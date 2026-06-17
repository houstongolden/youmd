import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface PatternMiningProject {
  name: string;
  path: string;
  providers?: string[];
}

export interface MinedReusablePattern {
  slug: string;
  name: string;
  status: "canonical" | "candidate";
  tags: string[];
  techStacks: string[];
  canonicalOwnerProject?: string;
  summary: string;
  sourcePaths: string[];
  usageProjects: string[];
}

export interface ReusablePatternMiningResult {
  root: string;
  generatedAt: string;
  projectsScanned: number;
  filesScanned: number;
  patterns: MinedReusablePattern[];
}

type SignalFile = {
  relPath: string;
  lowerPath: string;
  text: string;
};

type ProjectEvidence = {
  name: string;
  slug: string;
  relPath: string;
  absPath: string;
  providers: string[];
  files: SignalFile[];
  packageDeps: string[];
  packageScripts: string[];
};

type PatternRule = {
  slug: string;
  name: string;
  summary: string;
  tags: string[];
  techStacks: string[];
  status: "canonical" | "candidate";
  pathSignals?: RegExp[];
  textSignals?: RegExp[];
  depSignals?: RegExp[];
  scriptSignals?: RegExp[];
  providerSignals?: RegExp[];
  minSignals?: number;
};

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".venv",
  "build",
  "coverage",
  "DerivedData",
  "dist",
  "node_modules",
  "Pods",
  "target",
  "vendor",
  "_generated",
  "__generated__",
]);

const SIGNAL_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".md",
  ".mdx",
  ".json",
  ".mjs",
  ".cjs",
]);

const ROOT_SIGNAL_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "readme.md",
  "package.json",
  "next.config.ts",
  "next.config.js",
  "vite.config.ts",
  "vite.config.js",
]);

const DOC_SIGNAL_PATHS = [
  "project-context/PRD.md",
  "project-context/TODO.md",
  "project-context/CURRENT_STATE.md",
  "project-context/FEATURES.md",
  "project-context/ARCHITECTURE.md",
  "project-context/STYLE_GUIDE.md",
  "project-context/design.md",
  "project-context/tasks.md",
  "project-context/research.md",
  "project-context/ideas.md",
];

