import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

export type YouStackVisibility = "private" | "scoped-link" | "public-open" | "team";

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
  provenance?: Record<string, unknown>;
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

function parseJsonFile(filePath: string): unknown {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function findManifestCandidates(startDir: string): string[] {
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

    const stacksDir = path.join(dir, "youstacks");
    if (fs.existsSync(stacksDir) && fs.statSync(stacksDir).isDirectory()) {
      for (const entry of fs.readdirSync(stacksDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const manifest = path.join(stacksDir, entry.name, "youstack.json");
        if (fs.existsSync(manifest) && fs.statSync(manifest).isFile()) {
          candidates.push(manifest);
        }
      }
    }

    dir = path.dirname(dir);
  }

  return [...new Set(candidates)].sort();
}

export function resolveYouStackManifestPath(inputPath?: string): string {
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, "youstack.json");
    }
    return resolved;
  }

  const candidates = findManifestCandidates(process.cwd());
  if (candidates.length === 0) {
    throw new Error(
      "No youstack.json found. Run from a stack directory or pass --path <manifest-or-dir>."
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
  expectString(value, "slug", errors);
  expectString(value, "name", errors);
  expectString(value, "domain", errors, { optional: true });
  validateOptionalStringArray(value, "aliases", errors);
  validateOptionalStringArray(value, "tags", errors);
  expectString(value, "version", errors);
  const visibility = expectString(value, "visibility", errors);
  if (visibility && !VALID_VISIBILITY.has(visibility as YouStackVisibility)) {
    errors.push(`visibility must be one of: ${Array.from(VALID_VISIBILITY).join(", ")}`);
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

export function normalizeYouStackHost(host: string): string {
  const value = host.trim().toLowerCase();
  if (value === "claude") return "claude-code";
  if (value === "claude-code") return "claude-code";
  if (value === "codex") return "codex";
  if (value === "cursor") return "cursor";
  return value;
}

export function defaultAdapterPath(host: string, slug: string): string {
  switch (normalizeYouStackHost(host)) {
    case "claude-code":
      return path.join(".claude", "skills", "youstacks", slug, "SKILL.md");
    case "codex":
      return path.join(".codex", "skills", "youstacks", slug, "SKILL.md");
    case "cursor":
      return path.join(".cursor", "rules", `youstacks-${slug}.md`);
    default:
      return path.join(".you", "adapters", normalizeYouStackHost(host), `${slug}.md`);
  }
}

function adapterPathsForHost(manifest: YouStackManifest, host: string): string[] {
  const normalized = normalizeYouStackHost(host);
  const declared = manifest.adapters?.[normalized]?.files || manifest.adapters?.[host]?.files;
  if (declared && declared.length > 0) return declared;
  return [defaultAdapterPath(normalized, manifest.slug)];
}

export function generateYouStackAdapterContent(
  manifest: YouStackManifest,
  host: string
): string {
  const normalized = normalizeYouStackHost(host);
  const capabilities = getYouStackCapabilities(manifest);
  const brainScopes = manifest.brainScopes || [];
  const lines: string[] = [];

  if (normalized === "claude-code" || normalized === "codex") {
    lines.push("---");
    lines.push(`name: ${manifest.slug}`);
    lines.push(
      `description: ${manifest.description || `Use the ${manifest.name} YouStack safely.`}`
    );
    lines.push("---");
    lines.push("");
  }

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
  lines.push("6. Do not mutate brain data, connected tools, visibility, or repo files until the user approves the exact action.");
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
  lines.push("youmd stack smoke");
  lines.push("youmd stack capabilities");
  lines.push("youmd stack route \"<request>\"");
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

export function linkYouStackAdapters(
  loaded: LoadedYouStack,
  options: { hosts?: string[]; targetDir?: string; dryRun?: boolean } = {}
): YouStackLinkResult[] {
  const hostList =
    options.hosts && options.hosts.length > 0
      ? options.hosts.map(normalizeYouStackHost)
      : Object.keys(loaded.manifest.adapters || {}).map(normalizeYouStackHost);
  const hosts = hostList.length > 0 ? [...new Set(hostList)] : ["claude-code", "codex", "cursor"];
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const results: YouStackLinkResult[] = [];

  for (const host of hosts) {
    for (const relativePath of adapterPathsForHost(loaded.manifest, host)) {
      if (!isSafeRelativePath(relativePath)) {
        throw new Error(`Unsafe adapter path for ${host}: ${relativePath}`);
      }
      const targetPath = path.join(targetDir, relativePath);
      const content = generateYouStackAdapterContent(loaded.manifest, host);
      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, content);
      }
      results.push({
        host,
        targetPath,
        wrote: !options.dryRun,
        content,
      });
    }
  }

  return results;
}
