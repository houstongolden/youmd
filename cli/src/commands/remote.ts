import * as os from "os";
import chalk from "chalk";
import {
  getMachineProofs,
  listAgentBusMessages,
  type SyncedMachineProof,
  type AgentBusMessage,
} from "../lib/api";
import { isAuthenticated } from "../lib/config";
import {
  dispatchRemoteCommand,
  pollForResult,
  describeWhitelist,
} from "../lib/remote-command";
import {
  ALLOWED_REMOTE_ACTIONS,
  isAllowedRemoteAction,
} from "../lib/remote-executor";

const DIM = chalk.dim;
const ACCENT = chalk.hex("#C46A3A");

export type RemoteCommandOptions = {
  limit?: string;
  json?: boolean;
  message?: string;
  project?: string;
  timeout?: string;
};

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusColor(status: string): (s: string) => string {
  if (status === "ready") return chalk.green;
  if (status === "warn") return chalk.yellow;
  if (status === "failed") return chalk.red;
  return DIM;
}

function notAuthed(): void {
  console.log("");
  console.log(chalk.yellow("  not authenticated"));
  console.log("  run " + chalk.cyan("youmd login") + " to see your synced machines.");
  console.log("");
}

/**
 * Phase 0 (read-only): match a machine by host substring. We match against
 * hostName and machineKey, case-insensitively. Returns the freshest proof.
 */
function matchMachine(
  machines: SyncedMachineProof[],
  query: string
): SyncedMachineProof | undefined {
  const q = query.toLowerCase();
  const matches = machines.filter(
    (m) =>
      m.hostName?.toLowerCase().includes(q) ||
      m.machineKey?.toLowerCase().includes(q)
  );
  // machines arrive newest-first; keep that order.
  return matches[0];
}

async function lastAgentActivityForHost(
  hostName: string
): Promise<AgentBusMessage | undefined> {
  try {
    const res = await listAgentBusMessages({ limit: 100 });
    if (!res.ok) return undefined;
    const msgs = res.data?.messages || [];
    const host = hostName.toLowerCase();
    const forHost = msgs
      .filter((m) => (m.sourceHost || "").toLowerCase() === host)
      .sort((a, b) => b.createdAt - a.createdAt);
    return forHost[0];
  } catch {
    return undefined;
  }
}

function printMachineLine(m: SyncedMachineProof, isSelf: boolean): void {
  const color = statusColor(m.status);
  const tag = isSelf ? DIM(" (this machine)") : "";
  const daemons =
    m.daemonsTotal != null
      ? DIM(`  daemons ${m.daemonsLoaded ?? 0}/${m.daemonsTotal}`)
      : "";
  console.log(
    `  ${color("●")} ${chalk.cyan(m.hostName)}${tag}  ${color(m.status)}` +
      `  ${DIM(relativeTime(m.generatedAt))}${daemons}`
  );
  if (m.warnings && m.warnings.length > 0) {
    console.log("    " + DIM(`warnings: ${m.warnings.slice(0, 2).join("; ")}`));
  }
}

async function listMachines(options: RemoteCommandOptions): Promise<void> {
  if (!isAuthenticated()) return notAuthed();
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const res = await getMachineProofs({ limit });
  const machines = res.ok ? res.data?.machines || [] : [];

  if (options.json) {
    console.log(JSON.stringify({ machines }, null, 2));
    return;
  }

  console.log("");
  console.log(DIM("  --- your synced machines ---"));
  console.log("");
  if (machines.length === 0) {
    console.log(
      "  " + DIM("no machines reporting yet -- they appear after ") +
        chalk.cyan("you machine sync-now")
    );
    console.log("");
    return;
  }
  const self = os.hostname().toLowerCase();
  for (const m of machines) {
    printMachineLine(m, (m.hostName || "").toLowerCase() === self);
  }
  console.log("");
  console.log(
    "  " + DIM("status of one: ") + chalk.cyan("you remote status <machine>")
  );
  console.log("");
}

