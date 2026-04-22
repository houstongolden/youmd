import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────

export interface ProjectMeta {
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectMemory {
  category: string;
  content: string;
  created_at: string;
}

export interface RecentProjectInsight {
  name: string;
  slug: string;
  projectDir: string;
  updatedAt: number;
  signals: string[];
  summary: string;
  suggestedCommand: string;
}

export function getFeaturedRecentProjectNames(
  recentInsights: Array<{ name: string; signals: string[] }>,
  limit = 3,
): string[] {
  const featured: string[] = [];
  const pushUnique = (name: string) => {
    if (!featured.includes(name)) featured.push(name);
  };

  for (const insight of recentInsights) {
    if (insight.signals.length > 0) pushUnique(insight.name);
    if (featured.length >= limit) return featured;
  }

  for (const insight of recentInsights) {
    pushUnique(insight.name);
    if (featured.length >= limit) return featured;
  }

  return featured;
}

export function getTopProjectOpportunity(
  recentInsights: RecentProjectInsight[],
): RecentProjectInsight | null {
  return recentInsights.find((item) => item.signals.length > 0) || recentInsights[0] || null;
}

const STANDARD_WORKSPACE_ROOTS = [
  "Projects",
  "projects",
  "Code",
  "code",
  "Developer",
  "Development",
  "dev",
  "Workspace",
  "workspace",
  "Workspaces",
  "workspaces",
  "Repos",
  "repos",
  "Repositories",
  "GitHub",
  "github",
  "Desktop/Projects",
  "Desktop/projects",
  "Desktop/Code",
  "Desktop/code",
  "Desktop/Developer",
  "Desktop/dev",
  "Desktop/Repos",
  "Desktop/repos",
];

const WORKSPACE_ROOT_BASENAMES = new Set([
  "projects",
  "code",
  "developer",
  "development",
  "dev",
  "workspace",
  "workspaces",
  "repos",
  "repositories",
  "github",
]);

const PROJECT_MARKER_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  "Gemfile",
  "deno.json",
  "bun.lock",
  "pnpm-lock.yaml",
  ".youmd-project",
];

const PROJECT_MARKER_DIRS = [
  ".git",
  ".agents",
  ".claude",
  ".claw",
  "project-context",
  ".youmd",
];

const DISCOVERY_SKIP_DIRS = new Set([
  "Applications",
  "Library",
  "Movies",
  "Music",
  "Pictures",
  "Public",
  "Downloads",
  "node_modules",
  ".cache",
  ".Trash",
]);

export interface ProjectPreferences {
  tone: string;
  stack: string;
  focus: string;
  [key: string]: string;
}

export interface ProjectContext {
  meta: ProjectMeta;
  instructions: string;
  preferences: ProjectPreferences;
  prd: string;
  todo: string;
  features: string;
  changelog: string;
  decisions: string;
  memories: ProjectMemory[];
  privateNotes: string;
}

// ─── Templates ────────────────────────────────────────────────────────

function prdTemplate(name: string): string {
  return `# ${name}\n\n## Overview\n\n## Goals\n\n## Requirements\n\n## Non-Goals\n`;
}

function todoTemplate(): string {
  return `# TODO\n\n## In Progress\n\n## Backlog\n\n## Done\n`;
}

function featuresTemplate(): string {
  return `# Features\n\n## Requested\n\n## In Progress\n\n## Shipped\n`;
}

function changelogTemplate(): string {
  return `# Changelog\n\n`;
}

function decisionsTemplate(): string {
  return `# Decisions\n\n`;
}

function instructionsTemplate(): string {
  return `# Agent Instructions\n\nProject-specific instructions for AI agents working on this project.\n`;
}

function preferencesTemplate(): ProjectPreferences {
  return { tone: "direct", stack: "", focus: "" };
}

function projectMetaTemplate(name: string, description: string): ProjectMeta {
  const now = new Date().toISOString();
  return {
    name,
    description,
    created_at: now,
    updated_at: now,
  };
}

// ─── Core functions ───────────────────────────────────────────────────

/**
 * Creates the full project directory structure with default template files.
 */