const RULES: PatternRule[] = [
  {
    slug: "api-mcp-skillstack-first",
    name: "API/MCP/SkillStack-first architecture",
    status: "canonical",
    tags: ["architecture", "api", "mcp", "skillstack", "agentic-stack", "reuse"],
    techStacks: ["api", "mcp", "skills"],
    summary: "Projects expose durable API/MCP surfaces plus installable skills, stack manifests, docs, prompts, workflows, and local-agent guardrails.",
    pathSignals: [/mcp\/registry\.(t|j)s$/, /mcp\/server\.(t|j)s$/, /skill-catalog\.(t|j)s$/, /youstack\.json$/, /\/skills\//, /AGENTS\.md$/],
    textSignals: [/\bAPI\/MCP\b/i, /\bSkillStack\b/i, /\byoustack\b/i, /\bget_project_context\b/i],
    minSignals: 2,
  },
  {
    slug: "agentic-shell-layout",
    name: "Agentic shell layout",
    status: "canonical",
    tags: ["ui", "dashboard", "agent", "sidebar", "split-pane"],
    techStacks: ["react", "nextjs", "tailwind"],
    summary: "A full-height left navigation, central agent/chat surface, and right-side intelligence/artifact pane for projects, skills, APIs, context, and session state.",
    pathSignals: [/dashboard-content\.tsx$/, /PortfolioGraphPane\.tsx$/, /src\/components\/panes\//, /src\/components\/shell\//],
    textSignals: [/\brightPane\b/, /\bleft sidebar\b/i, /\bPortfolio Graph\b/i, /\bnew chat\b/i, /\bsession intelligence\b/i],
    depSignals: [/^next$/, /^react$/],
    minSignals: 3,
  },
  {
    slug: "first-party-passwordless-auth",
    name: "First-party passwordless auth",
    status: "canonical",
    tags: ["auth", "passwordless", "resend", "sendblue", "otp"],
    techStacks: ["auth", "email", "sms"],
    summary: "Simple first-party auth with email/SMS one-time codes or verify links, avoiding paid auth providers unless SSO breadth justifies it.",
    pathSignals: [/auth/i, /login/i, /device/i],
    textSignals: [/\bpasswordless\b/i, /\bone[-\s]?time code\b/i, /\bmagic link\b/i, /\botp\b/i, /\bverify link\b/i, /\bResend\b/i, /\bSendblue\b/i],
    providerSignals: [/Resend/i, /Sendblue/i],
    minSignals: 2,
  },
  {
    slug: "convex-owner-gated-api",
    name: "Convex owner-gated API surface",
    status: "candidate",
    tags: ["convex", "api", "security", "owner-gated", "local-agent"],
    techStacks: ["convex", "typescript"],
    summary: "Convex HTTP/actions/mutations guarded by owner auth, write scopes, trusted internal tokens, and server-side write guards for local-agent API access.",
    pathSignals: [/^convex\//, /convex\/http\.ts$/, /convex\/.*\.test\.ts$/],
    textSignals: [/\brequireScope\b/, /\bguardWrite\b/, /\brequireOwner\b/, /\bTRUSTED_INTERNAL_AUTH_TOKEN\b/, /\b_internalAuthToken\b/],
    depSignals: [/^convex$/],
    minSignals: 2,
  },
  {
    slug: "project-context-operating-docs",
    name: "Project-context operating docs",
    status: "canonical",
    tags: ["docs", "project-context", "tasks", "prd", "agent-memory"],
    techStacks: ["markdown", "agents"],
    summary: "A maintained project-context pack with PRD, architecture, current state, TODOs, features, changelog, prompts, and design notes for local agents.",
    pathSignals: [/project-context\/PRD\.md$/, /project-context\/TODO\.md$/, /project-context\/CURRENT_STATE\.md$/, /project-context\/FEATURES\.md$/, /project-context\/ARCHITECTURE\.md$/],
    textSignals: [/\bfeature-requests-active\b/i, /\bPROMPTS\.md\b/, /\bCURRENT_STATE\.md\b/],
    minSignals: 2,
  },
  {
    slug: "task-braindump-router",
    name: "Brain-dump to task router",
    status: "candidate",
    tags: ["tasks", "braindump", "routing", "portfolio", "agent-work"],
    techStacks: ["convex", "mcp", "cli"],
    summary: "Raw brain dumps are preserved first, summarized into insights, linked to projects, and converted into human-owned or agent-owned portfolio tasks.",
    pathSignals: [/braindump/i, /brain-dump/i, /tasks/i],
    textSignals: [/\bbrainDumpCaptures\b/, /\bportfolioTasks\b/, /\/braindump\b/i, /\/task\b/i, /\bownerType\b/],
    minSignals: 2,
  },
  {
    slug: "env-provider-intelligence",
    name: "Env/API provider intelligence",
    status: "candidate",
    tags: ["env", "api-keys", "providers", "security", "costs"],
    techStacks: ["cli", "security"],
    summary: "Secret-safe local scans normalize env key names, group API providers across projects, and optionally compare reused values with salted local fingerprints.",
    pathSignals: [/portfolio-audit\.(t|j)s$/, /env-key-audit/i, /\.env\.example$/],
    textSignals: [/\benv-audit\b/i, /\bportfolio-audit\b/i, /\bfingerprint\b/i, /\bnormalizeKeyName\b/, /\bsecret values were not read\b/i],
    minSignals: 2,
  },
  {
    slug: "fresh-machine-bootstrap",
    name: "Graph-backed fresh-machine bootstrap",
    status: "candidate",
    tags: ["machine-sync", "bootstrap", "new-computer", "skills", "env-vault"],
    techStacks: ["cli", "shell", "github"],
    summary: "A one-command new-machine flow installs You.md, authenticates, syncs skills/stacks, fetches the portfolio graph, clones active repos, restores env vaults, verifies readiness, and starts daemons.",
    pathSignals: [/machine-bootstrap/i, /machine-projects\.(t|j)s$/, /machine-verify\.(t|j)s$/],
    textSignals: [/\/new computer\b/i, /\bCODE_YOU\b/, /\benv vault\b/i, /\bportfolio graph\b/i, /\bresident sync\b/i],
    scriptSignals: [/youmd machine/i, /portfolio-hydrate/i],
    minSignals: 2,
  },
  {
    slug: "agent-streaming-progress",
    name: "Agent streaming progress loop",
    status: "candidate",
    tags: ["agent", "streaming", "progress", "task-list", "ux"],
    techStacks: ["react", "agent-ui"],
    summary: "Agent responses acknowledge context, stream visible progress steps, update task state while tools run, and produce artifacts or repo updates when needed.",
    pathSignals: [/useYouAgent\.(t|j)sx?$/, /stream\.(t|j)s$/, /chat/i],
    textSignals: [/\bstream/i, /\bprogress\b/i, /\btask list\b/i, /\bsteps\b/i, /\bartifact\b/i, /\backnowledg/i],
    minSignals: 2,
  },
];

function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "project";
}

function shouldReadSignalFile(relPath: string): boolean {
  const fileName = path.basename(relPath);
  if (ROOT_SIGNAL_FILES.has(fileName)) return true;
  if (DOC_SIGNAL_PATHS.includes(relPath)) return true;
  if (/\.env(?:\.local|)$/.test(fileName)) return false;
  const ext = path.extname(fileName);
  if (!SIGNAL_EXTENSIONS.has(ext)) return false;
  return /(^|\/)(src|app|components|convex|cli|scripts|skills|stacks|project-context|you-agent)\//.test(relPath);
}

function readLimitedText(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 220_000) return "";
    return fs.readFileSync(filePath, "utf-8").slice(0, 80_000);
  } catch {
    return "";
  }
}

