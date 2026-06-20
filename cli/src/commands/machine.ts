import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import * as child_process from "child_process";
import * as crypto from "crypto";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";
import {
  getCanonicalGlobalConfigDir,
  getLegacyGlobalConfigDir,
  getWritableHomeBundleDir,
  isAuthenticated,
  resolveActiveBundleDir,
} from "../lib/config";
import { apiErrorMessage, getPortfolioGraph, syncMachineProof } from "../lib/api";
import type { MachineProofSyncPayload } from "../lib/api";
import {
  buildMachineProjectPlan,
  GithubProjectSource,
  MachineProjectCandidate,
} from "../lib/machine-projects";
import {
  buildMachineVerificationProof,
  buildMachineInstallReport,
  loadLatestAgentStackInventoryProof,
  buildMachineReadinessReport,
  buildMachineRunChecksReport,
  buildMachineServerProbeReport,
  writeMachineVerificationProof,
} from "../lib/machine-verify";
import type { MachineVerificationProof } from "../lib/machine-verify";
import { buildFreshMachineBootstrapPrompt } from "../lib/machine-bootstrap-prompt";

// The compiled file lives at dist/commands/machine.js.
// Walking up two levels lands at the package root, then into scripts/.
function resolveSkillstackScript(name: string): string {
  return path.join(
    __dirname,
    "..",
    "..",
    "scripts",
    "skillstack-sync",
    name
  );
}

function assertScriptExists(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    console.error(
      chalk.hex("#C46A3A")(`  error: script not found: ${scriptPath}`) +
        "\n  " +
        chalk.dim("reinstall youmd (curl -fsSL https://you.md/install.sh | bash) to restore bundled scripts.")
    );
    process.exit(1);
  }
}

function machineProofSyncPayload(
  proof: MachineVerificationProof,
  reportPath?: string
): MachineProofSyncPayload {
  return {
    schemaVersion: proof.schemaVersion,
    generatedAt: proof.generatedAt,
    hostName: proof.hostName,
    platform: proof.platform,
    rootDir: proof.rootDir,
    secretValuesExposed: proof.secretValuesExposed,
    reportPath,
    source: "cli",
    agentName: "youmd machine verify",
    summary: proof.summary,
    daemonWarnings: proof.daemons.warnings,
    daemonLabels: proof.daemons.labels.map((daemon) => daemon.label),
  };
}

async function persistMachineProofReport(
  proof: MachineVerificationProof,
  opts: { writeReport?: boolean; syncReport?: boolean; reportPath?: string }
): Promise<void> {
  let latestPath: string | undefined;
  if (opts.writeReport) {
    const paths = writeMachineVerificationProof(proof, opts.reportPath ? expandHome(opts.reportPath) : undefined);
    latestPath = paths.latestPath;
    console.log("");
    console.log(chalk.dim("  proof report: ") + chalk.cyan(paths.latestPath));
    console.log(chalk.dim("  proof archive: ") + chalk.cyan(paths.archivedPath));
  }

  if (opts.syncReport) {
    const res = await syncMachineProof(machineProofSyncPayload(proof, latestPath));
    if (res.ok && res.data.success) {
      const action = res.data.created ? "created" : "updated";
      console.log(chalk.dim("  proof sync: ") + chalk.green(`${action} You.md machine record`));
    } else {
      console.log(chalk.hex("#C46A3A")("  proof sync failed") + chalk.dim(` — ${apiErrorMessage(res.data) || `HTTP ${res.status}`}`));
      process.exitCode = 1;
    }
  }
}

