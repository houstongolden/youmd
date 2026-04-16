import chalk from "chalk";
import { readGlobalConfig } from "../lib/config";
import { getMe, getMeUser, listApiKeys } from "../lib/api";
import { readSkillCatalog } from "../lib/skill-catalog";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const LABEL_W = 11;

function label(name: string): string {
  return ACCENT(name.padEnd(LABEL_W));
}

export async function whoamiCommand(): Promise<void> {
  const config = readGlobalConfig();

  console.log("");

  if (!config.token) {
    console.log("  " + chalk.yellow("not authenticated."));
    console.log("");
    console.log("  run " + chalk.cyan("youmd login") + " to connect your identity.");
    console.log("");
    return;
  }

  console.log("  " + chalk.bold("you.md") + DIM(" -- identity"));
  console.log("");

  // Show cached info while fetching
  if (config.username) {
    console.log("  " + label("user") + chalk.green("@" + config.username));
  }
  if (config.email) {
    console.log("  " + label("email") + config.email);
  }
  console.log(
    "  " + label("token") + DIM(config.token.slice(0, 8) + "..." + config.token.slice(-4))
  );

  console.log("");
  console.log("  " + DIM("resolving from server..."));

  try {
    const res = await getMe();

    if (!res.ok) {
      const errData = res.data as any;
      console.log(
        "  " +
          chalk.yellow("server error") +
          DIM(" -- " + (errData?.error || `status ${res.status}`))
      );

      if (res.status === 401) {
        console.log("");
        console.log(
          "  token may be invalid or revoked."
        );
        console.log(
          "  run " +
            chalk.cyan("youmd login --key <new-key>") +
            " to re-authenticate."
        );
      }
      console.log("");
      return;
    }

    const me = res.data;
    const u = getMeUser(me);

    // Reprint with fresh server data
    console.log("");
    console.log("  " + label("user") + chalk.green("@" + (u.username || "unknown")));
    if (u.displayName) {
      console.log("  " + label("name") + u.displayName);
    }
    if (u.email) {
      console.log("  " + label("email") + u.email);
    }
    console.log("  " + label("plan") + (u.plan || "free"));
    if (u.createdAt) {
      console.log(
        "  " + label("joined") + new Date(u.createdAt).toISOString().split("T")[0]
      );
    }

    // Bundle info
    console.log("  " + label("bundles") + String(me.bundleCount));
    if (me.publishedBundle) {
      console.log(
        "  " + label("live") + "v" + me.publishedBundle.version
      );
    }

    // API keys count
    try {
      const keysRes = await listApiKeys();
      if (keysRes.ok && Array.isArray(keysRes.data)) {
        console.log("  " + label("api keys") + String(keysRes.data.length));
      }
    } catch { /* non-critical */ }

    // Skills
    try {
      const catalog = readSkillCatalog();
      const installed = catalog.skills.filter((s) => s.installed).length;
      console.log(
        "  " + label("skills") + (installed > 0
          ? chalk.green(`${installed} installed`)
          : DIM("none"))
      );
    } catch { /* skip */ }

    // MCP
    console.log(
      "  " + label("mcp") + chalk.green("available") +
      DIM(" -- youmd mcp")
    );

    // Profile URL box
    const profileUrl = "https://you.md/@" + (u.username || config.username || "unknown");
    console.log("");
    console.log("  \u250C" + "\u2500".repeat(profileUrl.length + 4) + "\u2510");
    console.log("  \u2502  " + chalk.cyan.bold(profileUrl) + "  \u2502");
    console.log("  \u2514" + "\u2500".repeat(profileUrl.length + 4) + "\u2518");
    console.log("");

    const displayName = u.displayName || u.username || config.username;
    console.log(
      "  " + chalk.bold(`you are ${displayName}.`) +
        DIM(" the agent internet knows you.")
    );
    console.log("");

    // Update cached config
    if (u.username) config.username = u.username;
    if (u.email) config.email = u.email;

    const { writeGlobalConfig } = require("../lib/config");
    writeGlobalConfig(config);
  } catch (err) {
    console.log(
      "  " + chalk.yellow("could not reach server")
    );
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}
