import chalk from "chalk";
import { isAuthenticated, readGlobalConfig, getConvexSiteUrl } from "../lib/config";

const DIM = chalk.dim;
const ACCENT = chalk.hex("#C46A3A");

interface AgentSummary {
  agentName: string;
  agentSource?: string;
  reads: number;
  writes: number;
  firstSeen: number;
  lastSeen: number;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function absoluteDate(ts: number): string {
  const d = new Date(ts);
  return d.toISOString().split("T")[0];
}

async function fetchAgents(): Promise<AgentSummary[]> {
  const config = readGlobalConfig();
  if (!config.token) return [];
  const siteUrl = getConvexSiteUrl();

  try {
    const res = await fetch(`${siteUrl}/api/v1/me/agents`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { agents?: AgentSummary[] } | AgentSummary[];
    if (Array.isArray(data)) return data;
    return data.agents || [];
  } catch {
    return [];
  }
}

export async function agentsCommand(): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated"));
    console.log("  run " + chalk.cyan("youmd login") + " to view connected agents.");
    console.log("");
    return;
  }

  console.log("");
  console.log(DIM("  --- connected agents ---"));
  console.log("");

  const agents = await fetchAgents();

  if (agents.length === 0) {
    console.log(
      "  " + DIM("no agents yet -- they'll appear here when they connect to your identity")
    );
    console.log("");
    console.log(
      "  " + DIM("tip: install the mcp with ") + chalk.cyan("youmd mcp --install claude --auto")
    );
    console.log("");
    return;
  }

  const FIVE_MIN = 5 * 60 * 1000;
  const now = Date.now();

  const longest = Math.max(...agents.map((a) => a.agentName.length), 12);

  for (const a of agents) {
    const isActive = now - a.lastSeen < FIVE_MIN;
    const dot = isActive ? chalk.green("\u25CF") : DIM("\u25CB");
    const status = isActive ? ACCENT("active") : DIM("idle  ");
    const name = chalk.bold(a.agentName.padEnd(longest + 2));
    const lastSeen = DIM(`last seen ${relativeTime(a.lastSeen)}`);
    console.log(`  ${dot} ${name} ${status}   ${lastSeen}`);

    const counts: string[] = [];
    if (a.reads > 0) counts.push(`${a.reads} read${a.reads === 1 ? "" : "s"}`);
    if (a.writes > 0) counts.push(`${a.writes} write${a.writes === 1 ? "" : "s"}`);
    const countsStr = counts.length > 0 ? counts.join(", ") : "no activity";
    const firstSeen = `first seen ${absoluteDate(a.firstSeen)}`;
    const source = a.agentSource ? ` -- ${a.agentSource}` : "";
    console.log("    " + DIM(`${countsStr} -- ${firstSeen}${source}`));
    console.log("");
  }

  console.log(
    "  " + DIM(`${agents.length} agent${agents.length === 1 ? "" : "s"} -- see activity with `) + chalk.cyan("youmd logs")
  );
  console.log("");
}
