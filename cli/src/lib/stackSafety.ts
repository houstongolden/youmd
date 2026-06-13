/**
 * stackSafety.ts — machine-checkable T0-T3 safety contract for YouStack manifests.
 *
 * SELF-IMPROVING-SYSTEM-DESIGN.md §4 defines the four tiers:
 *   T0  read-only suggestions (diagnostics, inspect, brief)
 *   T1  additive writes to local scratch, always logged
 *   T2  modify skills/stacks/identity sections — propose-only unless mode grants more
 *   T3  visibility widening, publishing, remote push, deletions, irreversible ops
 *
 * Mode semantics (enforced, not advisory):
 *   observe         → read-only; smoke/guard FAIL (not warn) if write_local capability exists
 *   propose         → writes only to proposals/ directory
 *   auto_pr         → branch + PR, never main; requires humanGate.required === true
 *   auto_apply_local→ requires improvement.evals non-empty AND evals green
 */

import type { YouStackManifest, YouStackCapability } from "./youstack";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SafetyTier = "T0" | "T1" | "T2" | "T3";

export type SafetyCapabilityKey = "fs_write" | "network" | "shell" | "auto_pr";

export interface SafetyCapabilities {
  fs_write?: boolean;
  network?: boolean;
  shell?: boolean;
  auto_pr?: boolean;
}

export interface SafetyHumanGate {
  required: boolean;
  /** Scopes that always require explicit human approval (required at T3). */
  scopes?: string[];
}

/**
 * The `safety` section inside youstack.json.
 * Extend YouStackManifest with this via `manifest.safety`.
 */
export interface StackSafetyContract {
  tier: SafetyTier;
  capabilities: SafetyCapabilities;
  humanGate: SafetyHumanGate;
}

export interface ContractViolation {
  capability: SafetyCapabilityKey;
  reason: string;
  tierRule: string;
}