export function initProjectFiles(projectDir: string, projectName: string, description = ""): void {
  const dirs = [
    projectDir,
    path.join(projectDir, "private"),
    path.join(projectDir, "context"),
    path.join(projectDir, "agent"),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // project.json
  const metaPath = path.join(projectDir, "project.json");
  if (!fs.existsSync(metaPath)) {
    fs.writeFileSync(metaPath, JSON.stringify(projectMetaTemplate(projectName, description), null, 2) + "\n");
  }

  // private/
  writeIfMissing(path.join(projectDir, "private", "notes.md"), "# Private Notes\n\n");
  writeIfMissing(path.join(projectDir, "private", "links.json"), JSON.stringify([], null, 2) + "\n");
  writeIfMissing(path.join(projectDir, "private", "projects.json"), JSON.stringify([], null, 2) + "\n");

  // context/
  writeIfMissing(path.join(projectDir, "context", "prd.md"), prdTemplate(projectName));
  writeIfMissing(path.join(projectDir, "context", "todo.md"), todoTemplate());
  writeIfMissing(path.join(projectDir, "context", "features.md"), featuresTemplate());
  writeIfMissing(path.join(projectDir, "context", "changelog.md"), changelogTemplate());
  writeIfMissing(path.join(projectDir, "context", "decisions.md"), decisionsTemplate());

  // agent/
  writeIfMissing(path.join(projectDir, "agent", "instructions.md"), instructionsTemplate());
  writeIfMissing(path.join(projectDir, "agent", "preferences.json"), JSON.stringify(preferencesTemplate(), null, 2) + "\n");
  writeIfMissing(path.join(projectDir, "agent", "memory.json"), JSON.stringify([], null, 2) + "\n");
}

/**
 * Reads all project context files and returns a structured object.
 * Returns null if the project directory doesn't exist or has no project.json.
 */
export function readProjectContext(projectDir: string): ProjectContext | null {
  const metaPath = path.join(projectDir, "project.json");
  if (!fs.existsSync(metaPath)) return null;

  let meta: ProjectMeta;
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }

  return {
    meta,
    instructions: readFileOrDefault(path.join(projectDir, "agent", "instructions.md"), ""),
    preferences: readJsonOrDefault<ProjectPreferences>(path.join(projectDir, "agent", "preferences.json"), preferencesTemplate()),
    prd: readFileOrDefault(path.join(projectDir, "context", "prd.md"), ""),
    todo: readFileOrDefault(path.join(projectDir, "context", "todo.md"), ""),
    features: readFileOrDefault(path.join(projectDir, "context", "features.md"), ""),
    changelog: readFileOrDefault(path.join(projectDir, "context", "changelog.md"), ""),
    decisions: readFileOrDefault(path.join(projectDir, "context", "decisions.md"), ""),
    memories: readJsonOrDefault<ProjectMemory[]>(path.join(projectDir, "agent", "memory.json"), []),
    privateNotes: readFileOrDefault(path.join(projectDir, "private", "notes.md"), ""),
  };
}

/**
 * Writes content to a specific file within the project directory.
 * Creates parent directories if needed.
 */
export function updateProjectFile(projectDir: string, filePath: string, content: string): void {
  const fullPath = path.join(projectDir, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);

  // Touch updated_at in project.json
  const metaPath = path.join(projectDir, "project.json");
  if (fs.existsSync(metaPath)) {
    try {
      const meta: ProjectMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      meta.updated_at = new Date().toISOString();
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
    } catch {
      // non-fatal
    }
  }
}

/**
 * Reads the project memory.json file.
 */
export function getProjectMemories(projectDir: string): ProjectMemory[] {
  return readJsonOrDefault<ProjectMemory[]>(path.join(projectDir, "agent", "memory.json"), []);
}

/**
 * Appends a memory entry to the project's memory.json.
 */
