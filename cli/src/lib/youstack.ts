import * as crypto from "crypto";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import {
  buildHostLinkPlan,
  HostSkillUnit,
  hostLinkRelativePath,
  SkillDiscoveryCheck,
  SkillDiscoveryReport,
  verifySkillDiscovery,
  writeHostLinkPlan,
  youStackHostAdapterConfig,
} from "./host-link";
import {
  runStackGuard,
  parseSafetyContract,
  tierAllows,
  tierRefusalMessage,
  type StackGuardResult,
  type SafetyCapabilityKey,
} from "./stackSafety";

export type YouStackVisibility = "private" | "scoped-link" | "public-open" | "team";

/**
 * Canonical API scope vocabulary — mirrors convex/lib/scopes.ts API_SCOPES.
 * P19 (2026-06-12): used by stack doctor to validate requiresScopes entries.
 */
export const KNOWN_API_SCOPES = [
  "read:public",
  "read:private",
  "write:bundle",
  "write:memories",
  "vault",
] as const;
export type ApiScope = (typeof KNOWN_API_SCOPES)[number];

export interface YouStackBrainScope {
  scope: string;
  required?: boolean;
  reason?: string;
}

export interface YouStackFile {
  path: string;
  type: string;
  required?: boolean;
  checksum?: string;
}

export interface YouStackCapability {
  id: string;
  intent?: string;
  workflow?: string;
  skill?: string;
  localOnly?: boolean;
  mcpTool?: string;
  apiEndpoint?: string;
  requiredScopes?: string[];
  mutationPolicy?: string;
}

export interface YouStackAdapter {
  files?: string[];
  bootstrap?: string;
}

export interface YouStackImprovementPolicy {
  mode?: "observe" | "propose" | "auto_pr" | "auto_apply_local";
  cadence?: string;
  signals?: string[];
  evals?: string[];
  appliesTo?: string[];
  approvalRequiredFor?: string[];
}

// ── L18: YouStack workflow entries ───────────────────────────────────────────
// An optional `workflows` array in the manifest declares scheduled or
// triggered automations.  The `schedule` field is a cron string (standard
// 5-field: "0 9 * * 1" = Monday 09:00).  Action types are intentionally
// limited to a safe, auditable set.

export type YouStackWorkflowActionType = "run_skill" | "report_skill_outcome";

export interface YouStackWorkflow {
  id: string;
  /** Standard 5-field cron expression. */
  schedule: string;
  action: YouStackWorkflowActionType;
  /** Free-form params forwarded to the action handler. */
  params?: Record<string, unknown>;
}

export interface YouStackUpdatePolicy {
  channel?: string;
  check?: string;
  source?: string;
  autoApply?: boolean;
  pin?: string;
}

export interface YouStackManifest {
  schemaVersion: "youstack/v1";
  kind: "youstack";
  id?: string;
  slug: string;
  name: string;
  domain?: string;
  aliases?: string[];
  tags?: string[];
  version: string;
  description?: string;
  owner?: Record<string, unknown>;
  visibility: YouStackVisibility;
  compatibility?: {
    hosts?: string[];
    minYoumdCli?: string;
    requiresYoumdApi?: boolean;
    requiresYoumdMcp?: boolean;
  };
  brainScopes?: YouStackBrainScope[];
  /**
   * P19 (2026-06-12): optional list of API scopes this stack requires.
   * Doctor validates each entry against KNOWN_API_SCOPES and warns on unknowns.
   */
  requiresScopes?: ApiScope[];
  files?: YouStackFile[];
  adapters?: Record<string, YouStackAdapter>;
  capabilities?: YouStackCapability[];
  accessPolicy?: Record<string, unknown>;
  sharing?: Record<string, unknown>;
  repoSync?: Record<string, unknown>;
  docs?: Record<string, unknown>;
  tests?: Record<string, unknown>;
  improvement?: YouStackImprovementPolicy;
  update?: YouStackUpdatePolicy;
  /** L18: optional scheduled workflow declarations. */
  workflows?: YouStackWorkflow[];
  provenance?: Record<string, unknown>;
  /** Machine-checkable safety contract (L16). */
  safety?: {
    tier: "T0" | "T1" | "T2" | "T3";
    capabilities: {
      fs_write?: boolean;
      network?: boolean;
      shell?: boolean;
      auto_pr?: boolean;
    };
    humanGate: {
      required: boolean;
      scopes?: string[];
    };
  };
}

export interface LoadedYouStack {
  manifest: YouStackManifest;
  manifestPath: string;
  rootDir: string;
  validation: YouStackValidationResult;
}

export interface YouStackValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface YouStackSmokeResult extends YouStackValidationResult {
  checks: string[];
}

export interface YouStackDoctorResult extends YouStackSmokeResult {
  diagnostics: string[];
  recommendations: string[];
  /**
   * Empirical Claude Code discovery gate: per-skill pass/fail for the
   * SKILL.md files this stack would emit for the claude-code host.
   */
  discovery: SkillDiscoveryCheck[];
  /**
   * L12 safety guard result — present when the manifest has a `safety`
   * section or when the guard detected inferred capability mismatches.
   * Missing contract is treated as T0 with a warning.
   */
  guard?: StackGuardResult;
}

export type YouStackReadinessStatus = "not_found" | "invalid" | "ready";

export interface YouStackReadiness {
  status: YouStackReadinessStatus;
  ready: boolean;
  reason: string;
}

export interface YouStackRouteResult {
  request: string;
  capability: YouStackCapability;
  score: number;
  reasons: string[];
  alternatives: Array<{ capability: YouStackCapability; score: number }>;
}

