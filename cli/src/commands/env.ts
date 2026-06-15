import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";

// The compiled file lives at dist/commands/env.js.
// Walking up two levels lands at the package root, then into scripts/.
function resolveScript(name: "backup.sh" | "restore.sh"): string {
  return path.join(__dirname, "..", "..", "scripts", "env-vault", name);
}

function assertScriptExists(scriptPath: string): void {
  if (!fs.existsSync(scriptPath)) {
    console.error(
      chalk.hex("#C46A3A")(`  error: script not found: ${scriptPath}`) +
        "\n  " +
        chalk.dim("run `npm run build` from the cli/ directory to ensure scripts are in place.")
    );
    process.exit(1);
  }
}

export function envBackupCommand(opts: { root?: string; out?: string }): void {
  const scriptPath = resolveScript("backup.sh");
  assertScriptExists(scriptPath);

  const args: string[] = [];
  if (opts.root) args.push("--root", opts.root);
  if (opts.out) args.push("--out", opts.out);

  // Print the spinner line then stop it before handing the TTY to bash
  // (the script needs an interactive TTY for the passphrase prompt).
  const spinner = new BrailleSpinner("sealing your env vault...");
  spinner.start();
  spinner.stop("handing off to vault script");
  console.log("");

  const result = child_process.spawnSync("bash", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(chalk.hex("#C46A3A")(`  error spawning backup script: ${result.error.message}`));
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

export function envRestoreCommand(
  vault: string,
  opts: { root?: string; force?: boolean }
): void {
  const scriptPath = resolveScript("restore.sh");
  assertScriptExists(scriptPath);

  // Build arg list — restore.sh expects: [--force] [--root <path>] <vault-file>
  const args: string[] = [];
  if (opts.force) args.push("--force");
  if (opts.root) args.push("--root", opts.root);
  args.push(vault);

  const spinner = new BrailleSpinner("opening the vault...");
  spinner.start();
  spinner.stop("handing off to restore script");
  console.log("");

  const result = child_process.spawnSync("bash", [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(chalk.hex("#C46A3A")(`  error spawning restore script: ${result.error.message}`));
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}