export function addProjectMemory(projectDir: string, memory: { category: string; content: string }): void {
  const memPath = path.join(projectDir, "agent", "memory.json");
  const existing = readJsonOrDefault<ProjectMemory[]>(memPath, []);

  existing.push({
    category: memory.category,
    content: memory.content,
    created_at: new Date().toISOString(),
  });

  const dir = path.dirname(memPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(memPath, JSON.stringify(existing, null, 2) + "\n");
}

// ─── Project detection ────────────────────────────────────────────────

/**
 * Finds the .youmd/projects directory, searching upward from cwd.
 * Returns the path to the projects dir, or null if not found.
 */
export function findProjectsRoot(startDir?: string): string | null {
  let dir = startDir || process.cwd();
  const root = path.parse(dir).root;

  while (dir !== root) {
    const candidate = path.join(dir, ".youmd", "projects");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Lists all project names under .youmd/projects/.
 */
export function listProjects(projectsRoot: string): string[] {
  if (!fs.existsSync(projectsRoot)) return [];
  return fs
    .readdirSync(projectsRoot)
    .filter((name) => {
      const projectJson = path.join(projectsRoot, name, "project.json");
      return fs.existsSync(projectJson);
    })
    .sort();
}

function readProjectMeta(projectDir: string): ProjectMeta | null {
  const metaPath = path.join(projectDir, "project.json");
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as ProjectMeta;
  } catch {
    return null;
  }
}

function readTrimmed(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  try {
    return fs.readFileSync(filePath, "utf-8").trim();
  } catch {
    return "";
  }
}

function contentHasSubstance(content: string, template: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (trimmed === template.trim()) return false;

  const meaningfulLines = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("##"));

  return meaningfulLines.length > 0;
}

function quoteShellArg(value: string): string {
  if (/^[a-zA-Z0-9._/-]+$/.test(value)) return value;
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function countMarkdownFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  try {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) total += countMarkdownFiles(fullPath);
      else if (entry.isFile() && entry.name.endsWith(".md")) total += 1;
    }
    return total;
  } catch {
    return 0;
  }
}

function buildProjectSignals(projectDir: string, projectName: string): string[] {
  const signals: string[] = [];

  const prd = readTrimmed(path.join(projectDir, "context", "prd.md"));
  const todo = readTrimmed(path.join(projectDir, "context", "todo.md"));
  const instructions = readTrimmed(path.join(projectDir, "agent", "instructions.md"));
  const memories = getProjectMemories(projectDir);
  const privateNotes = readTrimmed(path.join(projectDir, "private", "notes.md"));

  if (!contentHasSubstance(prd, prdTemplate(projectName))) {
    signals.push("still wants a real PRD");
  }
  if (!contentHasSubstance(todo, todoTemplate())) {
    signals.push("still has an empty TODO board");
  }
  if (!contentHasSubstance(instructions, instructionsTemplate())) {
    signals.push("could use sharper agent instructions");
  }
  if (memories.length === 0) {
    signals.push("has no project memory yet");
  }
  if (!privateNotes || privateNotes === "# Private Notes") {
    signals.push("has no private notes yet");
  }

  return signals;
}

export function getProjectMarkerSignals(projectDir: string): string[] {
  const signals: string[] = [];

  for (const marker of PROJECT_MARKER_FILES) {
    if (fs.existsSync(path.join(projectDir, marker))) {
      signals.push(marker);
    }
  }

  for (const marker of PROJECT_MARKER_DIRS) {
    if (fs.existsSync(path.join(projectDir, marker))) {
      signals.push(marker);
    }
  }

  return signals;
}

function discoverWorkspaceRootsFromProjectMarkers(seeds: string[], maxDirs = 700): string[] {
  const roots = new Set<string>();
  const seen = new Set<string>();
  let visited = 0;

  for (const seed of seeds) {
    if (visited >= maxDirs) break;
    if (!fs.existsSync(seed)) continue;

    const stack: Array<{ dir: string; depth: number }> = [{ dir: seed, depth: 0 }];
    while (stack.length > 0 && visited < maxDirs) {
      const current = stack.pop();
      if (!current) break;

      let realDir = current.dir;
      try {
        realDir = fs.realpathSync.native(current.dir);
      } catch {
        // use unresolved path for the seen set below
      }
      if (seen.has(realDir)) continue;
      seen.add(realDir);
      visited += 1;

      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current.dir, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".")) continue;
        if (DISCOVERY_SKIP_DIRS.has(entry.name)) continue;

        const child = path.join(current.dir, entry.name);
        const markers = getProjectMarkerSignals(child);
        if (markers.length > 0) {
          roots.add(path.dirname(child));
          continue;
        }

        if (current.depth < 2) {
          stack.push({ dir: child, depth: current.depth + 1 });
        }
      }
    }
  }

  return Array.from(roots);
}

