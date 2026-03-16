import chalk from "chalk";

export function registerCommand(): void {
  console.log("");
  console.log("you.md -- register");
  console.log("");
  console.log("To claim your identity, visit:");
  console.log("");
  console.log("  " + chalk.cyan("https://you.md/claim"));
  console.log("");
  console.log("After registering, run " + chalk.cyan("youmd login") + " to authenticate.");
  console.log("");
}