export interface YouStackLinkResult {
  host: string;
  targetPath: string;
  wrote: boolean;
  content: string;
}

const VALID_VISIBILITY = new Set<YouStackVisibility>([
  "private",
  "scoped-link",
  "public-open",
  "team",
]);

const SHELL_SAFE_IDENTIFIER_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const SINGLE_LINE_METADATA_RE = /^[^\r\n\t]+$/;

const BUILT_IN_CAPABILITIES: YouStackCapability[] = [
  {
    id: "manifest.inspect",
    intent: "inspect the local YouStack manifest",
    localOnly: true,
    mutationPolicy: "read_only",
  },
  {
    id: "manifest.smoke",
    intent: "run read-only local YouStack smoke validation",
    localOnly: true,
    mutationPolicy: "read_only",
  },
  {
    id: "stack.diagnose",
    intent: "run read-only stack health diagnostics for manifest bloat, capability routing, adapter drift, update hygiene, and public-readiness gaps",
    skill: "youstack-maintainer",
    localOnly: true,
    mutationPolicy: "read_only",
  },
  {
    id: "stack.improve",
    intent: "inspect usage signals, evals, failures, corrections, and repo diffs to improve stack skills and workflows",
    localOnly: true,
    mutationPolicy: "write_local",
  },
  {
    id: "stack.update",
    intent: "check the stack update channel and refresh allowed local skills, workflows, docs, prompts, evals, and adapter files",
    localOnly: true,
    mutationPolicy: "write_local",
  },
  {
    id: "stack.maintain",
    intent: "organize, deduplicate, improve, and self-update named YouStacks and their skills using the bundled youstack-maintainer skill",
    skill: "youstack-maintainer",
    localOnly: true,
    mutationPolicy: "write_local",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectString(
  obj: Record<string, unknown>,
  field: string,
  errors: string[],
  options: { exact?: string; optional?: boolean } = {}
): string | undefined {
  const value = obj[field];
  if (value === undefined || value === null) {
    if (!options.optional) errors.push(`missing required field: ${field}`);
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
    return undefined;
  }
  if (options.exact && value !== options.exact) {
    errors.push(`${field} must be ${options.exact}`);
  }
  return value;
}

function expectStringField(
  obj: Record<string, unknown>,
  field: string,
  label: string,
  errors: string[],
  options: { exact?: string; optional?: boolean } = {}
): string | undefined {
  const value = obj[field];
  if (value === undefined || value === null) {
    if (!options.optional) errors.push(`missing required field: ${label}`);
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string`);
    return undefined;
  }
  if (options.exact && value !== options.exact) {
    errors.push(`${label} must be ${options.exact}`);
  }
  return value;
}

function isSafeRelativePath(value: string): boolean {
  if (!value || path.isAbsolute(value) || value.startsWith("~")) return false;
  const parts = value.split(/[\\/]+/);
  return !parts.includes("..");
}

function validateOptionalStringArray(
  value: Record<string, unknown>,
  field: string,
  errors: string[]
): void {
  if (value[field] === undefined) return;
  if (!Array.isArray(value[field])) {
    errors.push(`${field} must be an array`);
    return;
  }
  for (const [index, item] of (value[field] as unknown[]).entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string`);
    }
  }
}

function isShellSafeIdentifier(value: string): boolean {
  return SHELL_SAFE_IDENTIFIER_RE.test(value);
}

function isSingleLineMetadata(value: string): boolean {
  return SINGLE_LINE_METADATA_RE.test(value);
}

function parseJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

/** Canonical layout: stacks/<slug>/youstack.json inside the user's repo/brain. */
const CANONICAL_STACKS_DIRNAME = "stacks";
/** Legacy layout (still readable): youstacks/<slug>/youstack.json. */
const LEGACY_STACKS_DIRNAME = "youstacks";

export function isCanonicalYouStackManifestPath(manifestPath: string): boolean {
  const resolved = path.resolve(manifestPath);
  if (path.basename(resolved) !== "youstack.json") return false;
  const slugDir = path.dirname(resolved);
  const stacksDir = path.dirname(slugDir);
  if (slugDir === stacksDir) return false;
  return path.basename(stacksDir) === CANONICAL_STACKS_DIRNAME;
}

function collectStacksDirManifests(
  dir: string,
  stacksDirName: string,
  candidates: string[]
): void {
  const stacksDir = path.join(dir, stacksDirName);
  if (!fs.existsSync(stacksDir) || !fs.statSync(stacksDir).isDirectory()) return;
  for (const entry of fs.readdirSync(stacksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(stacksDir, entry.name, "youstack.json");
    if (fs.existsSync(manifest) && fs.statSync(manifest).isFile()) {
      candidates.push(manifest);
    }
  }
}

export function findYouStackManifestCandidates(startDir: string): string[] {
  const candidates: string[] = [];
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const candidate of [
      path.join(dir, "youstack.json"),
      path.join(dir, ".you", "youstack.json"),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        candidates.push(candidate);
      }
    }

    // Canonical layout first-class: stacks/<slug>/youstack.json
    collectStacksDirManifests(dir, CANONICAL_STACKS_DIRNAME, candidates);
    // Legacy layout kept readable: youstacks/<slug>/youstack.json
    collectStacksDirManifests(dir, LEGACY_STACKS_DIRNAME, candidates);

    dir = path.dirname(dir);
  }

  return [...new Set(candidates)].sort(
    (a, b) =>
      Number(isCanonicalYouStackManifestPath(b)) -
        Number(isCanonicalYouStackManifestPath(a)) || a.localeCompare(b)
  );
}

