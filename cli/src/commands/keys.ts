import chalk from "chalk";
import { isAuthenticated, readGlobalConfig } from "../lib/config";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../lib/api";
import { BrailleSpinner } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const SUCCESS = chalk.green;

/**
 * API key management.
 * Subcommands: list, create, revoke
 *
 * API keys authenticate CLI requests to the You.md platform.
 */

export async function keysCommand(
  subcommand?: string,
  options: { label?: string; scopes?: string; id?: string } = {}
): Promise<void> {
  console.log("");

  if (!isAuthenticated()) {
    console.log(chalk.yellow("not authenticated"));
    console.log("");
    console.log("Run " + chalk.cyan("youmd login") + " to authenticate first.");
    console.log("");
    return;
  }

  switch (subcommand) {
    case "list":
    case "ls":
      await keysList();
      break;
    case "create":
      await keysCreate(options);
      break;
    case "revoke":
      await keysRevoke(options.id);
      break;
    default:
      console.log("you.md -- API keys");
      console.log("");
      console.log("Usage:");
      console.log("  youmd keys list");
      console.log("  youmd keys create [--label <name>] [--scopes read:public]");
      console.log("  youmd keys revoke --id <keyId>");
      console.log("");
      console.log(
        "API keys authenticate CLI requests to the You.md platform."
      );
      console.log("");
      break;
  }
}

async function keysList(): Promise<void> {
  const spinner = new BrailleSpinner("fetching API keys");
  spinner.start();

  try {
    const res = await listApiKeys();

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    const keys = res.data;
    const activeKeys = keys.filter((k) => !k.isRevoked);
    const revokedKeys = keys.filter((k) => k.isRevoked);

    spinner.stop(`${activeKeys.length} active, ${revokedKeys.length} revoked`);
    console.log("");

    // Show current CLI key
    const config = readGlobalConfig();
    if (config.token) {
      console.log(
        DIM("  current CLI key: ") +
          chalk.white(config.token.slice(0, 8) + "..." + config.token.slice(-4))
      );
      console.log("");
    }

    if (keys.length === 0) {
      console.log(DIM("  no API keys found."));
      console.log("");
      console.log(DIM("  create one with: ") + chalk.cyan("youmd keys create"));
      console.log("");
      return;
    }

    if (activeKeys.length > 0) {
      console.log(DIM("  ACTIVE"));
      console.log("");
      for (const key of activeKeys) {
        const label = key.label ? chalk.white(key.label) : DIM("(no label)");
        const scopes = DIM(key.scopes.join(", "));
        const lastUsed = key.lastUsedAt
          ? DIM("last used " + key.lastUsedAt.split("T")[0])
          : DIM("never used");
        const created = DIM("created " + key.createdAt.split("T")[0]);

        console.log(`  ${chalk.white(key.keyPrefix)}  ${label}`);
        console.log(`    ${scopes} -- ${lastUsed} -- ${created}`);
        console.log(`    ${DIM("id: " + key.id)}`);
        console.log("");
      }
    }

    if (revokedKeys.length > 0) {
      console.log(DIM("  REVOKED"));
      console.log("");
      for (const key of revokedKeys) {
        const label = key.label || "(no label)";
        console.log(DIM(`  ${key.keyPrefix}  ${label}`));
        console.log(DIM(`    ${key.scopes.join(", ")} -- revoked`));
        console.log("");
      }
    }
  } catch (err) {
    spinner.fail("failed to list keys");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}

async function keysCreate(options: { label?: string; scopes?: string }): Promise<void> {
  const label = options.label;
  const scopes = options.scopes
    ? options.scopes.split(",").map((s) => s.trim())
    : ["read:public"];

  const spinner = new BrailleSpinner("creating API key");
  spinner.start();

  try {
    const res = await createApiKey({ label, scopes });

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    const data = res.data;
    spinner.stop();

    console.log("");
    if (data.label) {
      console.log(DIM("  label   ") + chalk.white(data.label));
    }
    console.log(DIM("  scopes  ") + chalk.white(data.scopes.join(", ")));
    console.log("");

    // Print the key value -- this is shown only once
    console.log(ACCENT("  copy this key now -- it will not be shown again:"));
    console.log("");
    process.stdout.write("  " + chalk.white(data.key) + "\n");
    console.log("");

    // Try to copy to clipboard
    try {
      const { execSync } = await import("child_process");
      if (process.platform === "darwin") {
        execSync(`echo -n ${JSON.stringify(data.key)} | pbcopy`, { stdio: "pipe" });
        console.log(SUCCESS("  copied to clipboard"));
      } else if (process.platform === "linux") {
        execSync(`echo -n ${JSON.stringify(data.key)} | xclip -selection clipboard`, { stdio: "pipe" });
        console.log(SUCCESS("  copied to clipboard"));
      }
    } catch {
      // Clipboard not available -- not fatal
    }

    console.log("");
    console.log(
      DIM("  authenticate with: ") +
        chalk.cyan("youmd login --key <key>")
    );
    console.log("");
  } catch (err) {
    spinner.fail("failed to create key");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}

async function keysRevoke(id?: string): Promise<void> {
  if (!id) {
    console.log(ACCENT("missing --id flag"));
    console.log("");
    console.log("Usage: youmd keys revoke --id <keyId>");
    console.log("");
    console.log(DIM("Tip: run ") + chalk.cyan("youmd keys list") + DIM(" to see key IDs."));
    console.log("");
    return;
  }

  const spinner = new BrailleSpinner("revoking API key");
  spinner.start();

  try {
    const res = await revokeApiKey(id);

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    spinner.stop("key revoked");
    console.log("");
  } catch (err) {
    spinner.fail("failed to revoke key");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}