function printHelp(): void {
  console.log("");
  console.log("  " + chalk.bold("you machine") + chalk.dim(" -- cross-machine setup and agent config sync"));
  console.log("");
  console.log("  " + chalk.hex("#C46A3A")("Commands"));
  console.log("    " + chalk.cyan("setup") + chalk.dim("     bootstrap a fresh Mac: clone synced repos, restore skills, guide secrets + daemons"));
  console.log("    " + chalk.cyan("sync-now") + chalk.dim("  reconcile identity, shared skills/stacks, inventory, MCP, daemons, and proof"));
  console.log("    " + chalk.cyan("full-sync") + chalk.dim(" reconcile skills plus clone active projects, pull Secret Vault, and proof"));
  console.log("    " + chalk.cyan("migrate-home") + chalk.dim(" migrate legacy ~/.youmd runtime state to canonical ~/.you"));
  console.log("    " + chalk.cyan("projects") + chalk.dim("  create/clone active You.md project repos into a Desktop code root"));
  console.log("    " + chalk.cyan("verify") + chalk.dim("    audit cloned project readiness without reading secret values"));
  console.log("    " + chalk.cyan("prompt") + chalk.dim("    print a one-command Claude Code/Codex fresh-computer setup prompt"));
  console.log("    " + chalk.cyan("capture") + chalk.dim("   snapshot agent config (settings, commands, plugins) into ~/.agent-shared"));
  console.log("    " + chalk.cyan("restore") + chalk.dim("   apply ~/.agent-shared/agent-config/ back onto this machine"));
  console.log("");
  console.log("  " + chalk.dim("Options:"));
  console.log("    " + chalk.cyan("--root <dir>") + chalk.dim("   (projects) workspace root, default ~/Desktop/CODE_YOU"));
  console.log("    " + chalk.cyan("--days <n>") + chalk.dim("     (projects) recent activity window, default 30"));
  console.log("    " + chalk.cyan("--limit <n>") + chalk.dim("    (prompt) portfolio graph project cap, default 80"));
  console.log("    " + chalk.cyan("--key <key>") + chalk.dim("   (prompt) embed a You.md API key for non-interactive login"));
  console.log("    " + chalk.cyan("--env-vault <path>") + chalk.dim(" (prompt) encrypted .env.local vault path to restore"));
  console.log("    " + chalk.cyan("--require-env-vault") + chalk.dim(" (prompt) fail setup proof unless YOUMD_ENV_VAULT is restored"));
  console.log("    " + chalk.cyan("--max-clone-projects <n>") + chalk.dim(" (projects/prompt) cap clones for clean-host proof runs"));
  console.log("    " + chalk.cyan("--recent-only") + chalk.dim(" (projects) skip projects outside the activity window without prompting"));
  console.log("    " + chalk.cyan("--include-inactive") + chalk.dim(" (projects) audit override; include inactive/non-focused portfolio projects"));
  console.log("    " + chalk.cyan("--max-projects <n>") + chalk.dim(" (verify) project scan cap, default 80"));
  console.log("    " + chalk.cyan("--install-deps") + chalk.dim(" (verify) run bounded dependency installs before checks/probes"));
  console.log("    " + chalk.cyan("--install-timeout-ms <n>") + chalk.dim(" (verify) timeout per dependency install, default 180000"));
  console.log("    " + chalk.cyan("--max-install-projects <n>") + chalk.dim(" (verify) package project install cap, default 4"));
  console.log("    " + chalk.cyan("--run-checks") + chalk.dim(" (verify) run bounded package checks after audit"));
  console.log("    " + chalk.cyan("--check-scripts <names>") + chalk.dim(" (verify) comma list, default typecheck,lint,test,build"));
  console.log("    " + chalk.cyan("--check-timeout-ms <n>") + chalk.dim(" (verify) timeout per script, default 120000"));
  console.log("    " + chalk.cyan("--max-check-projects <n>") + chalk.dim(" (verify) package project run cap, default 8"));
  console.log("    " + chalk.cyan("--probe-servers") + chalk.dim(" (verify) start bounded dev servers and probe localhost"));
  console.log("    " + chalk.cyan("--server-timeout-ms <n>") + chalk.dim(" (verify) timeout per server probe, default 45000"));
  console.log("    " + chalk.cyan("--max-server-projects <n>") + chalk.dim(" (verify) dev server probe cap, default 3"));
  console.log("    " + chalk.cyan("--server-start-port <n>") + chalk.dim(" (verify) first localhost probe port, default 4310"));
  console.log("    " + chalk.cyan("--write-report") + chalk.dim(" (verify) write secret-safe JSON proof to ~/.you/machine-reports/latest.json"));
  console.log("    " + chalk.cyan("--sync-report") + chalk.dim("  (verify) sync proof summary to the You.md machine dashboard"));
  console.log("    " + chalk.cyan("--report-path <path>") + chalk.dim(" (verify) custom machine proof report path"));
  console.log("    " + chalk.cyan("--no-github") + chalk.dim("  (projects) skip authenticated GitHub recent-repo scan"));
  console.log("    " + chalk.cyan("--yes") + chalk.dim("        (projects) include older projects without prompting"));
  console.log("    " + chalk.cyan("--no-clone") + chalk.dim("   (projects) create directories only"));
  console.log("    " + chalk.cyan("--force") + chalk.dim("      (restore) overwrite existing files without backing them up"));
  console.log("    " + chalk.cyan("--dry-run") + chalk.dim("    preview writes without changing files"));
  console.log("");
}

function directoryStats(root: string): { exists: boolean; files: number; dirs: number; bytes: number } {
  const stats = { exists: fs.existsSync(root), files: 0, dirs: 0, bytes: 0 };
  if (!stats.exists) return stats;
  const visit = (p: string) => {
    let st: fs.Stats;
    try {
      st = fs.lstatSync(p);
    } catch {
      return;
    }
    if (st.isDirectory()) {
      stats.dirs += 1;
      for (const entry of fs.readdirSync(p)) visit(path.join(p, entry));
      return;
    }
    if (st.isFile()) {
      stats.files += 1;
      stats.bytes += st.size;
    }
  };
  visit(root);
  return stats;
}

type MigrationFileAction = "copied" | "preserved" | "skipped-conflict";

interface MigrationFileRecord {
  relativePath: string;
  bytes: number;
  sha256: string;
  action: MigrationFileAction;
}

interface MigrationCopyResult {
  files: MigrationFileRecord[];
  dirsCreated: number;
  symlinksCopied: number;
  conflicts: Array<{ relativePath: string; legacySha256: string; canonicalSha256: string }>;
}

function fileSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function copyDirMerge(src: string, dest: string): MigrationCopyResult {
  const result: MigrationCopyResult = { files: [], dirsCreated: 0, symlinksCopied: 0, conflicts: [] };
  if (!fs.existsSync(src)) return result;
  fs.mkdirSync(dest, { recursive: true, mode: 0o700 });

  const visit = (fromDir: string, toDir: string, relativeDir = "") => {
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true, mode: 0o700 });
      result.dirsCreated += 1;
    }
    for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
      const from = path.join(fromDir, entry.name);
      const to = path.join(toDir, entry.name);
      const relativePath = path.join(relativeDir, entry.name);
      if (entry.isDirectory()) {
        visit(from, to, relativePath);
        continue;
      }
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(from);
        if (!fs.existsSync(to)) {
          fs.symlinkSync(target, to);
          result.symlinksCopied += 1;
        }
        continue;
      }
      if (entry.isFile()) {
        const legacySha256 = fileSha256(from);
        const bytes = fs.statSync(from).size;
        if (!fs.existsSync(to)) {
          fs.copyFileSync(from, to);
          const copiedSha256 = fileSha256(to);
          result.files.push({ relativePath, bytes, sha256: copiedSha256, action: "copied" });
          continue;
        }
        const canonicalSha256 = fileSha256(to);
        if (canonicalSha256 === legacySha256) {
          result.files.push({ relativePath, bytes, sha256: canonicalSha256, action: "preserved" });
        } else {
          result.files.push({ relativePath, bytes, sha256: canonicalSha256, action: "skipped-conflict" });
          result.conflicts.push({ relativePath, legacySha256, canonicalSha256 });
        }
      }
    }
  };

  visit(src, dest);
  return result;
}