export function getWorkspaceRootCandidates(startDir?: string): string[] {
  const roots = new Set<string>();
  const addRoot = (candidate: string) => {
    const resolved = path.resolve(candidate);
    if (resolved === path.parse(resolved).root) return;
    if (!fs.existsSync(resolved)) return;
    roots.add(resolved);
  };
  const envRoots = process.env.YOUMD_WORKSPACE_ROOTS
    ?.split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean) || [];

  for (const root of envRoots) {
    addRoot(root);
  }

  for (const relative of STANDARD_WORKSPACE_ROOTS) {
    addRoot(path.join(os.homedir(), relative));
  }

  const home = path.resolve(os.homedir());
  const discoverySeeds = [
    home,
    path.join(home, "Desktop"),
    path.join(home, "Documents"),
    ...STANDARD_WORKSPACE_ROOTS.map((relative) => path.join(home, relative)),
  ];
  for (const root of discoverWorkspaceRootsFromProjectMarkers(discoverySeeds)) {
    addRoot(root);
  }

  if (startDir) {
    const cwd = path.resolve(startDir);
    const cwdName = path.basename(cwd).toLowerCase();
    if (cwd !== home && WORKSPACE_ROOT_BASENAMES.has(cwdName)) {
      addRoot(cwd);
    }

    for (const candidate of [path.dirname(cwd), path.dirname(path.dirname(cwd))]) {
      const resolved = path.resolve(candidate);
      if (!resolved.startsWith(home + path.sep)) continue;
      if (resolved === home) continue;
      addRoot(resolved);
    }
  }

  return Array.from(roots).filter((root) => fs.existsSync(root));
}

function getWorkspaceProjectModifiedAt(projectDir: string): number {
  const candidates = [...PROJECT_MARKER_FILES, ...PROJECT_MARKER_DIRS].map((marker) =>
    path.join(projectDir, marker),
  );

  let latest = 0;
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      latest = Math.max(latest, fs.statSync(candidate).mtimeMs);
    } catch {
      // non-fatal
    }
  }
  return latest;
}

function buildWorkspaceSignals(projectDir: string): string[] {
  const hasAgents = fs.existsSync(path.join(projectDir, "AGENTS.md"));
  const hasClaude = fs.existsSync(path.join(projectDir, "CLAUDE.md"));
  const hasCodeMarker = getProjectMarkerSignals(projectDir).some((marker) =>
    !["AGENTS.md", "CLAUDE.md", "project-context", ".youmd-project", ".agents", ".claude", ".claw"].includes(marker),
  );
  const contextDir = path.join(projectDir, "project-context");
  const contextFiles = countMarkdownFiles(contextDir);
  const signals: string[] = [];

  if ((hasAgents || hasClaude) && contextFiles === 0) {
    signals.push("has agent instructions but still wants a project-context spine");
  } else if (!hasAgents && !hasClaude && contextFiles > 0) {
    signals.push("has project-context docs but no top-level agent entrypoint");
  } else if (contextFiles > 0 && contextFiles < 4) {
    signals.push("has a project-context directory, but it still feels thin");
  } else if (hasCodeMarker && !hasAgents && !hasClaude) {
    signals.push("has code markers but no agent entrypoint yet");
  } else if (!hasAgents && !hasClaude && contextFiles === 0) {
    signals.push("still looks unwired for agent-native work");
  }

  return signals;
}

