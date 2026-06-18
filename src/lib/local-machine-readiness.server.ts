import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type LocalReadinessStatus = "ready" | "warn" | "blocked" | "missing";

export type LocalDaemonHealth = {
  label: string;
  name: string;
  command: string;
  intervalSeconds: number;
  loaded: boolean;
  lastLogLine?: string;
  lastErrorLine?: string;
  lastActivityAt?: string;
  warning?: string;
};

type LocalDaemonConfig = {
  label: string;
  name: string;
  command: string;
  intervalSeconds: number;
  stdoutLog: string;
  stderrLog: string;
  combinedLog?: string;
};

export type LocalProjectReadiness = {
  dirName: string;
  projectDir: string;
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
  lastTouchedAt?: string;
};

export type LocalMachineProofSummary = {
  reportPath: string;
  archivedAt?: string;
  generatedAt: string;
  hostName: string;
  platform: string;
  rootDir: string;
  status: "ready" | "warn" | "failed" | "unknown";
  secretValuesExposed: false;
  scanned: number;
  ready: number;
  needsEnv: number;
  partial: number;
  installPassed: number;
  checksPassed: number;
  serversPassed: number;
  failures: number;
  warnings: string[];
};

export type LocalMachineReadiness = {
  generatedAt: string;
  hostName: string;
  platform: string;
  scanRoot: string;
  freshMachineRoot: string;
  summary: {
    status: LocalReadinessStatus;
    daemonsLoaded: number;
    daemonsTotal: number;
    projectReady: number;
    projectScanned: number;
    envLocal: number;
    envExamples: number;
    agentDocs: number;
    projectContext: number;
    warnings: string[];
  };
  daemons: LocalDaemonHealth[];
  agentStack: {
    status: LocalReadinessStatus;
    youmdCliPath?: string;
    youmdVersion?: string;
    hasYoumdConfig: boolean;
    hasApiKey: boolean;
    sharedSkillRoot: string;
    sharedSkillCount: number;
    claudeSkillsPresent: boolean;
    codexSkillsPresent: boolean;
    youmdSkillsPresent: boolean;
    syncScriptPresent: boolean;
  };
  mcp: {
    status: LocalReadinessStatus;
    claudeConfigPresent: boolean;
    codexConfigPresent: boolean;
    cursorConfigPresent: boolean;
    expectedLauncher: string;
  };
  envVault: {
    status: LocalReadinessStatus;
    auditToolPresent: boolean;
    backupScriptPresent: boolean;
    restoreScriptPresent: boolean;
    interactiveBackupPresent: boolean;
    privateVaultKeyPresent: boolean;
    accountSnapshotStatus: "ready" | "missing" | "scope-missing" | "unknown";
    accountSnapshotSummary?: string;
    accountSnapshotUpdatedAt?: string;
    latestAccountSnapshot?: {
      fileName?: string | null;
      createdAt?: number | null;
      sizeBytes?: number | null;
      projectCount?: number | null;
      variableCount?: number | null;
      sha256Short?: string | null;
      encryptionTool?: string | null;
      agentAuthIncluded?: boolean;
      sourceHost?: string | null;
      sourceRoot?: string | null;
    };
    accountPullCommand?: string;
    accountRestoreCommand?: string;
    secretValuesExposed: false;
    notes: string[];
  };
  projects: {
    rootDir: string;
    scanned: number;
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
      docsOnly: number;
    };
    rows: LocalProjectReadiness[];
  };
  latestProof?: LocalMachineProofSummary;
  commands: {
    verifyCurrent: string;
    verifyFresh: string;
    verifyFreshFull: string;
    daemonStatus: string;
    envBackup: string;
    envRestore: string;
  };
};

