import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CANONICAL_GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".you");
const LEGACY_GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".youmd");
const GLOBAL_CONFIG_DIR = resolveYouHomeDir();
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, "config.json");
const LEGACY_GLOBAL_CONFIG_FILE = path.join(LEGACY_GLOBAL_CONFIG_DIR, "config.json");
const LOCAL_BUNDLE_DIR = ".you";
const LEGACY_LOCAL_BUNDLE_DIR = ".youmd";
const DEFAULT_API_URL = "https://kindly-cassowary-600.convex.site";
const DEFAULT_APP_URL = "https://you.md";

export interface GlobalConfig {
  token?: string;
  username?: string;
  email?: string;
  apiUrl?: string;
  appUrl?: string;
  avatarUrl?: string;
  openrouterKey?: string;
  lastCliLatestVersion?: string;
  lastCliUpdateCheckAt?: string;
  /**
   * folder.md API key (`fmd_live_…`) for large-file/media offload. Manual today; the
   * autonomous server-to-server provisioning (no user paste) lands with the folder.md side —
   * see project-context/FOLDERMD_NATIVE_INTEGRATION_PLAN_2026-06-26.md.
   */
  folderMdKey?: string;
  /** folder.md folder/workspace id that holds this user's you.md media. */
  folderMdFolderId?: string;
  /**
   * This machine accepts remote requests to launch/stop autonomous worker agents
   * (orchestrator agent.spawn/agent.stop). Off by default; persisted here so the resident
   * daemon — whose process env does NOT carry shell exports — can read the opt-in. Set via
   * `you orchestrate host on`.
   */
  remoteAgentHost?: boolean;
}

export interface LocalConfig {
  version: number;
  sources: Array<{ type: string; url: string; addedAt: string }>;
  lastPublished?: string;
  lastKnownRemoteVersion?: number;
  lastPulledHash?: string;      // contentHash of last bundle pulled from remote
  lastPushedHash?: string;      // contentHash of last bundle pushed to remote
  localContentHash?: string;    // contentHash of current local compiled bundle
  lastPulledStableHash?: string; // timestamp-insensitive hash of the bundle as written by pull (dirty-check baseline)
}

function resolveYouHomeDir(): string {
  const explicit = process.env.YOU_HOME?.trim() || process.env.YOUMD_HOME?.trim();
  if (explicit) return path.resolve(explicit.replace(/^~(?=$|\/)/, os.homedir()));
  return CANONICAL_GLOBAL_CONFIG_DIR;
}

export function getCanonicalGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getLegacyGlobalConfigDir(): string {
  return LEGACY_GLOBAL_CONFIG_DIR;
}

export function getLegacyGlobalConfigPath(): string {
  return LEGACY_GLOBAL_CONFIG_FILE;
}

export function getLegacyHomeBundleDir(): string {
  return LEGACY_GLOBAL_CONFIG_DIR;
}

function resolveReadableHomeBundleDir(): string {
  if (bundleLooksInitialized(GLOBAL_CONFIG_DIR) || fs.existsSync(GLOBAL_CONFIG_FILE)) return GLOBAL_CONFIG_DIR;
  if (!process.env.YOU_HOME && bundleLooksInitialized(LEGACY_GLOBAL_CONFIG_DIR)) return LEGACY_GLOBAL_CONFIG_DIR;
  return GLOBAL_CONFIG_DIR;
}

function resolveReadableGlobalConfigPath(): string {
  if (fs.existsSync(GLOBAL_CONFIG_FILE)) return GLOBAL_CONFIG_FILE;
  if (!process.env.YOU_HOME && fs.existsSync(LEGACY_GLOBAL_CONFIG_FILE)) return LEGACY_GLOBAL_CONFIG_FILE;
  return GLOBAL_CONFIG_FILE;
}

export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getHomeBundleDir(): string {
  return resolveReadableHomeBundleDir();
}

export function getGlobalConfigPath(): string {
  return resolveReadableGlobalConfigPath();
}

export function getLocalBundleDir(): string {
  return path.resolve(process.cwd(), LOCAL_BUNDLE_DIR);
}

export function getLegacyLocalBundleDir(): string {
  return path.resolve(process.cwd(), LEGACY_LOCAL_BUNDLE_DIR);
}

export function getWritableHomeBundleDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getWritableGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

export function getBundleConfigPath(bundleDir: string): string {
  return path.join(bundleDir, "config.json");
}

