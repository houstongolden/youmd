import chalk from "chalk";
import { readGlobalConfig } from "../lib/config";
import { getMe } from "../lib/api";

export async function whoamiCommand(): Promise<void> {
  const config = readGlobalConfig();

  console.log("");

  if (!config.token) {
    console.log("not authenticated");
    console.log("");
    console.log("Run " + chalk.cyan("youmd login") + " to authenticate.");
    console.log("");
    return;
  }

  console.log("  " + chalk.bold("you.md") + chalk.dim(" -- current identity"));
  console.log("");

  // Show cached info first
  if (config.username) {
    console.log("  user:  " + chalk.green(config.username));
  }
  if (config.email) {
    console.log("  email: " + config.email);
  }
  console.log(
    "  token: " + config.token.slice(0, 8) + "..." + config.token.slice(-4)
  );

  // Fetch fresh info from the server
  console.log("");
  console.log("  " + chalk.dim("fetching from server..."));

  try {
    const res = await getMe();

    if (!res.ok) {
      const errData = res.data as any;
      console.log(
        "  " +
          chalk.yellow("server error") +
          " -- " +
          (errData?.error || `status ${res.status}`)
      );

      if (res.status === 401) {
        console.log("");
        console.log(
          "  Your API key may be invalid or revoked."
        );
        console.log(
          "  Run " +
            chalk.cyan("youmd login --key <new-key>") +
            " to re-authenticate."
        );
      }
      console.log("");
      return;
    }

    const me = res.data;
    const u = me.user || { username: me.username, email: me.email, displayName: me.displayName, plan: me.plan, createdAt: me.createdAt };

    // Clear and reprint with server data
    console.log("");
    console.log("  user:    " + chalk.green(u.username || "unknown"));
    if (u.displayName) {
      console.log("  name:    " + u.displayName);
    }
    if (u.email) {
      console.log("  email:   " + u.email);
    }
    console.log("  plan:    " + (u.plan || "free"));
    if (u.createdAt) {
      console.log(
        "  joined:  " + new Date(u.createdAt).toISOString().split("T")[0]
      );
    }
    console.log("  bundles: " + me.bundleCount);

    if (me.publishedBundle) {
      console.log(
        "  live:    v" +
          me.publishedBundle.version
      );
    }

    const profileUrl = "https://you.md/" + (u.username || config.username || "unknown");
    console.log("");
    console.log("  \u250C" + "\u2500".repeat(profileUrl.length + 4) + "\u2510");
    console.log("  \u2502  " + chalk.cyan.bold(profileUrl) + "  \u2502");
    console.log("  \u2514" + "\u2500".repeat(profileUrl.length + 4) + "\u2518");
    console.log("");

    const displayName = u.displayName || u.username || config.username;
    console.log(
      "  " + chalk.bold(`you are ${displayName}.`) +
        chalk.dim(" the agent internet knows you.")
    );
    console.log("");

    // Update cached config
    if (u.username) config.username = u.username;
    if (u.email) config.email = u.email;

    // Avoid circular import -- just write directly
    const { writeGlobalConfig } = require("../lib/config");
    writeGlobalConfig(config);
  } catch (err) {
    console.log(
      "  " +
        chalk.yellow("could not reach server")
    );
    if (err instanceof Error) {
      console.log("  " + chalk.dim(err.message));
    }
    console.log("");
  }
}
