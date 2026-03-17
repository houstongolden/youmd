import * as readline from "readline";
import chalk from "chalk";
import { checkUsername } from "../lib/api";

export async function registerCommand(): Promise<void> {
  console.log("");
  console.log("you.md -- register");
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const username = await new Promise<string>((resolve) => {
    rl.question("  Choose a username: ", (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });

  rl.close();

  if (!username) {
    console.log(chalk.yellow("no username provided -- aborting"));
    console.log("");
    return;
  }

  console.log("");
  console.log("  Checking availability...");

  try {
    const result = await checkUsername(username);

    if (result.available) {
      console.log(
        "  " +
          chalk.green(username) +
          " is available!"
      );
      console.log("");
      console.log("To complete registration:");
      console.log("");
      console.log(
        "  1. Visit " +
          chalk.cyan("https://you.md/claim?username=" + username)
      );
      console.log("  2. Create your account with Clerk authentication");
      console.log(
        "  3. Run " +
          chalk.cyan("youmd login") +
          " with the API key from your settings page"
      );
      console.log("");
    } else {
      console.log(
        "  " +
          chalk.yellow(username) +
          " is not available"
      );
      if (result.reason) {
        console.log("  " + result.reason);
      }
      console.log("");
      console.log(
        "Try a different username, or visit " +
          chalk.cyan("https://you.md/claim") +
          " to register."
      );
      console.log("");
    }
  } catch (err) {
    console.log(
      chalk.red("error") + " -- could not check username availability"
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
    console.log(
      "You can also register at " + chalk.cyan("https://you.md/claim")
    );
    console.log("");
  }
}
