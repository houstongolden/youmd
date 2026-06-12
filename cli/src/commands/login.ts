import * as readline from "readline";
import * as os from "os";
import { exec } from "child_process";
import chalk from "chalk";
import {
  readGlobalConfig,
  writeGlobalConfig,
  getAppUrl,
  getDefaultAppUrl,
  getDefaultConvexSiteUrl,
} from "../lib/config";
import {
  apiErrorMessage,
  getMeWithToken,
  getMeUser,
  pollDeviceLogin,
  startDeviceLogin,
  startEmailLogin,
  verifyEmailCode,
  type ApiResponse,
  type DeviceApprovedData,
  type DevicePollData,
} from "../lib/api";
import { BrailleSpinner, requireInteractiveTTY } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

export async function loginCommand(options: {
  key?: string;
  web?: boolean;
  email?: boolean;
}): Promise<void> {
  if (options.web) {
    openBrowserLogin();
    return;
  }

  if (options.key) {
    await loginWithKey(options.key);
    return;
  }

  requireInteractiveTTY();

  console.log("");
  console.log(ACCENT("you.md") + " -- login");
  console.log("");

  if (options.email) {
    await emailLogin();
    return;
  }

  // Default: device flow — code in the terminal, approval in the browser.
  await deviceLogin();
}

// ─── Device flow (default) ───────────────────────────────────────────

/** Format an 8-char user code as XXXX-XXXX for human eyes. */
function formatUserCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export type DevicePollOutcome =
  | { outcome: "approved"; data: DeviceApprovedData }
  | { outcome: "denied" }
  | { outcome: "expired" }
  | { outcome: "error"; message: string };

/**
 * Poll until the browser approval resolves. Extracted with injectable
 * poll/sleep/now so the loop logic is unit-testable without a server.
 *
 * Pacing: polls every `intervalMs`; `slow_down` (or a 429) adds 5s to the
 * interval per RFC 8628. Transient network errors are retried up to 3 times
 * in a row before giving up honestly.
 */
