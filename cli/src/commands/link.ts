import chalk from "chalk";
import { isAuthenticated } from "../lib/config";
import {
  createContextLink,
  listContextLinks,
  revokeContextLink,
} from "../lib/api";
import { BrailleSpinner, renderRichResponse } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;
const SUCCESS = chalk.green;

/**
 * Context link management.
 * Subcommands: create, list, revoke
 *
 * Context links are shareable URLs that give agents/LLMs access to your bundle.
 */

export async function linkCommand(
  subcommand?: string,
  options: { scope?: string; ttl?: string; maxUses?: string; id?: string; arg?: string } = {}
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
    case "preview":
      await linkPreview(options.arg || options.id);
      break;
    default:
      console.log("you.md -- context links");
      console.log("");
      console.log("Usage:");
      console.log("  youmd link create [--scope public|full] [--ttl 1h|24h|7d|30d|90d|never] [--max-uses N]");
      console.log("  youmd link list");
      console.log("  youmd link preview <token>     preview what the agent sees");
      console.log("  youmd link revoke --id <linkId>");
      console.log("");
      console.log("Context links are shareable URLs that give agents access to your identity context.");
      console.log("");
      break;
  }
}

async function linkCreate(options: {
  scope?: string;
  ttl?: string;
  maxUses?: string;
}): Promise<void> {
  const scope = options.scope || "public";
  const ttl = options.ttl || "7d";
  const maxUses = options.maxUses ? parseInt(options.maxUses, 10) : undefined;

  if (scope !== "public" && scope !== "full") {
    console.log(ACCENT("invalid scope") + " -- must be 'public' or 'full'");
    console.log("");
    return;
  }

  const validTtl = ["1h", "24h", "7d", "30d", "90d", "never"];
  if (!validTtl.includes(ttl)) {
    console.log(ACCENT("invalid ttl") + " -- must be one of: " + validTtl.join(", "));
    console.log("");
    return;
  }

  if (maxUses !== undefined && (isNaN(maxUses) || maxUses < 1)) {
    console.log(ACCENT("invalid max-uses") + " -- must be a positive number");
    console.log("");
    return;
  }

  const spinner = new BrailleSpinner("creating context link");
  spinner.start();

  try {
    const res = await createContextLink({ scope, ttl, maxUses });

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    const data = res.data;
    spinner.stop();

    console.log("");
    console.log(DIM("  scope     ") + chalk.white(data.scope));
    console.log(DIM("  ttl       ") + chalk.white(ttl));
    console.log(DIM("  expires   ") + chalk.white(data.expiresAt === "never" ? "never" : data.expiresAt.split("T")[0]));
    if (maxUses) {
      console.log(DIM("  max uses  ") + chalk.white(String(maxUses)));
    }
    console.log("");
    console.log(DIM("  url       ") + ACCENT(data.url));
    console.log("");

    // Try to copy to clipboard
    try {
      const { execSync } = await import("child_process");
      if (process.platform === "darwin") {
        execSync(`echo ${JSON.stringify(data.url)} | pbcopy`, { stdio: "pipe" });
        console.log(SUCCESS("  copied to clipboard"));
      } else if (process.platform === "linux") {
        execSync(`echo ${JSON.stringify(data.url)} | xclip -selection clipboard`, { stdio: "pipe" });
        console.log(SUCCESS("  copied to clipboard"));
      }
    } catch {
      // Clipboard not available -- not fatal
    }

    console.log("");
  } catch (err) {
    spinner.fail("failed to create link");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}

async function linkList(): Promise<void> {
  const spinner = new BrailleSpinner("fetching context links");
  spinner.start();

  try {
    const res = await listContextLinks();

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    const links = res.data;
    spinner.stop(`${links.length} link${links.length !== 1 ? "s" : ""}`);
    console.log("");

    if (links.length === 0) {
      console.log(DIM("  no context links yet."));
      console.log("");
      console.log(DIM("  create one with: ") + chalk.cyan("youmd link create"));
      console.log("");
      return;
    }

    const active = links.filter((l) => !l.isExpired);
    const expired = links.filter((l) => l.isExpired);

    if (active.length > 0) {
      console.log(DIM("  ACTIVE"));
      console.log("");
      for (const link of active) {
        const scopeLabel = link.scope === "full" ? ACCENT("full") : DIM("public");
        const uses = DIM(`${link.useCount} use${link.useCount !== 1 ? "s" : ""}`);
        const expires = link.expiresAt === "never"
          ? DIM("no expiry")
          : DIM("expires " + (typeof link.expiresAt === "string" ? link.expiresAt.split("T")[0] : "?"));

        console.log(`  ${ACCENT(link.url)}`);
        console.log(`    ${scopeLabel} -- ${uses} -- ${expires}`);
        console.log(`    ${DIM("id: " + link.id)}`);
        console.log("");
      }
    }

    if (expired.length > 0) {
      console.log(DIM("  EXPIRED"));
      console.log("");
      for (const link of expired) {
        console.log(DIM(`  ${link.url}`));
        console.log(DIM(`    ${link.scope} -- ${link.useCount} uses -- expired`));
        console.log("");
      }
    }
  } catch (err) {
    spinner.fail("failed to list links");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}

import { getConvexSiteUrl } from "../lib/config";

const CONVEX_SITE_URL = getConvexSiteUrl();

async function linkPreview(token?: string): Promise<void> {
  if (!token) {
    console.log(ACCENT("missing token"));
    console.log("");
    console.log("Usage: youmd link preview <token>");
    console.log("       youmd link preview --id <token>");
    console.log("");
    console.log(DIM("Tip: run ") + chalk.cyan("youmd link list") + DIM(" to see your links and tokens."));
    console.log("");
    return;
  }

  const spinner = new BrailleSpinner("resolving context link");
  spinner.start();

  try {
    // First, fetch link metadata from the list to show scope/expiry info
    let linkMeta: { scope?: string; useCount?: number; expiresAt?: string; url?: string } = {};
    try {
      const linksRes = await listContextLinks();
      if (linksRes.ok && Array.isArray(linksRes.data)) {
        const match = linksRes.data.find((l) => l.token === token || l.url?.includes(token));
        if (match) {
          linkMeta = {
            scope: match.scope,
            useCount: match.useCount,
            expiresAt: match.expiresAt,
            url: match.url,
          };
        }
      }
    } catch {
      // metadata fetch is best-effort
    }

    // Resolve the context link — fetch what an agent would see
    const res = await fetch(`${CONVEX_SITE_URL}/ctx?token=${encodeURIComponent(token)}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      spinner.fail(`HTTP ${res.status}: ${errText}`);
      console.log("");
      return;
    }

    const content = await res.text();
    spinner.stop(`${content.length} chars`);

    // Show link metadata
    console.log("");
    console.log(DIM("  token     ") + chalk.white(token));
    if (linkMeta.scope) {
      const scopeLabel = linkMeta.scope === "full" ? ACCENT("full (private)") : DIM("public");
      console.log(DIM("  scope     ") + scopeLabel);
    }
    if (linkMeta.useCount !== undefined) {
      console.log(DIM("  uses      ") + chalk.white(String(linkMeta.useCount)));
    }
    if (linkMeta.expiresAt) {
      const exp = linkMeta.expiresAt === "never"
        ? DIM("no expiry")
        : DIM("expires " + linkMeta.expiresAt.split("T")[0]);
      console.log(DIM("  expires   ") + exp);
    }
    if (linkMeta.url) {
      console.log(DIM("  url       ") + ACCENT(linkMeta.url));
    }
    console.log("");
    console.log(DIM("  " + "\u2500".repeat(50)));
    console.log(DIM("  AGENT VIEW:"));
    console.log(DIM("  " + "\u2500".repeat(50)));
    console.log("");

    // Render the content using the rich renderer
    const rendered = renderRichResponse(content);
    console.log(rendered);
    console.log("");
    console.log(DIM("  " + "\u2500".repeat(50)));
    console.log(DIM(`  ${content.length.toLocaleString()} chars -- this is what the agent sees`));
    console.log("");
  } catch (err) {
    spinner.fail("failed to resolve context link");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}

async function linkRevoke(id?: string): Promise<void> {
  if (!id) {
    console.log(ACCENT("missing --id flag"));
    console.log("");
    console.log("Usage: youmd link revoke --id <linkId>");
    console.log("");
    console.log(DIM("Tip: run ") + chalk.cyan("youmd link list") + DIM(" to see link IDs."));
    console.log("");
    return;
  }

  const spinner = new BrailleSpinner("revoking context link");
  spinner.start();

  try {
    const res = await revokeContextLink(id);

    if (!res.ok) {
      spinner.fail((res.data as any)?.error || `HTTP ${res.status}`);
      console.log("");
      return;
    }

    spinner.stop("link revoked");
    console.log("");
  } catch (err) {
    spinner.fail("failed to revoke link");
    if (err instanceof Error) {
      console.log("  " + DIM(err.message));
    }
    console.log("");
  }
}
