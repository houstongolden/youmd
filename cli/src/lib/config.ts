import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const GLOBAL_CONFIG_DIR = path.join(os.homedir(), ".youmd");
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, "config.json");
const LOCAL_BUNDLE_DIR = ".youmd";
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
}

export interface LocalConfig {
  version: number;
  sources: Array<{ type: string; url: string; addedAt: string }>;
  lastPublished?: string;
  lastKnownRemoteVersion?: number;
  lastPulledHash?: string;      // contentHash of last bundle pulled from remote
  lastPushedHash?: string;      // contentHash of last bundle pushed to remote
  localContentHash?: string;    // contentHash of current local compiled bundle
}

export function getGlobalConfigDir(): string {
  return GLOBAL_CONFIG_DIR;
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

export function getLocalBundleDir(): string {
  return path.resolve(process.cwd(), LOCAL_BUNDLE_DIR);
}

export function getConvexSiteUrl(): string {
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

export function readGlobalConfig(): GlobalConfig {
  if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function writeGlobalConfig(config: GlobalConfig): void {
  if (!fs.existsSync(GLOBAL_CONFIG_DIR)) {
    fs.mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
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
  const configPath = path.join(getLocalBundleDir(), "config.json");
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
  const configPath = path.join(getLocalBundleDir(), "config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function localBundleExists(): boolean {
  return fs.existsSync(getLocalBundleDir());
}

export function isAuthenticated(): boolean {
  const config = readGlobalConfig();
  return !!config.token;
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
 * Returns project context if found, null otherwise.
 */
export function detectProjectContext(): ProjectContext | null {
  let dir = process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const marker of PROJECT_MARKERS) {
      const markerPath = path.join(dir, marker);
      const isDir = marker === ".git";

      if (isDir) {
        if (fs.existsSync(markerPath) && fs.statSync(markerPath).isDirectory()) {
          return buildProjectContext(dir, marker);
        }
      } else {
        if (fs.existsSync(markerPath) && fs.statSync(markerPath).isFile()) {
          return buildProjectContext(dir, marker);
        }
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

/**
 * Sanitize a project name for use as a directory name.
 */
function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Get the global .youmd/projects/{project-name}/ directory for project-specific files.
 */
export function getProjectBundleDir(projectName: string): string {
  return path.join(GLOBAL_CONFIG_DIR, "projects", sanitizeProjectName(projectName));
}

/**
 * Get the private context directory for a project.
 */
export function getProjectPrivateDir(projectName: string): string {
  return path.join(getProjectBundleDir(projectName), "private");
}

/**
 * Ensure the project bundle directory structure exists.
 */
export function ensureProjectDirs(projectName: string): string {
  const projectDir = getProjectBundleDir(projectName);
  const privateDir = path.join(projectDir, "private");
  fs.mkdirSync(privateDir, { recursive: true });
  return projectDir;
}

/**
 * Read project-specific private notes from .youmd/projects/{name}/private/notes.md
 */
export function readProjectPrivateNotes(projectName: string): string | null {
  const notesPath = path.join(getProjectPrivateDir(projectName), "notes.md");
  if (!fs.existsSync(notesPath)) return null;
  try {
    return fs.readFileSync(notesPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write project-specific private notes.
 */
export function writeProjectPrivateNotes(projectName: string, content: string): void {
  const privateDir = getProjectPrivateDir(projectName);
  fs.mkdirSync(privateDir, { recursive: true });
  fs.writeFileSync(path.join(privateDir, "notes.md"), content);
}

/**
 * Read project-specific config/context from .youmd/projects/{name}/context.json
 */
export function readProjectContext(projectName: string): Record<string, unknown> | null {
  const contextPath = path.join(getProjectBundleDir(projectName), "context.json");
  if (!fs.existsSync(contextPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(contextPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Write project-specific context.
 */
export function writeProjectContext(projectName: string, context: Record<string, unknown>): void {
  const projectDir = getProjectBundleDir(projectName);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, "context.json"), JSON.stringify(context, null, 2) + "\n");
}

// ─── Skills Directories ──────────────────────────────────────────────

/**
 * Global skills directory: ~/.youmd/skills/
 */
export function getSkillsDir(): string {
  return path.join(GLOBAL_CONFIG_DIR, "skills");
}

/**
 * Global skill catalog path: ~/.youmd/skills/youmd-skills.yaml
 */
export function getSkillCatalogPath(): string {
  return path.join(getSkillsDir(), "youmd-skills.yaml");
}

/**
 * Skill metrics path: ~/.youmd/skills/skill-metrics.json
 */
export function getSkillMetricsPath(): string {
  return path.join(getSkillsDir(), "skill-metrics.json");
}

/**
 * Per-project skills directory: .youmd/skills/ in cwd
 */
export function getProjectSkillsDir(): string {
  return path.resolve(process.cwd(), ".youmd", "skills");
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

/**
 * List all known projects from .youmd/projects/
 */
export function listProjects(): Array<{ name: string; dir: string }> {
  const projectsDir = path.join(GLOBAL_CONFIG_DIR, "projects");
  if (!fs.existsSync(projectsDir)) return [];

  try {
    return fs
      .readdirSync(projectsDir)
      .filter((entry) => {
        const entryPath = path.join(projectsDir, entry);
        return fs.statSync(entryPath).isDirectory();
      })
      .map((entry) => ({
        name: entry,
        dir: path.join(projectsDir, entry),
      }));
  } catch {
    return [];
  }
}
