// orchestrate.ts — `you orchestrate` : the master orchestrator command.
//
// The You agent as conductor: launch/monitor/stop worker harnesses (manual subcommands), or
// run the autonomous loop that delegates a goal across them. Harness- and model-agnostic.

import * as os from "os";
import chalk from "chalk";
import {
  spawnWorker,
  refreshWorkers,
  getWorkerOutput,
  stopWorker,
  pruneWorkers,
  collectUnreportedCompletions,
  WorkerHarness,
  WorkerRecord,
} from "../lib/orchestrator/supervisor";
import { sendAgentBusMessage } from "../lib/api";
import { isAuthenticated } from "../lib/config";
import { buildOrchestratorTools, makeModelCaller, resolveProjectDir } from "../lib/orchestrator/tools";
import { runAgentLoop } from "../lib/orchestrator/loop";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

export interface OrchestrateOptions {
  harness?: string;
  project?: string;
  dir?: string;
  lines?: string;
  maxSteps?: string;
  json?: boolean;
  once?: boolean;
  interval?: string;
}

/** Post a worker-completion notice to the agent bus so U (here or on another machine) sees it. */
async function reportCompletion(w: WorkerRecord): Promise<boolean> {
  if (!isAuthenticated()) return false;
  const res = await sendAgentBusMessage({
    channel: "orchestrator",
    kind: "worker-complete",
    body: `worker ${w.id} (${w.harness}${w.project ? ` · ${w.project}` : ""}) ${w.status} — ${w.goal.slice(0, 100)}`,
    sourceAgent: "you orchestrator",
    metadata: {
      workerId: w.id,
      harness: w.harness,
      project: w.project,
      status: w.status,
      exitCode: w.exitCode,
      startedAt: w.startedAt,
      endedAt: w.endedAt,
      secretValuesExposed: false,
    },
  });
  return res.ok;
}

/** One reconcile-and-report pass. Returns the count reported. */
async function reportPass(): Promise<number> {
  const done = collectUnreportedCompletions();
  let reported = 0;
  for (const w of done) {
    const ok = await reportCompletion(w);
    if (ok) reported++;
    console.log(
      "  " + (w.status === "exited" ? chalk.green("done") : chalk.yellow(w.status)) + " " +
      chalk.cyan(w.id) + DIM(` ${w.harness}${w.project ? ` · ${w.project}` : ""}`) +
      (ok ? "" : DIM("  (not posted — login to report across machines)"))
    );
  }
  return reported;
}

function usage(): void {
  console.log("");
  console.log("  " + ACCENT("you orchestrate") + DIM("  — your personal master orchestrator agent"));
  console.log("");
  console.log("  " + chalk.cyan("run <goal>") + DIM("            autonomously delegate a goal across worker agents"));
  console.log("  " + chalk.cyan("spawn <goal>") + DIM("          launch one worker (--harness, --project|--dir)"));
  console.log("  " + chalk.cyan("list") + DIM("                  show workers and their status"));
  console.log("  " + chalk.cyan("logs <id>") + DIM("             tail a worker's output (--lines)"));
  console.log("  " + chalk.cyan("stop <id>") + DIM("             stop a running worker"));
  console.log("  " + chalk.cyan("watch") + DIM("                 report worker completions to the bus (--once, --interval)"));
  console.log("  " + chalk.cyan("prune") + DIM("                 drop old finished workers from the registry"));
  console.log("");
  console.log("  " + DIM("harnesses: claude | codex | cursor | custom   (override bins via YOU_HARNESS_*)"));
  console.log("");
}

