import * as fs from "fs";
import * as path from "path";

export interface MachineProjectReadiness {
  dirName: string;
  projectDir: string;
  isDirectory: boolean;
  isGitRepo: boolean;
  remoteUrl?: string;
  hasAgentDocs: boolean;
  hasProjectContext: boolean;
  hasEnvLocal: boolean;
  hasEnvExample: boolean;
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  scripts: string[];
  suggestedChecks: string[];
  status: "ready" | "needs-env" | "partial" | "docs-only" | "empty";
  notes: string[];
}

export interface MachineReadinessReport {
  rootDir: string;
  scanned: number;
  projects: MachineProjectReadiness[];
  totals: {
    gitRepos: number;
    packageProjects: number;
    envLocal: number;
    envExample: number;
    agentDocs: number;
    projectContext: number;
    ready: number;
    needsEnv: number;
    partial: number;
  };
}

function readText(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function detectRemoteUrl(projectDir: string): string | undefined {
  const config = readText(path.join(projectDir, ".git", "config"));
  const match = config.match(/\[remote "origin"\][\s\S]*?\n\s*url\s*=\s*(.+)/);
  return match?.[1]?.trim() || undefined;
}

function detectPackageManager(projectDir: string): MachineProjectReadiness["packageManager"] {
  if (fs.existsSync(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectDir, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectDir, "bun.lockb")) || fs.existsSync(path.join(projectDir, "bun.lock"))) return "bun";
  if (fs.existsSync(path.join(projectDir, "package-lock.json"))) return "npm";
  if (fs.existsSync(path.join(projectDir, "package.json"))) return "npm";
  return undefined;
}

function checkCommand(packageManager: NonNullable<MachineProjectReadiness["packageManager"]>, script: string): string {
  if (packageManager === "yarn") return `yarn ${script}`;
  if (packageManager === "bun") return `bun run ${script}`;
  return `${packageManager} run ${script}`;
}

function statusForProject(project: Omit<MachineProjectReadiness, "status">): MachineProjectReadiness["status"] {
  if (!project.isDirectory) return "empty";
  if (!project.isGitRepo && !project.packageManager && !project.hasProjectContext && !project.hasAgentDocs) return "empty";
  if (!project.packageManager && (project.hasAgentDocs || project.hasProjectContext)) return "docs-only";
  if (project.hasEnvExample && !project.hasEnvLocal) return "needs-env";
  if (project.isGitRepo && project.packageManager) return "ready";
  return "partial";
}

export function inspectMachineProject(projectDir: string): MachineProjectReadiness {
  const dirName = path.basename(projectDir);
  const isDirectory = fs.existsSync(projectDir) && fs.statSync(projectDir).isDirectory();
  const isGitRepo = isDirectory && fs.existsSync(path.join(projectDir, ".git"));
  const hasAgentDocs = isDirectory && (
    fs.existsSync(path.join(projectDir, "AGENTS.md")) ||
    fs.existsSync(path.join(projectDir, "CLAUDE.md")) ||
    fs.existsSync(path.join(projectDir, ".codex", "AGENTS.md")) ||
    fs.existsSync(path.join(projectDir, ".claude", "CLAUDE.md"))
  );
  const hasProjectContext = isDirectory && fs.existsSync(path.join(projectDir, "project-context"));
  const hasEnvLocal = isDirectory && fs.existsSync(path.join(projectDir, ".env.local"));
  const hasEnvExample = isDirectory && (
    fs.existsSync(path.join(projectDir, ".env.example")) ||
    fs.existsSync(path.join(projectDir, ".env.local.example"))
  );
  const packageJson = isDirectory ? readJson(path.join(projectDir, "package.json")) : null;
  const scriptsRecord = packageJson && typeof packageJson.scripts === "object" && packageJson.scripts !== null && !Array.isArray(packageJson.scripts)
    ? packageJson.scripts as Record<string, unknown>
    : {};
  const scripts = Object.entries(scriptsRecord)
    .filter(([, value]) => typeof value === "string")
    .map(([key]) => key)
    .sort();
  const packageManager = isDirectory ? detectPackageManager(projectDir) : undefined;
  const preferredChecks = ["typecheck", "lint", "test", "build", "dev"].filter((script) => scripts.includes(script));
  const suggestedChecks = packageManager
    ? preferredChecks.map((script) => checkCommand(packageManager, script))
    : [];
  const base = {
    dirName,
    projectDir,
    isDirectory,
    isGitRepo,
    remoteUrl: isGitRepo ? detectRemoteUrl(projectDir) : undefined,
    hasAgentDocs,
    hasProjectContext,
    hasEnvLocal,
    hasEnvExample,
    packageManager,
    scripts,
    suggestedChecks,
    notes: [
      hasEnvExample && !hasEnvLocal ? "env restore needed before full local run" : "",
      !hasAgentDocs ? "agent docs missing or not at root" : "",
      packageManager && suggestedChecks.length === 0 ? "package scripts found but no standard check scripts" : "",
    ].filter(Boolean),
  };
  return {
    ...base,
    status: statusForProject(base),
  };
}

export function buildMachineReadinessReport(rootDir: string, maxProjects = 80): MachineReadinessReport {
  const entries = fs.existsSync(rootDir)
    ? fs.readdirSync(rootDir)
        .filter((entry) => !entry.startsWith("."))
        .map((entry) => path.join(rootDir, entry))
        .filter((entryPath) => {
          try {
            return fs.statSync(entryPath).isDirectory();
          } catch {
            return false;
          }
        })
        .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
        .slice(0, Math.max(1, maxProjects))
    : [];
  const projects = entries.map(inspectMachineProject);
  return {
    rootDir,
    scanned: projects.length,
    projects,
    totals: {
      gitRepos: projects.filter((project) => project.isGitRepo).length,
      packageProjects: projects.filter((project) => Boolean(project.packageManager)).length,
      envLocal: projects.filter((project) => project.hasEnvLocal).length,
      envExample: projects.filter((project) => project.hasEnvExample).length,
      agentDocs: projects.filter((project) => project.hasAgentDocs).length,
      projectContext: projects.filter((project) => project.hasProjectContext).length,
      ready: projects.filter((project) => project.status === "ready").length,
      needsEnv: projects.filter((project) => project.status === "needs-env").length,
      partial: projects.filter((project) => project.status === "partial").length,
    },
  };
}
