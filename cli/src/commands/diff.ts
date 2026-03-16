import chalk from "chalk";
import { localBundleExists } from "../lib/config";

export function diffCommand(): void {
  console.log("");

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  console.log("you.md -- diff");
  console.log("");
  console.log(chalk.yellow("diff is not yet implemented"));
  console.log("");
  console.log("This will show changes between your local bundle and the last published version.");
  console.log("");
}
