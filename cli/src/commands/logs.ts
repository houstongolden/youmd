import chalk from "chalk";
import { isAuthenticated, readGlobalConfig, getConvexSiteUrl } from "../lib/config";

const DIM = chalk.dim;

interface ActivityEvent {
  _id: string;
  agentName: string;
  agentSource: string;
  action: string;
  resource?: string;
  scope?: string;
  status: string;
  bundleVersionBefore?: number;
  bundleVersionAfter?: number;
  details?: unknown;
  createdAt: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 5);
}

function actionColor(action: string): (s: string) => string {
  if (action.includes("read") || action === "skill_use") return chalk.cyan;
  if (action.includes("write") || action === "push" || action === "publish") return chalk.green;
  if (action === "memory_add") return chalk.magenta;
  return chalk.white;
}

async function fetchActivity(opts: {
  limit?: number;
  agent?: string;
  action?: string;
}): Promise<ActivityEvent[]> {
  const config = readGlobalConfig();
  if (!config.token) return [];
  const siteUrl = getConvexSiteUrl();
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.agent) params.set("agent", opts.agent);
  if (opts.action) params.set("action", opts.action);

  try {
    const res = await fetch(`${siteUrl}/api/v1/me/activity?${params}`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { activity?: ActivityEvent[] };
    return data.activity || [];
  } catch {
    return [];
  }
}

export async function logsCommand(options: {
  limit?: string;
  agent?: string;
  action?: string;
  tail?: boolean;
}): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated"));
    console.log("  run " + chalk.cyan("youmd login") + " to view activity logs.");
    console.log("");
    return;
  }

  const limit = parseInt(options.limit || "30", 10);

  if (options.tail) {
    console.log("");
    console.log(DIM("  --- youmd activity (live, ctrl-c to stop) ---"));
    console.log("");
    let lastSeen: number | null = null;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const events = await fetchActivity({
        limit: 50,
        agent: options.agent,
        action: options.action,
      });
      const newEvents = lastSeen
        ? events.filter((e) => e.createdAt > (lastSeen as number)).reverse()
        : events.slice(0, 10).reverse();
      for (const e of newEvents) {
        printEvent(e);
      }
      if (events.length > 0) {
        lastSeen = Math.max(...events.map((e) => e.createdAt));
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } else {
    console.log("");
    console.log(DIM("  --- recent activity ---"));
    console.log("");
    const events = await fetchActivity({
      limit,
      agent: options.agent,
      action: options.action,
    });
    if (events.length === 0) {
      console.log("  " + DIM("no activity yet -- agents will appear here when they connect"));
      console.log("");
      return;
    }
    for (const e of events.slice().reverse()) {
      printEvent(e);
    }
    console.log("");
    console.log(
      DIM(
        `  ${events.length} event${events.length === 1 ? "" : "s"} -- use --tail for live mode`
      )
    );
    console.log("");
  }
}

function printEvent(e: ActivityEvent): void {
  const time = formatTime(e.createdAt);
  const agent = chalk.bold(e.agentName.padEnd(16));
  const action = actionColor(e.action)(e.action.padEnd(12));
  const resource = e.resource ? DIM(e.resource) : "";
  const scope = e.scope ? DIM(`[${e.scope}]`) : "";
  const versions =
    e.bundleVersionBefore && e.bundleVersionAfter
      ? DIM(` v${e.bundleVersionBefore}->v${e.bundleVersionAfter}`)
      : "";
  console.log(`  ${DIM(time)}  ${agent}  ${action}  ${resource} ${scope}${versions}`);
}
