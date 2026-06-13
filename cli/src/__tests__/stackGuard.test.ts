import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  runStackGuard,
  parseSafetyContract,
  type StackSafetyContract,
} from "../lib/stackSafety";
import {
  checkTierAllows,
  runYouStackDoctor,
  loadYouStackManifest,
} from "../lib/youstack";
import type { YouStackManifest } from "../lib/youstack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-guard-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeManifest(extra: Partial<YouStackManifest> = {}): YouStackManifest {
  return {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "guard-test",
    name: "Guard Test Stack",
    version: "0.1.0",
    visibility: "private",
    accessPolicy: { protectedByDefault: true },
    ...extra,
  } as YouStackManifest;
}

function writeManifestToDir(dir: string, manifest: Partial<YouStackManifest> = {}): string {
  const stackDir = path.join(dir, "stacks", "guard-test");
  fs.mkdirSync(stackDir, { recursive: true });
  const full = {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "guard-test",
    name: "Guard Test Stack",
    version: "0.1.0",
    visibility: "private",
    accessPolicy: { protectedByDefault: true },
    ...manifest,
  };
  const manifestPath = path.join(stackDir, "youstack.json");
  fs.writeFileSync(manifestPath, JSON.stringify(full, null, 2));
  return manifestPath;
}

// ---------------------------------------------------------------------------
// runStackGuard — fixture stacks
// ---------------------------------------------------------------------------

