import * as readline from "readline";
import chalk from "chalk";
import { checkUsername, startEmailRegister, verifyEmailCode } from "../lib/api";
import { readGlobalConfig, writeGlobalConfig, getConvexSiteUrl } from "../lib/config";
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

  // 3. Display name
  const displayName = await promptInput(ACCENT("  what should we call you? "));
  if (!displayName) {
    console.log(chalk.yellow("  no name provided -- aborting"));
    console.log("");
    return;
  }

  console.log("");

  const spinner = new BrailleSpinner("sending verification code");
  spinner.start();

  try {
    const res = await startEmailRegister(email, cleanUsername, displayName);

    if (!res.ok) {
      spinner.fail();
      const errData = res.data as any;
      const errMsg = errData?.error || `server returned ${res.status}`;
      console.log("");
      console.log("  " + chalk.yellow(errMsg));
      console.log("");
      return;
    }

    spinner.stop();
    console.log("");
    console.log("  verification code sent to " + email);
    if ((res.data as any).devCode) {
      console.log("  " + chalk.dim("dev code: ") + (res.data as any).devCode);
    }
    console.log("");

    const code = await promptInput(ACCENT("  code: "));
    if (!code) {
      console.log(chalk.yellow("  no verification code provided -- aborting"));
      console.log("");
      return;
    }

    const verifySpinner = new BrailleSpinner("verifying code");
    verifySpinner.start();

    const verifyRes = await verifyEmailCode(email, code);
    if (!verifyRes.ok) {
      verifySpinner.fail();
      const errData = verifyRes.data as any;
      console.log("");
      console.log("  " + chalk.yellow(errData?.error || `server returned ${verifyRes.status}`));
      console.log("");
      return;
    }

    const { username: registeredUsername, apiKey, user } = verifyRes.data;

    // Save credentials
    const config = readGlobalConfig();
    config.token = apiKey || undefined;
    config.username = registeredUsername;
    config.email = user.email;
    config.apiUrl = getConvexSiteUrl();
    writeGlobalConfig(config);

    verifySpinner.stop();
    console.log("");
    console.log(
      "  " + chalk.green("account created") +
        " -- you're logged in as " +
        ACCENT("@" + registeredUsername)
    );
    console.log("");
    console.log("  user:  " + registeredUsername);
    console.log("  email: " + user.email);
    console.log("  plan:  free");
    if (apiKey) {
      console.log("  key:   " + apiKey.slice(0, 8) + "..." + apiKey.slice(-4));
    }
    console.log("");
    console.log(
      "  run " + ACCENT("youmd init") + " to build your identity context"
    );
    console.log(
      "  then " + ACCENT("you") + " to meet U once your bundle exists"
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
