import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";

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
  console.log("    " + chalk.cyan("capture") + chalk.dim("   snapshot agent config (settings, commands, plugins) into ~/.agent-shared"));
  console.log("    " + chalk.cyan("restore") + chalk.dim("   apply ~/.agent-shared/agent-config/ back onto this machine"));
  console.log("");
  console.log("  " + chalk.dim("Options:"));
  console.log("    " + chalk.cyan("--force") + chalk.dim("   (restore) overwrite existing files without backing them up"));
  console.log("    " + chalk.cyan("--dry-run") + chalk.dim(" (restore) preview what would be written, write nothing"));
  console.log("");
}

export function machineCommand(subcommand: string, opts: { force?: boolean; dryRun?: boolean } = {}): void {
  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printHelp();
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
  machineCommand("setup");
}