function updateYouShims(homeDir: string): void {
  const binDir = path.join(homeDir, "bin");
  fs.mkdirSync(binDir, { recursive: true, mode: 0o700 });
  const npmBin = path.join(homeDir, "npm-global", "bin");
  for (const bin of ["youmd", "you", "create-youmd"]) {
    const preferred = path.join(npmBin, bin);
    if (fs.existsSync(preferred)) {
      const target = path.join(binDir, bin);
      try { fs.rmSync(target, { force: true }); } catch { /* ignore */ }
      fs.symlinkSync(preferred, target);
    }
  }
}

function machineMigrateHomeCommand(opts: { dryRun?: boolean; yes?: boolean } = {}): void {
  const canonical = getCanonicalGlobalConfigDir();
  const legacy = getLegacyGlobalConfigDir();
  const apply = opts.yes === true && opts.dryRun !== true;
  const beforeLegacy = directoryStats(legacy);
  const beforeCanonical = directoryStats(canonical);

  console.log("");
  console.log("  " + chalk.bold("YOU home migration"));
  console.log(chalk.dim(`  canonical: ${canonical}`));
  console.log(chalk.dim(`  legacy:    ${legacy}`));
  console.log(chalk.dim("  mode:      ") + (apply ? chalk.green("apply") : chalk.yellow("dry-run")));
  console.log("");
  console.log(chalk.dim("  legacy files:    ") + chalk.cyan(String(beforeLegacy.files)) + chalk.dim(` / ${beforeLegacy.bytes} bytes`));
  console.log(chalk.dim("  canonical files: ") + chalk.cyan(String(beforeCanonical.files)) + chalk.dim(` / ${beforeCanonical.bytes} bytes`));

  if (!beforeLegacy.exists && !beforeCanonical.exists) {
    console.log(chalk.yellow("  no ~/.you or legacy ~/.youmd runtime home exists yet"));
    console.log("");
    return;
  }

  if (!apply) {
    console.log("");
    console.log(chalk.dim("  no files changed. rerun with ") + chalk.cyan("you machine migrate-home --yes"));
    console.log(chalk.dim("  after migration, export: ") + chalk.cyan('PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$PATH"'));
    console.log("");
    return;
  }

  const migration = copyDirMerge(legacy, canonical);
  updateYouShims(canonical);
  try { fs.chmodSync(canonical, 0o700); } catch { /* ignore */ }
  const afterCanonical = directoryStats(canonical);
  const copied = migration.files.filter((file) => file.action === "copied").length;
  const preserved = migration.files.filter((file) => file.action === "preserved").length;
  const conflicted = migration.files.filter((file) => file.action === "skipped-conflict").length;
  const reportDir = path.join(canonical, "migration-reports");
  fs.mkdirSync(reportDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `you-home-migration-${stamp}.json`);
  const report = {
    schemaVersion: "you-md/home-migration/v1",
    generatedAt: new Date().toISOString(),
    canonical,
    legacy,
    mode: "apply",
    before: { canonical: beforeCanonical, legacy: beforeLegacy },
    after: { canonical: afterCanonical },
    copied,
    preserved,
    conflicted,
    dirsCreated: migration.dirsCreated,
    symlinksCopied: migration.symlinksCopied,
    conflicts: migration.conflicts,
    files: migration.files,
    legacyPreserved: true,
    secretValuesExposed: false,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });

  console.log("");
  console.log(chalk.green("  migrated runtime state to canonical ~/.you"));
  console.log(chalk.dim("  canonical files: ") + chalk.cyan(String(afterCanonical.files)) + chalk.dim(` / ${afterCanonical.bytes} bytes`));
  console.log(chalk.dim("  proof:           ") + chalk.cyan(`${copied} copied / ${preserved} already matched / ${conflicted} conflicts`));
  console.log(chalk.dim("  proof report:    ") + chalk.cyan(reportPath));
  if (conflicted > 0) {
    console.log(chalk.yellow("  conflicts were preserved in canonical ~/.you; inspect the proof report before removing legacy ~/.youmd"));
  }
  console.log(chalk.dim("  legacy ~/.youmd was preserved for fallback compatibility"));
  console.log(chalk.dim("  next shell PATH: ") + chalk.cyan('export PATH="$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:$PATH"'));
  console.log("");
}

