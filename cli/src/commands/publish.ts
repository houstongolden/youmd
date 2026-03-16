import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
  readLocalConfig,
  writeLocalConfig,
} from "../lib/config";

export function publishCommand(): void {
  console.log("");

  if (!isAuthenticated()) {
    console.log(chalk.yellow("not authenticated"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd login") + " to authenticate first.");
    console.log("");
    return;
  }

  if (!localBundleExists()) {
    console.log(chalk.yellow("no .youmd/ directory found"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  const bundleDir = getLocalBundleDir();
  const youJsonPath = path.join(bundleDir, "you.json");

  if (!fs.existsSync(youJsonPath)) {
    console.log(chalk.yellow("no you.json found -- run ") + chalk.cyan("youmd build") + chalk.yellow(" first"));
    console.log("");
    return;
  }

  const config = readGlobalConfig();
  const apiUrl = config.apiUrl || "https://api.you.md";

  console.log("you.md -- publishing bundle");
  console.log("");

  // Read the bundle
  const bundle = JSON.parse(fs.readFileSync(youJsonPath, "utf-8"));

  console.log("\u251C\u2500\u2500 Reading you.json (v" + bundle.version + ")");
  console.log("\u251C\u2500\u2500 Uploading to " + chalk.cyan(apiUrl));
  console.log("\u2514\u2500\u2500 Waiting for confirmation");

  // Simulate publish (actual API call would go here)
  console.log("");
  console.log(chalk.yellow("publish is not yet connected to the API"));
  console.log("When the API is live, this will push your bundle to " + chalk.cyan(apiUrl + "/v1/bundle"));
  console.log("");

  // Update local config with publish timestamp
  const localConfig = readLocalConfig();
  if (localConfig) {
    localConfig.lastPublished = new Date().toISOString();
    writeLocalConfig(localConfig);
  }
}
