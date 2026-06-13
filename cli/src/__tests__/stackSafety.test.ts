import { describe, expect, it } from "vitest";
import {
  parseSafetyContract,
  validateSafetyContract,
  tierAllows,
  inferCapabilitiesFromManifest,
  runStackGuard,
  checkModeConsistency,
  tierRefusalMessage,
  type StackSafetyContract,
} from "../lib/stackSafety";
import type { YouStackManifest } from "../lib/youstack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(extra: Partial<YouStackManifest> = {}): YouStackManifest {
  return {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "test-stack",
    name: "Test Stack",
    version: "0.1.0",
    visibility: "private",
    ...extra,
  } as YouStackManifest;
}

function makeContract(
  tier: StackSafetyContract["tier"],
  caps: StackSafetyContract["capabilities"] = {},
  gate: StackSafetyContract["humanGate"] = { required: false }
): StackSafetyContract {
  return { tier, capabilities: caps, humanGate: gate };
}

// ---------------------------------------------------------------------------
// parseSafetyContract
// ---------------------------------------------------------------------------

describe("parseSafetyContract", () => {
  it("returns null when safety section is absent", () => {
    const manifest = makeManifest();
    expect(parseSafetyContract(manifest)).toBeNull();
  });

  it("returns null for invalid tier value", () => {
    const manifest = makeManifest({ safety: { tier: "T9" as "T0", capabilities: {}, humanGate: { required: false } } });
    expect(parseSafetyContract(manifest)).toBeNull();
  });

  it("parses a valid T0 contract", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: { network: true }, humanGate: { required: false } },
    });
    const contract = parseSafetyContract(manifest);
    expect(contract).not.toBeNull();
    expect(contract?.tier).toBe("T0");
    expect(contract?.capabilities.network).toBe(true);
    expect(contract?.capabilities.fs_write).toBe(false);
    expect(contract?.humanGate.required).toBe(false);
  });

  it("parses a valid T3 contract with scopes", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T3",
        capabilities: { fs_write: true, network: true, shell: true, auto_pr: true },
        humanGate: { required: true, scopes: ["publish", "delete"] },
      },
    });
    const contract = parseSafetyContract(manifest);
    expect(contract?.tier).toBe("T3");
    expect(contract?.capabilities.auto_pr).toBe(true);
    expect(contract?.humanGate.scopes).toEqual(["publish", "delete"]);
  });
});

// ---------------------------------------------------------------------------
// validateSafetyContract — per-tier matrix
// ---------------------------------------------------------------------------

