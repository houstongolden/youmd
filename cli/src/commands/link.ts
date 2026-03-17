import chalk from "chalk";
import { isAuthenticated, readGlobalConfig } from "../lib/config";

/**
 * Context link management.
 * Subcommands: create, list, revoke
 *
 * Context links are shareable URLs that give agents/LLMs access to your bundle.
 */

const SITE_URL = "https://uncommon-chicken-142.convex.site";

function getToken(): string {
  const config = readGlobalConfig();
  if (!config.token) {
    throw new Error("Not authenticated");
  }
  return config.token;
}

async function apiRequest(path: string, options: RequestInit = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(`${SITE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res.json();
}

export async function linkCommand(
  subcommand?: string,
  options: { scope?: string; ttl?: string; maxUses?: string; id?: string } = {}
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
    case "create":
      await linkCreate(options);
      break;
    case "list":
    case "ls":
      await linkList();
      break;
    case "revoke":
      await linkRevoke(options.id);
      break;
    default:
      console.log("you.md -- context links");
      console.log("");
      console.log("Usage:");
      console.log("  youmd link create [--scope public|full] [--ttl 24h|7d|30d|never] [--max-uses N]");
      console.log("  youmd link list");
      console.log("  youmd link revoke --id <linkId>");
      console.log("");
      console.log("Context links are shareable URLs that give agents access to your identity bundle.");
      console.log("");
      break;
  }
}

async function linkCreate(options: {
  scope?: string;
  ttl?: string;
  maxUses?: string;
}): Promise<void> {
  console.log("you.md -- creating context link");
  console.log("");

  const scope = options.scope || "public";
  const ttl = options.ttl || "7d";
  const maxUses = options.maxUses ? parseInt(options.maxUses, 10) : undefined;

  if (scope !== "public" && scope !== "full") {
    console.log(chalk.yellow("invalid scope") + " -- must be 'public' or 'full'");
    console.log("");
    return;
  }

  try {
    const config = readGlobalConfig();
    // We need the clerkId; for now we pass through the API key auth
    // The server endpoint doesn't exist yet for context links via API key
    // This is a placeholder that shows the intended flow
    console.log(
      chalk.yellow("note") +
        " -- context link management from CLI requires the web dashboard"
    );
    console.log("");
    console.log(
      "  Visit " +
        chalk.cyan("https://you.md/settings/links") +
        " to create context links."
    );
    console.log("");
    console.log("Requested:");
    console.log("  scope:    " + scope);
    console.log("  ttl:      " + ttl);
    if (maxUses) {
      console.log("  maxUses:  " + maxUses);
    }
    console.log("");
  } catch (err) {
    console.log(chalk.red("error") + " -- failed to create link");
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}

async function linkList(): Promise<void> {
  console.log("you.md -- context links");
  console.log("");

  try {
    console.log(
      chalk.yellow("note") +
        " -- context link listing from CLI requires the web dashboard"
    );
    console.log("");
    console.log(
      "  Visit " +
        chalk.cyan("https://you.md/settings/links") +
        " to manage your context links."
    );
    console.log("");
  } catch (err) {
    console.log(chalk.red("error") + " -- failed to list links");
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}

async function linkRevoke(id?: string): Promise<void> {
  if (!id) {
    console.log(chalk.yellow("missing --id flag"));
    console.log("");
    console.log("Usage: youmd link revoke --id <linkId>");
    console.log("");
    return;
  }

  try {
    console.log(
      chalk.yellow("note") +
        " -- context link revocation from CLI requires the web dashboard"
    );
    console.log("");
    console.log(
      "  Visit " +
        chalk.cyan("https://you.md/settings/links") +
        " to revoke context links."
    );
    console.log("");
  } catch (err) {
    console.log(chalk.red("error") + " -- failed to revoke link");
    if (err instanceof Error) {
      console.log("  " + err.message);
    }
    console.log("");
  }
}