function getWorkspaceProjectInsights(startDir?: string, limit = 5): RecentProjectInsight[] {
  const insights: RecentProjectInsight[] = [];
  const seen = new Set<string>();

  for (const root of getWorkspaceRootCandidates(startDir)) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const projectDir = path.join(root, entry.name);
      if (getProjectMarkerSignals(projectDir).length === 0) continue;

      const realDir = fs.realpathSync.native(projectDir);
      if (seen.has(realDir)) continue;
      seen.add(realDir);

      const signals = buildWorkspaceSignals(projectDir);
      insights.push({
        name: entry.name,
        slug: entry.name,
        projectDir,
        updatedAt: getWorkspaceProjectModifiedAt(projectDir),
        signals,
        summary: signals.length > 0 ? `${entry.name} ${signals[0]}.` : `${entry.name} already looks pretty well-shaped.`,
        suggestedCommand: `cd ${quoteShellArg(projectDir)} && you`,
      });
    }
  }

  return insights
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function getRecentProjectInsights(startDir?: string, limit = 3): RecentProjectInsight[] {
  const projectsRoot =
    findProjectsRoot(startDir) ||
    (fs.existsSync(path.join(os.homedir(), ".youmd", "projects"))
      ? path.join(os.homedir(), ".youmd", "projects")
      : null);
  const managedInsights = projectsRoot
    ? listProjects(projectsRoot).map((slug) => {
        const projectDir = path.join(projectsRoot, slug);
        const meta = readProjectMeta(projectDir);
        const projectName = meta?.name || slug;
        const updatedAt = meta?.updated_at ? Date.parse(meta.updated_at) : 0;
        const signals = buildProjectSignals(projectDir, projectName);
        return {
          name: projectName,
          slug,
          projectDir,
          updatedAt,
          signals,
          summary: signals.length > 0 ? `${projectName} ${signals[0]}.` : `${projectName} looks pretty well-shaped already.`,
          suggestedCommand: `youmd project show ${quoteShellArg(projectName)}`,
        };
      })
    : [];

  const combined = [...managedInsights, ...getWorkspaceProjectInsights(startDir, Math.max(limit * 2, 6))];
  const seen = new Set<string>();

  return combined
    .filter((item) => {
      const key = fs.existsSync(item.projectDir) ? fs.realpathSync.native(item.projectDir) : path.resolve(item.projectDir);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/**
 * Gets the project directory for a given project name.
 */
export function getProjectDir(projectsRoot: string, projectName: string): string {
  return path.join(projectsRoot, slugify(projectName));
}

/**
 * Detects current project based on cwd or git repo name.
 */
export function detectCurrentProject(projectsRoot: string): string | null {
  const cwd = process.cwd();
  const dirName = path.basename(cwd);
  const slug = slugify(dirName);

  // Check if a project matching the current directory name exists
  const candidatePath = path.join(projectsRoot, slug, "project.json");
  if (fs.existsSync(candidatePath)) {
    return slug;
  }

  return null;
}

/**
 * Builds the project context injection string for the LLM system prompt.
 */
export function buildProjectContextInjection(projectDir: string): string | null {
  const ctx = readProjectContext(projectDir);
  if (!ctx) return null;

  const parts: string[] = [];
  parts.push(`[PROJECT CONTEXT — the user is working in project "${ctx.meta.name}"]`);

  if (ctx.meta.description) {
    parts.push(`description: ${ctx.meta.description}`);
  }

  if (ctx.instructions.trim() && ctx.instructions !== instructionsTemplate()) {
    parts.push(`agent instructions: ${ctx.instructions}`);
  }

  const prefs = ctx.preferences;
  const prefParts: string[] = [];
  if (prefs.tone) prefParts.push(`tone=${prefs.tone}`);
  if (prefs.stack) prefParts.push(`stack=${prefs.stack}`);
  if (prefs.focus) prefParts.push(`focus=${prefs.focus}`);
  if (prefParts.length > 0) {
    parts.push(`preferences: ${prefParts.join(", ")}`);
  }

  if (ctx.prd.trim() && ctx.prd !== prdTemplate(ctx.meta.name)) {
    parts.push(`current PRD summary: ${ctx.prd.slice(0, 500)}`);
  }

  if (ctx.todo.trim() && ctx.todo !== todoTemplate()) {
    parts.push(`current tasks:\n${ctx.todo}`);
  }

  // Only return something if there's meaningful content beyond the name
  if (parts.length <= 1) {
    parts.push("(project context is mostly empty — help the user fill it in if relevant)");
  }

  return parts.join("\n");
}

/**
 * Parses project_updates JSON blocks from LLM response text.
 * Expected format in the response:
 * ```json
 * {"project_updates": [{"file": "context/todo.md", "content": "..."}]}
 * ```
 */
export function parseProjectUpdates(text: string): Array<{ file: string; content: string }> {
  const updates: Array<{ file: string; content: string }> = [];
  const blocks = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  for (const match of blocks) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.project_updates && Array.isArray(parsed.project_updates)) {
        for (const pu of parsed.project_updates) {
          if (pu?.file && typeof pu.file === "string" && pu?.content && typeof pu.content === "string") {
            // Validate file path is within allowed directories
            if (pu.file.startsWith("context/") || pu.file.startsWith("agent/") || pu.file.startsWith("private/")) {
              updates.push({ file: pu.file, content: pu.content });
            }
          }
        }
      }
    } catch {
      // skip malformed JSON blocks
    }
  }
  return updates;
}

// ─── Utilities ────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function writeIfMissing(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content);
  }
}

function readFileOrDefault(filePath: string, fallback: string): string {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {
    // fall through
  }
  return fallback;
}

function readJsonOrDefault<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch {
    // fall through
  }
  return fallback;
}