export function resolveYouStackManifestPath(inputPath?: string): string {
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, "youstack.json");
    }
    return resolved;
  }

  const candidates = findYouStackManifestCandidates(process.cwd());
  if (candidates.length === 0) {
    throw new Error(
      "No youstack.json found. Create stacks/<slug>/youstack.json (canonical layout), run from a stack directory, or pass --path <manifest-or-dir>."
    );
  }

  return candidates[0];
}

export function validateYouStackManifest(value: unknown): YouStackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["manifest must be a JSON object"], warnings };
  }

  expectString(value, "schemaVersion", errors, { exact: "youstack/v1" });
  expectString(value, "kind", errors, { exact: "youstack" });
  const slug = expectString(value, "slug", errors);
  expectString(value, "name", errors);
  const domain = expectString(value, "domain", errors, { optional: true });
  validateOptionalStringArray(value, "aliases", errors);
  validateOptionalStringArray(value, "tags", errors);
  expectString(value, "version", errors);
  const visibility = expectString(value, "visibility", errors);
  if (visibility && !VALID_VISIBILITY.has(visibility as YouStackVisibility)) {
    errors.push(`visibility must be one of: ${Array.from(VALID_VISIBILITY).join(", ")}`);
  }
  if (slug && !isShellSafeIdentifier(slug)) {
    errors.push("slug must use only shell-safe identifier characters: letters, numbers, dot, underscore, dash");
  }
  if (domain && !isSingleLineMetadata(domain)) {
    warnings.push("domain should stay single-line so generated adapter/docs metadata stays readable");
  }
  for (const field of ["aliases", "tags"] as const) {
    const items = value[field];
    if (!Array.isArray(items)) continue;
    for (const [index, item] of items.entries()) {
      if (typeof item === "string" && !isSingleLineMetadata(item)) {
        warnings.push(`${field}[${index}] should stay single-line so generated adapter/docs metadata stays readable`);
      }
    }
  }

  if (value.files !== undefined) {
    if (!Array.isArray(value.files)) {
      errors.push("files must be an array");
    } else {
      for (const [index, file] of value.files.entries()) {
        if (!isRecord(file)) {
          errors.push(`files[${index}] must be an object`);
          continue;
        }
        const filePath = expectStringField(file, "path", `files[${index}].path`, errors);
        expectStringField(file, "type", `files[${index}].type`, errors);
        if (filePath && !isSafeRelativePath(filePath)) {
          errors.push(`files[${index}].path must be a safe relative path`);
        }
        if (file.checksum !== undefined && typeof file.checksum !== "string") {
          errors.push(`files[${index}].checksum must be a string`);
        }
      }
    }
  }

  if (value.brainScopes !== undefined) {
    if (!Array.isArray(value.brainScopes)) {
      errors.push("brainScopes must be an array");
    } else {
      for (const [index, scope] of value.brainScopes.entries()) {
        if (!isRecord(scope)) {
          errors.push(`brainScopes[${index}] must be an object`);
          continue;
        }
        expectStringField(scope, "scope", `brainScopes[${index}].scope`, errors);
        if (scope.reason === undefined || String(scope.reason || "").trim().length === 0) {
          warnings.push(`brainScopes[${index}] should explain why the scope is needed`);
        }
      }
    }
  }

  // P19 (2026-06-12): validate requiresScopes entries against known vocabulary.
  if (value.requiresScopes !== undefined) {
    if (!Array.isArray(value.requiresScopes)) {
      errors.push("requiresScopes must be an array");
    } else {
      const knownSet = new Set<string>(KNOWN_API_SCOPES);
      for (const [index, scope] of value.requiresScopes.entries()) {
        if (typeof scope !== "string") {
          errors.push(`requiresScopes[${index}] must be a string`);
        } else if (!knownSet.has(scope)) {
          warnings.push(
            `requiresScopes[${index}] "${scope}" is not a known API scope — valid scopes: ${[...KNOWN_API_SCOPES].join(", ")}`
          );
        }
      }
    }
  }

  if (value.capabilities !== undefined) {
    if (!Array.isArray(value.capabilities)) {
      errors.push("capabilities must be an array");
    } else {
      const seen = new Set<string>();
      for (const [index, capability] of value.capabilities.entries()) {
        if (!isRecord(capability)) {
          errors.push(`capabilities[${index}] must be an object`);
          continue;
        }
        const id = expectStringField(capability, "id", `capabilities[${index}].id`, errors);
        if (id) {
          if (seen.has(id)) errors.push(`duplicate capability id: ${id}`);
          seen.add(id);
          if (!isShellSafeIdentifier(id)) {
            errors.push(`capabilities[${index}].id must use only shell-safe identifier characters: letters, numbers, dot, underscore, dash`);
          }
        }
        if (
          capability.localOnly !== undefined &&
          typeof capability.localOnly !== "boolean"
        ) {
          errors.push(`capabilities[${index}].localOnly must be a boolean`);
        }
        if (
          capability.requiredScopes !== undefined &&
          !Array.isArray(capability.requiredScopes)
        ) {
          errors.push(`capabilities[${index}].requiredScopes must be an array`);
        }
      }
    }
  }

  if (value.adapters !== undefined) {
    if (!isRecord(value.adapters)) {
      errors.push("adapters must be an object keyed by host id");
    } else {
      for (const [host, adapter] of Object.entries(value.adapters)) {
        if (!isRecord(adapter)) {
          errors.push(`adapters.${host} must be an object`);
          continue;
        }
        if (adapter.files !== undefined) {
          if (!Array.isArray(adapter.files)) {
            errors.push(`adapters.${host}.files must be an array`);
          } else {
            for (const [index, filePath] of adapter.files.entries()) {
              if (typeof filePath !== "string" || !isSafeRelativePath(filePath)) {
                errors.push(`adapters.${host}.files[${index}] must be a safe relative path`);
              }
            }
          }
        }
      }
    }
  }

  if (isRecord(value.accessPolicy)) {
    if (value.accessPolicy.protectedByDefault !== true) {
      warnings.push("accessPolicy.protectedByDefault should be true for v1 stacks");
    }
  } else {
    warnings.push("accessPolicy is missing; defaulting to local/static only");
  }

  if (value.improvement !== undefined) {
    if (!isRecord(value.improvement)) {
      errors.push("improvement must be an object");
    } else {
      const mode = value.improvement.mode;
      if (
        mode !== undefined &&
        mode !== "observe" &&
        mode !== "propose" &&
        mode !== "auto_pr" &&
        mode !== "auto_apply_local"
      ) {
        errors.push("improvement.mode must be one of: observe, propose, auto_pr, auto_apply_local");
      }
      validateOptionalStringArray(value.improvement, "signals", errors);
      validateOptionalStringArray(value.improvement, "evals", errors);
      validateOptionalStringArray(value.improvement, "appliesTo", errors);
      validateOptionalStringArray(value.improvement, "approvalRequiredFor", errors);
    }
  } else {
    warnings.push("improvement policy is missing; self-improvement will not be explicit");
  }

  if (value.update !== undefined) {
    if (!isRecord(value.update)) {
      errors.push("update must be an object");
    } else if (
      value.update.autoApply !== undefined &&
      typeof value.update.autoApply !== "boolean"
    ) {
      errors.push("update.autoApply must be a boolean");
    }
  } else {
    warnings.push("update policy is missing; auto-update behavior will not be explicit");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function loadYouStackManifest(inputPath?: string): LoadedYouStack {
  const manifestPath = resolveYouStackManifestPath(inputPath);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`YouStack manifest not found: ${manifestPath}`);
  }
  const parsed = parseJsonFile(manifestPath);
  const validation = validateYouStackManifest(parsed);
  return {
    manifest: parsed as YouStackManifest,
    manifestPath,
    rootDir: path.dirname(manifestPath),
    validation,
  };
}

