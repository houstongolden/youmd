import * as fs from "fs";
import * as path from "path";
import * as childProcess from "child_process";
import * as http from "http";

export const DEFAULT_MACHINE_CHECK_SCRIPTS = ["typecheck", "lint", "test", "build"];
export const DEFAULT_MACHINE_SERVER_START_PORT = 4310;

export interface MachineRunCheckResult {
  dirName: string;
  projectDir: string;
  script: string;
  command: string;
  status: "passed" | "failed" | "timeout" | "skipped";
  exitCode?: number | null;
  durationMs: number;
  outputTail?: string;
  reason?: string;
}

export interface MachineInstallResult {
  dirName: string;
  projectDir: string;
  command: string;
  status: "passed" | "failed" | "timeout" | "skipped";
  exitCode?: number | null;
  durationMs: number;
  outputTail?: string;
  reason?: string;
}

export interface MachineServerProbeResult {
  dirName: string;
  projectDir: string;
  command: string;
  url: string;
  status: "passed" | "failed" | "timeout" | "skipped";
  statusCode?: number;
  durationMs: number;
  outputTail?: string;
  reason?: string;
}

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

export interface MachineRunChecksReport {
  rootDir: string;
  requestedScripts: string[];
  timeoutMs: number;
  maxProjects: number;
  results: MachineRunCheckResult[];
  totals: {
    passed: number;
    failed: number;
    timeout: number;
    skipped: number;
  };
}

export interface MachineInstallReport {
  rootDir: string;
  timeoutMs: number;
  maxProjects: number;
  results: MachineInstallResult[];
  totals: {
    passed: number;
    failed: number;
    timeout: number;
    skipped: number;
  };
}