describe("runStackGuard — fixture stacks", () => {
  it("PASS: clean T0 stack with only read-only capabilities", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: { network: true }, humanGate: { required: false } },
      capabilities: [
        { id: "read-profile", intent: "read public profile", mutationPolicy: "read_only", localOnly: true },
      ],
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("T0");
    expect(result.checks.every((c) => c.status === "PASS")).toBe(true);
    expect(result.contractViolations).toHaveLength(0);
  });

  it("PASS: T1 stack with fs_write but no auto_pr", () => {
    const manifest = makeManifest({
      safety: { tier: "T1", capabilities: { fs_write: true, network: true }, humanGate: { required: false } },
      capabilities: [
        { id: "save-context", intent: "save project context to local scratch", mutationPolicy: "write_local", localOnly: true },
      ],
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
    expect(result.tier).toBe("T1");
  });

  it("VIOLATION: T0 stack with auto_pr inferred from improvement.mode", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: {}, humanGate: { required: false } },
      improvement: { mode: "auto_pr" },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
    const autoPrCheck = result.checks.find(
      (c) => c.capability === "auto_pr" && c.status === "VIOLATION"
    );
    expect(autoPrCheck).toBeDefined();
    expect(autoPrCheck?.inferred).toBe(true);
    expect(autoPrCheck?.inferredFrom).toContain("improvement.mode");
  });

  it("VIOLATION: T1 stack with auto_pr declared", () => {
    const manifest = makeManifest({
      safety: { tier: "T1", capabilities: { auto_pr: true }, humanGate: { required: false } },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
    expect(result.contractViolations.some((v) => v.capability === "auto_pr")).toBe(true);
  });

  it("PASS: T2 stack with auto_pr and humanGate.required=true", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T2",
        capabilities: { fs_write: true, auto_pr: true },
        humanGate: { required: true },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
  });

  it("VIOLATION: T2 stack with auto_pr but humanGate.required=false", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T2",
        capabilities: { fs_write: true, auto_pr: true },
        humanGate: { required: false },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
  });

  it("PASS: T3 stack with explicit humanGate.scopes", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T3",
        capabilities: { fs_write: true, network: true, shell: true, auto_pr: true },
        humanGate: { required: true, scopes: ["publish", "delete", "push"] },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
  });

  it("VIOLATION: T3 stack with empty humanGate.scopes", () => {
    const manifest = makeManifest({
      safety: {
        tier: "T3",
        capabilities: { auto_pr: true },
        humanGate: { required: true, scopes: [] },
      },
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runStackGuard — missing contract (T0 default)
// ---------------------------------------------------------------------------

describe("runStackGuard — missing safety contract", () => {
  it("treats missing contract as T0 and emits a warning", () => {
    const manifest = makeManifest(); // no safety section
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.tier).toBe("T0");
    expect(result.warnings.some((w) => w.includes("no safety contract"))).toBe(true);
  });

  it("passes if no write capabilities are inferred in the missing-contract case", () => {
    const manifest = makeManifest({
      capabilities: [
        { id: "read-only", intent: "read stuff", mutationPolicy: "read_only", localOnly: true },
      ],
    });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    expect(result.ok).toBe(true);
  });

  it("fails if write capabilities are inferred without a contract (defaults T0 = no writes)", () => {
    const manifest = makeManifest({ improvement: { mode: "auto_apply_local" } });
    const result = runStackGuard(manifest, "/fake/youstack.json");
    // auto_apply_local infers auto_pr + fs_write → both violate T0
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Doctor surfacing of guard results
// ---------------------------------------------------------------------------

describe("runYouStackDoctor — guard surfacing", () => {
  it("includes guard in doctor result", () => {
    const manifestPath = writeManifestToDir(tmpDir, {
      safety: { tier: "T0", capabilities: { network: true }, humanGate: { required: false } },
    });
    const loaded = loadYouStackManifest(manifestPath);
    const doctorResult = runYouStackDoctor(loaded);
    expect(doctorResult.guard).toBeDefined();
    expect(doctorResult.guard?.tier).toBe("T0");
  });

  it("doctor ok=false when guard detects a contract violation", () => {
    const manifestPath = writeManifestToDir(tmpDir, {
      safety: {
        tier: "T0",
        capabilities: { auto_pr: true }, // T0 + auto_pr = violation
        humanGate: { required: false },
      },
    });
    const loaded = loadYouStackManifest(manifestPath);
    const doctorResult = runYouStackDoctor(loaded);
    expect(doctorResult.ok).toBe(false);
    expect(doctorResult.errors.some((e) => e.includes("guard"))).toBe(true);
  });

  it("doctor surfaces missing-contract warning", () => {
    // No safety section → T0 default with warning
    const manifestPath = writeManifestToDir(tmpDir, {});
    const loaded = loadYouStackManifest(manifestPath);
    const doctorResult = runYouStackDoctor(loaded);
    expect(doctorResult.warnings.some((w) => w.includes("guard"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkTierAllows — runtime enforcement hook
// ---------------------------------------------------------------------------

describe("checkTierAllows — runtime enforcement", () => {
  it("returns null (allow) for a T2 stack requesting fs_write", () => {
    const manifest = makeManifest({
      safety: { tier: "T2", capabilities: { fs_write: true }, humanGate: { required: false } },
    });
    const result = checkTierAllows(manifest, "fs_write");
    expect(result).toBeNull();
  });

  it("returns a refusal string for a T1 stack requesting auto_pr", () => {
    const manifest = makeManifest({
      safety: { tier: "T1", capabilities: { fs_write: true }, humanGate: { required: false } },
    });
    const result = checkTierAllows(manifest, "auto_pr");
    expect(typeof result).toBe("string");
    expect(result).toContain("blocked");
    expect(result).toContain("T1");
  });

  it("returns a refusal string for a T0 stack requesting fs_write", () => {
    const manifest = makeManifest({
      safety: { tier: "T0", capabilities: {}, humanGate: { required: false } },
    });
    const result = checkTierAllows(manifest, "fs_write");
    expect(result).toContain("blocked");
    expect(result).toContain("T0");
  });

  it("returns a refusal string with 'no safety contract' when contract is missing and write is requested", () => {
    const manifest = makeManifest(); // no safety section
    const result = checkTierAllows(manifest, "fs_write");
    expect(typeof result).toBe("string");
    expect(result).toContain("no safety contract");
  });

  it("returns null for network on a T0 stack with no contract", () => {
    const manifest = makeManifest(); // no safety section
    const result = checkTierAllows(manifest, "network");
    expect(result).toBeNull();
  });
});
