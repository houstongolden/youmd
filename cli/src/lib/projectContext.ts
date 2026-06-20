/**
 * Single project-context engine (PRODUCT-AUDIT #14 / ROADMAP 3.8).
 *
 * A project's context is resolved as the repo `project-context/` directory
 * (when the cwd is inside a repo that has one) OVERLAID on the global
 * `~/.you/projects/<slug>/` directory (global notes for the same project),
 * with legacy `~/.youmd/projects/<slug>/` read fallback:
 *
 *   - readers see the overlay UNION of both sides
 *   - the repo copy wins on file conflicts
 *   - writers route project files to the repo copy when inside the repo,
 *     otherwise to the global `~/.you/projects/<slug>/` store
 *
 * This module is the only place that knows both locations. Consumers
 * (chat project reads, `youmd project` commands, the MCP server) route
 * through it instead of carrying their own copies of the path logic.
 *
 * It also owns the documented precedence model (PRODUCT-AUDIT #22 /
 * ROADMAP 3.15): the PRECEDENCE table, shadowing detection, and the
 * "active roots" summary used by `youmd status` and `youmd stack doctor`.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ProjectContext as ManagedProjectContext,
  buildProjectContextInjectionFromContext,
  findProjectsRoot,
  readProjectContext as readManagedProjectContext,
  updateProjectFile,
} from "./project";
import {
  GlobalConfig,
  bundleLooksInitialized,
  getEnvApiKey,
  getEnvApiUrl,
  getGlobalConfigPath,
  getHomeBundleDir,
  readGlobalConfig,
} from "./config";
import {
  findYouStackManifestCandidates,
  isCanonicalYouStackManifestPath,
} from "./youstack";

// ─── Slug + global store paths (single ownership) ─────────────────────
// These replace the duplicate helpers that used to live in lib/config.ts.

export function projectSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Global projects root: ~/.you/projects, with legacy ~/.youmd read fallback through config helpers. */
export function getGlobalProjectsRoot(): string {
  return path.join(getHomeBundleDir(), "projects");
}

/** Global per-project dir: ~/.you/projects/<slug> */
export function getProjectGlobalDir(projectName: string): string {
  return path.join(getGlobalProjectsRoot(), projectSlug(projectName));
}

/** Private context dir for a project: ~/.you/projects/<slug>/private */
export function getProjectPrivateDir(projectName: string): string {
  return path.join(getProjectGlobalDir(projectName), "private");
}

/** Ensure the global project dir structure exists. Returns the project dir. */
export function ensureProjectDirs(projectName: string): string {
  const projectDir = getProjectGlobalDir(projectName);
  fs.mkdirSync(path.join(projectDir, "private"), { recursive: true });
  return projectDir;
}

/** Read project-scoped private notes from the global store. */
export function readProjectPrivateNotes(projectName: string): string | null {
  const notesPath = path.join(getProjectPrivateDir(projectName), "notes.md");
  if (!fs.existsSync(notesPath)) return null;
  try {
    return fs.readFileSync(notesPath, "utf-8");
  } catch {
    return null;
  }
}

/** Write project-scoped private notes to the global store. */
export function writeProjectPrivateNotes(projectName: string, content: string): void {
  const privateDir = getProjectPrivateDir(projectName);
  fs.mkdirSync(privateDir, { recursive: true });
  fs.writeFileSync(path.join(privateDir, "notes.md"), content);
}

// ─── Repo-side detection ──────────────────────────────────────────────

/**
 * Find the nearest repo project-context root by walking up from startDir.
 * A directory qualifies when it contains a `project-context/` directory or
 * a `.youmd-project` marker file. (Moved here from the MCP server, which
 * carried a private copy of this walk.)
 */
