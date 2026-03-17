import chalk from "chalk";
import { isAuthenticated, readGlobalConfig } from "../lib/config";

/**
 * API key management.
 * Subcommands: list, create, revoke
 *
 * API keys are created through the web dashboard and used by the CLI for auth.
 */

export async function keysCommand(
  subcommand?: string,
  options: { label?: string; id?: string } = {}
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
      await keysCreate(options.label);
      break;
    case "revoke":
      await keysRevoke(options.id);
      break;
    default:
      console.log("you.md -- API keys");
      console.log("");
      console.log("Usage:");
      console.log("  youmd keys list");
      console.log("  youmd keys create [--label <name>]");
      console.log("  youmd keys revoke --id <keyId>");
      console.log("");
      console.log(
        "API keys authenticate CLI requests to the You.md platform."
      );
      console.log(
        "Create keys at " +
          chalk.cyan("https://you.md/settings/api") +
          " or use this command."
      );
      console.log("");
      break;
  }
}

async function keysList(): Promise<void> {
  console.log("you.md -- API keys");
  console.log("");
  console.log(
    chalk.yellow("note") +
      " -- API key management from CLI is not yet available"
  );
  console.log("");
  console.log(
    "  Visit " +
      chalk.cyan("https://you.md/settings/api") +
      " to manage your API keys."
  );
  console.log("");

  const config = readGlobalConfig();
  if (config.token) {
    console.log("  Current key: " + config.token.slice(0, 8) + "..." + config.token.slice(-4));
    console.log("");
  }
}

async function keysCreate(label?: string): Promise<void> {
  console.log("you.md -- create API key");
  console.log("");
  console.log(
    chalk.yellow("note") +
      " -- API key creation from CLI is not yet available"
  );
  console.log("");
  console.log(
    "  Visit " +
      chalk.cyan("https://you.md/settings/api") +
      " to create a new API key."
  );
  if (label) {
    console.log("  Requested label: " + label);
  }
  console.log("");
}

async function keysRevoke(id?: string): Promise<void> {
  if (!id) {
    console.log(chalk.yellow("missing --id flag"));
    console.log("");
    console.log("Usage: youmd keys revoke --id <keyId>");
    console.log("");
    return;
  }

  console.log("you.md -- revoke API key");
  console.log("");
  console.log(
    chalk.yellow("note") +
      " -- API key revocation from CLI is not yet available"
  );
  console.log("");
  console.log(
    "  Visit " +
      chalk.cyan("https://you.md/settings/api") +
      " to revoke API keys."
  );
  console.log("");
}