export function bundleLooksInitialized(bundleDir: string): boolean {
  return (
    fs.existsSync(path.join(bundleDir, "you.json")) ||
    fs.existsSync(path.join(bundleDir, "profile")) ||
    fs.existsSync(path.join(bundleDir, "preferences"))
  );
}

export function resolveActiveBundleDir(): string | null {
  const localDir = getLocalBundleDir();
  if (bundleLooksInitialized(localDir)) return localDir;
  const legacyLocalDir = getLegacyLocalBundleDir();
  if (bundleLooksInitialized(legacyLocalDir)) return legacyLocalDir;

  const homeDir = getHomeBundleDir();
  if (bundleLooksInitialized(homeDir)) return homeDir;

  return null;
}

// ─── T7: home-first bundle resolution for identity sync ──────────────
//
// pull/push/sync are IDENTITY operations — they default to the home brain
// (~/.you/) ALWAYS. Operating on a project-local .you/ requires either
// the explicit --local flag or a deliberate marker file
// (.you/youmd.local.json) written by `youmd init` / a previous --local
// run. This stops `youmd pull` inside a random repo from scattering
// identity copies into project-local .you/ directories.

const LOCAL_BUNDLE_MARKER_FILE = "youmd.local.json";

export interface BundleDirResolution {
  /** The bundle directory pull/push/sync should operate on. */
  dir: string;
  scope: "home" | "local";
  /** Why this scope was chosen. */
  reason: "flag" | "marker" | "default" | "home-is-cwd";
  /** Whether an initialized project-local .you/ or legacy .youmd/ exists in cwd. */
  localBundlePresent: boolean;
}

export function getLocalBundleMarkerPath(bundleDir: string): string {
  return path.join(bundleDir, LOCAL_BUNDLE_MARKER_FILE);
}

export function hasLocalBundleMarker(bundleDir: string): boolean {
  return fs.existsSync(getLocalBundleMarkerPath(bundleDir));
}

/**
 * Canonicalize a path for comparison: resolve symlinks where possible
 * (macOS tmp/home paths often traverse /var → /private/var) and fall back
 * to plain resolution when the path doesn't exist yet.
 */
function canonicalPath(p: string): string {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    try {
      return path.join(fs.realpathSync(path.dirname(resolved)), path.basename(resolved));
    } catch {
      return resolved;
    }
  }
}

export function isHomeBundleDir(bundleDir: string): boolean {
  return canonicalPath(bundleDir) === canonicalPath(getHomeBundleDir());
}

/**
 * Mark a project-local .you/ as a deliberate local bundle. Idempotent.
 * Never marks the home bundle dir — home needs no marker.
 */
export function markLocalBundle(bundleDir: string): void {
  if (isHomeBundleDir(bundleDir)) return;
  fs.mkdirSync(bundleDir, { recursive: true });
  const markerPath = getLocalBundleMarkerPath(bundleDir);
  if (!fs.existsSync(markerPath)) {
    writeJsonAtomic(markerPath, { localBundle: true, createdAt: new Date().toISOString() }, 0o644);
  }
}

/**
 * Resolve the bundle dir for identity sync operations (pull/push/sync).
 *
 * Home-first: defaults to ~/.you/. A project-local .you/ is used only
 * when explicitly requested (--local) or deliberately marked
 * (.you/youmd.local.json). When cwd IS the home directory, local and home
 * are the same dir.
 */
export function resolveSyncBundleDir(options: { local?: boolean } = {}): BundleDirResolution {
  const localDir = getLocalBundleDir();
  const legacyLocalDir = getLegacyLocalBundleDir();
  const homeDir = getWritableHomeBundleDir();

  if (isHomeBundleDir(localDir)) {
    return { dir: homeDir, scope: "home", reason: "home-is-cwd", localBundlePresent: false };
  }

  const localBundlePresent = bundleLooksInitialized(localDir) || bundleLooksInitialized(legacyLocalDir);

  if (options.local) {
    const explicitLocal = bundleLooksInitialized(localDir) || !bundleLooksInitialized(legacyLocalDir) ? localDir : legacyLocalDir;
    return { dir: explicitLocal, scope: "local", reason: "flag", localBundlePresent };
  }
  if (hasLocalBundleMarker(localDir)) {
    return { dir: localDir, scope: "local", reason: "marker", localBundlePresent };
  }
  if (hasLocalBundleMarker(legacyLocalDir)) {
    return { dir: legacyLocalDir, scope: "local", reason: "marker", localBundlePresent };
  }
  return { dir: homeDir, scope: "home", reason: "default", localBundlePresent };
}