export interface MachineServerProbeReport {
  rootDir: string;
  timeoutMs: number;
  maxProjects: number;
  startPort: number;
  results: MachineServerProbeResult[];
  totals: {
    passed: number;
    failed: number;
    timeout: number;
    skipped: number;
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

function checkCommandParts(
  packageManager: NonNullable<MachineProjectReadiness["packageManager"]>,
  script: string
): { command: string; args: string[]; display: string } {
  if (packageManager === "yarn") return { command: "yarn", args: [script], display: `yarn ${script}` };
  if (packageManager === "bun") return { command: "bun", args: ["run", script], display: `bun run ${script}` };
  return { command: packageManager, args: ["run", script], display: `${packageManager} run ${script}` };
}

function installCommandParts(project: MachineProjectReadiness): { command: string; args: string[]; display: string } | null {
  if (!project.packageManager) return null;

  if (project.packageManager === "npm") {
    const hasPackageLock = fs.existsSync(path.join(project.projectDir, "package-lock.json"));
    return hasPackageLock
      ? { command: "npm", args: ["ci"], display: "npm ci" }
      : { command: "npm", args: ["install"], display: "npm install" };
  }

  if (project.packageManager === "pnpm") {
    const hasLock = fs.existsSync(path.join(project.projectDir, "pnpm-lock.yaml"));
    return {
      command: "pnpm",
      args: hasLock ? ["install", "--frozen-lockfile"] : ["install"],
      display: hasLock ? "pnpm install --frozen-lockfile" : "pnpm install",
    };
  }

  if (project.packageManager === "yarn") {
    const hasLock = fs.existsSync(path.join(project.projectDir, "yarn.lock"));
    return {
      command: "yarn",
      args: hasLock ? ["install", "--frozen-lockfile"] : ["install"],
      display: hasLock ? "yarn install --frozen-lockfile" : "yarn install",
    };
  }

  const hasLock = fs.existsSync(path.join(project.projectDir, "bun.lockb")) || fs.existsSync(path.join(project.projectDir, "bun.lock"));
  return {
    command: "bun",
    args: hasLock ? ["install", "--frozen-lockfile"] : ["install"],
    display: hasLock ? "bun install --frozen-lockfile" : "bun install",
  };
}

function packageText(projectDir: string): string {
  return readText(path.join(projectDir, "package.json")).toLowerCase();
}

function devServerCommandParts(
  project: MachineProjectReadiness,
  port: number
): { command: string; args: string[]; display: string } | null {
  if (!project.packageManager || !project.scripts.includes("dev")) return null;

  const text = packageText(project.projectDir);
  let extraArgs: string[] = [];
  if (text.includes("\"next\"") || text.includes("next dev")) {
    extraArgs = ["--hostname", "127.0.0.1", "--port", String(port)];
  } else if (text.includes("\"vite\"") || text.includes("vite ")) {
    extraArgs = ["--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  } else if (text.includes("\"astro\"") || text.includes("astro dev")) {
    extraArgs = ["--host", "127.0.0.1", "--port", String(port)];
  }

  const withArgs = extraArgs.length > 0 ? ["--", ...extraArgs] : [];
  if (project.packageManager === "yarn") {
    return {
      command: "yarn",
      args: ["dev", ...extraArgs],
      display: ["yarn dev", ...extraArgs].join(" "),
    };
  }
  if (project.packageManager === "bun") {
    return {
      command: "bun",
      args: ["run", "dev", ...withArgs],
      display: ["bun run dev", ...withArgs].join(" "),
    };
  }
  return {
    command: project.packageManager,
    args: ["run", "dev", ...withArgs],
    display: [`${project.packageManager} run dev`, ...withArgs].join(" "),
  };
}

function outputTail(value: string, maxLength = 1200): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(trimmed.length - maxLength);
}

function appendBounded(buffer: string, chunk: Buffer | string, maxLength = 12_000): string {
  const next = buffer + String(chunk);
  if (next.length <= maxLength) return next;
  return next.slice(next.length - maxLength);
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

export function runMachineProjectChecks(
  projects: MachineProjectReadiness[],
  options: {
    scripts?: string[];
    timeoutMs?: number;
    maxProjects?: number;
  } = {}
): MachineRunCheckResult[] {
  const requestedScripts = (options.scripts?.length ? options.scripts : DEFAULT_MACHINE_CHECK_SCRIPTS)
    .map((script) => script.trim())
    .filter(Boolean);
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 120_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 8;
  const runnableProjects = projects
    .filter((project) => Boolean(project.packageManager))
    .slice(0, maxProjects);
  const results: MachineRunCheckResult[] = [];

  for (const project of runnableProjects) {
    if (!project.packageManager) continue;
    const scriptsToRun = requestedScripts.filter((script) => project.scripts.includes(script));
    if (scriptsToRun.length === 0) {
      results.push({
        dirName: project.dirName,
        projectDir: project.projectDir,
        script: requestedScripts.join(","),
        command: requestedScripts.map((script) => checkCommand(project.packageManager!, script)).join(" | "),
        status: "skipped",
        durationMs: 0,
        reason: "no requested check scripts found",
      });
      continue;
    }

    for (const script of scriptsToRun) {
      const { command, args, display } = checkCommandParts(project.packageManager, script);
      const startedAt = Date.now();
      const result = childProcess.spawnSync(command, args, {
        cwd: project.projectDir,
        encoding: "utf-8",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          CI: process.env.CI || "1",
          NO_COLOR: process.env.NO_COLOR || "1",
        },
      });
      const durationMs = Date.now() - startedAt;
      const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
      const timedOut = result.error && result.error.message.includes("ETIMEDOUT");
      results.push({
        dirName: project.dirName,
        projectDir: project.projectDir,
        script,
        command: display,
        status: timedOut ? "timeout" : result.status === 0 ? "passed" : "failed",
        exitCode: result.status,
        durationMs,
        outputTail: outputTail(combinedOutput),
        reason: result.error && !timedOut ? result.error.message : undefined,
      });
    }
  }

  return results;
}

export function runMachineDependencyInstalls(
  projects: MachineProjectReadiness[],
  options: {
    timeoutMs?: number;
    maxProjects?: number;
  } = {}
): MachineInstallResult[] {
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 180_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 4;
  const runnableProjects = projects
    .filter((project) => Boolean(project.packageManager))
    .slice(0, maxProjects);
  const results: MachineInstallResult[] = [];

  for (const project of runnableProjects) {
    const commandParts = installCommandParts(project);
    if (!commandParts) {
      results.push({
        dirName: project.dirName,
        projectDir: project.projectDir,
        command: "install",
        status: "skipped",
        durationMs: 0,
        reason: "no package manager detected",
      });
      continue;
    }

    const startedAt = Date.now();
    const result = childProcess.spawnSync(commandParts.command, commandParts.args, {
      cwd: project.projectDir,
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        CI: process.env.CI || "1",
        NO_COLOR: process.env.NO_COLOR || "1",
      },
    });
    const durationMs = Date.now() - startedAt;
    const combinedOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const timedOut = result.error && result.error.message.includes("ETIMEDOUT");
    results.push({
      dirName: project.dirName,
      projectDir: project.projectDir,
      command: commandParts.display,
      status: timedOut ? "timeout" : result.status === 0 ? "passed" : "failed",
      exitCode: result.status,
      durationMs,
      outputTail: outputTail(combinedOutput),
      reason: result.error && !timedOut ? result.error.message : undefined,
    });
  }

