import chalk from "chalk";
import { clearGlobalAuth, getGlobalConfigPath, readGlobalConfig } from "../lib/config";

export async function logoutCommand(): Promise<void> {
  const config = readGlobalConfig();

  console.log("");

  if (!config.token && !config.username && !config.email) {
    console.log("  " + chalk.yellow("already logged out."));
    console.log("");
    return;
  }

  clearGlobalAuth();

  console.log("  " + chalk.green("logged out"));
  console.log("");
  console.log("  cleared local auth state from " + chalk.cyan(getGlobalConfigPath()));
  console.log("  run " + chalk.cyan("youmd login") + " to authenticate again.");
  console.log("");
}