export async function orchestrateCommand(
  subcommand: string | undefined,
  args: string[],
  options: OrchestrateOptions
): Promise<void> {
  const host = os.hostname();

  if (!subcommand || subcommand === "help") {
    usage();
    return;
  }

  if (subcommand === "list") {
    const workers = refreshWorkers();
    if (options.json) {
      console.log(JSON.stringify(workers, null, 2));
      return;
    }
    console.log("");
    if (workers.length === 0) {
      console.log("  " + DIM("no workers yet — try: you orchestrate spawn \"<task>\" --harness claude --project youmd"));
      console.log("");
      return;
    }
    for (const w of workers) {
      const color =
        w.status === "running" ? chalk.green : w.status === "failed" ? chalk.red : DIM;
      console.log("  " + color(w.status.padEnd(8)) + " " + chalk.cyan(w.id) + DIM(` ${w.harness}`) +
        (w.project ? DIM(` · ${w.project}`) : ""));
      console.log("           " + DIM(w.goal.slice(0, 100)));
    }
    console.log("");
    return;
  }

  if (subcommand === "logs") {
    const id = args[0];
    if (!id) {
      console.log(chalk.yellow("  usage: you orchestrate logs <id> [--lines N]"));
      process.exitCode = 1;
      return;
    }
    const lines = Number(options.lines) > 0 ? Number(options.lines) : 40;
    const res = getWorkerOutput(id, lines);
    console.log("");
    console.log(res.ok ? res.output || DIM("(empty)") : chalk.red("  " + res.error));
    console.log("");
    return;
  }

  if (subcommand === "stop") {
    const id = args[0];
    if (!id) {
      console.log(chalk.yellow("  usage: you orchestrate stop <id>"));
      process.exitCode = 1;
      return;
    }
    const res = stopWorker(id);
    console.log(res.ok ? "  " + chalk.green(`stopped ${id}`) : chalk.red("  " + res.error));
    return;
  }

  if (subcommand === "prune") {
    const removed = pruneWorkers();
    console.log("  " + chalk.green(`pruned ${removed} finished worker(s)`));
    return;
  }

  if (subcommand === "watch") {
    // One pass (--once) or a poll loop reporting completions to the agent bus. For always-on
    // report-back, run this under a process manager (systemd/launchd/nohup) or a sibling daemon
    // timer; foreground is fine for tailing a session.
    console.log("");
    if (options.once) {
      const n = await reportPass();
      console.log("  " + DIM(n > 0 ? `reported ${n} completion(s)` : "no new completions"));
      console.log("");
      return;
    }
    const interval = Math.max(Number(options.interval) || 15, 5) * 1000;
    console.log("  " + ACCENT("U watching workers") + DIM(`  every ${interval / 1000}s — ctrl-c to stop`));
    console.log("");
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await reportPass();
      } catch (err) {
        console.log("  " + chalk.yellow("watch pass error: ") + DIM(String((err as Error).message)));
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  if (subcommand === "spawn") {
    const goal = args.join(" ").trim();
    if (!goal) {
      console.log(chalk.yellow('  usage: you orchestrate spawn "<task>" --harness claude --project youmd'));
      process.exitCode = 1;
      return;
    }
    const harness = (options.harness || "claude") as WorkerHarness;
    const dir = options.dir || resolveProjectDir(options.project, process.cwd());
    const res = spawnWorker({ harness, goal, cwd: dir, project: options.project, host });
    if (!res.ok || !res.worker) {
      console.log(chalk.red("  " + res.error));
      process.exitCode = 1;
      return;
    }
    console.log("");
    console.log("  " + chalk.green("launched") + " " + chalk.cyan(res.worker.id) +
      DIM(` (${harness}, pid ${res.worker.pid})`));
    console.log("  " + DIM(`dir: ${dir}`));
    console.log("  " + DIM(`tail: you orchestrate logs ${res.worker.id}`));
    console.log("");
    return;
  }

  if (subcommand === "run") {
    const goal = args.join(" ").trim();
    if (!goal) {
      console.log(chalk.yellow('  usage: you orchestrate run "<goal>"'));
      process.exitCode = 1;
      return;
    }
    const maxSteps = Number(options.maxSteps) > 0 ? Number(options.maxSteps) : 12;
    const tools = buildOrchestratorTools({ host, cwd: process.cwd() });
    const callModel = makeModelCaller();

    console.log("");
    console.log("  " + ACCENT("U orchestrating") + DIM(`  goal: ${goal}`));
    console.log("");

    const outcome = await runAgentLoop({
      goal,
      tools,
      callModel,
      maxSteps,
      context: `host: ${host}\nYou can run workers on THIS host, or delegate to another computer: call list_machines to see synced machines, then pass machine="<hostname>" to spawn_agent/list_agents/get_agent_output/stop_agent (the target must have YOU_REMOTE_AGENT_HOST=1 to accept spawns).`,
      onStep: (step) => {
        const head = step.thought ? `${step.thought} ` : "";
        console.log("  " + DIM(`#${step.index + 1} `) + chalk.cyan(step.tool) + " " + DIM(head));
        console.log("     " + DIM(step.result.split("\n")[0].slice(0, 120)));
      },
    });

    console.log("");
    console.log(outcome.finished ? "  " + chalk.green("done") : "  " + chalk.yellow("incomplete"));
    console.log("  " + outcome.summary);
    console.log("");
    if (!outcome.finished) process.exitCode = 1;
    return;
  }

  usage();
  process.exitCode = 1;
}