async function machineStatus(
  query: string | undefined,
  options: RemoteCommandOptions
): Promise<void> {
  if (!isAuthenticated()) return notAuthed();
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const res = await getMachineProofs({ limit });
  const machines = res.ok ? res.data?.machines || [] : [];

  if (machines.length === 0) {
    console.log("");
    console.log(
      "  " + DIM("no machines reporting yet -- run ") +
        chalk.cyan("you machine sync-now") + DIM(" on the target machine.")
    );
    console.log("");
    return;
  }

  // No query → default to the most recently active machine that is NOT this one,
  // otherwise the freshest overall.
  let machine: SyncedMachineProof | undefined;
  if (query) {
    machine = matchMachine(machines, query);
    if (!machine) {
      console.log("");
      console.log(chalk.yellow(`  no machine matching "${query}"`));
      console.log(
        "  " + DIM("known machines: ") +
          machines.map((m) => m.hostName).filter(Boolean).join(", ")
      );
      console.log("");
      return;
    }
  } else {
    const self = os.hostname().toLowerCase();
    machine =
      machines.find((m) => (m.hostName || "").toLowerCase() !== self) ||
      machines[0];
  }

  const activity = await lastAgentActivityForHost(machine.hostName);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          machine,
          lastAgentActivity: activity || null,
          // Phase 0 is read-only: no live git state yet (requires the daemon
          // command handler from Phase 1). gitState is reported once available.
          gitState: null,
          phase: 0,
        },
        null,
        2
      )
    );
    return;
  }

  const color = statusColor(machine.status);
  const self = os.hostname().toLowerCase();
  const isSelf = (machine.hostName || "").toLowerCase() === self;

  console.log("");
  console.log(
    "  " + ACCENT(machine.hostName) + (isSelf ? DIM("  (this machine)") : "")
  );
  console.log("  " + DIM("─".repeat(Math.min(40, (machine.hostName || "").length + 16))));
  console.log(
    "  status      " + color(machine.status) +
      DIM(`  (last report ${relativeTime(machine.generatedAt)})`)
  );
  if (machine.platform) console.log("  platform    " + DIM(machine.platform));
  console.log("  root        " + DIM(machine.rootDir));
  console.log(
    "  projects    " +
      DIM(
        `${machine.ready}/${machine.scanned} ready` +
          (machine.needsEnv ? `, ${machine.needsEnv} need env` : "") +
          (machine.failures ? `, ${machine.failures} failed` : "")
      )
  );
  if (machine.daemonsTotal != null) {
    console.log(
      "  daemons     " +
        DIM(`${machine.daemonsLoaded ?? 0}/${machine.daemonsTotal} loaded`)
    );
  }

  if (activity) {
    console.log("");
    console.log("  " + DIM("last agent activity:"));
    console.log(
      "    " + chalk.cyan(activity.sourceAgent || "agent") +
        DIM(`  [${activity.channel}]  ${relativeTime(activity.createdAt)}`)
    );
    console.log("    " + DIM(activity.body.slice(0, 160)));
  } else {
    console.log("");
    console.log("  " + DIM("no recent agent-bus activity from this machine"));
  }

  console.log("");
  if (!isSelf) {
    // Honest about what isn't built yet — Phase 1 adds live git + commit/push.
    console.log(
      "  " + DIM("live git state + remote commit/push land in Phase 1 ") +
        DIM("(see project-context/CROSS-MACHINE-AGENTS.md)")
    );
    console.log("");
  }
}

/**
 * Phase 1: dispatch a whitelisted command to another machine and wait
 * (bounded) for the result. The hard security boundary is on the target
 * daemon's executor — this side only addresses + polls.
 */
