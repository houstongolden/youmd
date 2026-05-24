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

export interface YouStackManifest {
  schemaVersion: "youstack/v1";
  kind: "youstack";
  id?: string;
  slug: string;
  name: string;
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
