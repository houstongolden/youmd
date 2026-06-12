import * as readline from "readline";
import chalk from "chalk";
import { apiErrorMessage, checkUsername, startEmailRegister, verifyEmailCode } from "../lib/api";
import { readGlobalConfig, writeGlobalConfig, getConvexSiteUrl } from "../lib/config";
import { BrailleSpinner, requireInteractiveTTY } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

export type SignupCorrection = "back" | "change-email" | "resend" | null;

/**
 * Sign-up correction commands: "back" re-asks the previous question,
 * "/email" re-enters the email, "resend" sends a fresh verification code.
 */
export function parseSignupCorrection(input: string): SignupCorrection {
  const lower = input.toLowerCase().trim();
  if (lower === "back" || lower === "/back") return "back";
  if (
    lower === "/email" ||
    lower === "change email" ||
    lower === "change-email"
  ) {
    return "change-email";
  }
  if (lower === "resend" || lower === "/resend" || lower === "resend code") {
    return "resend";
  }
  return null;
}

export async function registerCommand(): Promise<void> {
  requireInteractiveTTY();

  console.log("");
  console.log(ACCENT("you.md") + " -- register");
  console.log("");

  // ── Collect answers, one question at a time ("back" = previous) ────
  let cleanUsername = "";
  let email = "";
  let displayName = "";

  let step: "username" | "email" | "name" | "done" = "username";

  while (step !== "done") {
    if (step === "username") {
      const username = await promptInput(ACCENT("  pick a username: "));
      if (!username) {
        console.log(chalk.yellow("  no username provided -- aborting"));
        console.log("");
        return;
      }
      if (parseSignupCorrection(username) === "back") {
        console.log(chalk.dim("  first question -- nowhere to go back to."));
        continue;
      }

      const candidate = username.toLowerCase().replace(/[^a-z0-9-]/g, "");

      // Validate format
      const usernameRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
      if (!usernameRegex.test(candidate)) {
        console.log("");
        console.log(
          "  " + chalk.yellow("invalid username") +
            " -- must be 3-30 chars, lowercase alphanumeric + hyphens,"
        );
        console.log("  cannot start or end with a hyphen");
        console.log("");
        continue;
      }

      // Check availability
      const checkSpinner = new BrailleSpinner("checking availability");
      checkSpinner.start();

      try {
        const result = await checkUsername(candidate);
        if (!result.available) {
          checkSpinner.fail(result.reason || "not available");
          console.log("");
          console.log(
            "  " + chalk.yellow(candidate) + " is not available"
          );
          if (result.reason) {
            console.log("  " + result.reason);
          }
          console.log("");
          continue;
        }
        checkSpinner.stop(ACCENT(candidate) + " is available");
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

      cleanUsername = candidate;
      console.log("");
      step = "email";
    } else if (step === "email") {
      const answer = await promptInput(
        ACCENT("  enter your email") +
          chalk.dim(" (back = fix username)") +
          ACCENT(": ")
      );
      if (parseSignupCorrection(answer) === "back") {
        step = "username";
        continue;
      }
      if (!answer || !answer.includes("@")) {
        console.log(chalk.yellow("  invalid email -- aborting"));
        console.log("");
        return;
      }
      email = answer;
      step = "name";
    } else {
      const answer = await promptInput(
        ACCENT("  what should we call you?") +
          chalk.dim(" (back = fix email)") +
          ACCENT(" ")
      );
      const correction = parseSignupCorrection(answer);
      if (correction === "back" || correction === "change-email") {
        step = "email";
        continue;
      }
      if (!answer) {
        console.log(chalk.yellow("  no name provided -- aborting"));
        console.log("");
        return;
      }
      displayName = answer;
      step = "done";
    }
  }

  console.log("");

  // ── Send verification code (re-runs on resend / change email) ──────
  const sendCode = async (): Promise<boolean> => {
    const spinner = new BrailleSpinner("sending verification code");
    spinner.start();

    let res;
    try {
      res = await startEmailRegister(email, cleanUsername, displayName);
    } catch (err) {
      spinner.fail();
      throw err;
    }

    if (!res.ok) {
      spinner.fail();
      const errMsg = apiErrorMessage(res.data) || `server returned ${res.status}`;
      console.log("");
      console.log("  " + chalk.yellow(errMsg));
      console.log("");
      return false;
    }

    spinner.stop();
    console.log("");
    console.log("  verification code sent to " + email);
    if (res.data.devCode) {
      console.log("  " + chalk.dim("dev code: ") + res.data.devCode);
    }
    console.log("");
    return true;
  };

  try {
    if (!(await sendCode())) return;

    // ── Verify, with a way out on failure ─────────────────────────────
    let verifyRes;
    while (true) {
      const code = await promptInput(
        ACCENT("  code") +
          chalk.dim(" (resend = new code, /email = change email)") +
          ACCENT(": ")
      );
      if (!code) {
        console.log(chalk.yellow("  no verification code provided -- aborting"));
        console.log("");
        return;
      }

      const correction = parseSignupCorrection(code);
      if (correction === "resend") {
        if (!(await sendCode())) return;
        continue;
      }
      if (correction === "change-email") {
        const newEmail = await promptInput(ACCENT("  new email: "));
        if (!newEmail || !newEmail.includes("@")) {
          console.log(chalk.yellow("  invalid email -- keeping " + email));
          console.log("");
          continue;
        }
        email = newEmail;
        if (!(await sendCode())) return;
        continue;
      }

      const verifySpinner = new BrailleSpinner("verifying code");
      verifySpinner.start();

      try {
        verifyRes = await verifyEmailCode(email, code);
      } catch (err) {
        verifySpinner.fail();
        throw err;
      }
      if (!verifyRes.ok) {
        verifySpinner.fail();
        console.log("");
        console.log("  " + chalk.yellow(apiErrorMessage(verifyRes.data) || `server returned ${verifyRes.status}`));
        console.log(
          "  " +
            chalk.dim("try again -- or type ") +
            chalk.cyan("resend") +
            chalk.dim(" for a new code, ") +
            chalk.cyan("/email") +
            chalk.dim(" to change your email")
        );
        console.log("");
        continue;
      }

      verifySpinner.stop();
      break;
    }

    const { username: registeredUsername, apiKey, user } = verifyRes.data;

    // Save credentials
    const config = readGlobalConfig();
    config.token = apiKey || undefined;
    config.username = registeredUsername;
    config.email = user.email;
    config.apiUrl = getConvexSiteUrl();
    writeGlobalConfig(config);

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
