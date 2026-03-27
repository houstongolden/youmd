import * as readline from "readline";
import chalk from "chalk";
import { checkUsername, registerWithEmail } from "../lib/api";
import { readGlobalConfig, writeGlobalConfig } from "../lib/config";
import { BrailleSpinner } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

export async function registerCommand(): Promise<void> {
  console.log("");
  console.log(ACCENT("you.md") + " -- register");
  console.log("");

  // 1. Username
  const username = await promptInput(ACCENT("  pick a username: "));
  if (!username) {
    console.log(chalk.yellow("  no username provided -- aborting"));
    console.log("");
    return;
  }

  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9-]/g, "");

  // Validate format
  const usernameRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
  if (!usernameRegex.test(cleanUsername)) {
    console.log("");
    console.log(
      "  " + chalk.yellow("invalid username") +
        " -- must be 3-30 chars, lowercase alphanumeric + hyphens,"
    );
    console.log("  cannot start or end with a hyphen");
    console.log("");
    return;
  }

  // Check availability
  const checkSpinner = new BrailleSpinner("checking availability");
  checkSpinner.start();

  try {
    const result = await checkUsername(cleanUsername);
    if (!result.available) {
      checkSpinner.fail(result.reason || "not available");
      console.log("");
      console.log(
        "  " + chalk.yellow(cleanUsername) + " is not available"
      );
      if (result.reason) {
        console.log("  " + result.reason);
      }
      console.log("");
      return;
    }
    checkSpinner.stop(ACCENT(cleanUsername) + " is available");
  } catch (err) {
    checkSpinner.fail();
    console.log("");
    console.log(
      chalk.yellow("  could not check username availability")
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
    return;
  }

  console.log("");

  // 2. Email
  const email = await promptInput(ACCENT("  enter your email: "));
  if (!email || !email.includes("@")) {
    console.log(chalk.yellow("  invalid email -- aborting"));
    console.log("");
    return;
  }

  // 3. Password
  const password = await promptPassword(ACCENT("  choose a password: "));
  if (!password) {
    console.log(chalk.yellow("  no password provided -- aborting"));
    console.log("");
    return;
  }

  if (password.length < 8) {
    console.log("");
    console.log(chalk.yellow("  password must be at least 8 characters"));
    console.log("");
    return;
  }

  // 4. Confirm password
  const confirm = await promptPassword(ACCENT("  confirm password: "));
  if (confirm !== password) {
    console.log("");
    console.log(chalk.yellow("  passwords do not match -- aborting"));
    console.log("");
    return;
  }

  console.log("");

  // 5. Register
  const spinner = new BrailleSpinner("creating account");
  spinner.start();

  try {
    const res = await registerWithEmail(email, password, cleanUsername, cleanUsername);

    if (!res.ok) {
      spinner.fail();
      const errData = res.data as any;
      const errMsg = errData?.error || `server returned ${res.status}`;
      console.log("");
      console.log("  " + chalk.yellow(errMsg));
      console.log("");
      return;
    }

    const { username: registeredUsername, apiKey } = res.data;

    // Save credentials
    const config = readGlobalConfig();
    config.token = apiKey;
    config.username = registeredUsername;
    config.email = email;
    config.apiUrl = "https://kindly-cassowary-600.convex.site";
    writeGlobalConfig(config);

    spinner.stop();
    console.log("");
    console.log(
      "  " + chalk.green("account created") +
        " -- you're logged in as " +
        ACCENT("@" + registeredUsername)
    );
    console.log("");
    console.log("  user:  " + registeredUsername);
    console.log("  email: " + email);
    console.log("  plan:  free");
    console.log("  key:   " + apiKey.slice(0, 8) + "..." + apiKey.slice(-4));
    console.log("");
    console.log(
      "  run " + ACCENT("youmd init") + " to build your identity context"
    );
    console.log(
      "  or  " + ACCENT("youmd chat") + " to talk to the You agent"
    );
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