export function findRepoContextRoot(startDir: string = process.cwd()): string | null {
  let dir = path.resolve(startDir);
  // Walk up at most 8 levels to avoid runaway searches
  for (let i = 0; i < 8; i++) {
    const contextDir = path.join(dir, "project-context");
    const marker = path.join(dir, ".youmd-project");
    try {
      if (fs.existsSync(contextDir) && fs.statSync(contextDir).isDirectory()) {
        return dir;
      }
      if (fs.existsSync(marker)) {
        return dir;
      }
    } catch {
      // unreadable dir — keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Derive a project name from a repo root: .youmd-project, package.json, basename. */
export function deriveProjectName(projectRoot: string): string {
  const markerPath = path.join(projectRoot, ".youmd-project");
  if (fs.existsSync(markerPath)) {
    try {
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf-8"));
      if (marker && typeof marker.name === "string" && marker.name.trim()) {
        return marker.name;
      }
    } catch {
      // malformed marker — fall through
    }
  }
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg && typeof pkg.name === "string" && pkg.name.trim()) {
        return pkg.name;
      }
    } catch {
      // malformed package.json — fall through
    }
  }
  return path.basename(projectRoot);
}

// ─── Overlay resolution ───────────────────────────────────────────────

export type ProjectContextSource = "repo" | "global";

export interface ProjectContextEntry {
  /** Case-insensitive overlay key (lowercased file name, e.g. "todo.md"). */
  key: string;
  /** Actual file name of the winning copy. */
  fileName: string;
  /** Absolute path of the winning copy. */
  path: string;
  source: ProjectContextSource;
  /** Absolute path of the shadowed lower-precedence copy, when both exist. */
  shadows?: string;
}

export interface ResolvedProjectContext {
  projectName: string | null;
  /** Repo root containing project-context/ or a .youmd-project marker. */
  repoRoot: string | null;
  /** <repoRoot>/project-context when it exists on disk. */
  repoContextDir: string | null;
  /** Managed/global project dir (walk-up .you/projects or ~/.you/projects/<slug>, with legacy fallback). */
  globalDir: string | null;
  /** <globalDir>/context when it exists on disk. */
  globalContextDir: string | null;
  /** Overlay union of both sides — repo wins on key conflicts. */
  entries: ProjectContextEntry[];
}