  return results;
}

function waitForHttp(url: string, timeoutMs: number): Promise<{ status: "passed" | "timeout" | "failed"; statusCode?: number; reason?: string }> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let lastError = "";

    const attempt = () => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        res.resume();
        resolve({ status: "passed", statusCode: res.statusCode });
      });

      req.on("timeout", () => {
        req.destroy(new Error("probe request timed out"));
      });

      req.on("error", (err) => {
        lastError = err.message;
        if (Date.now() - startedAt >= timeoutMs) {
          resolve({ status: "timeout", reason: lastError || "server did not respond before timeout" });
        } else {
          setTimeout(attempt, 500);
        }
      });
    };

    attempt();
  });
}

function stopChild(child: childProcess.ChildProcess): void {
  if (child.exitCode !== null || child.killed) return;
  child.kill("SIGTERM");
  setTimeout(() => {
    if (child.exitCode === null && !child.killed) {
      child.kill("SIGKILL");
    }
  }, 1000).unref();
}

export async function runMachineServerProbes(
  projects: MachineProjectReadiness[],
  options: {
    timeoutMs?: number;
    maxProjects?: number;
    startPort?: number;
  } = {}
): Promise<MachineServerProbeResult[]> {
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 45_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 3;
  const startPort = Number.isFinite(options.startPort) && Number(options.startPort) > 0
    ? Number(options.startPort)
    : DEFAULT_MACHINE_SERVER_START_PORT;
  const runnableProjects = projects
    .filter((project) => Boolean(project.packageManager) && project.scripts.includes("dev"))
    .slice(0, maxProjects);
  const results: MachineServerProbeResult[] = [];

  for (const [index, project] of runnableProjects.entries()) {
    const port = startPort + index;
    const commandParts = devServerCommandParts(project, port);
    const url = `http://127.0.0.1:${port}`;
    if (!commandParts) {
      results.push({
        dirName: project.dirName,
        projectDir: project.projectDir,
        command: "dev",
        url,
        status: "skipped",
        durationMs: 0,
        reason: "no dev server command could be inferred",
      });
      continue;
    }

    const startedAt = Date.now();
    let output = "";
    const child = childProcess.spawn(commandParts.command, commandParts.args, {
      cwd: project.projectDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        HOSTNAME: "127.0.0.1",
        BROWSER: "none",
        CI: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        NO_COLOR: process.env.NO_COLOR || "1",
      },
    });

    child.stdout?.on("data", (chunk) => {
      output = appendBounded(output, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      output = appendBounded(output, chunk);
    });

    const earlyExit = new Promise<{ status: "failed"; reason: string }>((resolve) => {
      child.once("error", (err) => resolve({ status: "failed", reason: err.message }));
      child.once("exit", (code, signal) => {
        const exitReason = signal || (code ?? "unknown");
        resolve({ status: "failed", reason: `server exited before probe responded (${exitReason})` });
      });
    });

    const probe = await Promise.race([
      waitForHttp(url, timeoutMs),
      earlyExit,
    ]);
    const durationMs = Date.now() - startedAt;
    stopChild(child);

    results.push({
      dirName: project.dirName,
      projectDir: project.projectDir,
      command: commandParts.display,
      url,
      status: probe.status,
      statusCode: "statusCode" in probe ? probe.statusCode : undefined,
      durationMs,
      outputTail: outputTail(output),
      reason: probe.reason,
    });
  }

  return results;
}

