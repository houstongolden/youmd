import chalk from "chalk";
import { localBundleExists } from "../lib/config";

export function previewCommand(options: { port?: string }): void {
  const port = options.port || "3333";

  console.log("");

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  console.log("you.md -- preview");
  console.log("");
  console.log(chalk.yellow("preview server is not yet implemented"));
  console.log("");
  console.log("This will start a local server at " + chalk.cyan("http://localhost:" + port) + " to preview your identity context.");
  console.log("");
}
