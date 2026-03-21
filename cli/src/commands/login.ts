import * as readline from "readline";
import { exec } from "child_process";
import chalk from "chalk";
import { readGlobalConfig, writeGlobalConfig } from "../lib/config";
import { getMe } from "../lib/api";

export async function loginCommand(options: { key?: string; web?: boolean }): Promise<void> {
  if (options.web) {
    console.log("");
    console.log("opening you.md dashboard in your browser...");
    console.log("");

    const url = "https://you.md/dashboard";
    const platform = process.platform;
    const cmd =
      platform === "darwin"
        ? `open ${url}`
        : platform === "win32"
          ? `start ${url}`
          : `xdg-open ${url}`;

    exec(cmd, (err) => {
      if (err) {
        console.log(
          chalk.yellow("could not open browser") +
            " -- visit " +
            chalk.cyan(url) +
            " manually"
        );
      }
    });

    console.log(
      "create an API key in the /tokens tab, then run: " +
        chalk.cyan("youmd login -k YOUR_KEY")
    );
    console.log("");
    return;
  }

  if (options.key) {
    await loginWithKey(options.key);
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
  console.log(
    "Enter your API key, or visit " +
      chalk.cyan("https://you.md/settings/api") +
      " to generate one."
  );
  console.log("");

  rl.question("  API key: ", async (answer) => {
    rl.close();

    const key = answer.trim();
    if (!key) {
      console.log(chalk.yellow("no key provided -- aborting"));
      console.log("");
      return;
    }

    await loginWithKey(key);
  });
}

async function loginWithKey(key: string): Promise<void> {
  // Save the key first
  const config = readGlobalConfig();
  config.token = key;
  config.apiUrl = "https://uncommon-chicken-142.convex.site";
  writeGlobalConfig(config);

  console.log("");

  // Validate the key by fetching the user's profile
  try {
    const res = await getMe();

    if (!res.ok) {
      console.log(
        chalk.yellow("warning") +
          " -- key saved but could not verify with the server"
      );
      console.log(
        "  Server responded with status " + res.status
      );
      console.log("");
      console.log(
        "The key has been stored. If it is valid, " +
          chalk.cyan("youmd whoami") +
          " will show your identity."
      );
      console.log("");
      return;
    }

    const me = res.data;
    config.username = me.username;
    config.email = me.email;
    writeGlobalConfig(config);

    console.log(
      chalk.green("authenticated") +
        " as " +
        chalk.cyan(me.username)
    );
    console.log("");
    console.log("  user:  " + me.username);
    if (me.email) {
      console.log("  email: " + me.email);
    }
    console.log("  plan:  " + me.plan);
    console.log("  key:   " + key.slice(0, 8) + "..." + key.slice(-4));
    console.log("");
  } catch (err) {
    console.log(
      chalk.green("key saved") +
        " to ~/.youmd/config.json"
    );
    console.log("");
    console.log(
      chalk.yellow("note") +
        " -- could not reach the server to verify the key"
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}
