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
  WorkerHarness,
} from "../lib/orchestrator/supervisor";
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
      context: `host: ${host}`,
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
