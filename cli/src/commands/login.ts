import * as readline from "readline";
import { exec } from "child_process";
import chalk from "chalk";
import {
  readGlobalConfig,
  writeGlobalConfig,
  getDefaultAppUrl,
  getDefaultConvexSiteUrl,
} from "../lib/config";
import { apiErrorMessage, getMeWithToken, getMeUser, startEmailLogin, verifyEmailCode } from "../lib/api";
import { BrailleSpinner, requireInteractiveTTY } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

export async function loginCommand(options: { key?: string; web?: boolean }): Promise<void> {
  if (options.web) {
    openBrowserLogin();
    return;
  }

  if (options.key) {
    await loginWithKey(options.key);
    return;
  }

  // Interactive email-code login
  requireInteractiveTTY();

  console.log("");
  console.log(ACCENT("you.md") + " -- login");
  console.log("");

  console.log("  " + chalk.dim("press Enter to open browser sign-in"));
  console.log("  " + chalk.dim("or type your email for an in-terminal code login"));
  console.log("  " + chalk.dim("or run ") + chalk.cyan("youmd login --key YOUR_KEY") + chalk.dim(" for direct agent auth"));
  console.log("");

  const email = await promptInput(ACCENT("  email (or Enter for browser): "));
  if (!email) {
    openBrowserLogin();
    return;
  }

  const spinner = new BrailleSpinner("sending verification code");
  spinner.start();

  try {
    const res = await startEmailLogin(email);

    if (!res.ok) {
      spinner.fail();
      const errMsg = apiErrorMessage(res.data) || `server returned ${res.status}`;
      console.log("");
      console.log("  " + chalk.yellow(errMsg));
      console.log("");
      if (errMsg.includes("No account")) {
        console.log("  run " + ACCENT("youmd register") + " to create an account");
        console.log("");
      }
      return;
    }

    spinner.stop();
    console.log("");
    console.log("  verification code sent to " + email);
    if (res.data.devCode) {
      console.log("  " + chalk.dim("dev code: ") + res.data.devCode);
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
      console.log("");
      console.log("  " + chalk.yellow(apiErrorMessage(verifyRes.data) || `server returned ${verifyRes.status}`));
      console.log("");
      return;
    }

    const { username, apiKey, user } = verifyRes.data;

    // Save credentials — preserve any custom apiUrl/appUrl across re-login
    const config = readGlobalConfig();
    config.token = apiKey || undefined;
    config.username = username;
    config.email = user.email;
    if (!config.apiUrl) config.apiUrl = getDefaultConvexSiteUrl();
    if (!config.appUrl) config.appUrl = getDefaultAppUrl();
    writeGlobalConfig(config);

    verifySpinner.stop();
    console.log("");
    console.log(
      "  " + chalk.green("authenticated") + " as " + ACCENT("@" + username)
    );
    console.log("");
    console.log("  user:  " + username);
    console.log("  email: " + user.email);
    console.log("  plan:  free");
    if (apiKey) {
      console.log("  key:   " + apiKey.slice(0, 8) + "..." + apiKey.slice(-4));
    }
    console.log("");
    console.log("  run " + chalk.cyan("you") + " to meet U.");
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

function openBrowserLogin(): void {
  console.log("");
  console.log("opening you.md in your browser...");
  console.log("");

  const url = "https://you.md/sign-in?redirect_url=https%3A%2F%2Fwww.you.md%2Fshell";
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

  console.log("sign in there, then create or reveal an API key in settings if you want local agent access.");
  console.log("after that, run " + chalk.cyan("youmd login --key YOUR_KEY"));
  console.log("once you're in, run " + chalk.cyan("you"));
  console.log("");
}

async function loginWithKey(key: string): Promise<void> {
  console.log("");

  const spinner = new BrailleSpinner("verifying key");
  spinner.start();

  // Validate the candidate key BEFORE persisting anything — a bad key must
  // never clobber a working session in ~/.youmd/config.json.
  let res;
  try {
    res = await getMeWithToken(key);
  } catch (err) {
    spinner.fail();
    console.log("");
    console.log(
      chalk.yellow("  could not reach the server to verify the key")
    );
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
    console.log("  " + chalk.dim("existing config was left untouched. retry when you're back online."));
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (!res.ok) {
    spinner.fail();
    const errMsg = apiErrorMessage(res.data);
    console.log("");
    console.log(
      "  " + chalk.yellow("invalid key") +
        " -- server responded with status " + res.status +
        (errMsg ? ` (${errMsg})` : "")
    );
    console.log("");
    console.log("  " + chalk.dim("nothing was saved. your existing login (if any) is intact."));
    console.log(
      "  " + chalk.dim("check the key at ") + chalk.cyan("https://you.md/settings") +
        chalk.dim(" and try again.")
    );
    console.log("");
    process.exitCode = 1;
    return;
  }

  // Key is valid — persist it, preserving any custom apiUrl/appUrl
  const me = res.data;
  const user = getMeUser(me);
  const config = readGlobalConfig();
  config.token = key;
  config.username = user.username;
  config.email = user.email;
  if (!config.apiUrl) config.apiUrl = getDefaultConvexSiteUrl();
  if (!config.appUrl) config.appUrl = getDefaultAppUrl();
  writeGlobalConfig(config);

  spinner.stop();
  console.log("");
  console.log(
    "  " + chalk.green("authenticated") +
      " as " +
      chalk.hex("#C46A3A")("@" + (user.username || "unknown"))
  );
  console.log("");
  console.log("  user:  " + (user.username || "unknown"));
  if (user.email) {
    console.log("  email: " + user.email);
  }
  console.log("  plan:  " + (user.plan || "free"));
  console.log("  key:   " + key.slice(0, 8) + "..." + key.slice(-4));
  console.log("");
  console.log("  run " + chalk.cyan("you") + " to meet U.");
  console.log("");
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