const DAEMONS: LocalDaemonConfig[] = [
  {
    label: "com.youmd.realtime-sync",
    name: "realtime brain",
    command: "youmd sync --live --daemon",
    intervalSeconds: 0,
    stdoutLog: "~/.youmd/logs/realtime-sync.out.log",
    stderrLog: "~/.youmd/logs/realtime-sync.err.log",
  },
  {
    label: "com.youmd.skillstack-sync",
    name: "skills/stacks",
    command: "youmd stack sync",
    intervalSeconds: 300,
    stdoutLog: "~/.youmd/logs/skillstack-sync.out.log",
    stderrLog: "~/.youmd/logs/skillstack-sync.err.log",
    combinedLog: "~/.youmd/logs/skillstack-sync.log",
  },
  {
    label: "com.youmd.identity-sync",
    name: "identity/API",
    command: "youmd sync --daemon",
    intervalSeconds: 300,
    stdoutLog: "~/.youmd/logs/identity-sync.out.log",
    stderrLog: "~/.youmd/logs/identity-sync.err.log",
  },
  {
    label: "com.youmd.context-sync",
    name: "project context",
    command: "youmd stack context-sync",
    intervalSeconds: 900,
    stdoutLog: "~/.youmd/logs/context-sync.out.log",
    stderrLog: "~/.youmd/logs/context-sync.err.log",
    combinedLog: "~/.youmd/logs/context-sync.log",
  },
] as const;

export function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function resolveMachineReadinessRoot(input?: string | null): {
  allowed: boolean;
  rootDir: string;
  reason?: string;
} {
  const home = os.homedir();
  const freshRoot = path.join(home, "Desktop", "CODE_YOU");
  const currentRoot = path.join(home, "Desktop", "CODE_2025");
  const fallbackRoot = fs.existsSync(currentRoot) ? currentRoot : freshRoot;
  const raw =
    !input || input === "current"
      ? fallbackRoot
      : input === "fresh"
        ? freshRoot
        : expandHome(input);
  const rootDir = path.resolve(raw);
  const resolvedHome = path.resolve(home);

  if (rootDir !== resolvedHome && !rootDir.startsWith(`${resolvedHome}${path.sep}`)) {
    return {
      allowed: false,
      rootDir,
      reason: "machine readiness can only scan paths inside the signed-in user's home directory",
    };
  }

  return { allowed: true, rootDir };
}

function exists(filePath: string): boolean {
  return fs.existsSync(expandHome(filePath));
}

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(expandHome(filePath)).isDirectory();
  } catch {
    return false;
  }
}

