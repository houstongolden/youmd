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

  console.log("you.md -- current identity");
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

    // Clear and reprint with server data
    console.log("");
    console.log("  user:    " + chalk.green(me.username));
    if (me.displayName) {
      console.log("  name:    " + me.displayName);
    }
    if (me.email) {
      console.log("  email:   " + me.email);
    }
    console.log("  plan:    " + me.plan);
    console.log(
      "  joined:  " + new Date(me.createdAt).toISOString().split("T")[0]
    );
    console.log("  bundles: " + me.bundleCount);

    if (me.publishedBundle) {
      console.log(
        "  live:    v" +
          me.publishedBundle.version
      );
    }

    console.log(
      "  url:     " +
        chalk.cyan("https://you.md/" + me.username)
    );
    console.log("");

    // Update cached config
    config.username = me.username;
    config.email = me.email;

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