function packageSignals(absPath: string): { deps: string[]; scripts: string[] } {
  try {
    const json = JSON.parse(readLimitedText(path.join(absPath, "package.json")) || "{}") as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    return {
      deps: Object.keys({ ...(json.dependencies ?? {}), ...(json.devDependencies ?? {}) }),
      scripts: Object.values(json.scripts ?? {}),
    };
  } catch {
    return { deps: [], scripts: [] };
  }
}

function scanProjectFiles(projectPath: string, maxFiles: number): SignalFile[] {
  const files: SignalFile[] = [];

  function walk(dir: string): void {
    if (files.length >= maxFiles) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.endsWith(".xcarchive")) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const absFile = path.join(dir, entry.name);
      const relPath = path.relative(projectPath, absFile).split(path.sep).join("/");
      if (!shouldReadSignalFile(relPath)) continue;
      files.push({
        relPath,
        lowerPath: relPath.toLowerCase(),
        text: readLimitedText(absFile),
      });
    }
  }

  walk(projectPath);
  return files;
}

function collectProjectEvidence(root: string, projects: PatternMiningProject[], maxFilesPerProject: number): ProjectEvidence[] {
  return projects.map((project) => {
    const absPath = path.resolve(root, project.path);
    const pkg = packageSignals(absPath);
    return {
      name: project.name,
      slug: slugify(project.name),
      relPath: project.path,
      absPath,
      providers: project.providers ?? [],
      files: scanProjectFiles(absPath, maxFilesPerProject),
      packageDeps: pkg.deps,
      packageScripts: pkg.scripts,
    };
  });
}

function matchRule(rule: PatternRule, project: ProjectEvidence): { score: number; evidence: string[] } {
  const evidence = new Set<string>();
  let score = 0;

  for (const file of project.files) {
    const pathMatches = rule.pathSignals?.filter((signal) => signal.test(file.relPath)).length ?? 0;
    if (pathMatches > 0) {
      evidence.add(`${project.slug}:${file.relPath}`);
      score += pathMatches;
    }
    const textMatches = rule.textSignals?.filter((signal) => signal.test(file.text)).length ?? 0;
    if (textMatches > 0) {
      evidence.add(`${project.slug}:${file.relPath}`);
      score += textMatches;
    }
  }

  for (const dep of project.packageDeps) {
    if (rule.depSignals?.some((signal) => signal.test(dep))) score += 1;
  }
  for (const script of project.packageScripts) {
    if (rule.scriptSignals?.some((signal) => signal.test(script))) score += 1;
  }
  for (const provider of project.providers) {
    if (rule.providerSignals?.some((signal) => signal.test(provider))) score += 1;
  }

  return { score, evidence: [...evidence].slice(0, 10) };
}

function canonicalOwnerFor(rule: PatternRule, usageProjects: string[]): string | undefined {
  if (usageProjects.includes("youmd")) return "youmd";
  if (rule.slug.includes("bamf") && usageProjects.includes("bamfsite")) return "bamfsite";
  return usageProjects[0];
}

export function mineReusablePatterns(options: {
  root?: string;
  projects: PatternMiningProject[];
  maxProjects?: number;
  maxFilesPerProject?: number;
}): ReusablePatternMiningResult {
  const root = path.resolve(expandHome(options.root ?? "~/Desktop/CODE_2025"));
  const maxProjects = Math.max(1, Math.min(options.maxProjects ?? 80, 200));
  const maxFilesPerProject = Math.max(20, Math.min(options.maxFilesPerProject ?? 500, 1_200));
  const evidence = collectProjectEvidence(root, options.projects.slice(0, maxProjects), maxFilesPerProject);
  const patterns: MinedReusablePattern[] = [];

  for (const rule of RULES) {
    const usageProjects: string[] = [];
    const sourcePaths: string[] = [];
    for (const project of evidence) {
      const match = matchRule(rule, project);
      if (match.score < (rule.minSignals ?? 1)) continue;
      usageProjects.push(project.slug);
      sourcePaths.push(...match.evidence);
    }
    if (usageProjects.length === 0) continue;
    const uniqueUsage = [...new Set(usageProjects)].sort();
    patterns.push({
      slug: rule.slug,
      name: rule.name,
      status: rule.status === "canonical" || uniqueUsage.length >= 2 ? rule.status : "candidate",
      tags: rule.tags,
      techStacks: rule.techStacks,
      canonicalOwnerProject: canonicalOwnerFor(rule, uniqueUsage),
      summary: `${rule.summary} Scanner evidence: ${uniqueUsage.length} active project${uniqueUsage.length === 1 ? "" : "s"}.`,
      sourcePaths: [...new Set(sourcePaths)].slice(0, 24),
      usageProjects: uniqueUsage,
    });
  }

  return {
    root,
    generatedAt: new Date().toISOString(),
    projectsScanned: evidence.length,
    filesScanned: evidence.reduce((total, project) => total + project.files.length, 0),
    patterns: patterns.sort((a, b) => b.usageProjects.length - a.usageProjects.length || a.slug.localeCompare(b.slug)),
  };
}