function listContextDirFiles(dir: string | null): Array<{ key: string; fileName: string; path: string }> {
  if (!dir || !fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
      .map((entry) => ({
        key: entry.name.toLowerCase(),
        fileName: entry.name,
        path: path.join(dir, entry.name),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  } catch {
    return [];
  }
}

/**
 * Resolve a project's context roots and overlay union.
 *
 * - `projectName` pins the global side to a specific project. The repo
 *   side is only overlaid when the repo derives the same project (so a
 *   named lookup for project A does not absorb repo B's files).
 * - With no `projectName`, the project is derived from the repo root
 *   (or null when no repo context exists from cwd).
 */
export function resolveProjectContext(
  options: { cwd?: string; projectName?: string } = {},
): ResolvedProjectContext {
  const cwd = options.cwd || process.cwd();
  const detectedRoot = findRepoContextRoot(cwd);
  const repoName = detectedRoot ? deriveProjectName(detectedRoot) : null;
  const projectName = options.projectName || repoName;

  // Named lookups only overlay the repo when it is the same project.
  const repoRoot =
    detectedRoot &&
    (!options.projectName ||
      (repoName && projectSlug(repoName) === projectSlug(options.projectName)) ||
      projectSlug(path.basename(detectedRoot)) === projectSlug(options.projectName))
      ? detectedRoot
      : null;

  const repoContextDirCandidate = repoRoot ? path.join(repoRoot, "project-context") : null;
  const repoContextDir =
    repoContextDirCandidate && fs.existsSync(repoContextDirCandidate)
      ? repoContextDirCandidate
      : null;

  // Global side: walk-up .you/projects store first, then ~/.you/projects.
  let globalDir: string | null = null;
  if (projectName) {
    const slugCandidates = [projectSlug(projectName)];
    if (repoRoot) {
      const baseSlug = projectSlug(path.basename(repoRoot));
      if (!slugCandidates.includes(baseSlug)) slugCandidates.push(baseSlug);
    }
    const projectsRoot = findProjectsRoot(cwd);
    const dirCandidates: string[] = [];
    for (const slug of slugCandidates) {
      if (projectsRoot) dirCandidates.push(path.join(projectsRoot, slug));
      dirCandidates.push(path.join(getGlobalProjectsRoot(), slug));
    }
    globalDir =
      dirCandidates.find((candidate) => fs.existsSync(candidate)) ||
      getProjectGlobalDir(projectName);
  }

  const globalContextDirCandidate = globalDir ? path.join(globalDir, "context") : null;
  const globalContextDir =
    globalContextDirCandidate && fs.existsSync(globalContextDirCandidate)
      ? globalContextDirCandidate
      : null;

  // Overlay union — repo wins on (case-insensitive) file-name conflicts.
  const entries = new Map<string, ProjectContextEntry>();
  for (const file of listContextDirFiles(repoContextDir)) {
    entries.set(file.key, { ...file, source: "repo" });
  }
  for (const file of listContextDirFiles(globalContextDir)) {
    const existing = entries.get(file.key);
    if (existing) {
      existing.shadows = file.path;
    } else {
      entries.set(file.key, { ...file, source: "global" });
    }
  }

  return {
    projectName,
    repoRoot,
    repoContextDir,
    globalDir,
    globalContextDir,
    entries: Array.from(entries.values()).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function normalizeContextFileName(name: string): string {
  return name.includes(".") ? name : `${name}.md`;
}

/**
 * Read a context file from the overlay union (repo copy wins).
 * `name` may omit the .md extension and is matched case-insensitively.
 */
export function readContextFile(
  resolved: ResolvedProjectContext,
  name: string,
): { content: string; path: string; source: ProjectContextSource } | null {
  const rel = normalizeContextFileName(name);
  const key = rel.toLowerCase();
  const entry = resolved.entries.find((candidate) => candidate.key === key);
  if (entry) {
    try {
      return {
        content: fs.readFileSync(entry.path, "utf-8"),
        path: entry.path,
        source: entry.source,
      };
    } catch {
      return null;
    }
  }
  // Compat: repos with a .youmd-project marker but no project-context/ dir
  // may keep top-level files (legacy MCP read behavior).
  if (resolved.repoRoot) {
    for (const candidate of [
      path.join(resolved.repoRoot, rel),
      path.join(resolved.repoRoot, rel.toUpperCase()),
    ]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        try {
          return { content: fs.readFileSync(candidate, "utf-8"), path: candidate, source: "repo" };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Write a context file. Routes to the repo project-context/ copy when
 * inside the repo, otherwise to the global store's context/ directory.
 * Prefers an existing same-key file (preserving its on-disk casing).
 */
export function writeContextFile(
  resolved: ResolvedProjectContext,
  name: string,
  content: string,
): { path: string; source: ProjectContextSource } {
  const rel = normalizeContextFileName(name);
  const key = rel.toLowerCase();

  if (resolved.repoRoot) {
    const existing = resolved.entries.find(
      (entry) => entry.key === key && entry.source === "repo",
    );
    const target = existing?.path || path.join(resolved.repoRoot, "project-context", rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    return { path: target, source: "repo" };
  }

  if (!resolved.globalDir) {
    throw new Error("no project resolved — cannot write a project-context file");
  }
  // updateProjectFile keeps project.json updated_at fresh in managed stores.
  updateProjectFile(resolved.globalDir, path.join("context", rel), content);
  return { path: path.join(resolved.globalDir, "context", rel), source: "global" };
}

/**
 * Route a managed-store-relative update (context/x.md, agent/x, private/x)
 * through the engine. `context/` files go to the repo copy when inside the
 * repo; agent/ and private/ files always live in the global store.
 */
export function writeProjectUpdate(
  resolved: ResolvedProjectContext,
  relFile: string,
  content: string,
): { path: string; source: ProjectContextSource } {
  const normalized = relFile.replace(/\\/g, "/");
  if (normalized.startsWith("context/") && resolved.repoRoot) {
    return writeContextFile(resolved, normalized.slice("context/".length), content);
  }
  if (!resolved.globalDir) {
    throw new Error("no project resolved — cannot write a project file");
  }
  updateProjectFile(resolved.globalDir, relFile, content);
  return { path: path.join(resolved.globalDir, relFile), source: "global" };
}

// ─── Reader path lists for repo-rooted consumers (chat) ──────────────

export interface ProjectContextReadPath {
  /** Human-facing label (relative path or shortened overlay path). */
  label: string;
  /** Absolute path to read. */
  path: string;
}

/**
 * Ordered candidate paths for a logical context file under a project root:
 * repo project-context/, the generated .you/project-context/ layer, then the
 * global overlay copy. Consumers read whichever exist (repo first = wins).
 */
export function projectContextReadPaths(
  projectRoot: string,
  relNames: string[],
): ProjectContextReadPath[] {
  const projectName = deriveProjectName(projectRoot);
  const globalContextDir = path.join(getProjectGlobalDir(projectName), "context");
  const paths: ProjectContextReadPath[] = [];

  for (const relName of relNames) {
    paths.push({
      label: `project-context/${relName}`,
      path: path.join(projectRoot, "project-context", relName),
    });
    paths.push({
      label: `.you/project-context/${relName}`,
      path: path.join(projectRoot, ".you", "project-context", relName),
    });
  }
  for (const relName of relNames) {
    const overlayFile = path.join(globalContextDir, relName.toLowerCase());
    paths.push({
      label: `~/.you/projects/${projectSlug(projectName)}/context/${relName.toLowerCase()}`,
      path: overlayFile,
    });
  }
  return paths;
}

// ─── Merged structured context ────────────────────────────────────────

const MERGED_CONTEXT_FIELDS: Array<{
  field: "prd" | "todo" | "features" | "changelog" | "decisions";
  file: string;
}> = [
  { field: "prd", file: "prd.md" },
  { field: "todo", file: "todo.md" },
  { field: "features", file: "features.md" },
  { field: "changelog", file: "changelog.md" },
  { field: "decisions", file: "decisions.md" },
];

/**
 * Read a project's full structured context (the same shape lib/project.ts
 * readProjectContext returns) with the repo project-context/ overlay
 * applied: repo files win for prd/todo/features/changelog/decisions; the
 * global store contributes meta, agent instructions, preferences, memories,
 * and private notes. Returns null when neither side has anything.
 */
export function readMergedProjectContext(
  options: { cwd?: string; projectName?: string } = {},
): ManagedProjectContext | null {
  const resolved = resolveProjectContext(options);
  const managed = resolved.globalDir ? readManagedProjectContext(resolved.globalDir) : null;
  if (!managed && !resolved.repoContextDir) return null;

  const ctx: ManagedProjectContext = managed || {
    meta: {
      name: resolved.projectName || path.basename(resolved.repoRoot || ""),
      description: "",
      created_at: "",
      updated_at: "",
    },
    instructions: "",
    preferences: { tone: "", stack: "", focus: "" },
    prd: "",
    todo: "",
    features: "",
    changelog: "",
    decisions: "",
    memories: [],
    privateNotes: "",
  };

  for (const { field, file } of MERGED_CONTEXT_FIELDS) {
    const read = readContextFile(resolved, file);
    if (read && read.source === "repo") {
      ctx[field] = read.content;
    }
  }
  return ctx;
}

/**
 * Build the LLM system-prompt injection from the merged (repo-overlaid)
 * context. Same output format as lib/project.ts buildProjectContextInjection.
 */
export function buildMergedProjectContextInjection(
  options: { cwd?: string; projectName?: string } = {},
): string | null {
  const ctx = readMergedProjectContext(options);
  if (!ctx) return null;
  return buildProjectContextInjectionFromContext(ctx);
}

// ─── P20: documented precedence model ─────────────────────────────────

export interface PrecedenceRule {
  domain: string;
  /** Highest precedence first. */
  order: string[];
  note: string;
}

/**
 * The full precedence model the CLI actually implements, in one place.
 * Rendered by help text, docs, and `youmd status` — keep this table in
 * sync with config.ts (env/config), this module (project overlay), and
 * youstack.ts (manifest discovery).
 */
export const PRECEDENCE: ReadonlyArray<PrecedenceRule> = [
  {
    domain: "config",
    order: [
      "env vars (YOU_API_KEY, YOU_API_URL; legacy YOUMD_* aliases)",
      "local project config (./.you/config.json; legacy ./.youmd fallback)",
      "global config (~/.you/config.json; legacy ~/.youmd fallback)",
    ],
    note: "env always wins; the local bundle config only applies inside an initialized project directory",
  },
  {
    domain: "project context",
    order: [
      "repo project-context/ directory",
      "global overlay (~/.you/projects/<name>/; legacy ~/.youmd fallback)",
    ],
    note: "repo wins on file conflicts; readers see the overlay union of both sides",
  },
  {
    domain: "stack layout",
    order: [
      "canonical stacks/<slug>/youstack.json",
      "legacy youstack.json, .you/youstack.json, youstacks/<slug>/youstack.json",
    ],
    note: "canonical manifests are discovered first; legacy locations still load when no canonical manifest exists",
  },
];

/** Render the precedence table as plain text lines (for help text/docs). */
export function renderPrecedence(): string[] {
  return PRECEDENCE.map(
    (rule) => `${rule.domain}: ${rule.order.join(" > ")} — ${rule.note}`,
  );
}

// ─── P20: shadowing detection ─────────────────────────────────────────

export interface ShadowWarning {
  domain: "config" | "project-context" | "stack";
  shadowed: string;
  shadowedBy: string;
  message: string;
}

export interface ShadowDetectionInput {
  cwd?: string;
  env?: { apiKey?: string; apiUrl?: string };
  globalConfig?: GlobalConfig;
}

function shortenHome(p: string): string {
  const home = os.homedir();
  return p.startsWith(home + path.sep) || p === home ? p.replace(home, "~") : p;
}

/**
 * Detect actually-active shadowing that is likely to surprise:
 *   - YOU_API_KEY/YOU_API_URL env overriding a logged-in session/config
 *   - repo project-context files shadowing global overlay copies
 *   - a canonical stack manifest shadowing legacy manifest locations
 * Returns at most one warning per domain occurrence — callers print each
 * as a single dim line, once per invocation.
 */
export function detectShadowing(input: ShadowDetectionInput = {}): ShadowWarning[] {
  const cwd = input.cwd || process.cwd();
  const env = input.env || { apiKey: getEnvApiKey(), apiUrl: getEnvApiUrl() };
  const config = input.globalConfig || readGlobalConfig();
  const warnings: ShadowWarning[] = [];

  if (env.apiKey && config.token) {
    warnings.push({
      domain: "config",
      shadowed: "logged-in session token (~/.you/config.json)",
      shadowedBy: "YOU_API_KEY env var",
      message:
        "YOU_API_KEY env var overrides your logged-in session token (~/.you/config.json); YOUMD_API_KEY remains a legacy alias",
    });
  }
  if (env.apiUrl && config.apiUrl) {
    warnings.push({
      domain: "config",
      shadowed: "apiUrl from ~/.you/config.json",
      shadowedBy: "YOU_API_URL env var",
      message: "YOU_API_URL env var overrides apiUrl from ~/.you/config.json; YOUMD_API_URL remains a legacy alias",
    });
  }

  // Repo project-context files shadowing global overlay copies — one line.
  const resolved = resolveProjectContext({ cwd });
  const shadowedFiles = resolved.entries.filter((entry) => entry.shadows);
  if (shadowedFiles.length > 0) {
    const names = shadowedFiles.map((entry) => entry.fileName).join(", ");
    warnings.push({
      domain: "project-context",
      shadowed: `global overlay copies (${shortenHome(resolved.globalContextDir || "")})`,
      shadowedBy: `repo project-context/ (${shortenHome(resolved.repoContextDir || "")})`,
      message: `repo project-context/ shadows ${shadowedFiles.length} global overlay file${shadowedFiles.length === 1 ? "" : "s"} (${names}) — repo wins`,
    });
  }

  // Canonical stack layout shadowing legacy manifest locations — one line.
  try {
    const candidates = findYouStackManifestCandidates(cwd);
    const canonical = candidates.find((candidate) => isCanonicalYouStackManifestPath(candidate));
    const legacy = candidates.filter((candidate) => !isCanonicalYouStackManifestPath(candidate));
    if (canonical && legacy.length > 0) {
      warnings.push({
        domain: "stack",
        shadowed: legacy.map((entry) => shortenHome(entry)).join(", "),
        shadowedBy: shortenHome(canonical),
        message: `legacy stack manifest${legacy.length === 1 ? "" : "s"} ${legacy.map((entry) => shortenHome(entry)).join(", ")} shadowed by canonical ${shortenHome(canonical)}`,
      });
    }
  } catch {
    // stack discovery is best-effort for shadow warnings
  }

  return warnings;
}

// ─── P20: active roots (youmd status) ─────────────────────────────────

export interface ActiveRoots {
  /** Global config file path. */
  configPath: string;
  /** Env overrides currently active (e.g. YOU_API_KEY). */
  envOverrides: string[];
  /** Local ./.you bundle dir when it looks initialized. */
  localBundleDir: string | null;
  /** Repo project-context/ dir in effect for the cwd (null when absent). */
  repoContextDir: string | null;
  /** Global overlay dir for the resolved project (null when absent on disk). */
  globalOverlayDir: string | null;
  /** Stack manifest in effect for the cwd (null when none discovered). */
  stackManifest: string | null;
  stackLayout: "canonical" | "legacy" | null;
}

export function getActiveRoots(cwd: string = process.cwd()): ActiveRoots {
  const envOverrides: string[] = [];
  if (getEnvApiKey()) envOverrides.push(process.env.YOU_API_KEY?.trim() ? "YOU_API_KEY" : "YOUMD_API_KEY");
  if (getEnvApiUrl()) envOverrides.push(process.env.YOU_API_URL?.trim() ? "YOU_API_URL" : "YOUMD_API_URL");

  const localBundle = path.resolve(cwd, ".you");
  const legacyLocalBundle = path.resolve(cwd, ".youmd");
  const resolved = resolveProjectContext({ cwd });

  let stackManifest: string | null = null;
  try {
    stackManifest = findYouStackManifestCandidates(cwd)[0] || null;
  } catch {
    stackManifest = null;
  }

  return {
    configPath: getGlobalConfigPath(),
    envOverrides,
    localBundleDir: bundleLooksInitialized(localBundle)
      ? localBundle
      : bundleLooksInitialized(legacyLocalBundle)
        ? legacyLocalBundle
        : null,
    repoContextDir: resolved.repoContextDir,
    globalOverlayDir:
      resolved.globalDir && fs.existsSync(resolved.globalDir) ? resolved.globalDir : null,
    stackManifest,
    stackLayout: stackManifest
      ? isCanonicalYouStackManifestPath(stackManifest)
        ? "canonical"
        : "legacy"
      : null,
  };
}

export interface ActiveRootLine {
  label: string;
  value: string;
}

/** Render active roots as label/value lines for `youmd status`. */
export function buildActiveRootsLines(roots: ActiveRoots): ActiveRootLine[] {
  const lines: ActiveRootLine[] = [];

  const configSuffix = roots.envOverrides.length > 0
    ? ` (env: ${roots.envOverrides.join(", ")})`
    : "";
  const configValue = roots.localBundleDir
    ? `${shortenHome(roots.localBundleDir)} (local) + ${shortenHome(roots.configPath)}${configSuffix}`
    : `${shortenHome(roots.configPath)}${configSuffix}`;
  lines.push({ label: "config", value: configValue });

  const projectParts: string[] = [];
  if (roots.repoContextDir) projectParts.push(`${shortenHome(roots.repoContextDir)} (repo)`);
  if (roots.globalOverlayDir) projectParts.push(`${shortenHome(roots.globalOverlayDir)} (overlay)`);
  lines.push({
    label: "project",
    value: projectParts.length > 0 ? projectParts.join(" + ") : "none detected",
  });

  lines.push({
    label: "stack",
    value: roots.stackManifest
      ? `${shortenHome(roots.stackManifest)} (${roots.stackLayout})`
      : "none detected",
  });

  return lines;
}