export async function pollDeviceApproval(opts: {
  deviceCode: string;
  intervalMs: number;
  deadlineMs: number;
  poll?: (deviceCode: string) => Promise<ApiResponse<DevicePollData>>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<DevicePollOutcome> {
  const poll = opts.poll ?? pollDeviceLogin;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;

  let intervalMs = Math.max(opts.intervalMs, 1000);
  let consecutiveNetworkFailures = 0;

  while (now() < opts.deadlineMs) {
    let res: ApiResponse<DevicePollData>;
    try {
      res = await poll(opts.deviceCode);
    } catch (err) {
      consecutiveNetworkFailures += 1;
      if (consecutiveNetworkFailures >= 3) {
        return {
          outcome: "error",
          message:
            err instanceof Error ? err.message : "could not reach the server",
        };
      }
      await sleep(intervalMs);
      continue;
    }
    consecutiveNetworkFailures = 0;

    const data = (res.data ?? {}) as Record<string, unknown>;
    const status = typeof data.status === "string" ? data.status : undefined;

    if (res.ok) {
      if (status === "approved") {
        return {
          outcome: "approved",
          data: res.data as DeviceApprovedData,
        };
      }
      if (status === "slow_down") {
        intervalMs += 5000;
      }
      // pending (or anything unexpected-but-ok): keep waiting
      await sleep(intervalMs);
      continue;
    }

    if (status === "denied") return { outcome: "denied" };
    if (status === "expired") return { outcome: "expired" };
    if (res.status === 429) {
      intervalMs += 5000;
      await sleep(intervalMs);
      continue;
    }

    return {
      outcome: "error",
      message: apiErrorMessage(res.data) || `server returned ${res.status}`,
    };
  }

  return { outcome: "expired" };
}

async function deviceLogin(): Promise<void> {
  // Retry loop: an expired code offers a fresh one.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const spinner = new BrailleSpinner("requesting a device code");
    spinner.start();

    let start;
    try {
      start = await startDeviceLogin(`youmd CLI on ${os.hostname()} (${process.platform})`);
    } catch (err) {
      spinner.fail();
      console.log("");
      console.log("  " + chalk.yellow("could not reach the server"));
      if (err instanceof Error) console.log("  " + chalk.dim(err.message));
      console.log("");
      console.log("  " + chalk.dim("try ") + chalk.cyan("youmd login --email") + chalk.dim(" for the in-terminal code flow"));
      console.log("");
      process.exitCode = 1;
      return;
    }

    if (!start.ok) {
      spinner.stop();
      // Older server or anything unexpected — fall back to the email flow.
      console.log("");
      console.log("  " + chalk.yellow(apiErrorMessage(start.data) || "device login unavailable") + chalk.dim(" -- falling back to email code login"));
      console.log("");
      await emailLogin();
      return;
    }

    spinner.stop();
    const { deviceCode, userCode, verificationUrl, expiresIn, interval } = start.data;
    const displayCode = formatUserCode(userCode);
    const approveUrl = `${verificationUrl || `${getAppUrl()}/device`}?code=${encodeURIComponent(userCode)}`;

    console.log("");
    console.log("  your code:");
    console.log("");
    console.log("    " + chalk.bold(ACCENT(displayCode.split("").join(" "))));
    console.log("");
    console.log("  approve at " + ACCENT(approveUrl));
    console.log("  " + chalk.dim(`code expires in ${Math.floor(expiresIn / 60)} minutes`));
    console.log("");

    openInBrowser(approveUrl);

    const waitSpinner = new BrailleSpinner("waiting for browser approval...");
    waitSpinner.start();

    const result = await pollDeviceApproval({
      deviceCode,
      intervalMs: interval * 1000,
      deadlineMs: Date.now() + expiresIn * 1000,
    });

    if (result.outcome === "approved") {
      const { apiKey, username, user } = result.data;
      saveCredentials(apiKey, username, user.email);
      waitSpinner.stop();
      printLoginSuccess(username, user.email, user.plan || "free", apiKey);
      return;
    }

    if (result.outcome === "denied") {
      waitSpinner.fail();
      console.log("");
      console.log("  " + chalk.yellow("authorization denied in the browser"));
      console.log("  " + chalk.dim("nothing was saved. run ") + chalk.cyan("youmd login") + chalk.dim(" to try again."));
      console.log("");
      process.exitCode = 1;
      return;
    }

    if (result.outcome === "expired") {
      waitSpinner.fail();
      console.log("");
      console.log("  " + chalk.yellow("the device code expired before approval"));
      console.log("");
      const answer = await promptInput(
        ACCENT("  press Enter for a fresh code, or type q to quit: ")
      );
      if (answer.toLowerCase().startsWith("q")) {
        console.log("");
        return;
      }
      console.log("");
      continue; // new code, same dance
    }

    // outcome === "error"
    waitSpinner.fail();
    console.log("");
    console.log("  " + chalk.yellow(result.message));
    console.log("  " + chalk.dim("try ") + chalk.cyan("youmd login --email") + chalk.dim(" for the in-terminal code flow"));
    console.log("");
    process.exitCode = 1;
    return;
  }
}

function openInBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "" "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      // Non-fatal: the URL is already printed above.
    }
  });
}

// ─── Email-code flow (fallback, `youmd login --email`) ───────────────

async function emailLogin(): Promise<void> {
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
    saveCredentials(apiKey || undefined, username, user.email);

    verifySpinner.stop();
    printLoginSuccess(username, user.email, "free", apiKey || undefined);
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

// ─── Shared helpers ──────────────────────────────────────────────────

/** Persist credentials, preserving any custom apiUrl/appUrl across re-login. */
function saveCredentials(
  apiKey: string | undefined,
  username: string,
  email: string | undefined
): void {
  const config = readGlobalConfig();
  config.token = apiKey || undefined;
  config.username = username;
  config.email = email;
  if (!config.apiUrl) config.apiUrl = getDefaultConvexSiteUrl();
  if (!config.appUrl) config.appUrl = getDefaultAppUrl();
  writeGlobalConfig(config);
}

function printLoginSuccess(
  username: string,
  email: string,
  plan: string,
  apiKey?: string
): void {
  console.log("");
  console.log(
    "  " + chalk.green("authenticated") + " as " + ACCENT("@" + username)
  );
  console.log("");
  console.log("  user:  " + username);
  console.log("  email: " + email);
  console.log("  plan:  " + plan);
  if (apiKey) {
    console.log("  key:   " + apiKey.slice(0, 8) + "..." + apiKey.slice(-4));
  }
  console.log("");
  console.log("  run " + chalk.cyan("you") + " to meet U.");
  console.log("");
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
  saveCredentials(key, user.username || "unknown", user.email);

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
