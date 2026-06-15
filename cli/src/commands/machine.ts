import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import chalk from "chalk";
import { BrailleSpinner } from "../lib/render";

// The compiled file lives at dist/commands/machine.js.
// Walking up two levels lands at the package root, then into scripts/.
function resolveBootstrap(): string {
  return path.join(
    __dirname,
    "..",
    "..",
    "scripts",
    "skillstack-sync",
    "bootstrap-new-mac.sh"
  );
}

export function machineSetupCommand(): void {
  const scriptPath = resolveBootstrap();
  if (!fs.existsSync(scriptPath)) {
    console.error(
      chalk.hex("#C46A3A")(`  error: bootstrap script not found: ${scriptPath}`) +
        "\n  " +
        chalk.dim("reinstall youmd (curl -fsSL https://you.md/install.sh | bash) to restore bundled scripts.")
    );
    process.exit(1);
  }

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
}