function readText(filePath: string, maxBytes = 20000): string {
  const resolved = expandHome(filePath);
  try {
    const stat = fs.statSync(resolved);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(resolved, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf.toString("utf-8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return "";
  }
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = fs.readFileSync(expandHome(filePath), "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function booleanField(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumberField(value: unknown): number | null | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeLine(line?: string): string | undefined {
  if (!line) return undefined;
  return line
    .replace(/((?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH)[A-Z0-9_]*=)[^\s]+/gi, "$1[redacted]")
    .replace(/\b(?:sk|pk|ghp|gho|ghs|ghu|ghr|xox[baprs]|or)-[A-Za-z0-9_-]{12,}\b/g, "[redacted-token]")
    .slice(0, 280);
}

function tailUsefulLine(filePath: string, maxBytes = 8192): string | undefined {
  const raw = readText(filePath, maxBytes);
  if (!raw) return undefined;
  const line = raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .reverse()
    .find((item) => !item.includes("watching for changes"));
  return sanitizeLine(line);
}

function mtimeMs(filePath: string): number {
  try {
    return fs.statSync(expandHome(filePath)).mtimeMs;
  } catch {
    return 0;
  }
}

function newestMtimeIso(paths: string[]): string | undefined {
  const newest = paths.map(mtimeMs).reduce((max, value) => Math.max(max, value), 0);
  return newest > 0 ? new Date(newest).toISOString() : undefined;
}

function launchAgentLoaded(label: string): boolean {
  if (process.platform !== "darwin") return false;
  const result = childProcess.spawnSync("launchctl", ["list", label], {
    encoding: "utf-8",
    timeout: 2500,
  });
  return result.status === 0 && Boolean(result.stdout.trim());
}

function daemonHealth(): LocalDaemonHealth[] {
  return DAEMONS.map((daemon) => {
    const logs = [
      daemon.stdoutLog,
      daemon.stderrLog,
      ...(daemon.combinedLog ? [daemon.combinedLog] : []),
    ];
    const lastErrorLine = tailUsefulLine(daemon.stderrLog);
    const stderrMtime = mtimeMs(daemon.stderrLog);
    const healthyMtime = Math.max(
      mtimeMs(daemon.stdoutLog),
      daemon.combinedLog ? mtimeMs(daemon.combinedLog) : 0
    );
    const warning =
      lastErrorLine &&
      stderrMtime >= healthyMtime &&
      /(error|warn|conflict|refus|failed|smaller|blocked|unknown option)/i.test(lastErrorLine)
        ? lastErrorLine
        : undefined;

    return {
      label: daemon.label,
      name: daemon.name,
      command: daemon.command,
      intervalSeconds: daemon.intervalSeconds,
      loaded: launchAgentLoaded(daemon.label),
      lastLogLine: tailUsefulLine(daemon.combinedLog ?? daemon.stdoutLog) ?? tailUsefulLine(daemon.stdoutLog),
      lastErrorLine,
      lastActivityAt: newestMtimeIso(logs),
      warning,
    };
  });
}

function detectRemoteUrl(projectDir: string): string | undefined {
  const config = readText(path.join(projectDir, ".git", "config"));
  const match = config.match(/\[remote "origin"\][\s\S]*?\n\s*url\s*=\s*(.+)/);
  return sanitizeLine(match?.[1]?.trim());
}

function detectPackageManager(projectDir: string): LocalProjectReadiness["packageManager"] {
  if (exists(path.join(projectDir, "pnpm-lock.yaml"))) return "pnpm";
  if (exists(path.join(projectDir, "yarn.lock"))) return "yarn";
  if (exists(path.join(projectDir, "bun.lockb")) || exists(path.join(projectDir, "bun.lock"))) return "bun";
  if (exists(path.join(projectDir, "package-lock.json")) || exists(path.join(projectDir, "package.json"))) return "npm";
  return undefined;
}

function checkCommand(packageManager: NonNullable<LocalProjectReadiness["packageManager"]>, script: string): string {
  if (packageManager === "yarn") return `yarn ${script}`;
  if (packageManager === "bun") return `bun run ${script}`;
  return `${packageManager} run ${script}`;
}

function statusForProject(project: Omit<LocalProjectReadiness, "status">): LocalProjectReadiness["status"] {
  if (!project.isGitRepo && !project.packageManager && !project.hasProjectContext && !project.hasAgentDocs) return "empty";
  if (!project.packageManager && (project.hasAgentDocs || project.hasProjectContext)) return "docs-only";
  if (project.hasEnvExample && !project.hasEnvLocal) return "needs-env";
  if (project.isGitRepo && project.packageManager) return "ready";
  return "partial";
}

function inspectProject(projectDir: string): LocalProjectReadiness {
  const dirName = path.basename(projectDir);
  const isGitRepo = exists(path.join(projectDir, ".git"));
  const hasAgentDocs =
    exists(path.join(projectDir, "AGENTS.md")) ||
    exists(path.join(projectDir, "CLAUDE.md")) ||
    exists(path.join(projectDir, ".codex", "AGENTS.md")) ||
    exists(path.join(projectDir, ".claude", "CLAUDE.md"));
  const hasProjectContext = isDirectory(path.join(projectDir, "project-context"));
  const hasEnvLocal = exists(path.join(projectDir, ".env.local"));
  const hasEnvExample = exists(path.join(projectDir, ".env.example")) || exists(path.join(projectDir, ".env.local.example"));
  const packageJson = readJson(path.join(projectDir, "package.json"));
  const scriptsRecord =
    packageJson && typeof packageJson.scripts === "object" && packageJson.scripts !== null && !Array.isArray(packageJson.scripts)
      ? (packageJson.scripts as Record<string, unknown>)
      : {};
  const scripts = Object.entries(scriptsRecord)
    .filter(([, value]) => typeof value === "string")
    .map(([key]) => key)
    .sort();
  const packageManager = detectPackageManager(projectDir);
  const preferredChecks = ["typecheck", "lint", "test", "build", "dev"].filter((script) => scripts.includes(script));
  const suggestedChecks = packageManager ? preferredChecks.map((script) => checkCommand(packageManager, script)) : [];
  const gitMtime = mtimeMs(path.join(projectDir, ".git"));
  const packageMtime = mtimeMs(path.join(projectDir, "package.json"));
  const contextMtime = mtimeMs(path.join(projectDir, "project-context"));
  const base = {
    dirName,
    projectDir,
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
      packageManager && suggestedChecks.length === 0 ? "package scripts found but no standard checks" : "",
    ].filter(Boolean),
    lastTouchedAt: newestMtimeIso([projectDir, path.join(projectDir, ".git"), path.join(projectDir, "project-context"), path.join(projectDir, "package.json")]),
  };

  return {
    ...base,
    lastTouchedAt: gitMtime || packageMtime || contextMtime ? base.lastTouchedAt : undefined,
    status: statusForProject(base),
  };
}

function projectReadiness(rootDir: string) {
  const rows = isDirectory(rootDir)
    ? fs
        .readdirSync(rootDir)
        .filter((entry) => !entry.startsWith("."))
        .map((entry) => path.join(rootDir, entry))
        .filter(isDirectory)
        .map(inspectProject)
        .sort((a, b) => {
          const aTime = a.lastTouchedAt ? Date.parse(a.lastTouchedAt) : 0;
          const bTime = b.lastTouchedAt ? Date.parse(b.lastTouchedAt) : 0;
          return bTime - aTime || a.dirName.localeCompare(b.dirName);
        })
        .slice(0, 80)
    : [];

  return {
    rootDir,
    scanned: rows.length,
    totals: {
      gitRepos: rows.filter((project) => project.isGitRepo).length,
      packageProjects: rows.filter((project) => Boolean(project.packageManager)).length,
      envLocal: rows.filter((project) => project.hasEnvLocal).length,
      envExample: rows.filter((project) => project.hasEnvExample).length,
      agentDocs: rows.filter((project) => project.hasAgentDocs).length,
      projectContext: rows.filter((project) => project.hasProjectContext).length,
      ready: rows.filter((project) => project.status === "ready").length,
      needsEnv: rows.filter((project) => project.status === "needs-env").length,
      partial: rows.filter((project) => project.status === "partial").length,
      docsOnly: rows.filter((project) => project.status === "docs-only").length,
    },
    rows,
  };
}

function shell(command: string, timeout = 2500): { ok: boolean; stdout: string } {
  const result = childProcess.spawnSync("zsh", ["-lc", command], {
    encoding: "utf-8",
    timeout,
  });
  return {
    ok: result.status === 0,
    stdout: sanitizeLine(result.stdout.trim()) ?? "",
  };
}

function countSkills(skillRoot: string): number {
  const root = expandHome(skillRoot);
  if (!isDirectory(root)) return 0;
  try {
    return fs
      .readdirSync(root)
      .filter((entry) => exists(path.join(root, entry, "SKILL.md")))
      .length;
  } catch {
    return 0;
  }
}

function statusFrom(parts: boolean[], warnWhenPartial = true): LocalReadinessStatus {
  if (parts.every(Boolean)) return "ready";
  if (parts.some(Boolean) && warnWhenPartial) return "warn";
  return "missing";
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? sanitizeLine(value.trim()) : undefined;
}

function latestMachineProof(): LocalMachineProofSummary | undefined {
  const reportPath = expandHome("~/.youmd/machine-reports/latest.json");
  const proof = readJson(reportPath);
  if (!proof) return undefined;
  const summary =
    typeof proof.summary === "object" && proof.summary !== null && !Array.isArray(proof.summary)
      ? (proof.summary as Record<string, unknown>)
      : {};
  const status = summary.status === "ready" || summary.status === "warn" || summary.status === "failed"
    ? summary.status
    : "unknown";
  const warnings = Array.isArray(summary.warnings)
    ? summary.warnings
        .map((warning) => stringField(warning))
        .filter((warning): warning is string => Boolean(warning))
        .slice(0, 8)
    : [];
  const generatedAt = stringField(proof.generatedAt) ?? new Date(mtimeMs(reportPath) || Date.now()).toISOString();

  return {
    reportPath,
    archivedAt: newestMtimeIso([reportPath]),
    generatedAt,
    hostName: stringField(proof.hostName) ?? "unknown host",
    platform: stringField(proof.platform) ?? "unknown platform",
    rootDir: stringField(proof.rootDir) ?? "unknown root",
    status,
    secretValuesExposed: false,
    scanned: numberField(summary.scanned),
    ready: numberField(summary.ready),
    needsEnv: numberField(summary.needsEnv),
    partial: numberField(summary.partial),
    installPassed: numberField(summary.installPassed),
    checksPassed: numberField(summary.checksPassed),
    serversPassed: numberField(summary.serversPassed),
    failures: numberField(summary.failures),
    warnings,
  };
}

function realtimeSecretVaultStatus(): Pick<LocalMachineReadiness["envVault"], "accountSnapshotStatus" | "accountSnapshotSummary" | "accountSnapshotUpdatedAt" | "latestAccountSnapshot" | "accountPullCommand" | "accountRestoreCommand"> {
  const status = readJson("~/.youmd/realtime-sync-status.json");
  const secretVault = status?.secretVault && typeof status.secretVault === "object"
    ? status.secretVault as Record<string, unknown>
    : null;
  const state = stringField(secretVault?.state);
  const latest = secretVault?.latestSnapshot && typeof secretVault.latestSnapshot === "object"
    ? secretVault.latestSnapshot as Record<string, unknown>
    : null;
  const generatedAt = optionalNumberField(status?.generatedAt);
  const safeState =
    state === "ready" || state === "missing" || state === "scope-missing" || state === "unknown"
      ? state
      : "unknown";

  return {
    accountSnapshotStatus: safeState,
    accountSnapshotSummary: stringField(secretVault?.summary),
    accountSnapshotUpdatedAt: generatedAt ? new Date(generatedAt).toISOString() : undefined,
    latestAccountSnapshot: latest
      ? {
          fileName: stringField(latest.fileName) ?? null,
          createdAt: optionalNumberField(latest.createdAt),
          sizeBytes: optionalNumberField(latest.sizeBytes),
          projectCount: optionalNumberField(latest.projectCount),
          variableCount: optionalNumberField(latest.variableCount),
          sha256Short: stringField(latest.sha256Short) ?? null,
          encryptionTool: stringField(latest.encryptionTool) ?? null,
          agentAuthIncluded: booleanField(latest.agentAuthIncluded),
          sourceHost: stringField(latest.sourceHost) ?? null,
          sourceRoot: stringField(latest.sourceRoot) ?? null,
        }
      : undefined,
    accountPullCommand: stringField(secretVault?.pullCommand),
    accountRestoreCommand: stringField(secretVault?.restoreCommand),
  };
}

export function buildLocalMachineReadiness(rootDir: string): LocalMachineReadiness {
  const generatedAt = new Date().toISOString();
  const home = os.homedir();
  const freshMachineRoot = path.join(home, "Desktop", "CODE_YOU");
  const daemons = daemonHealth();
  const projects = projectReadiness(rootDir);
  const youmdCli = shell("command -v youmd");
  const youmdVersion = youmdCli.ok ? shell("youmd --version", 3500).stdout : "";
  const config = readJson("~/.youmd/config.json");
  const hasApiKey =
    (typeof config?.token === "string" && config.token.length > 0) ||
    (typeof process.env.YOUMD_API_KEY === "string" && process.env.YOUMD_API_KEY.length > 0);
  const sharedSkillRoot = path.join(home, ".agent-shared", "claude-skills");
  const claudeSkillsPresent = isDirectory("~/.claude/skills");
  const codexSkillsPresent = isDirectory("~/.codex/skills");
  const youmdSkillsPresent = isDirectory("~/.youmd/skills");
  const syncScriptPresent = exists("~/.agent-shared/bin/sync-agent-shared.sh");
  const agentStack = {
    status: statusFrom([youmdCli.ok, Boolean(config), hasApiKey, isDirectory(sharedSkillRoot), syncScriptPresent]) as LocalReadinessStatus,
    youmdCliPath: youmdCli.stdout || undefined,
    youmdVersion: youmdVersion || undefined,
    hasYoumdConfig: Boolean(config),
    hasApiKey,
    sharedSkillRoot,
    sharedSkillCount: countSkills(sharedSkillRoot),
    claudeSkillsPresent,
    codexSkillsPresent,
    youmdSkillsPresent,
    syncScriptPresent,
  };
  const mcp = {
    status: statusFrom([exists("~/.claude.json") || exists("~/.claude/settings.json"), exists("~/.codex/config.toml"), youmdCli.ok]) as LocalReadinessStatus,
    claudeConfigPresent: exists("~/.claude.json") || exists("~/.claude/settings.json"),
    codexConfigPresent: exists("~/.codex/config.toml"),
    cursorConfigPresent: exists("~/.cursor/mcp.json") || exists("~/.cursor/config.json"),
    expectedLauncher: "npx --yes youmd@latest mcp",
  };
  const accountVault = realtimeSecretVaultStatus();
  const envVault = {
    status: statusFrom([
      exists("~/.agent-shared/bin/env-key-audit.py"),
      exists("~/.agent-shared/bin/env-secure-backup.sh"),
      exists("~/.agent-shared/bin/env-secure-restore.sh"),
      accountVault.accountSnapshotStatus === "ready",
    ]) as LocalReadinessStatus,
    auditToolPresent: exists("~/.agent-shared/bin/env-key-audit.py"),
    backupScriptPresent: exists("~/.agent-shared/bin/env-secure-backup.sh"),
    restoreScriptPresent: exists("~/.agent-shared/bin/env-secure-restore.sh"),
    interactiveBackupPresent: exists("~/.agent-shared/bin/env-backup-interactive.command"),
    privateVaultKeyPresent: exists("~/.youmd/vault-key.enc"),
    ...accountVault,
    secretValuesExposed: false as const,
    notes: [
      "dashboard reports file presence and key-name readiness only",
      "raw .env.local values stay local and are not returned by this API",
      "account Secret Vault status comes from the local realtime daemon sync head",
      "fresh hosts restore values through youmd env restore <vault> --root <dir>",
    ],
  };
  const warnings = [
    ...daemons.filter((daemon) => !daemon.loaded).map((daemon) => `${daemon.name} daemon not loaded`),
    ...daemons.flatMap((daemon) => (daemon.warning ? [`${daemon.name}: ${daemon.warning}`] : [])),
    projects.totals.needsEnv > 0 ? `${projects.totals.needsEnv} projects need env restore` : "",
    projects.scanned === 0 ? `no project directories found under ${rootDir}` : "",
    agentStack.status !== "ready" ? "local You.md agent stack is not fully ready" : "",
    envVault.status !== "ready" ? "env vault backup/restore tooling is incomplete" : "",
    envVault.accountSnapshotStatus !== "ready" ? "account Secret Vault encrypted snapshot is not ready in realtime status" : "",
  ].filter(Boolean);

  return {
    generatedAt,
    hostName: os.hostname(),
    platform: `${process.platform} ${os.release()}`,
    scanRoot: rootDir,
    freshMachineRoot,
    summary: {
      status: warnings.length === 0 ? "ready" : warnings.length <= 3 ? "warn" : "blocked",
      daemonsLoaded: daemons.filter((daemon) => daemon.loaded).length,
      daemonsTotal: daemons.length,
      projectReady: projects.totals.ready,
      projectScanned: projects.scanned,
      envLocal: projects.totals.envLocal,
      envExamples: projects.totals.envExample,
      agentDocs: projects.totals.agentDocs,
      projectContext: projects.totals.projectContext,
      warnings: warnings.slice(0, 8),
    },
    daemons,
    agentStack,
    mcp,
    envVault,
    projects,
    latestProof: latestMachineProof(),
    commands: {
      verifyCurrent: `youmd machine verify --root "${rootDir}"`,
      verifyFresh: `youmd machine verify --root "${freshMachineRoot}" --write-report`,
      verifyFreshFull: `youmd machine verify --root "${freshMachineRoot}" --install-deps --run-checks --probe-servers --write-report`,
      daemonStatus: "youmd stack daemon status",
      envBackup: "~/.agent-shared/bin/env-secure-backup.sh --root ~/Desktop/CODE_2025",
      envRestore: `youmd env restore <vault> --root "${freshMachineRoot}"`,
    },
  };
}
