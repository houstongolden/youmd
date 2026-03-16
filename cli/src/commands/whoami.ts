import chalk from "chalk";
import { readGlobalConfig } from "../lib/config";

export function whoamiCommand(): void {
  const config = readGlobalConfig();

  console.log("");

  if (!config.token) {
    console.log("not authenticated");
    console.log("");
    console.log("Run " + chalk.cyan("youmd login") + " to authenticate.");
    console.log("");
    return;
  }

  console.log("you.md -- current identity");
  console.log("");

  if (config.username) {
    console.log("  user:  " + chalk.green(config.username));
  }
  if (config.email) {
    console.log("  email: " + config.email);
  }
  console.log("  token: " + config.token.slice(0, 8) + "..." + config.token.slice(-4));
  if (config.apiUrl) {
    console.log("  api:   " + chalk.cyan(config.apiUrl));
  }

  console.log("");
}
