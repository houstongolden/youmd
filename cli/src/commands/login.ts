import * as readline from "readline";
import { exec } from "child_process";
import chalk from "chalk";
import { readGlobalConfig, writeGlobalConfig } from "../lib/config";
import { getMe, loginWithEmail } from "../lib/api";
import { BrailleSpinner } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

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
        chalk.cyan("youmd login --key YOUR_KEY")
    );
    console.log("");
    return;
  }

  if (options.key) {
    await loginWithKey(options.key);
    return;
  }

  // Interactive email/password login
  console.log("");
  console.log(ACCENT("you.md") + " -- login");
  console.log("");

  const email = await promptInput(ACCENT("  email: "));
  if (!email) {
    console.log(chalk.yellow("  no email provided -- aborting"));
    console.log("");
    return;
  }

  const password = await promptPassword(ACCENT("  password: "));
  if (!password) {
    console.log(chalk.yellow("  no password provided -- aborting"));
    console.log("");
    return;
  }

  console.log("");

  const spinner = new BrailleSpinner("authenticating");
  spinner.start();

  try {
    const res = await loginWithEmail(email, password);

    if (!res.ok) {
      spinner.fail();
      const errData = res.data as any;
      const errMsg = errData?.error || `server returned ${res.status}`;
      console.log("");
      console.log("  " + chalk.yellow(errMsg));
      console.log("");
      if (errMsg.includes("No account")) {
        console.log("  run " + ACCENT("youmd register") + " to create an account");
        console.log("");
      }
      return;
    }

    const { username, apiKey, plan } = res.data;

    // Save credentials
    const config = readGlobalConfig();
    config.token = apiKey;
    config.username = username;
    config.email = email;
    config.apiUrl = "https://kindly-cassowary-600.convex.site";
    writeGlobalConfig(config);

    spinner.stop();
    console.log("");
    console.log(
      "  " + chalk.green("authenticated") + " as " + ACCENT("@" + username)
    );
    console.log("");
    console.log("  user:  " + username);
    console.log("  email: " + email);
    console.log("  plan:  " + (plan || "free"));
    console.log("  key:   " + apiKey.slice(0, 8) + "..." + apiKey.slice(-4));
    console.log("");
  } catch (err) {
    spinner.fail();
    console.log("");
    console.log(
      chalk.yellow("  could not reach the server")
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}

async function loginWithKey(key: string): Promise<void> {
  // Save the key first
  const config = readGlobalConfig();
  config.token = key;
  config.apiUrl = "https://kindly-cassowary-600.convex.site";
  writeGlobalConfig(config);

  console.log("");

  const spinner = new BrailleSpinner("verifying key");
  spinner.start();

  // Validate the key by fetching the user's profile
  try {
    const res = await getMe();

    if (!res.ok) {
      spinner.fail();
      console.log("");
      console.log(
        chalk.yellow("  warning") +
          " -- key saved but could not verify with the server"
      );
      console.log(
        "  server responded with status " + res.status
      );
      console.log("");
      console.log(
        "  the key has been stored. if it is valid, " +
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

    spinner.stop();
    console.log("");
    console.log(
      "  " + chalk.green("authenticated") +
        " as " +
        chalk.hex("#C46A3A")("@" + me.username)
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
    spinner.fail();
    console.log("");
    console.log(
      chalk.green("  key saved") +
        " to ~/.youmd/config.json"
    );
    console.log("");
    console.log(
      chalk.yellow("  note") +
        " -- could not reach the server to verify the key"
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}

// ─── Input helpers ───────────────────────────────────────────────────

function promptInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    // Write the prompt manually
    process.stdout.write(prompt);

    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    // If stdin is a TTY, enable raw mode for character-by-character masking
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();

    let password = "";

    const onData = (ch: Buffer) => {
      const char = ch.toString("utf8");

      // Enter
      if (char === "\n" || char === "\r" || char === "\u0004") {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        rl.close();
        process.stdout.write("\n");
        resolve(password);
        return;
      }

      // Ctrl+C
      if (char === "\u0003") {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        rl.close();
        process.stdout.write("\n");
        resolve("");
        return;
      }

      // Backspace
      if (char === "\u007F" || char === "\b") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }

      // Regular character
      password += char;
      process.stdout.write("*");
    };

    process.stdin.on("data", onData);
  });
}