/**
 * One-line notice explaining which bundle root is in use and how to target
 * the other. Returns null when there is nothing ambiguous to explain.
 * Callers print it dim — this stays plain text so it is unit-testable.
 */
export function bundleResolutionNotice(res: BundleDirResolution): string | null {
  if (res.scope === "home" && res.localBundlePresent) {
    return `using home bundle ${res.dir} (project-local .you/.youmd ignored — pass --local to target it)`;
  }
  if (res.scope === "local") {
    const why = res.reason === "flag" ? "--local" : "youmd.local.json marker";
    return `using project-local bundle ${res.dir} (${why}) — omit --local and remove the marker to target ~/.you`;
  }
  return null;
}

// ─── T7: auto-gitignore project-local .you/ ─────────────────────────

/** Walk up from startDir looking for a .git directory. */
export function findGitRoot(startDir: string): string | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (dir === root) return null;
    dir = path.dirname(dir);
  }
}

const GITIGNORE_YOUMD_PATTERNS = new Set([
  ".you",
  ".you/",
  "/.you",
  "/.you/",
  "**/.you",
  "**/.you/",
  ".youmd",
  ".youmd/",
  "/.youmd",
  "/.youmd/",
  "**/.youmd",
  "**/.youmd/",
]);

const GITIGNORE_YOUMD_BLOCK =
  "# You.md identity bundle — never commit identity data\n.you/\n.youmd/\n";

/**
 * Ensure the repo containing a project-local .you/ gitignores it, so
 * identity data is never silently committed. Appends `.you/` and legacy
 * `.youmd/` when a
 * .gitignore exists without coverage; creates one at the git root when the
 * repo has none; no-ops outside a git repo or when already covered.
 */
export function ensureYoumdGitignored(
  bundleDir: string
): "appended" | "created" | "covered" | "no-repo" {
  if (isHomeBundleDir(bundleDir)) return "no-repo";
  const gitRoot = findGitRoot(path.dirname(path.resolve(bundleDir)));
  if (!gitRoot) return "no-repo";

  const gitignorePath = path.join(gitRoot, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, GITIGNORE_YOUMD_BLOCK);
    return "created";
  }

  const content = fs.readFileSync(gitignorePath, "utf-8");
  const covered = content
    .split("\n")
    .some((line) => GITIGNORE_YOUMD_PATTERNS.has(line.trim()));
  if (covered) return "covered";

  const sep = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  fs.appendFileSync(gitignorePath, `${sep}\n${GITIGNORE_YOUMD_BLOCK}`);
  return "appended";
}

// ─── Headless auth env overrides ─────────────────────────────────────
// YOU_API_KEY / YOU_API_URL let agents and CI run authenticated
// commands with zero filesystem state (no ~/.you/config.json needed).
// YOUMD_* remains supported as a legacy alias.
// Env always wins over the config file.

export function getEnvApiKey(): string | undefined {
  const key = process.env.YOU_API_KEY?.trim() || process.env.YOUMD_API_KEY?.trim();
  return key || undefined;
}

export function getEnvApiUrl(): string | undefined {
  const url = process.env.YOU_API_URL?.trim() || process.env.YOUMD_API_URL?.trim();
  return url || undefined;
}

/** Resolve the auth token: YOU_API_KEY env var first, then config file. */
export function getAuthToken(): string | undefined {
  return getEnvApiKey() || readGlobalConfig().token || undefined;
}

export function getConvexSiteUrl(): string {
  const envUrl = getEnvApiUrl();
  if (envUrl) return envUrl;
  const config = readGlobalConfig();
  return config.apiUrl || DEFAULT_API_URL;
}

export function getAppUrl(): string {
  const config = readGlobalConfig();
  return config.appUrl || DEFAULT_APP_URL;
}

export function getDefaultConvexSiteUrl(): string {
  return DEFAULT_API_URL;
}

export function getDefaultAppUrl(): string {
  return DEFAULT_APP_URL;
}

// ─── Atomic, locked config writes ─────────────────────────────────────