describe("validateSafetyContract", () => {
  describe("T0 — read-only", () => {
    it("passes with no capabilities declared", () => {
      const result = validateSafetyContract(makeContract("T0"));
      expect(result.ok).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("passes with only network declared", () => {
      const result = validateSafetyContract(makeContract("T0", { network: true }));
      expect(result.ok).toBe(true);
    });

    it("violates when fs_write is declared", () => {
      const result = validateSafetyContract(makeContract("T0", { fs_write: true }));
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.capability === "fs_write")).toBe(true);
    });

    it("violates when auto_pr is declared", () => {
      const result = validateSafetyContract(makeContract("T0", { auto_pr: true }));
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.capability === "auto_pr")).toBe(true);
    });

    it("violates when shell is declared", () => {
      const result = validateSafetyContract(makeContract("T0", { shell: true }));
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.capability === "shell")).toBe(true);
    });

    it("reports all three violations at once", () => {
      const result = validateSafetyContract(
        makeContract("T0", { fs_write: true, auto_pr: true, shell: true })
      );
      expect(result.ok).toBe(false);
      expect(result.violations).toHaveLength(3);
    });
  });

  describe("T1 — suggest-only with disk writes to scratch", () => {
    it("passes with fs_write and shell declared", () => {
      const result = validateSafetyContract(makeContract("T1", { fs_write: true, shell: true }));
      expect(result.ok).toBe(true);
    });

    it("violates when auto_pr is declared", () => {
      const result = validateSafetyContract(makeContract("T1", { auto_pr: true }));
      expect(result.ok).toBe(false);
      expect(result.violations[0].capability).toBe("auto_pr");
    });
  });

  describe("T2 — supervised actions", () => {
    it("passes without auto_pr", () => {
      const result = validateSafetyContract(makeContract("T2", { fs_write: true }));
      expect(result.ok).toBe(true);
    });

    it("passes with auto_pr when humanGate.required is true", () => {
      const result = validateSafetyContract(
        makeContract("T2", { auto_pr: true }, { required: true })
      );
      expect(result.ok).toBe(true);
    });

    it("violates when auto_pr is declared without humanGate.required", () => {
      const result = validateSafetyContract(
        makeContract("T2", { auto_pr: true }, { required: false })
      );
      expect(result.ok).toBe(false);
      expect(result.violations[0].capability).toBe("auto_pr");
    });
  });

  describe("T3 — autonomous", () => {
    it("passes with auto_pr and explicit scopes", () => {
      const result = validateSafetyContract(
        makeContract(
          "T3",
          { auto_pr: true, fs_write: true },
          { required: true, scopes: ["publish", "delete"] }
        )
      );
      expect(result.ok).toBe(true);
    });

    it("violates when humanGate.scopes is empty", () => {
      const result = validateSafetyContract(
        makeContract("T3", { auto_pr: true }, { required: true, scopes: [] })
      );
      expect(result.ok).toBe(false);
      expect(result.violations[0].tierRule).toMatch(/T3/);
    });

    it("violates when humanGate.scopes is absent", () => {
      const result = validateSafetyContract(
        makeContract("T3", { auto_pr: true }, { required: true })
      );
      expect(result.ok).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// tierAllows
// ---------------------------------------------------------------------------

describe("tierAllows", () => {
  it("T0 denies fs_write regardless of declared flag", () => {
    expect(tierAllows(makeContract("T0", { fs_write: true }), "fs_write")).toBe(false);
  });

  it("T0 denies shell", () => {
    expect(tierAllows(makeContract("T0", { shell: true }), "shell")).toBe(false);
  });

  it("T0 denies auto_pr", () => {
    expect(tierAllows(makeContract("T0", { auto_pr: true }), "auto_pr")).toBe(false);
  });

  it("T0 allows network (read-only identity retrieval)", () => {
    expect(tierAllows(makeContract("T0", { network: true }), "network")).toBe(true);
  });

  it("T1 allows fs_write when declared", () => {
    expect(tierAllows(makeContract("T1", { fs_write: true }), "fs_write")).toBe(true);
  });

  it("T1 denies auto_pr even when declared", () => {
    expect(tierAllows(makeContract("T1", { auto_pr: true }), "auto_pr")).toBe(false);
  });

  it("T2 allows auto_pr only when humanGate.required is true", () => {
    expect(
      tierAllows(makeContract("T2", { auto_pr: true }, { required: true }), "auto_pr")
    ).toBe(true);
    expect(
      tierAllows(makeContract("T2", { auto_pr: true }, { required: false }), "auto_pr")
    ).toBe(false);
  });

  it("T3 allows auto_pr with non-empty scopes", () => {
    expect(
      tierAllows(
        makeContract("T3", { auto_pr: true }, { required: true, scopes: ["publish"] }),
        "auto_pr"
      )
    ).toBe(true);
  });

  it("T3 denies auto_pr without scopes", () => {
    expect(
      tierAllows(makeContract("T3", { auto_pr: true }, { required: true }), "auto_pr")
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inferCapabilitiesFromManifest
// ---------------------------------------------------------------------------

describe("inferCapabilitiesFromManifest", () => {
  it("infers fs_write from write_local mutationPolicy", () => {
    const manifest = makeManifest({
      capabilities: [
        {
          id: "stack.improve",
          intent: "improve skills",
          mutationPolicy: "write_local",
          localOnly: true,
        },
      ],
    });
    const inferred = inferCapabilitiesFromManifest(manifest);
    expect(inferred.fs_write).toBe(true);
    expect(inferred.sources.fs_write).toContain("stack.improve");
  });

  it("infers auto_pr from improvement.mode auto_pr", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_pr" },
    });
    const inferred = inferCapabilitiesFromManifest(manifest);
    expect(inferred.auto_pr).toBe(true);
    expect(inferred.sources.auto_pr).toContain("improvement.mode");
  });

  it("infers auto_pr from improvement.mode auto_apply_local", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_apply_local" },
    });
    const inferred = inferCapabilitiesFromManifest(manifest);
    expect(inferred.auto_pr).toBe(true);
    expect(inferred.fs_write).toBe(true);
  });

  it("infers shell from shell hint in capability id", () => {
    const manifest = makeManifest({
      capabilities: [
        {
          id: "run-shell-script",
          intent: "execute a shell command",
          localOnly: true,
        },
      ],
    });
    const inferred = inferCapabilitiesFromManifest(manifest);
    expect(inferred.shell).toBe(true);
  });

  it("returns no inferences for a pure read-only manifest", () => {
    const manifest = makeManifest({
      capabilities: [
        {
          id: "inspect",
          intent: "inspect the manifest read-only",
          mutationPolicy: "read_only",
          localOnly: true,
        },
      ],
    });
    const inferred = inferCapabilitiesFromManifest(manifest);
    expect(inferred.fs_write).toBe(false);
    expect(inferred.shell).toBe(false);
    expect(inferred.auto_pr).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runStackGuard — fixture stacks
// ---------------------------------------------------------------------------

describe("runStackGuard", () => {
  it("passes for a clean T0 manifest with no write capabilities", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: { network: true }, humanGate: { required: false } },
      capabilities: [
        { id: "read-identity", intent: "read public profile", mutationPolicy: "read_only", localOnly: true },
      ],
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("T0");
    expect(result.checks.every((c) => c.status === "PASS")).toBe(true);
  });

  it("detects VIOLATION when T0 stack has auto_pr capability inferred from improvement.mode", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: {}, humanGate: { required: false } },
      improvement: { mode: "auto_pr" },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
    const violation = result.checks.find((c) => c.capability === "auto_pr" && c.status === "VIOLATION");
    expect(violation).toBeDefined();
    expect(violation?.inferredFrom).toContain("improvement.mode");
  });

  it("treats missing contract as T0 with a warning", () => {
    const manifest = makeManifest(); // no safety section
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.tier).toBe("T0");
    expect(result.warnings.some((w) => w.includes("no safety contract"))).toBe(true);
  });

  it("passes for a T2 stack with auto_pr and humanGate.required", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T2",
        capabilities: { fs_write: true, auto_pr: true },
        humanGate: { required: true },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
    expect(result.contractViolations).toHaveLength(0);
  });

  it("reports VIOLATION when T2 stack declares auto_pr without humanGate.required", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T2",
        capabilities: { fs_write: true, auto_pr: true },
        humanGate: { required: false },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
    expect(result.contractViolations.some((v) => v.capability === "auto_pr")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkModeConsistency
// ---------------------------------------------------------------------------

describe("checkModeConsistency", () => {
  it("observe mode with fs_write capability → violation", () => {
    const manifest = makeManifest({ improvement: { mode: "observe" } });
    const contract = makeContract("T0", { fs_write: true });
    const result = checkModeConsistency(manifest, contract);
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/observe/);
  });

  it("auto_pr mode without humanGate.required → violation", () => {
    const manifest = makeManifest({ improvement: { mode: "auto_pr" } });
    const contract = makeContract("T2", { auto_pr: true }, { required: false });
    const result = checkModeConsistency(manifest, contract);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("humanGate.required"))).toBe(true);
  });

  it("auto_apply_local without evals → violation", () => {
    const manifest = makeManifest({ improvement: { mode: "auto_apply_local", evals: [] } });
    const contract = makeContract("T2", { fs_write: true }, { required: true });
    const result = checkModeConsistency(manifest, contract);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("evals"))).toBe(true);
  });

  it("auto_apply_local with non-empty evals → passes", () => {
    const manifest = makeManifest({
      improvement: { mode: "auto_apply_local", evals: ["youmd stack eval"] },
    });
    const contract = makeContract("T2", { fs_write: true }, { required: true });
    const result = checkModeConsistency(manifest, contract);
    expect(result.ok).toBe(true);
  });

  it("no mode → always ok", () => {
    const manifest = makeManifest();
    const contract = makeContract("T0");
    const result = checkModeConsistency(manifest, contract);
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// tierRefusalMessage
// ---------------------------------------------------------------------------

describe("tierRefusalMessage", () => {
  it("produces a one-line blocked message mentioning the tier", () => {
    const contract = makeContract("T1", {}, { required: false });
    const msg = tierRefusalMessage(contract, "auto_pr");
    expect(msg).toContain("blocked");
    expect(msg).toContain("T1");
    expect(msg).toContain("T2 or higher");
  });

  it("mentions the stack tier for T0 refusing fs_write", () => {
    const contract = makeContract("T0");
    const msg = tierRefusalMessage(contract, "fs_write");
    expect(msg).toContain("T0");
    expect(msg).toContain("T1 or higher");
  });
});