function createRL(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function expandHome(input: string): string {
  return input === "~" || input.startsWith("~/")
    ? path.join(os.homedir(), input.slice(2))
    : input;
}

function readActiveYouJson(): Record<string, unknown> | null {
  const bundleDir = resolveActiveBundleDir();
  if (!bundleDir) return null;
  const youJsonPath = path.join(bundleDir, "you.json");
  if (!fs.existsSync(youJsonPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(youJsonPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function commandExists(name: string): boolean {
  const result = child_process.spawnSync("sh", ["-lc", `command -v ${name}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function cloneProject(candidate: MachineProjectCandidate, targetDir: string): "cloned" | "created" | "skipped" | "failed" {
  if (fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir);
    if (entries.length > 0) return "skipped";
  }

  if (!candidate.cloneSpec || !candidate.githubUrl) {
    fs.mkdirSync(targetDir, { recursive: true });
    return "created";
  }

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  const result = commandExists("gh")
    ? child_process.spawnSync("gh", ["repo", "clone", candidate.cloneSpec, targetDir], { stdio: "inherit" })
    : child_process.spawnSync("git", ["clone", candidate.githubUrl, targetDir], { stdio: "inherit" });

  return result.status === 0 ? "cloned" : "failed";
}

function runYoumdMachineStep(label: string, args: string[], opts: { required?: boolean; timeoutMs?: number } = {}): boolean {
  const command = `you ${args.map((arg) => /\s/.test(arg) ? JSON.stringify(arg) : arg).join(" ")}`;
  console.log(chalk.dim(`  -- ${label}: `) + chalk.cyan(command));
  const timeout = opts.timeoutMs ?? 10 * 60 * 1000;
  const run = (cmd: string, cmdArgs: string[]) =>
    child_process.spawnSync(cmd, cmdArgs, {
      stdio: "inherit",
      env: process.env,
      timeout,
    });

  let result = run("you", args);
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    result = run("youmd", args);
  }
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT" && process.argv[1]) {
    result = run(process.execPath, [process.argv[1], ...args]);
  }

  if (result.error) {
    console.log(chalk.yellow(`  ${label} warning: ${result.error.message}`));
    if (opts.required) process.exitCode = 1;
    return false;
  }
  if (typeof result.status === "number" && result.status !== 0) {
    console.log(chalk.yellow(`  ${label} exited ${result.status}`));
    if (opts.required) process.exitCode = result.status;
    return false;
  }
  return true;
}

async function machineSyncNowCommand(opts: {
  root?: string;
  maxProjects?: string | number;
  full?: boolean;
  days?: string | number;
  limit?: string | number;
  maxCloneProjects?: string | number;
  recentOnly?: boolean;
  includeInactive?: boolean;
  installDeps?: boolean;
  runChecks?: boolean;
  probeServers?: boolean;
  github?: boolean;
  clone?: boolean;
  yes?: boolean;
} = {}): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.hex("#C46A3A")("  not authenticated. run: ") + chalk.cyan("you login"));
    console.log("");
    process.exitCode = 1;
    return;
  }

  const rootDir = expandHome(opts.root || path.join(os.homedir(), "Desktop", "CODE_YOU"));
  const inventoryDir = path.join(getWritableHomeBundleDir(), "agent-stack-inventory");
  fs.mkdirSync(inventoryDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(rootDir, { recursive: true });

  console.log("");
  console.log("  " + chalk.bold(opts.full ? "machine full sync" : "machine sync now"));
  console.log(chalk.dim(`  root: ${rootDir}`));
  console.log(chalk.dim(`  inventory: ${inventoryDir}`));
  console.log(chalk.dim("  secret rule: sync reads metadata and file names only; .env.local values are never printed."));
  console.log("");

  const required = { required: true };
  runYoumdMachineStep("pull identity bundle", ["pull"], required);
  runYoumdMachineStep("sync identity bundle", ["sync", "--daemon"], required);
  runYoumdMachineStep("sync shared skill/stack git roots", ["stack", "sync"], required);
  runYoumdMachineStep("install catalog skills", ["skill", "install", "all"]);
  runYoumdMachineStep("render installed skills", ["skill", "sync"], required);
  runYoumdMachineStep("install Claude MCP config", ["mcp", "--install", "claude", "--auto"]);
  runYoumdMachineStep("install Codex MCP config", ["mcp", "--install", "codex", "--auto"]);

  if (opts.full) {
    await machineProjectsCommand({
      root: rootDir,
      days: opts.days,
      maxCloneProjects: opts.maxCloneProjects,
      recentOnly: opts.recentOnly ?? true,
      dryRun: false,
      yes: opts.yes,
      clone: opts.clone,
      github: opts.github,
      includeInactive: opts.includeInactive,
    });
    runYoumdMachineStep("register Secret Vault device", ["env", "vault", "device-register"]);
    runYoumdMachineStep("pull Secret Vault envs", [
      "env",
      "vault",
      "pull",
      "--restore",
      "--root",
      rootDir,
      "--map-existing",
      "--existing-only",
      "--skip-agent-auth",
    ]);
    runYoumdMachineStep("rehydrate portfolio graph", [
      "project",
      "portfolio-hydrate",
      "--root",
      rootDir,
      "--days",
      String(opts.days || 30),
      "--limit",
      String(opts.limit || 80),
    ]);
  }

  runYoumdMachineStep("sync agent stack inventory", [
    "skill",
    "inventory",
    "--out-dir",
    inventoryDir,
    "--register-catalog",
    "--sync",
  ], required);
  runYoumdMachineStep("install resident daemons", ["stack", "daemon", "install"]);

  const verifyArgs = [
    "machine",
    "verify",
    "--root",
    rootDir,
    "--max-projects",
    String(opts.maxProjects || opts.limit || 80),
    "--write-report",
    "--sync-report",
  ];
  if (opts.installDeps) {
    verifyArgs.push("--install-deps");
  }
  if (opts.runChecks) {
    verifyArgs.push("--run-checks");
  }
  if (opts.probeServers) {
    verifyArgs.push("--probe-servers");
  }
  runYoumdMachineStep("write/sync machine proof", verifyArgs, required);
  runYoumdMachineStep("show synced Skill Mesh status", ["skill", "inventory", "status", "--limit", "10"]);
  runYoumdMachineStep("show resident daemon status", ["stack", "daemon", "status"]);

  console.log("");
  console.log(chalk.green("  machine sync pass complete."));
  console.log(chalk.dim("  keep it live with: ") + chalk.cyan("you sync --live --daemon"));
  console.log("");
}

function readRecentGithubProjectsFromGh(days: number): GithubProjectSource[] {
  if (!commandExists("gh")) return [];
  const result = child_process.spawnSync(
    "gh",
    [
      "api",
      "-X",
      "GET",
      "/user/repos",
      "-F",
      "sort=pushed",
      "-F",
      "direction=desc",
      "-F",
      "per_page=100",
      "-F",
      "affiliation=owner,collaborator,organization_member",
      "--paginate",
      "--jq",
      ".[] | {name, fullName: .full_name, url: .html_url, pushedAt: .pushed_at, updatedAt: .updated_at, description, homepage, isPrivate: .private}",
    ],
    { encoding: "utf-8" },
  );
  if (result.status !== 0 || !result.stdout.trim()) return [];

  const cutoff = Date.now() - days * 86_400_000;
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as GithubProjectSource;
        if (!parsed.pushedAt || Date.parse(parsed.pushedAt) < cutoff) return [];
        return [parsed];
      } catch {
        return [];
      }
    });
}

async function machineProjectsCommand(opts: {
  root?: string;
  days?: string | number;
  maxCloneProjects?: string | number;
  recentOnly?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  clone?: boolean;
  github?: boolean;
  includeInactive?: boolean;
} = {}): Promise<void> {
  const youJson = readActiveYouJson();
  if (!youJson) {
    console.log(chalk.hex("#C46A3A")("  no local You.md bundle found."));
    console.log(chalk.dim("  run ") + chalk.cyan("you login && you pull") + chalk.dim(" first, then retry: ") + chalk.cyan("you machine projects"));
    return;
  }

  const defaultRoot = path.join(os.homedir(), "Desktop", "CODE_YOU");
  let rootDir = expandHome(opts.root || defaultRoot);

  let rl: readline.Interface | null = null;
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  if (!opts.root && interactive) {
    rl = createRL();
    const answer = await ask(
      rl,
      chalk.dim(`  code project directory [${rootDir}]: `),
    );
    if (answer) rootDir = expandHome(answer);
  }

  const activeDays = Number(opts.days || 30);
  let portfolioGraph: Record<string, unknown> | null = null;
  if (isAuthenticated()) {
    const graphRes = await getPortfolioGraph({ includeTasks: true });
    if (graphRes.ok && graphRes.data) {
      portfolioGraph = graphRes.data as unknown as Record<string, unknown>;
      console.log(
        chalk.dim(
          `  portfolio graph: ${graphRes.data.projects.length} project${graphRes.data.projects.length === 1 ? "" : "s"} / ${graphRes.data.recentTrackedProjects.length} tracked repo${graphRes.data.recentTrackedProjects.length === 1 ? "" : "s"}`
        )
      );
    } else {
      console.log(chalk.dim(`  portfolio graph: unavailable (${apiErrorMessage(graphRes.data) || `HTTP ${graphRes.status}`}); falling back to local bundle + GitHub`));
    }
  } else {
    console.log(chalk.dim("  portfolio graph: skipped until youmd login completes"));
  }

  const githubProjects = opts.github === false ? [] : readRecentGithubProjectsFromGh(activeDays);
  if (githubProjects.length > 0) {
    console.log(chalk.dim(`  github: found ${githubProjects.length} repo${githubProjects.length === 1 ? "" : "s"} pushed within ${activeDays || 30}d`));
  } else if (opts.github !== false) {
    console.log(chalk.dim("  github: no authenticated recent repos found; using local You.md project records"));
  }

  const plan = buildMachineProjectPlan(youJson, {
    rootDir,
    activeDays: Number.isFinite(activeDays) && activeDays > 0 ? activeDays : 30,
    githubProjects,
    portfolioGraph,
    includeInactive: opts.includeInactive,
  });

  let selected = [...plan.recent];
  if (plan.older.length > 0 && opts.recentOnly) {
    console.log("");
    console.log(chalk.dim(`  skipped ${plan.older.length} project${plan.older.length === 1 ? "" : "s"} outside the ${activeDays || 30}d activity window (--recent-only)`));
  } else if (plan.older.length > 0) {
    console.log("");
    console.log(chalk.dim(`  older projects outside the ${activeDays || 30}d window:`));
    for (const candidate of plan.older) {
      console.log(chalk.dim(`    - ${candidate.name} (${candidate.reason})`));
    }

    if (opts.yes) {
      selected = selected.concat(plan.older);
    } else if (interactive) {
      if (!rl) rl = createRL();
      for (const candidate of plan.older) {
        const answer = await ask(
          rl,
          chalk.dim(`  include ${candidate.name}? [y/N]: `),
        );
        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          selected.push(candidate);
        }
      }
    }
  }
  rl?.close();

  const maxCloneProjects = Number(opts.maxCloneProjects || 0);
  const hasCloneCap = Number.isFinite(maxCloneProjects) && maxCloneProjects > 0;
  if (hasCloneCap && selected.length > maxCloneProjects) {
    selected = selected.slice(0, maxCloneProjects);
  }

  console.log("");
  console.log("  " + chalk.bold("machine project bootstrap"));
  console.log(chalk.dim(`  root: ${plan.rootDir}`));
  console.log(chalk.dim(`  selected: ${selected.length} project${selected.length === 1 ? "" : "s"}`));
  if (hasCloneCap) {
    console.log(chalk.dim(`  clone cap: ${maxCloneProjects} project${maxCloneProjects === 1 ? "" : "s"} (proof mode)`));
  }
  console.log(chalk.dim(`  graph inputs: ${plan.sourceCounts.portfolioGraphProjects} portfolio project${plan.sourceCounts.portfolioGraphProjects === 1 ? "" : "s"} / ${plan.sourceCounts.portfolioGraphTrackedProjects} graph-tracked repo${plan.sourceCounts.portfolioGraphTrackedProjects === 1 ? "" : "s"} / ${plan.sourceCounts.githubProjects} gh repo${plan.sourceCounts.githubProjects === 1 ? "" : "s"} / ${plan.sourceCounts.bundleProjects} bundle project${plan.sourceCounts.bundleProjects === 1 ? "" : "s"}`));
  if (plan.sourceCounts.portfolioGraphProjects > 0 && !opts.includeInactive) {
    console.log(chalk.dim("  setup gate: Portfolio Graph status=active and focus=Top Priority/Focusing only"));
  }
  if (plan.skipped.length > 0) {
    console.log(chalk.dim(`  skipped duplicates/unusable/not setup-eligible: ${plan.skipped.length}`));
  }
  console.log("");

  if (selected.length === 0) {
    console.log(chalk.dim("  nothing selected. no dirt made on the desktop today."));
    return;
  }

  if (opts.dryRun) {
    for (const candidate of selected) {
      const target = path.join(plan.rootDir, candidate.targetDirName);
      const action = opts.clone === false || !candidate.githubUrl ? "mkdir" : "clone";
      const meta = [
        candidate.githubUrl ? `<- ${candidate.githubUrl}` : "",
        candidate.stackName ? `[${candidate.stackName}]` : "",
        `source:${candidate.source}`,
        candidate.focus ? `focus:${candidate.focus.slice(0, 72)}` : "",
      ].filter(Boolean).join(" ");
      console.log(`  ${chalk.cyan(action.padEnd(5))} ${target}${meta ? chalk.dim(` ${meta}`) : ""}`);
    }
    return;
  }

  fs.mkdirSync(plan.rootDir, { recursive: true });

  let cloned = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const candidate of selected) {
    const target = path.join(plan.rootDir, candidate.targetDirName);
    if (opts.clone === false) {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
        created++;
        console.log(chalk.green("  ✓") + chalk.dim(` ${candidate.targetDirName}`));
      } else {
        skipped++;
        console.log(chalk.dim(`  - ${candidate.targetDirName} already exists`));
      }
      continue;
    }

    const result = cloneProject(candidate, target);
    if (result === "cloned") cloned++;
    else if (result === "created") created++;
    else if (result === "skipped") skipped++;
    else failed++;
  }

  console.log("");
  console.log(chalk.green(`  done: ${cloned} cloned, ${created} directories created, ${skipped} skipped${failed ? `, ${failed} failed` : ""}`));
  console.log(chalk.dim("  next: open Claude Code or Codex from that CODE folder and run ") + chalk.cyan("you"));
}

async function machineVerifyCommand(opts: {
  root?: string;
  maxProjects?: string | number;
  installDeps?: boolean;
  installTimeoutMs?: string | number;
  maxInstallProjects?: string | number;
  runChecks?: boolean;
  checkScripts?: string;
  checkTimeoutMs?: string | number;
  maxCheckProjects?: string | number;
  probeServers?: boolean;
  serverTimeoutMs?: string | number;
  maxServerProjects?: string | number;
  serverStartPort?: string | number;
  writeReport?: boolean;
  syncReport?: boolean;
  reportPath?: string;
} = {}): Promise<void> {
  const defaultRoot = path.join(os.homedir(), "Desktop", "CODE_YOU");
  const rootDir = expandHome(opts.root || defaultRoot);
  const maxProjects = Number(opts.maxProjects || 80);
  const report = buildMachineReadinessReport(rootDir, Number.isFinite(maxProjects) && maxProjects > 0 ? maxProjects : 80);
  const agentStackInventory = loadLatestAgentStackInventoryProof();

  console.log("");
  console.log("  " + chalk.bold("machine readiness audit"));
  console.log(chalk.dim(`  root: ${report.rootDir}`));
  console.log(chalk.dim(`  scanned: ${report.scanned} project director${report.scanned === 1 ? "y" : "ies"}`));
  console.log(chalk.dim(`  git: ${report.totals.gitRepos} / packages: ${report.totals.packageProjects} / env.local: ${report.totals.envLocal} / env examples: ${report.totals.envExample}`));
  console.log(chalk.dim(`  agent docs: ${report.totals.agentDocs} / project-context: ${report.totals.projectContext} / ready: ${report.totals.ready} / needs env: ${report.totals.needsEnv} / partial: ${report.totals.partial}`));
  if (agentStackInventory) {
    console.log(chalk.dim(
      `  skill mesh: ${agentStackInventory.counts.uniqueSkillNames} unique skills / ${agentStackInventory.counts.uniqueRealSkillFiles} real SKILL.md files / ${agentStackInventory.counts.missingFromYoumdCatalog} catalog gaps / ${agentStackInventory.counts.duplicateNameDifferentRealpaths} DRY review cases`
    ));
    if (agentStackInventory.htmlPath) {
      console.log(chalk.dim(`  skill mesh report: ${agentStackInventory.htmlPath}`));
    }
  } else {
    console.log(chalk.dim("  skill mesh: no local inventory proof yet; run ") + chalk.cyan("you skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync"));
  }
  console.log("");

  if (report.projects.length === 0) {
    console.log(chalk.dim("  no cloned projects found yet. run ") + chalk.cyan("you machine projects") + chalk.dim(" first."));
    if (opts.writeReport || opts.syncReport) {
      const proof = buildMachineVerificationProof({ readiness: report, agentStackInventory });
      await persistMachineProofReport(proof, {
        writeReport: opts.writeReport,
        syncReport: opts.syncReport,
        reportPath: opts.reportPath,
      });
    }
    console.log("");
    return;
  }

  for (const project of report.projects) {
    const statusColor = project.status === "ready"
      ? chalk.green
      : project.status === "needs-env"
        ? chalk.yellow
        : project.status === "empty"
          ? chalk.dim
          : chalk.hex("#C46A3A");
    const tags = [
      project.isGitRepo ? "git" : "no-git",
      project.packageManager || "no-pkg",
      project.hasEnvLocal ? ".env.local" : project.hasEnvExample ? "env-needed" : "no-env-template",
      project.hasAgentDocs ? "agent-docs" : "agent-docs-missing",
    ];
    console.log(`  ${statusColor(project.status.padEnd(9))} ${chalk.cyan(project.dirName)} ${chalk.dim(tags.join(" · "))}`);
    if (project.remoteUrl) console.log(chalk.dim(`             remote: ${project.remoteUrl}`));
    if (project.suggestedChecks.length > 0) {
      console.log(chalk.dim(`             checks: ${project.suggestedChecks.slice(0, 4).join(" | ")}`));
    }
    for (const note of project.notes.slice(0, 2)) {
      console.log(chalk.dim(`             note: ${note}`));
    }
  }
  console.log("");
  console.log(chalk.dim("  secret rule: readiness checks only inspect file names and package scripts; .env.local values are never read."));

  let installReport: ReturnType<typeof buildMachineInstallReport> | undefined;
  let runReport: ReturnType<typeof buildMachineRunChecksReport> | undefined;
  let probeReport: Awaited<ReturnType<typeof buildMachineServerProbeReport>> | undefined;

  if (opts.installDeps) {
    installReport = buildMachineInstallReport(rootDir, {
      timeoutMs: Number(opts.installTimeoutMs || 180_000),
      maxProjects: Number(opts.maxInstallProjects || 4),
      scanLimit: Number.isFinite(maxProjects) && maxProjects > 0 ? maxProjects : 80,
    });

    console.log("");
    console.log("  " + chalk.bold("bounded dependency install"));
    console.log(chalk.dim(`  max projects: ${installReport.maxProjects} / timeout: ${installReport.timeoutMs}ms per project`));
    console.log(chalk.dim(`  passed: ${installReport.totals.passed} / failed: ${installReport.totals.failed} / timeout: ${installReport.totals.timeout} / skipped: ${installReport.totals.skipped}`));
    console.log("");

    if (installReport.results.length === 0) {
      console.log(chalk.dim("  no package projects were available for dependency install."));
      console.log("");
    }

    for (const result of installReport.results) {
      const statusColor = result.status === "passed"
        ? chalk.green
        : result.status === "skipped"
          ? chalk.dim
          : result.status === "timeout"
            ? chalk.yellow
            : chalk.hex("#C46A3A");
      console.log(`  ${statusColor(result.status.padEnd(7))} ${chalk.cyan(result.dirName)} ${chalk.dim(result.command)} ${chalk.dim(`${result.durationMs}ms`)}`);
      if (result.reason) console.log(chalk.dim(`           reason: ${result.reason}`));
      if (result.status !== "passed" && result.status !== "skipped" && result.outputTail) {
        console.log(chalk.dim("           output tail:"));
        for (const line of result.outputTail.split("\n").slice(-12)) {
          console.log(chalk.dim(`             ${line}`));
        }
      }
    }

    if (installReport.totals.failed > 0 || installReport.totals.timeout > 0) {
      process.exitCode = 1;
    }
  }

  if (!opts.runChecks && !opts.probeServers) {
    if (opts.writeReport || opts.syncReport) {
      const proof = buildMachineVerificationProof({ readiness: report, installs: installReport, agentStackInventory });
      await persistMachineProofReport(proof, {
        writeReport: opts.writeReport,
        syncReport: opts.syncReport,
        reportPath: opts.reportPath,
      });
    }
    console.log(chalk.dim("  run ") + chalk.cyan("you machine verify --install-deps --run-checks --probe-servers") + chalk.dim(" to install deps, execute bounded checks, and smoke-probe dev servers."));
    console.log("");
    return;
  }

  if (opts.runChecks) {
    const checkScripts = opts.checkScripts
      ? opts.checkScripts.split(",").map((script) => script.trim()).filter(Boolean)
      : undefined;
    runReport = buildMachineRunChecksReport(rootDir, {
      scripts: checkScripts,
      timeoutMs: Number(opts.checkTimeoutMs || 120_000),
      maxProjects: Number(opts.maxCheckProjects || 8),
      scanLimit: Number.isFinite(maxProjects) && maxProjects > 0 ? maxProjects : 80,
    });

    console.log("");
    console.log("  " + chalk.bold("bounded package checks"));
    console.log(chalk.dim(`  scripts: ${runReport.requestedScripts.join(", ")}`));
    console.log(chalk.dim(`  max projects: ${runReport.maxProjects} / timeout: ${runReport.timeoutMs}ms per script`));
    console.log(chalk.dim(`  passed: ${runReport.totals.passed} / failed: ${runReport.totals.failed} / timeout: ${runReport.totals.timeout} / skipped: ${runReport.totals.skipped}`));
    console.log("");

    if (runReport.results.length === 0) {
      console.log(chalk.dim("  no package projects had requested check scripts."));
      console.log("");
    }

    for (const result of runReport.results) {
      const statusColor = result.status === "passed"
        ? chalk.green
        : result.status === "skipped"
          ? chalk.dim
          : result.status === "timeout"
            ? chalk.yellow
            : chalk.hex("#C46A3A");
      console.log(`  ${statusColor(result.status.padEnd(7))} ${chalk.cyan(result.dirName)} ${chalk.dim(result.command)} ${chalk.dim(`${result.durationMs}ms`)}`);
      if (result.reason) console.log(chalk.dim(`           reason: ${result.reason}`));
      if (result.status !== "passed" && result.status !== "skipped" && result.outputTail) {
        console.log(chalk.dim("           output tail:"));
        for (const line of result.outputTail.split("\n").slice(-12)) {
          console.log(chalk.dim(`             ${line}`));
        }
      }
    }

    if (runReport.totals.failed > 0 || runReport.totals.timeout > 0) {
      process.exitCode = 1;
    }
  }

  if (opts.probeServers) {
    probeReport = await buildMachineServerProbeReport(rootDir, {
      timeoutMs: Number(opts.serverTimeoutMs || 45_000),
      maxProjects: Number(opts.maxServerProjects || 3),
      startPort: Number(opts.serverStartPort || 4310),
      scanLimit: Number.isFinite(maxProjects) && maxProjects > 0 ? maxProjects : 80,
    });

    console.log("");
    console.log("  " + chalk.bold("bounded dev server probes"));
    console.log(chalk.dim(`  max projects: ${probeReport.maxProjects} / timeout: ${probeReport.timeoutMs}ms per server / first port: ${probeReport.startPort}`));
    console.log(chalk.dim(`  passed: ${probeReport.totals.passed} / failed: ${probeReport.totals.failed} / timeout: ${probeReport.totals.timeout} / skipped: ${probeReport.totals.skipped}`));
    console.log("");

    if (probeReport.results.length === 0) {
      console.log(chalk.dim("  no package projects had a dev script to probe."));
      console.log("");
    }

    for (const result of probeReport.results) {
      const statusColor = result.status === "passed"
        ? chalk.green
        : result.status === "skipped"
          ? chalk.dim
          : result.status === "timeout"
            ? chalk.yellow
            : chalk.hex("#C46A3A");
      const statusSuffix = result.statusCode ? ` HTTP ${result.statusCode}` : "";
      console.log(`  ${statusColor(result.status.padEnd(7))} ${chalk.cyan(result.dirName)} ${chalk.dim(result.command)} ${chalk.dim(`${result.url}${statusSuffix} · ${result.durationMs}ms`)}`);
      if (result.reason) console.log(chalk.dim(`           reason: ${result.reason}`));
      if (result.status !== "passed" && result.status !== "skipped" && result.outputTail) {
        console.log(chalk.dim("           output tail:"));
        for (const line of result.outputTail.split("\n").slice(-12)) {
          console.log(chalk.dim(`             ${line}`));
        }
      }
    }

    if (probeReport.totals.failed > 0 || probeReport.totals.timeout > 0) {
      process.exitCode = 1;
    }
  }
  if (opts.writeReport || opts.syncReport) {
    const proof = buildMachineVerificationProof({
      readiness: report,
      installs: installReport,
      checks: runReport,
      servers: probeReport,
      agentStackInventory,
    });
    await persistMachineProofReport(proof, {
      writeReport: opts.writeReport,
      syncReport: opts.syncReport,
      reportPath: opts.reportPath,
    });
  }
  console.log("");
}

export async function machineCommand(subcommand: string, opts: { force?: boolean; dryRun?: boolean; root?: string; days?: string | number; limit?: string | number; maxCloneProjects?: string | number; recentOnly?: boolean; includeInactive?: boolean; maxProjects?: string | number; installDeps?: boolean; installTimeoutMs?: string | number; maxInstallProjects?: string | number; runChecks?: boolean; checkScripts?: string; checkTimeoutMs?: string | number; maxCheckProjects?: string | number; probeServers?: boolean; serverTimeoutMs?: string | number; maxServerProjects?: string | number; serverStartPort?: string | number; writeReport?: boolean; syncReport?: boolean; reportPath?: string; key?: string; envVault?: string; requireEnvVault?: boolean; yes?: boolean; clone?: boolean; github?: boolean } = {}): Promise<void> {
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printHelp();
    return;
  }

  if (subcommand === "projects") {
    await machineProjectsCommand(opts);
    return;
  }

  if (subcommand === "verify" || subcommand === "readiness" || subcommand === "doctor") {
    await machineVerifyCommand(opts);
    return;
  }

  if (subcommand === "sync-now" || subcommand === "repair" || subcommand === "reconcile") {
    await machineSyncNowCommand(opts);
    return;
  }

  if (subcommand === "full-sync" || subcommand === "full-setup") {
    await machineSyncNowCommand({ ...opts, full: true });
    return;
  }

  if (subcommand === "migrate-home" || subcommand === "migrate-you-home" || subcommand === "migrate-to-you") {
    machineMigrateHomeCommand(opts);
    return;
  }

  if (subcommand === "prompt" || subcommand === "new-computer" || subcommand === "new-machine") {
    console.log("");
    console.log(buildFreshMachineBootstrapPrompt({
      apiKey: opts.key,
      root: opts.root,
      days: opts.days,
      limit: opts.limit,
      maxCloneProjects: opts.maxCloneProjects,
      envVaultPath: opts.envVault,
      requireEnvVault: opts.requireEnvVault,
    }));
    console.log("");
    return;
  }

  if (subcommand === "setup") {
    const scriptPath = resolveSkillstackScript("bootstrap-new-mac.sh");
    assertScriptExists(scriptPath);

    const spinner = new BrailleSpinner("setting up this machine...");
    spinner.start();
    spinner.stop("handing off to bootstrap");
    console.log("");

    const result = child_process.spawnSync("bash", [scriptPath], {
      stdio: "inherit",
    });

    if (result.error) {
      console.error(
        chalk.hex("#C46A3A")(`  error spawning bootstrap: ${result.error.message}`)
      );
      process.exit(1);
    }

    process.exit(result.status ?? 0);
    return;
  }

  if (subcommand === "capture") {
    const scriptPath = resolveSkillstackScript("capture-agent-config.sh");
    assertScriptExists(scriptPath);

    const spinner = new BrailleSpinner("capturing agent config...");
    spinner.start();
    spinner.stop("handing off to capture script");
    console.log("");

    const result = child_process.spawnSync("bash", [scriptPath], {
      stdio: "inherit",
    });

    if (result.error) {
      console.error(
        chalk.hex("#C46A3A")(`  error spawning capture script: ${result.error.message}`)
      );
      process.exit(1);
    }

    process.exit(result.status ?? 0);
    return;
  }

  if (subcommand === "restore") {
    const scriptPath = resolveSkillstackScript("restore-agent-config.sh");
    assertScriptExists(scriptPath);

    const spinner = new BrailleSpinner("restoring agent config...");
    spinner.start();
    spinner.stop("handing off to restore script");
    console.log("");

    const args: string[] = [];
    if (opts.dryRun) args.push("--dry-run");
    if (opts.force) args.push("--force");

    const result = child_process.spawnSync("bash", [scriptPath, ...args], {
      stdio: "inherit",
    });

    if (result.error) {
      console.error(
        chalk.hex("#C46A3A")(`  error spawning restore script: ${result.error.message}`)
      );
      process.exit(1);
    }

    process.exit(result.status ?? 0);
    return;
  }

  console.error(
    chalk.hex("#C46A3A")(`  unknown machine subcommand: ${subcommand}`)
  );
  printHelp();
  process.exit(1);
}

// Preserve the original export name for any callers that imported it directly.
export function machineSetupCommand(): void {
  void machineCommand("setup");
}