/**
 * Write JSON to a file atomically: write to a tmp file in the same
 * directory, then rename over the target (atomic on the same volume).
 * Prevents partial/corrupt files when parallel agents write concurrently.
 */
export function writeJsonAtomic(file: string, data: unknown, mode = 0o600): void {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", { mode });
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* tmp may not exist */ }
    throw err;
  }
}

/** Synchronous sleep without busy-looping (Atomics.wait works on the Node main thread). */
function sleepSync(ms: number): void {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    // SharedArrayBuffer unavailable — skip the wait
  }
}

const LOCK_STALE_MS = 5000;

/**
 * Acquire a simple O_EXCL lockfile next to `file`. Retries 5x with ~50ms
 * jitter. Returns a release function, or null if the lock could not be
 * acquired (callers proceed anyway — the atomic rename still prevents
 * corruption; the lock just narrows read-modify-write races).
 */
function acquireFileLock(file: string): (() => void) | null {
  const lockPath = `${file}.lock`;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const fd = fs.openSync(lockPath, "wx"); // O_CREAT | O_EXCL
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return () => {
        try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
      };
    } catch {
      // Lock held — clear it if stale (holder crashed), else wait + retry
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch { /* lock vanished between attempts */ }
      sleepSync(40 + Math.floor(Math.random() * 40));
    }
  }
  return null;
}

/** Ensure ~/.you is 0700 and config.json is 0600 (fix on read if wrong). */
function enforceGlobalConfigPermissions(): void {
  if (process.platform === "win32") return;
  const configPath = resolveReadableGlobalConfigPath();
  const configDir = path.dirname(configPath);
  try {
    const dirMode = fs.statSync(configDir).mode & 0o777;
    if (dirMode !== 0o700) fs.chmodSync(configDir, 0o700);
  } catch { /* dir may not exist yet */ }
  try {
    const fileMode = fs.statSync(configPath).mode & 0o777;
    if (fileMode !== 0o600) fs.chmodSync(configPath, 0o600);
  } catch { /* file may not exist yet */ }
}

export function readGlobalConfig(): GlobalConfig {
  const configPath = resolveReadableGlobalConfigPath();
  if (!fs.existsSync(configPath)) {
    return {};
  }
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf-8");
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    enforceGlobalConfigPermissions();
    return parsed;
  } catch {
    // Preserve evidence instead of silently logging the user out
    try {
      fs.copyFileSync(configPath, configPath + ".bak");
      console.error(
        `warning: ${configPath} is corrupt — saved a copy to config.json.bak`
      );
    } catch {
      console.error(`warning: ${configPath} is corrupt and could not be backed up`);
    }
    return {};
  }
}

export function writeGlobalConfig(config: GlobalConfig): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  const release = acquireFileLock(GLOBAL_CONFIG_FILE);
  try {
    writeJsonAtomic(GLOBAL_CONFIG_FILE, config, 0o600);
    enforceGlobalConfigPermissions();
  } finally {
    if (release) release();
  }
}

export function clearGlobalAuth(options: { resetEndpoints?: boolean } = {}): void {
  const config = readGlobalConfig();
  delete config.token;
  delete config.username;
  delete config.email;
  delete config.avatarUrl;

  if (options.resetEndpoints) {
    delete config.apiUrl;
    delete config.appUrl;
  }

  writeGlobalConfig(config);
}