export function getYouStackReadiness(loaded: LoadedYouStack | null): YouStackReadiness {
  if (!loaded) {
    return {
      status: "not_found",
      ready: false,
      reason: "No local YouStack manifest found from the current directory or supplied path.",
    };
  }

  if (!loaded.validation.ok) {
    return {
      status: "invalid",
      ready: false,
      reason: `Manifest validation failed with ${loaded.validation.errors.length} error${loaded.validation.errors.length === 1 ? "" : "s"}.`,
    };
  }

  return {
    status: "ready",
    ready: true,
    reason: "Manifest is present and validation passed.",
  };
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function normalizeChecksum(value: string): string {
  return value.replace(/^sha256:/, "").trim().toLowerCase();
}

export function getYouStackCapabilities(manifest: YouStackManifest): YouStackCapability[] {
  return [...BUILT_IN_CAPABILITIES, ...(manifest.capabilities || [])];
}

export function runYouStackSmoke(loaded: LoadedYouStack): YouStackSmokeResult {
  const errors = [...loaded.validation.errors];
  const warnings = [...loaded.validation.warnings];
  const checks: string[] = [];

  checks.push(`manifest: ${loaded.manifestPath}`);
  checks.push(`stack: ${loaded.manifest.name} (${loaded.manifest.slug})`);
  if (loaded.manifest.domain) checks.push(`domain: ${loaded.manifest.domain}`);
  if (loaded.manifest.tags?.length) checks.push(`tags: ${loaded.manifest.tags.join(", ")}`);
  if (loaded.validation.ok) checks.push("schema: youstack/v1");

  for (const file of loaded.manifest.files || []) {
    const fullPath = path.join(loaded.rootDir, file.path);
    if (!fs.existsSync(fullPath)) {
      const message = `missing stack file: ${file.path}`;
      if (file.required) errors.push(message);
      else warnings.push(message);
      continue;
    }
    checks.push(`file exists: ${file.path}`);

    if (file.checksum) {
      const actual = sha256File(fullPath);
      const expected = normalizeChecksum(file.checksum);
      if (actual !== expected) {
        errors.push(`checksum mismatch for ${file.path}`);
      } else {
        checks.push(`checksum ok: ${file.path}`);
      }
    }
  }

  const adapterHosts = Object.keys(loaded.manifest.adapters || {});
  if (adapterHosts.length === 0) {
    warnings.push("no host adapters declared yet");
  } else {
    for (const host of adapterHosts) {
      const adapter = loaded.manifest.adapters?.[host];
      checks.push(`adapter declared: ${host}`);
      for (const filePath of adapter?.files || []) {
        if (!isSafeRelativePath(filePath)) {
          errors.push(`adapter ${host} has unsafe path: ${filePath}`);
        }
      }
    }
  }

  const capabilities = getYouStackCapabilities(loaded.manifest);
  checks.push(`capabilities: ${capabilities.length}`);

  if (loaded.manifest.improvement) {
    checks.push(`improvement policy: ${loaded.manifest.improvement.mode || "declared"}`);
  }
  if (loaded.manifest.update) {
    checks.push(`update policy: ${loaded.manifest.update.channel || "declared"}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checks,
  };
}

export function runYouStackDoctor(loaded: LoadedYouStack): YouStackDoctorResult {
  const smoke = runYouStackSmoke(loaded);
  const errors = [...smoke.errors];
  const warnings = [...smoke.warnings];
  const checks = [...smoke.checks];
  const diagnostics: string[] = [];
  const recommendations: string[] = [];
  const manifest = loaded.manifest;
  const capabilities = getYouStackCapabilities(manifest);
  const files = manifest.files || [];
  const adapters = Object.keys(manifest.adapters || {});
  const manifestBytes = fs.statSync(loaded.manifestPath).size;
  const localCapabilities = capabilities.filter((capability) => capability.localOnly).length;
  const protectedCapabilities = capabilities.length - localCapabilities;
  const fileTypes = new Map<string, number>();

  const manifestDir = path.dirname(loaded.manifestPath);
  try {
    const gitRoot = execFileSync("git", ["-C", manifestDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .replace(/\n/g, "");
    if (gitRoot) {
      const porcelain = execFileSync("git", ["-C", gitRoot, "status", "--porcelain"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const dirtyCount = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;
      diagnostics.push(`git root: ${gitRoot}`);
      diagnostics.push(dirtyCount > 0 ? `git status: dirty (${dirtyCount} changes)` : "git status: clean");
      if (dirtyCount > 0) {
        warnings.push("git working tree has uncommitted changes; stack adapters and smoke results may not be reproducible");
      }

      let upstream = "";
      try {
        upstream = execFileSync("git", ["-C", gitRoot, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
      } catch {
        upstream = "";
      }
      if (upstream) {
        try {
          const counts = execFileSync("git", ["-C", gitRoot, "rev-list", "--left-right", "--count", `HEAD...${upstream}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim();
          const [aheadRaw, behindRaw] = counts.split(/\s+/);
          const ahead = Number(aheadRaw || 0);
          const behind = Number(behindRaw || 0);
          diagnostics.push(`git upstream: ${upstream} (ahead ${ahead}, behind ${behind})`);
          if (behind > 0) {
            warnings.push(`git upstream is behind by ${behind} commits; pull before publishing stack changes`);
          }
        } catch {
          diagnostics.push(`git upstream: ${upstream}`);
        }
      } else {
        diagnostics.push("git upstream: none");
      }
    }
  } catch {
    // Not a git repo (or git unavailable). Ignore.
  }

  for (const file of files) {
    fileTypes.set(file.type, (fileTypes.get(file.type) || 0) + 1);
  }

  const canonicalLayout = isCanonicalYouStackManifestPath(loaded.manifestPath);
  const stackDirName = path.basename(path.dirname(loaded.manifestPath));
  const slugHint =
    typeof manifest.slug === "string" && manifest.slug.trim().length > 0
      ? manifest.slug
      : "<slug>";
  diagnostics.push(
    `layout: ${canonicalLayout ? "canonical (stacks/<slug>/youstack.json)" : "legacy"}`
  );
  if (!canonicalLayout) {
    warnings.push(
      `stack manifest found outside the canonical layout; move it to stacks/${slugHint}/youstack.json so cli discovery and you.md repo sync agree (legacy youstack.json, .you/, and youstacks/ locations still load)`
    );
  } else {
    // P20 shadowing: a canonical manifest wins discovery — surface any
    // legacy manifests it silently shadows so stale copies get cleaned up.
    const shadowedLegacy = findYouStackManifestCandidates(path.dirname(loaded.manifestPath))
      .filter(
        (candidate) =>
          path.resolve(candidate) !== path.resolve(loaded.manifestPath) &&
          !isCanonicalYouStackManifestPath(candidate)
      );
    if (shadowedLegacy.length > 0) {
      warnings.push(
        `legacy stack manifest${shadowedLegacy.length === 1 ? "" : "s"} shadowed by the canonical layout: ${shadowedLegacy.join(", ")} (canonical ${loaded.manifestPath} wins discovery; migrate or remove the legacy cop${shadowedLegacy.length === 1 ? "y" : "ies"})`
      );
    }
  }
  if (canonicalLayout && slugHint !== "<slug>" && stackDirName !== manifest.slug) {
    warnings.push(
      `stack folder name "${stackDirName}" does not match manifest slug "${manifest.slug}"; rename the folder to stacks/${manifest.slug}/ so repo stack derivation uses the right slug`
    );
  }
  if (!loaded.validation.ok) {
    warnings.push(
      `manifest is invalid (${loaded.validation.errors.length} error${loaded.validation.errors.length === 1 ? "" : "s"}); fix the missing or invalid fields reported above, then rerun youmd stack doctor`
    );
  }

  diagnostics.push(`manifest bytes: ${manifestBytes}`);
  diagnostics.push(`files: ${files.length}`);
  diagnostics.push(`file types: ${Array.from(fileTypes.entries()).map(([type, count]) => `${type}=${count}`).join(", ") || "none"}`);
  diagnostics.push(`capabilities: ${capabilities.length} (${localCapabilities} local, ${protectedCapabilities} protected)`);
  diagnostics.push(`adapters: ${adapters.join(", ") || "none"}`);
  diagnostics.push(`brain scopes: ${manifest.brainScopes?.length || 0}`);
  // P19: surface requiresScopes count and any unknown scope names.
  if (manifest.requiresScopes && manifest.requiresScopes.length > 0) {
    const knownSet = new Set<string>(KNOWN_API_SCOPES);
    const unknownScopes = manifest.requiresScopes.filter((s) => !knownSet.has(s));
    diagnostics.push(`requires scopes: ${manifest.requiresScopes.join(", ")}`);
    for (const unknown of unknownScopes) {
      warnings.push(
        `requiresScopes contains unknown scope "${unknown}" — valid: ${[...KNOWN_API_SCOPES].join(", ")}`
      );
    }
  }

  if (manifestBytes > 64 * 1024) {
    warnings.push("manifest is over 64KB; move long docs/prompts into files and keep the manifest routable");
  }
  if (!isShellSafeIdentifier(manifest.slug)) {
    warnings.push("stack slug is not shell-safe; adapter paths and generated host files should use letters, numbers, dot, underscore, and dash only");
  }
  if (files.length > 50) {
    warnings.push("stack declares more than 50 files; consider splitting into named domain stacks");
  }
  if (capabilities.length > 40) {
    warnings.push("stack exposes more than 40 capabilities; route quality may degrade without narrower intents");
  }
  if (adapters.length === 0) {
    recommendations.push("Add host adapters for Claude Code, Codex, and Cursor so the stack is useful after one install.");
  }

  // L18: validate workflow action types.
  const VALID_WORKFLOW_ACTIONS = new Set<string>(["run_skill", "report_skill_outcome"]);
  if (manifest.workflows) {
    for (const wf of manifest.workflows) {
      if (!wf.id) {
        warnings.push("workflow entry is missing an id field");
      }
      if (!wf.schedule) {
        warnings.push(`workflow ${wf.id || "?"}: missing schedule (cron string required)`);
      }
      if (!VALID_WORKFLOW_ACTIONS.has(wf.action)) {
        warnings.push(
          `workflow ${wf.id || "?"}: unknown action type "${wf.action}" — valid types are: ${[...VALID_WORKFLOW_ACTIONS].join(", ")}`
        );
      }
    }
  }
  if (!files.some((file) => file.type === "test")) {
    recommendations.push("Add a read-only smoke test file so agents can verify the stack before using it.");
  }
  if (!manifest.improvement?.evals?.some((item) => item.includes("youmd stack smoke"))) {
    recommendations.push("Include `youmd stack smoke` in improvement.evals so self-improvement stays gated.");
  }
  if (!manifest.update?.check) {
    recommendations.push("Declare update.check so host agents know exactly how to refresh the stack.");
  } else if (
    manifest.update.autoApply === true &&
    !manifest.update.check.includes("youmd-auto-upgrade")
  ) {
    recommendations.push("Auto-applying stacks should run `~/.youmd/bin/youmd-auto-upgrade --quiet` before stack updates.");
  }

  for (const capability of capabilities) {
    const protectedMutation =
      !capability.localOnly &&
      capability.mutationPolicy &&
      capability.mutationPolicy !== "read_only";
    if (protectedMutation && (!capability.requiredScopes || capability.requiredScopes.length === 0)) {
      warnings.push(`protected capability ${capability.id} mutates state without requiredScopes`);
    }
  }

  if (manifest.visibility === "public-open") {
    const publicReadiness = manifest.sharing?.publicReadiness;
    if (!Array.isArray(publicReadiness) || publicReadiness.length === 0) {
      warnings.push("public-open stacks should declare sharing.publicReadiness checks");
    }
    if (!capabilities.some((capability) => capability.id.includes("public-readiness"))) {
      recommendations.push("Add a public-readiness capability that redacts secrets, private memories, and proprietary prompts before publishing.");
    }
  }

  if (recommendations.length === 0) {
    recommendations.push("No structural recommendations. Keep watching route misses, user corrections, eval failures, and reference-intelligence tasks.");
  }

  // Empirical Claude Code discovery gate: verify the SKILL.md files this
  // stack would emit for the claude-code host. Only meaningful once the
  // manifest itself is valid.
  let discovery: SkillDiscoveryCheck[] = [];
  if (loaded.validation.ok) {
    try {
      discovery = verifyYouStackClaudeDiscovery(loaded).checks;
      for (const check of discovery) {
        if (check.ok) {
          checks.push(`claude discovery ok: ${check.path}`);
        } else {
          for (const problem of check.problems) {
            errors.push(`claude discovery failed for ${check.path}: ${problem}`);
          }
        }
      }
    } catch (error) {
      errors.push(
        `claude discovery check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } else {
    diagnostics.push("claude discovery: skipped (manifest invalid)");
  }

  // L12 safety guard: run for all manifests; missing contract → T0 with warning.
  // When a safety contract is explicitly declared, violations are hard errors.
  // When no contract is present (defaulting to T0), inferred-capability mismatches
  // are surfaced as warnings so existing manifests without a safety section are
  // not retroactively broken.
  let guard: StackGuardResult | undefined;
  try {
    guard = runStackGuard(manifest, loaded.manifestPath);
    const hasExplicitContract = parseSafetyContract(manifest) !== null;
    for (const warning of guard.warnings) {
      warnings.push(`guard: ${warning}`);
    }
    for (const violation of guard.contractViolations) {
      // Contract violations are always hard errors regardless of whether the
      // contract was explicit (the manifest declared a safety section that is
      // internally inconsistent).
      errors.push(`guard contract violation: ${violation.reason}`);
    }
    for (const check of guard.checks) {
      if (check.status === "VIOLATION") {
        if (hasExplicitContract) {
          // Explicit contract: capability exceeds the declared tier → hard error
          errors.push(`guard ${check.capability}: ${check.message}`);
        } else {
          // Implicit T0 default: inferred violations are advisory warnings only
          warnings.push(`guard (advisory): ${check.capability}: ${check.message} — declare a safety section to enforce this`);
        }
      } else {
        diagnostics.push(`guard ${check.capability}: ${check.message}`);
      }
    }
    if (guard.ok || !hasExplicitContract) {
      checks.push(`safety guard: ${guard.tier} — all capability checks passed`);
    }
  } catch (error) {
    warnings.push(
      `guard check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    checks,
    diagnostics,
    recommendations,
    discovery,
    guard,
  };
}

function capabilityText(capability: YouStackCapability): string {
  return [
    capability.id,
    capability.intent,
    capability.workflow,
    capability.skill,
    capability.mcpTool,
    capability.apiEndpoint,
    ...(capability.requiredScopes || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreCapability(request: string, capability: YouStackCapability): number {
  const query = request.toLowerCase().trim();
  if (!query) return 0;
  const haystack = capabilityText(capability);
  let score = 0;

  if (haystack.includes(query)) score += 12;
  for (const raw of query.split(/[^a-z0-9_.:-]+/).filter(Boolean)) {
    if (raw.length < 2) continue;
    if (haystack.includes(raw)) score += raw.length > 4 ? 3 : 1;
  }
  if (capability.localOnly) score += 1;
  if (capability.mutationPolicy === "read_only") score += 1;
  if (/\b(doctor|diagnose|diagnostic|health|bloat|leak|resource|drift|stale)\b/.test(query) && /diagnos|health|bloat|drift|hygiene|readiness/.test(haystack)) {
    score += 8;
  }

  return score;
}

export function routeYouStackRequest(
  manifest: YouStackManifest,
  request: string
): YouStackRouteResult {
  const scored = getYouStackCapabilities(manifest)
    .map((capability) => ({ capability, score: scoreCapability(request, capability) }))
    .sort((a, b) => b.score - a.score || a.capability.id.localeCompare(b.capability.id));

  const best = scored[0] || {
    capability: BUILT_IN_CAPABILITIES[0],
    score: 0,
  };

  const reasons =
    best.score > 0
      ? [`Matched request terms against capability ${best.capability.id}.`]
      : ["No strong match found; defaulted to safe manifest inspection."];

  return {
    request,
    capability: best.capability,
    score: best.score,
    reasons,
    alternatives: scored.slice(1, 4),
  };
}

/**
 * Runtime enforcement hook (L12).
 *
 * Maps a mutation policy to a capability key, then checks the safety contract.
 * Returns a refusal message if the requested action exceeds the declared tier,
 * or null if the action is allowed.
 *
 * Usage: call this before any write action in stack routing flows.
 *
 * Example refusal: "blocked: stack is T1 (suggest-only) — this action needs T2"
 */
export function checkTierAllows(
  manifest: YouStackManifest,
  capabilityKey: SafetyCapabilityKey
): string | null {
  const contract = parseSafetyContract(manifest);
  if (!contract) {
    // No contract → treat as T0; deny write capabilities
    if (capabilityKey === "fs_write" || capabilityKey === "shell" || capabilityKey === "auto_pr") {
      return (
        `blocked: no safety contract declared (defaulting to T0, read-only). ` +
        `Add a safety section to youstack.json to grant ${capabilityKey}.`
      );
    }
    return null;
  }
  if (!tierAllows(contract, capabilityKey)) {
    return tierRefusalMessage(contract, capabilityKey);
  }
  return null;
}

export function normalizeYouStackHost(host: string): string {
  const value = host.trim().toLowerCase();
  if (value === "claude") return "claude-code";
  if (value === "claude-code") return "claude-code";
  if (value === "codex") return "codex";
  if (value === "cursor") return "cursor";
  return value;
}

/** Default link path for one host — derived from the engine adapter config. */
export function defaultAdapterPath(host: string, slug: string): string {
  return hostLinkRelativePath(
    youStackHostAdapterConfig(normalizeYouStackHost(host)),
    slug
  );
}

function declaredAdapterPaths(manifest: YouStackManifest, host: string): string[] | undefined {
  const normalized = normalizeYouStackHost(host);
  const declared = manifest.adapters?.[normalized]?.files || manifest.adapters?.[host]?.files;
  return declared && declared.length > 0 ? declared : undefined;
}

/** The stack rendered as one linkable skill unit for the host-link engine. */
function youStackSkillUnit(manifest: YouStackManifest): HostSkillUnit {
  return {
    name: manifest.slug,
    description: manifest.description || `Use the ${manifest.name} YouStack safely.`,
    content: generateYouStackAdapterBody(manifest),
  };
}

/**
 * Render the stack adapter content for a host. Frontmatter shape is decided
 * by the engine's per-host adapter config, not by host conditionals here.
 */
export function generateYouStackAdapterContent(
  manifest: YouStackManifest,
  host: string
): string {
  const config = youStackHostAdapterConfig(normalizeYouStackHost(host));
  const entries = buildHostLinkPlan([youStackSkillUnit(manifest)], config);
  return entries[0]?.content || "";
}

function generateYouStackAdapterBody(manifest: YouStackManifest): string {
  const capabilities = getYouStackCapabilities(manifest);
  const brainScopes = manifest.brainScopes || [];
  const lines: string[] = [];

  lines.push(`# ${manifest.name} YouStack`);
  lines.push("");
  lines.push("This file is generated from `youstack.json`.");
  lines.push("");
  lines.push("## Stack Identity");
  lines.push("");
  lines.push(`- Name: ${manifest.name}`);
  lines.push(`- Slug: ${manifest.slug}`);
  if (manifest.domain) lines.push(`- Domain: ${manifest.domain}`);
  if (manifest.aliases?.length) lines.push(`- Aliases: ${manifest.aliases.join(", ")}`);
  if (manifest.tags?.length) lines.push(`- Tags: ${manifest.tags.join(", ")}`);
  lines.push("");
  lines.push("## Startup");
  lines.push("");
  lines.push("1. Run `~/.youmd/bin/youmd-auto-upgrade --quiet || true` when the helper exists.");
  lines.push("2. Run `youmd stack smoke` from the stack or project root before relying on this stack.");
  lines.push("3. Read local project instructions and project-context files before acting.");
  lines.push("4. Use local/static stack files first.");
  lines.push("5. Use shared You.md API/MCP only for protected brain retrieval, sync, tokens, connected tools, or server-side actions.");
  lines.push("6. Protected reads may return readiness states such as auth_required, unavailable, or ready; if richer retrieval is unavailable, fall back to local stack files, project-context files, and public identity first.");
  lines.push("7. Do not mutate brain data, connected tools, visibility, or repo files until the user approves the exact action.");
  lines.push("");
  lines.push("## Capabilities");
  lines.push("");
  for (const capability of capabilities) {
    const mode = capability.localOnly ? "local" : "protected";
    lines.push(`- ${capability.id} (${mode}, ${capability.mutationPolicy || "unspecified"}): ${capability.intent || "No intent declared."}`);
  }
  lines.push("");
  lines.push("## Brain Scopes");
  lines.push("");
  if (brainScopes.length === 0) {
    lines.push("- None declared.");
  } else {
    for (const scope of brainScopes) {
      const required = scope.required ? "required" : "optional";
      lines.push(`- ${scope.scope} (${required}): ${scope.reason || "No reason declared."}`);
    }
  }
  lines.push("");
  lines.push("## Self-Improvement");
  lines.push("");
  if (manifest.improvement) {
    lines.push(`- Mode: ${manifest.improvement.mode || "observe"}`);
    if (manifest.improvement.cadence) lines.push(`- Cadence: ${manifest.improvement.cadence}`);
    if (manifest.improvement.appliesTo?.length) lines.push(`- Applies to: ${manifest.improvement.appliesTo.join(", ")}`);
    if (manifest.improvement.signals?.length) lines.push(`- Signals: ${manifest.improvement.signals.join(", ")}`);
    if (manifest.improvement.evals?.length) lines.push(`- Evals: ${manifest.improvement.evals.join(", ")}`);
    if (manifest.improvement.approvalRequiredFor?.length) {
      lines.push(`- Approval required for: ${manifest.improvement.approvalRequiredFor.join(", ")}`);
    }
  } else {
    lines.push("- No explicit improvement policy declared. Treat improvements as propose-only until the user chooses a policy.");
  }
  if (manifest.update) {
    lines.push(`- Update channel: ${manifest.update.channel || "manual"}`);
    if (manifest.update.check) lines.push(`- Update check: ${manifest.update.check}`);
    if (manifest.update.source) lines.push(`- Update source: ${manifest.update.source}`);
    lines.push(`- Auto-apply local updates: ${manifest.update.autoApply === true ? "yes" : "no"}`);
  }
  lines.push("- When improving this stack, update stack files, docs, evals/tests, and adapter outputs together, then run `youmd stack smoke`.");
  lines.push("- Use the bundled `youstack-maintainer` skill for stack organization, visibility review, public-readiness checks, and safe self-updates.");
  lines.push("- Never auto-write protected brain data, private context, connected tools, or remote repos unless the manifest policy and user approval both allow it.");
  lines.push("");
  lines.push("## Local Commands");
  lines.push("");
  lines.push("```bash");
  lines.push("youmd stack inspect");
  lines.push("youmd stack doctor");
  lines.push("youmd stack smoke");
  lines.push("youmd stack capabilities");
  lines.push("youmd stack route \"<request>\"");
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

/**
 * Build the per-host link plans (paths + rendered content) for a stack
 * without touching the filesystem. All hosts go through the one engine;
 * manifest-declared adapter paths still override the default layout.
 */
export function planYouStackAdapterLinks(
  loaded: LoadedYouStack,
  hosts?: string[]
): Array<{ host: string; relativePath: string; content: string }> {
  const hostList =
    hosts && hosts.length > 0
      ? hosts.map(normalizeYouStackHost)
      : Object.keys(loaded.manifest.adapters || {}).map(normalizeYouStackHost);
  const resolvedHosts =
    hostList.length > 0 ? [...new Set(hostList)] : ["claude-code", "codex", "cursor"];
  const unit = youStackSkillUnit(loaded.manifest);

  return resolvedHosts.flatMap((host) =>
    buildHostLinkPlan([unit], youStackHostAdapterConfig(host), {
      explicitRelativePaths: declaredAdapterPaths(loaded.manifest, host),
    })
  );
}

export function linkYouStackAdapters(
  loaded: LoadedYouStack,
  options: { hosts?: string[]; targetDir?: string; dryRun?: boolean } = {}
): YouStackLinkResult[] {
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const plan = planYouStackAdapterLinks(loaded, options.hosts);
  return writeHostLinkPlan(plan, targetDir, { dryRun: options.dryRun }).map((result) => ({
    host: result.host,
    targetPath: result.targetPath,
    wrote: result.wrote,
    content: result.content,
  }));
}

/**
 * Empirical Claude Code discovery release gate (exported for CI use):
 * verify that every SKILL.md this stack would emit for the claude-code
 * host parses, carries name + description, name matches its directory,
 * and has a non-empty body.
 */
export function verifyYouStackClaudeDiscovery(loaded: LoadedYouStack): SkillDiscoveryReport {
  return verifySkillDiscovery(planYouStackAdapterLinks(loaded, ["claude-code"]));
}

// Re-export the guard types and runner so callers only need one import.
export { runStackGuard, parseSafetyContract, tierAllows, tierRefusalMessage } from "./stackSafety";
export type {
  StackGuardResult,
  StackSafetyContract,
  SafetyTier,
  SafetyCapabilityKey,
  ContractValidationResult,
  ContractViolation,
  GuardCheckResult,
} from "./stackSafety";