async function runRemoteCommand(
  machine: string | undefined,
  action: string | undefined,
  options: RemoteCommandOptions
): Promise<void> {
  if (!isAuthenticated()) return notAuthed();

  if (!machine || !action) {
    console.log("");
    console.log(chalk.yellow("  usage: ") + chalk.cyan("youmd remote run <machine> <action> [--project <p>] [--message <m>]"));
    console.log("");
    console.log("  " + DIM("actions:"));
    for (const line of describeWhitelist()) {
      console.log("    " + DIM(line));
    }
    console.log("");
    return;
  }

  if (!isAllowedRemoteAction(action)) {
    console.log("");
    console.log(chalk.yellow(`  unknown action "${action}"`));
    console.log("  " + DIM("allowed: ") + ALLOWED_REMOTE_ACTIONS.join(", "));
    console.log("");
    return;
  }

  const args: Record<string, unknown> = {};
  if (options.project) args.project = options.project;
  if (options.message) args.message = options.message;

  const timeoutMs = Math.min(
    Math.max(Number(options.timeout) * 1000 || 60_000, 5_000),
    180_000
  );

  console.log("");
  const spinner = new (await import("../lib/render")).BrailleSpinner(
    `dispatching ${action} to ${machine}...`
  );
  spinner.start();

  const dispatched = await dispatchRemoteCommand({
    machine,
    action,
    args,
    message: options.message,
    sourceAgent: "youmd remote cli",
  });

  if (!dispatched.ok) {
    spinner.fail(dispatched.error);
    if (/scope/i.test(dispatched.error)) {
      console.log("  " + DIM("this key needs the ") + chalk.cyan("remote:command") + DIM(" scope (opt-in, like vault)."));
    }
    console.log("");
    process.exitCode = 1;
    return;
  }

  spinner.stop(`dispatched ${chalk.dim(dispatched.data.requestId)}`);

  const waitSpinner = new (await import("../lib/render")).BrailleSpinner(
    `waiting for ${machine} to respond...`
  );
  waitSpinner.start();

  const result = await pollForResult({
    requestId: dispatched.data.requestId,
    timeoutMs,
  });

  if (!result) {
    waitSpinner.fail("no response before timeout");
    console.log(
      "  " + DIM("the target daemon may be offline. check ") +
        chalk.cyan(`youmd remote status ${machine}`)
    );
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    waitSpinner.stop("");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.ok) {
    waitSpinner.stop(chalk.green(`${result.action} ok`));
  } else {
    waitSpinner.fail(`${result.action} ${result.status}: ${result.error ?? "failed"}`);
  }

  const gitState = result.gitState as
    | { branch?: string; dirty?: boolean; ahead?: number; behind?: number; lastCommit?: string }
    | undefined;
  if (gitState) {
    console.log(
      "  " + DIM("git   ") +
        chalk.cyan(gitState.branch ?? "?") +
        DIM(`  ${gitState.dirty ? "dirty" : "clean"}, ahead ${gitState.ahead ?? 0}, behind ${gitState.behind ?? 0}`)
    );
    if (gitState.lastCommit) {
      console.log("  " + DIM("commit ") + DIM(gitState.lastCommit));
    }
  }
  if (result.output) {
    console.log("");
    for (const line of result.output.split("\n").slice(0, 20)) {
      console.log("  " + DIM(line));
    }
  }
  console.log("");
}

function usage(): void {
  console.log("");
  console.log("  " + chalk.bold("youmd remote") + DIM(" -- cross-machine agent status + commands"));
  console.log("");
  console.log("  " + DIM("list:   ") + chalk.cyan("youmd remote list"));
  console.log("  " + DIM("status: ") + chalk.cyan("youmd remote status <machine>"));
  console.log("  " + DIM("run:    ") + chalk.cyan("youmd remote run <machine> <action> [--project <p>] [--message <m>]"));
  console.log("");
  console.log("  " + DIM("actions:"));
  for (const line of describeWhitelist()) {
    console.log("    " + DIM(line));
  }
  console.log("");
  console.log(
    "  " + DIM("Remote commands require the ") + chalk.cyan("remote:command") + DIM(" key scope (opt-in).")
  );
  console.log(
    "  " + DIM("Full spec: project-context/CROSS-MACHINE-AGENTS.md")
  );
  console.log("");
}

export async function remoteCommand(
  subcommand: string | undefined,
  args: string[],
  options: RemoteCommandOptions
): Promise<void> {
  switch (subcommand) {
    case "list":
      return listMachines(options);
    case "status":
      return machineStatus(args[0], options);
    case "run":
      return runRemoteCommand(args[0], args[1], options);
    case undefined:
    case "help":
      return usage();
    default:
      // Treat `you remote <machine>` as a status shortcut.
      return machineStatus(subcommand, options);
  }
}