export function buildMachineRunChecksReport(
  rootDir: string,
  options: {
    scripts?: string[];
    timeoutMs?: number;
    maxProjects?: number;
    scanLimit?: number;
  } = {}
): MachineRunChecksReport {
  const scanLimit = Number.isFinite(options.scanLimit) && Number(options.scanLimit) > 0
    ? Number(options.scanLimit)
    : 80;
  const requestedScripts = (options.scripts?.length ? options.scripts : DEFAULT_MACHINE_CHECK_SCRIPTS)
    .map((script) => script.trim())
    .filter(Boolean);
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 120_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 8;
  const readiness = buildMachineReadinessReport(rootDir, scanLimit);
  const results = runMachineProjectChecks(readiness.projects, {
    scripts: requestedScripts,
    timeoutMs,
    maxProjects,
  });
  return {
    rootDir,
    requestedScripts,
    timeoutMs,
    maxProjects,
    results,
    totals: {
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      timeout: results.filter((result) => result.status === "timeout").length,
      skipped: results.filter((result) => result.status === "skipped").length,
    },
  };
}

export function buildMachineInstallReport(
  rootDir: string,
  options: {
    timeoutMs?: number;
    maxProjects?: number;
    scanLimit?: number;
  } = {}
): MachineInstallReport {
  const scanLimit = Number.isFinite(options.scanLimit) && Number(options.scanLimit) > 0
    ? Number(options.scanLimit)
    : 80;
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 180_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 4;
  const readiness = buildMachineReadinessReport(rootDir, scanLimit);
  const results = runMachineDependencyInstalls(readiness.projects, {
    timeoutMs,
    maxProjects,
  });
  return {
    rootDir,
    timeoutMs,
    maxProjects,
    results,
    totals: {
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      timeout: results.filter((result) => result.status === "timeout").length,
      skipped: results.filter((result) => result.status === "skipped").length,
    },
  };
}

export async function buildMachineServerProbeReport(
  rootDir: string,
  options: {
    timeoutMs?: number;
    maxProjects?: number;
    scanLimit?: number;
    startPort?: number;
  } = {}
): Promise<MachineServerProbeReport> {
  const scanLimit = Number.isFinite(options.scanLimit) && Number(options.scanLimit) > 0
    ? Number(options.scanLimit)
    : 80;
  const timeoutMs = Number.isFinite(options.timeoutMs) && Number(options.timeoutMs) > 0
    ? Number(options.timeoutMs)
    : 45_000;
  const maxProjects = Number.isFinite(options.maxProjects) && Number(options.maxProjects) > 0
    ? Number(options.maxProjects)
    : 3;
  const startPort = Number.isFinite(options.startPort) && Number(options.startPort) > 0
    ? Number(options.startPort)
    : DEFAULT_MACHINE_SERVER_START_PORT;
  const readiness = buildMachineReadinessReport(rootDir, scanLimit);
  const results = await runMachineServerProbes(readiness.projects, {
    timeoutMs,
    maxProjects,
    startPort,
  });
  return {
    rootDir,
    timeoutMs,
    maxProjects,
    startPort,
    results,
    totals: {
      passed: results.filter((result) => result.status === "passed").length,
      failed: results.filter((result) => result.status === "failed").length,
      timeout: results.filter((result) => result.status === "timeout").length,
      skipped: results.filter((result) => result.status === "skipped").length,
    },
  };
}
