import * as readline from "readline";
import chalk from "chalk";
import { readGlobalConfig, writeGlobalConfig } from "../lib/config";

export function loginCommand(options: { key?: string }): void {
  if (options.key) {
    // Direct API key login
    const config = readGlobalConfig();
    config.token = options.key;
    config.apiUrl = config.apiUrl || "https://api.you.md";
    writeGlobalConfig(config);
    console.log("");
    console.log(chalk.green("authenticated") + " -- API key saved to ~/.youmd/config.json");
    console.log("");
    return;
  }

  // Interactive prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log("you.md -- authentication");
  console.log("");
  console.log("Enter your API key, or visit " + chalk.cyan("https://you.md/settings/api") + " to generate one.");
  console.log("");

  rl.question("  API key: ", (answer) => {
    rl.close();

    const key = answer.trim();
    if (!key) {
      console.log(chalk.yellow("no key provided -- aborting"));
      console.log("");
      return;
    }

    const config = readGlobalConfig();
    config.token = key;
    config.apiUrl = config.apiUrl || "https://api.you.md";
    writeGlobalConfig(config);

    console.log("");
    console.log(chalk.green("authenticated") + " -- API key saved to ~/.youmd/config.json");
    console.log("");
  });
}