export function readLocalConfig(): LocalConfig | null {
  const configPath = getBundleConfigPath(getLocalBundleDir());
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readBundleConfig(bundleDir: string): LocalConfig | null {
  const configPath = getBundleConfigPath(bundleDir);
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeLocalConfig(config: LocalConfig): void {
  writeBundleConfig(getLocalBundleDir(), config);
}

/**
 * Bundle-dir-aware twin of writeLocalConfig (T7). Same lock + atomic-rename
 * write path; at the home bundle dir this file (~/.you/config.json) also
 * carries GlobalConfig fields — callers must read-modify-write via
 * readBundleConfig so those fields are preserved.
 */
export function writeBundleConfig(bundleDir: string, config: LocalConfig): void {
  fs.mkdirSync(bundleDir, { recursive: true });
  const configPath = getBundleConfigPath(bundleDir);
  const release = acquireFileLock(configPath);
  try {
    writeJsonAtomic(configPath, config);
  } finally {
    if (release) release();
  }
}

export function localBundleExists(): boolean {
  return fs.existsSync(getLocalBundleDir()) || fs.existsSync(getLegacyLocalBundleDir());
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// ─── Project Context Detection ────────────────────────────────────────

export interface YoumdProjectFile {
  name: string;
  description?: string;
  createdAt?: string;
}

export interface ProjectContext {
  root: string;
  name: string;
  marker: string; // which file triggered detection
  youmdProject?: YoumdProjectFile; // contents of .youmd-project if present
}

const PROJECT_MARKERS = [
  ".youmd-project",
  ".git",
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "Makefile",
];

/**
 * Walk up from cwd looking for project markers.
 *
 * Nearest-marker-wins: the first directory (walking up from cwd) that
 * contains ANY marker is the project root. Marker priority only breaks
 * ties between markers at that same depth. This prevents a stray
 * `.youmd-project` high in the tree (e.g. ~/Desktop) from outranking the
 * nested repo the user is actually working in.
 *
 * The home directory itself is never treated as a project root — dotfiles
 * and stray Makefiles in ~ are not a project.
 *
 * Returns project context if found, null otherwise.
 */
export function detectProjectContext(): ProjectContext | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;
  const home = os.homedir();

  while (dir !== root) {
    if (dir !== home) {
      const found: ProjectContext[] = [];

      for (const marker of PROJECT_MARKERS) {
        const markerPath = path.join(dir, marker);
        const isDir = marker === ".git";

        if (isDir) {
          if (fs.existsSync(markerPath) && fs.statSync(markerPath).isDirectory()) {
            found.push(buildProjectContext(dir, marker));
          }
        } else {
          if (fs.existsSync(markerPath) && fs.statSync(markerPath).isFile()) {
            found.push(buildProjectContext(dir, marker));
          }
        }
      }

      if (found.length > 0) {
        // Equal-depth tie-break preserves the original marker priorities.
        return (
          found.find((candidate) => candidate.marker === ".youmd-project") ||
          found.find((candidate) => candidate.marker === ".git") ||
          found.find((candidate) => fs.existsSync(path.join(candidate.root, "AGENTS.md"))) ||
          found.find((candidate) => fs.existsSync(path.join(candidate.root, "project-context"))) ||
          found[0]
        );
      }
    }

    dir = path.dirname(dir);
  }

  return null;
}

function buildProjectContext(projectRoot: string, marker: string): ProjectContext {
  // Check for .youmd-project first (highest priority for name/description)
  const youmdProjectPath = path.join(projectRoot, ".youmd-project");
  let youmdProject: YoumdProjectFile | undefined;

  if (fs.existsSync(youmdProjectPath)) {
    try {
      youmdProject = JSON.parse(fs.readFileSync(youmdProjectPath, "utf-8"));
    } catch {
      // malformed — ignore
    }
  }

  // Determine project name
  let name = youmdProject?.name || "";

  if (!name) {
    // Try package.json
    const pkgPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name && typeof pkg.name === "string") {
          name = pkg.name;
        }
      } catch {
        // skip
      }
    }
  }

  // Fallback to directory name
  if (!name) {
    name = path.basename(projectRoot);
  }

  return {
    root: projectRoot,
    name,
    marker,
    youmdProject,
  };
}

// Project store path helpers (slug, ~/.you/projects/<name>/ dirs, private
// notes) live in lib/projectContext.ts — the single project-context engine.
// The duplicate copies that used to live here were removed (PRODUCT-AUDIT #14).

// ─── Skills Directories ──────────────────────────────────────────────

/**
 * Global skills directory: ~/.you/skills/
 */
export function getSkillsDir(): string {
  return path.join(GLOBAL_CONFIG_DIR, "skills");
}

/**
 * Global skill catalog path: ~/.you/skills/youmd-skills.yaml
 */
export function getSkillCatalogPath(): string {
  return path.join(getSkillsDir(), "youmd-skills.yaml");
}

/**
 * Skill metrics path: ~/.you/skills/skill-metrics.json
 */
export function getSkillMetricsPath(): string {
  return path.join(getSkillsDir(), "skill-metrics.json");
}

/**
 * Per-project skills directory: .you/skills/ in cwd
 */
export function getProjectSkillsDir(): string {
  return path.resolve(process.cwd(), LOCAL_BUNDLE_DIR, "skills");
}

/**
 * Ensure the global skills directory exists.
 */
export function ensureSkillsDir(): string {
  const dir = getSkillsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
