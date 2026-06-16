import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";
import * as child_process from "child_process";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";
import { resolveActiveBundleDir } from "../lib/config";
import {
  buildMachineProjectPlan,
  MachineProjectCandidate,
} from "../lib/machine-projects";

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

function printHelp(): void {
  console.log("");
  console.log("  " + chalk.bold("youmd machine") + chalk.dim(" -- cross-machine setup and agent config sync"));
  console.log("");
  console.log("  " + chalk.hex("#C46A3A")("Commands"));
  console.log("    " + chalk.cyan("setup") + chalk.dim("     bootstrap a fresh Mac: clone synced repos, restore skills, guide secrets + daemons"));
  console.log("    " + chalk.cyan("projects") + chalk.dim("  create/clone active You.md project repos into a Desktop code root"));
  console.log("    " + chalk.cyan("capture") + chalk.dim("   snapshot agent config (settings, commands, plugins) into ~/.agent-shared"));
  console.log("    " + chalk.cyan("restore") + chalk.dim("   apply ~/.agent-shared/agent-config/ back onto this machine"));
  console.log("");
  console.log("  " + chalk.dim("Options:"));
  console.log("    " + chalk.cyan("--root <dir>") + chalk.dim("   (projects) workspace root, default ~/Desktop/CODE_2026"));
  console.log("    " + chalk.cyan("--days <n>") + chalk.dim("     (projects) recent activity window, default 90"));
  console.log("    " + chalk.cyan("--yes") + chalk.dim("        (projects) include older projects without prompting"));
  console.log("    " + chalk.cyan("--no-clone") + chalk.dim("   (projects) create directories only"));
  console.log("    " + chalk.cyan("--force") + chalk.dim("      (restore) overwrite existing files without backing them up"));
  console.log("    " + chalk.cyan("--dry-run") + chalk.dim("    preview writes without changing files"));
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

async function machineProjectsCommand(opts: {
  root?: string;
  days?: string | number;
  dryRun?: boolean;
  yes?: boolean;
  clone?: boolean;
} = {}): Promise<void> {
  const youJson = readActiveYouJson();
  if (!youJson) {
    console.log(chalk.hex("#C46A3A")("  no local You.md bundle found."));
    console.log(chalk.dim("  run ") + chalk.cyan("youmd login && youmd pull") + chalk.dim(" first, then retry: ") + chalk.cyan("youmd machine projects"));
    return;
  }

  const defaultRoot = path.join(os.homedir(), "Desktop", "CODE_2026");
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

  const activeDays = Number(opts.days || 90);
  const plan = buildMachineProjectPlan(youJson, {
    rootDir,
    activeDays: Number.isFinite(activeDays) && activeDays > 0 ? activeDays : 90,
  });

  let selected = [...plan.recent];
  if (plan.older.length > 0) {
    console.log("");
    console.log(chalk.dim(`  older projects outside the ${activeDays || 90}d window:`));
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

  console.log("");
  console.log("  " + chalk.bold("machine project bootstrap"));
  console.log(chalk.dim(`  root: ${plan.rootDir}`));
  console.log(chalk.dim(`  selected: ${selected.length} project${selected.length === 1 ? "" : "s"}`));
  if (plan.skipped.length > 0) {
    console.log(chalk.dim(`  skipped duplicates/unusable: ${plan.skipped.length}`));
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
      console.log(`  ${chalk.cyan(action.padEnd(5))} ${target}${candidate.githubUrl ? chalk.dim(` <- ${candidate.githubUrl}`) : ""}`);
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

export async function machineCommand(subcommand: string, opts: { force?: boolean; dryRun?: boolean; root?: string; days?: string | number; yes?: boolean; clone?: boolean } = {}): Promise<void> {
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printHelp();
    return;
  }

  if (subcommand === "projects") {
    await machineProjectsCommand(opts);
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