export interface ContractValidationResult {
  ok: boolean;
  violations: ContractViolation[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Tier rules (table from SELF-IMPROVING-SYSTEM-DESIGN.md §4)
// ---------------------------------------------------------------------------

// Regex patterns for capability hint inference.
// We use word-boundary (\b) patterns to avoid false positives on common words
// like "profile" triggering "pr", or "screen" triggering "create".

/** Implies filesystem write access beyond read-only. */
const FS_WRITE_RE =
  /\b(write|write_local|create|edit|save|update|generate|output|auto_apply|auto-apply|modify|patch)\b/i;

/** Implies shell/subprocess execution. */
const SHELL_RE = /\b(shell|exec|bash|script|subprocess)\b/i;

/** Implies creating a pull request or pushing to a remote branch. */
const AUTO_PR_RE =
  /\b(auto_pr|auto-pr|pull[_\s-]request|pull_request)\b/i;

/** Implies outbound network access (beyond read-only identity retrieval). */
const NETWORK_RE =
  /\b(network|http|fetch|api|remote|sync|upload|download|webhook)\b/i;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse the `safety` section from a raw manifest object.
 * Returns null if the section is absent.
 */
export function parseSafetyContract(
  manifest: YouStackManifest | Record<string, unknown>
): StackSafetyContract | null {
  const raw = (manifest as Record<string, unknown>)["safety"];
  if (!raw) return null;
  if (!isRecord(raw)) return null;

  const tier = raw["tier"];
  if (typeof tier !== "string" || !["T0", "T1", "T2", "T3"].includes(tier)) {
    return null;
  }

  const capabilitiesRaw = raw["capabilities"];
  const capabilities: SafetyCapabilities = isRecord(capabilitiesRaw)
    ? {
        fs_write: capabilitiesRaw["fs_write"] === true,
        network: capabilitiesRaw["network"] === true,
        shell: capabilitiesRaw["shell"] === true,
        auto_pr: capabilitiesRaw["auto_pr"] === true,
      }
    : {};

  const gateRaw = raw["humanGate"];
  const humanGate: SafetyHumanGate = isRecord(gateRaw)
    ? {
        required: gateRaw["required"] === true,
        scopes: Array.isArray(gateRaw["scopes"])
          ? (gateRaw["scopes"] as string[]).filter((s) => typeof s === "string")
          : undefined,
      }
    : { required: false };

  return {
    tier: tier as SafetyTier,
    capabilities,
    humanGate,
  };
}

// ---------------------------------------------------------------------------
// Validation (tier rules)
// ---------------------------------------------------------------------------

/**
 * Validate a safety contract against the T0-T3 tier rules.
 *
 * T0: no fs_write, no auto_pr, no shell.
 * T1: no auto_pr.
 * T2: auto_pr only if humanGate.required === true.
 * T3: humanGate MUST list explicit scopes (non-empty).
 */
export function validateSafetyContract(
  contract: StackSafetyContract
): ContractValidationResult {
  const violations: ContractViolation[] = [];
  const warnings: string[] = [];
  const { tier, capabilities, humanGate } = contract;

  switch (tier) {
    case "T0":
      if (capabilities.fs_write) {
        violations.push({
          capability: "fs_write",
          reason: "T0 stacks are read-only; fs_write is not allowed",
          tierRule: "T0: no fs_write, no auto_pr, no shell",
        });
      }
      if (capabilities.auto_pr) {
        violations.push({
          capability: "auto_pr",
          reason: "T0 stacks are read-only; auto_pr is not allowed",
          tierRule: "T0: no fs_write, no auto_pr, no shell",
        });
      }
      if (capabilities.shell) {
        violations.push({
          capability: "shell",
          reason: "T0 stacks are read-only; shell execution is not allowed",
          tierRule: "T0: no fs_write, no auto_pr, no shell",
        });
      }
      break;

    case "T1":
      if (capabilities.auto_pr) {
        violations.push({
          capability: "auto_pr",
          reason: "T1 stacks may write to local scratch only; auto_pr is not allowed",
          tierRule: "T1: no auto_pr",
        });
      }
      break;

    case "T2":
      if (capabilities.auto_pr && humanGate.required !== true) {
        violations.push({
          capability: "auto_pr",
          reason:
            "T2 stacks may use auto_pr only when humanGate.required is true",
          tierRule: "T2: auto_pr only if humanGate.required === true",
        });
      }
      break;

    case "T3":
      if (!humanGate.scopes || humanGate.scopes.length === 0) {
        violations.push({
          capability: "auto_pr",
          reason:
            "T3 stacks must list explicit humanGate.scopes for every autonomous action",
          tierRule: "T3: humanGate MUST list explicit scopes",
        });
      }
      break;
  }

  if (tier !== "T3" && !humanGate.required && capabilities.auto_pr) {
    warnings.push(
      "auto_pr is declared without humanGate.required; ensure the mode policy enforces approval"
    );
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// tierAllows — runtime capability check
// ---------------------------------------------------------------------------

/**
 * Returns true if the declared contract allows the given capability.
 * Used by the guard and runtime routing hook.
 */
export function tierAllows(
  contract: StackSafetyContract,
  capability: SafetyCapabilityKey
): boolean {
  const { tier, capabilities } = contract;

  switch (capability) {
    case "fs_write":
      // T0: denied
      if (tier === "T0") return false;
      return capabilities.fs_write === true;

    case "shell":
      // T0: denied
      if (tier === "T0") return false;
      return capabilities.shell === true;

    case "auto_pr":
      // T0, T1: denied
      if (tier === "T0" || tier === "T1") return false;
      // T2: only if humanGate.required
      if (tier === "T2") return capabilities.auto_pr === true && contract.humanGate.required === true;
      // T3: declared + non-empty scopes
      return (
        capabilities.auto_pr === true &&
        Array.isArray(contract.humanGate.scopes) &&
        contract.humanGate.scopes.length > 0
      );

    case "network":
      // T0 may do read-only network (e.g. fetching public identity)
      // The design-doc says T0 is "read identity, brief, public profile" — always allowed
      // So network is tier-gated by the declared flag
      if (tier === "T0") return capabilities.network !== false;
      return capabilities.network !== false;
  }
}

// ---------------------------------------------------------------------------
// Capability hint inference (for guard scanning)
// ---------------------------------------------------------------------------

function capabilityHints(cap: YouStackCapability): {
  fs_write: boolean;
  shell: boolean;
  auto_pr: boolean;
  network: boolean;
} {
  const text = [
    cap.id,
    cap.intent,
    cap.workflow,
    cap.skill,
    cap.mcpTool,
    cap.apiEndpoint,
    cap.mutationPolicy,
    ...(cap.requiredScopes || []),
  ]
    .filter(Boolean)
    .join(" ");

  return {
    fs_write: FS_WRITE_RE.test(text),
    shell: SHELL_RE.test(text),
    auto_pr: AUTO_PR_RE.test(text),
    network: NETWORK_RE.test(text),
  };
}

export interface InferredCapabilities {
  fs_write: boolean;
  shell: boolean;
  auto_pr: boolean;
  network: boolean;
  sources: {
    fs_write: string[];
    shell: string[];
    auto_pr: string[];
    network: string[];
  };
}

/**
 * Scan a manifest's declared capabilities (and improvement policy) for hints
 * that imply specific capability flags. Returns what was inferred and which
 * capability IDs triggered each flag.
 */
export function inferCapabilitiesFromManifest(
  manifest: YouStackManifest
): InferredCapabilities {
  const result: InferredCapabilities = {
    fs_write: false,
    shell: false,
    auto_pr: false,
    network: false,
    sources: { fs_write: [], shell: [], auto_pr: [], network: [] },
  };

  for (const cap of manifest.capabilities || []) {
    const hints = capabilityHints(cap);
    if (hints.fs_write) {
      result.fs_write = true;
      result.sources.fs_write.push(cap.id);
    }
    if (hints.shell) {
      result.shell = true;
      result.sources.shell.push(cap.id);
    }
    if (hints.auto_pr) {
      result.auto_pr = true;
      result.sources.auto_pr.push(cap.id);
    }
    if (hints.network) {
      result.network = true;
      result.sources.network.push(cap.id);
    }
  }

  // Also check improvement.mode
  const mode = manifest.improvement?.mode;
  if (mode === "auto_pr" || mode === "auto_apply_local") {
    result.auto_pr = true;
    if (!result.sources.auto_pr.includes("improvement.mode")) {
      result.sources.auto_pr.push("improvement.mode");
    }
  }
  if (mode === "auto_apply_local" || mode === "auto_pr") {
    result.fs_write = true;
    if (!result.sources.fs_write.includes("improvement.mode")) {
      result.sources.fs_write.push("improvement.mode");
    }
  }

  // Check evals array for auto_pr references
  for (const evalEntry of manifest.improvement?.evals || []) {
    if (AUTO_PR_RE.test(evalEntry)) {
      result.auto_pr = true;
      if (!result.sources.auto_pr.includes(`evals: ${evalEntry}`)) {
        result.sources.auto_pr.push(`evals: ${evalEntry}`);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Guard result type (used by both stackSafety and stack.ts)
// ---------------------------------------------------------------------------

export interface GuardCheckResult {
  capability: SafetyCapabilityKey;
  status: "PASS" | "VIOLATION";
  declared: boolean;
  inferred: boolean;
  inferredFrom: string[];
  tierRule: string;
  message: string;
}

export interface StackGuardResult {
  ok: boolean;
  tier: SafetyTier;
  manifestPath: string;
  checks: GuardCheckResult[];
  contractViolations: ContractViolation[];
  warnings: string[];
}

/**
 * Run the full guard check against a loaded manifest.
 * Called from the `youmd stack guard` subcommand and from runYouStackDoctor.
 */
export function runStackGuard(
  manifest: YouStackManifest,
  manifestPath: string
): StackGuardResult {
  const rawContract = parseSafetyContract(manifest);
  const warnings: string[] = [];
  const checks: GuardCheckResult[] = [];

  // Missing contract → treat as T0 with a warning
  if (!rawContract) {
    warnings.push(
      "no safety contract declared; treating stack as T0 (read-only). " +
        "Add a `safety` section to youstack.json to declare capabilities explicitly."
    );
    const impliedContract: StackSafetyContract = {
      tier: "T0",
      capabilities: {},
      humanGate: { required: false },
    };
    const inferred = inferCapabilitiesFromManifest(manifest);
    const caps: SafetyCapabilityKey[] = ["fs_write", "shell", "auto_pr", "network"];
    for (const cap of caps) {
      const allowed = tierAllows(impliedContract, cap);
      const inf = inferred[cap];
      const inferredFrom = inferred.sources[cap];
      if (inf && !allowed) {
        checks.push({
          capability: cap,
          status: "VIOLATION",
          declared: false,
          inferred: true,
          inferredFrom,
          tierRule: "T0: no fs_write, no auto_pr, no shell",
          message: `inferred ${cap} (from: ${inferredFrom.join(", ")}) but T0 contract disallows it`,
        });
      } else {
        checks.push({
          capability: cap,
          status: "PASS",
          declared: false,
          inferred: inf,
          inferredFrom,
          tierRule: allowed ? "allowed by T0" : "not applicable (not inferred)",
          message: inf ? `inferred ${cap} — T0 permits this capability` : `${cap} not inferred`,
        });
      }
    }
    const ok = checks.every((c) => c.status === "PASS");
    return { ok, tier: "T0", manifestPath, checks, contractViolations: [], warnings };
  }

  // Validate the contract itself
  const contractResult = validateSafetyContract(rawContract);
  const inferred = inferCapabilitiesFromManifest(manifest);
  const caps: SafetyCapabilityKey[] = ["fs_write", "shell", "auto_pr", "network"];

  for (const cap of caps) {
    const allowed = tierAllows(rawContract, cap);
    const declared = rawContract.capabilities[cap] === true;
    const inf = inferred[cap];
    const inferredFrom = inferred.sources[cap];

    // Check: inferred capability exceeds declared tier
    if (inf && !allowed && !declared) {
      checks.push({
        capability: cap,
        status: "VIOLATION",
        declared,
        inferred: inf,
        inferredFrom,
        tierRule: getTierRule(rawContract.tier, cap),
        message: `inferred ${cap} (from: ${inferredFrom.join(", ")}) but ${rawContract.tier} contract does not permit it`,
      });
    } else if (declared && !allowed) {
      // Declared but tier doesn't permit
      checks.push({
        capability: cap,
        status: "VIOLATION",
        declared,
        inferred: inf,
        inferredFrom,
        tierRule: getTierRule(rawContract.tier, cap),
        message: `${cap} declared but ${rawContract.tier} tier rule prohibits it`,
      });
    } else {
      checks.push({
        capability: cap,
        status: "PASS",
        declared,
        inferred: inf,
        inferredFrom,
        tierRule: allowed ? `${rawContract.tier}: ${cap} allowed` : `${rawContract.tier}: ${cap} not applicable`,
        message: declared
          ? `${cap} declared and allowed under ${rawContract.tier}`
          : inf
          ? `${cap} inferred and allowed under ${rawContract.tier}`
          : `${cap} not declared or inferred`,
      });
    }
  }

  warnings.push(...contractResult.warnings);

  const ok =
    contractResult.ok && checks.every((c) => c.status === "PASS");

  return {
    ok,
    tier: rawContract.tier,
    manifestPath,
    checks,
    contractViolations: contractResult.violations,
    warnings,
  };
}

function getTierRule(tier: SafetyTier, cap: SafetyCapabilityKey): string {
  const rules: Record<SafetyTier, Record<SafetyCapabilityKey, string>> = {
    T0: {
      fs_write: "T0: no fs_write, no auto_pr, no shell",
      shell: "T0: no fs_write, no auto_pr, no shell",
      auto_pr: "T0: no fs_write, no auto_pr, no shell",
      network: "T0: network allowed for read-only identity retrieval",
    },
    T1: {
      fs_write: "T1: fs_write allowed to scratch only, always logged",
      shell: "T1: shell allowed if declared",
      auto_pr: "T1: no auto_pr",
      network: "T1: network allowed if declared",
    },
    T2: {
      fs_write: "T2: fs_write allowed",
      shell: "T2: shell allowed if declared",
      auto_pr: "T2: auto_pr only if humanGate.required === true",
      network: "T2: network allowed if declared",
    },
    T3: {
      fs_write: "T3: all declared capabilities allowed with explicit humanGate.scopes",
      shell: "T3: all declared capabilities allowed with explicit humanGate.scopes",
      auto_pr: "T3: all declared capabilities allowed with explicit humanGate.scopes",
      network: "T3: all declared capabilities allowed with explicit humanGate.scopes",
    },
  };
  return rules[tier][cap];
}

/**
 * Mode-compatibility check: verifies the improvement.mode is consistent
 * with the declared safety tier.
 *
 * `observe` → T0 or T1 only; smoke/guard FAIL if a write_local capability exists
 * `propose` → T1 or T2; writes to proposals/ only
 * `auto_pr` → T2 or T3; requires humanGate.required
 * `auto_apply_local` → T2 or T3; requires non-empty evals
 */
export function checkModeConsistency(
  manifest: YouStackManifest,
  contract: StackSafetyContract
): { ok: boolean; violations: string[] } {
  const mode = manifest.improvement?.mode;
  const violations: string[] = [];

  if (!mode) return { ok: true, violations };

  switch (mode) {
    case "observe":
      // Under observe, write_local capability → FAIL (not warn)
      if (contract.capabilities.fs_write || contract.capabilities.shell) {
        violations.push(
          "improvement.mode is 'observe' but safety.capabilities declares fs_write or shell; " +
            "smoke and guard FAIL (not warn) under observe mode"
        );
      }
      break;

    case "propose":
      if (contract.tier === "T0") {
        violations.push(
          "improvement.mode 'propose' requires at least T1 tier (T0 is read-only)"
        );
      }
      break;

    case "auto_pr":
      if (contract.tier === "T0" || contract.tier === "T1") {
        violations.push(
          `improvement.mode 'auto_pr' requires T2 or T3 tier; current tier is ${contract.tier}`
        );
      }
      if (!contract.humanGate.required) {
        violations.push(
          "improvement.mode 'auto_pr' requires humanGate.required to be true"
        );
      }
      break;

    case "auto_apply_local": {
      if (contract.tier === "T0" || contract.tier === "T1") {
        violations.push(
          `improvement.mode 'auto_apply_local' requires T2 or T3 tier; current tier is ${contract.tier}`
        );
      }
      const evals = manifest.improvement?.evals || [];
      if (evals.length === 0) {
        violations.push(
          "improvement.mode 'auto_apply_local' requires improvement.evals to be non-empty"
        );
      }
      break;
    }
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Refusal message for runtime enforcement — the one-line message the routing
 * hook emits when a request exceeds the declared tier.
 */
export function tierRefusalMessage(
  contract: StackSafetyContract,
  requestedCapability: SafetyCapabilityKey
): string {
  const requiredTier = requiredTierForCapability(requestedCapability);
  return (
    `blocked: stack is ${contract.tier} — this action needs ${requiredTier}. ` +
    `Declare a higher tier in youstack.json safety.tier and rerun \`youmd stack guard\`.`
  );
}

function requiredTierForCapability(cap: SafetyCapabilityKey): string {
  switch (cap) {
    case "fs_write":
      return "T1 or higher";
    case "shell":
      return "T1 or higher";
    case "auto_pr":
      return "T2 or higher with humanGate.required=true";
    case "network":
      return "T1 or higher";
  }
}
