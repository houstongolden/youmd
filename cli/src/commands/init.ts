import * as fs from "fs";
import chalk from "chalk";
import { getLocalBundleDir } from "../lib/config";
import { runOnboarding, createBundle } from "../lib/onboarding";

export async function initCommand(options: {
  skipPrompts?: boolean;
}): Promise<void> {
  const bundleDir = getLocalBundleDir();

  if (options.skipPrompts) {
    // Non-interactive: create empty bundle like the old behavior
    if (fs.existsSync(bundleDir)) {
      console.log(chalk.yellow("warning: .youmd/ directory already exists"));
      return;
    }

    await createBundle({
      username: "anonymous",
      name: "Anonymous",
      tagline: "",
    });
    return;
  }

  // Interactive: run the full onboarding wizard
  try {
    await runOnboarding();
  } catch (err) {
    if (err instanceof Error && err.message === "readline was closed") {
      console.log("");
      console.log("  aborted.");
      console.log("");
      process.exit(0);
    }
    throw err;
  }
}
