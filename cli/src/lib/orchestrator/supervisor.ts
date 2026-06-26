// supervisor.ts — process supervisor for the You agent orchestrator.
//
// The You agent is a MASTER ORCHESTRATOR, not a worker/coding agent. It launches, monitors,
// and stops other agentic harnesses (Claude Code, Codex, Cursor, etc.) — each best at a
// given task — in real project directories, captures their output, and reports back. This
// module is the deterministic substrate for that: spawn / list / tail / stop, persisted in a
// registry so an always-on daemon (or the next CLI invocation) can see the whole fleet.
//
// No LLM in this file. It is pure, testable process management; the loop (loop.ts) drives it.

import * as child_process from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getWritableHomeBundleDir } from "../config";

export type WorkerHarness = "claude" | "codex" | "cursor" | "custom";
export type WorkerStatus = "running" | "exited" | "failed" | "stopped" | "unknown";

export interface WorkerRecord {
  id: string;
  harness: WorkerHarness;
  /** You.md project name / slug this worker is operating on (for reporting). */
  project?: string;
  /** Working directory the harness was launched in. */
  cwd: string;
  /** The task prompt handed to the worker. */
  goal: string;
  pid?: number;
  status: WorkerStatus;
  exitCode?: number;
  startedAt: string;
  endedAt?: string;
  logFile: string;
  /** Host that launched this worker (for cross-machine fleet views). */
  host: string;
}

/** Headless invocation templates per harness. `{prompt}` is replaced with the task. */
interface HarnessSpec {
  bin: string;
  args: (prompt: string) => string[];
  /** Env override that lets Houston point at a different binary/flags. */
  overrideEnv: string;
}

const HARNESS_SPECS: Record<Exclude<WorkerHarness, "custom">, HarnessSpec> = {
  // Claude Code headless print mode.
  claude: { bin: "claude", args: (p) => ["-p", p], overrideEnv: "YOU_HARNESS_CLAUDE" },
  // Codex non-interactive exec mode.
  codex: { bin: "codex", args: (p) => ["exec", p], overrideEnv: "YOU_HARNESS_CODEX" },
  // Cursor agent CLI headless mode.
  cursor: { bin: "cursor-agent", args: (p) => ["-p", p], overrideEnv: "YOU_HARNESS_CURSOR" },
};

function orchestratorDir(): string {
  const dir = path.join(getWritableHomeBundleDir(), "orchestrator");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function logsDir(): string {
  const dir = path.join(orchestratorDir(), "logs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function registryPath(): string {
  return path.join(orchestratorDir(), "workers.json");
}

export function loadWorkers(): WorkerRecord[] {
  try {
    const raw = fs.readFileSync(registryPath(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WorkerRecord[]) : [];
  } catch {
    return [];
  }
}

function saveWorkers(workers: WorkerRecord[]): void {
  fs.writeFileSync(registryPath(), JSON.stringify(workers, null, 2));
}

/** True if a pid is alive (signal 0 probe). */
export function isPidAlive(pid: number | undefined): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process; EPERM = exists but not ours (still alive).
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Reconcile registry status against live pids (a running worker whose pid died → exited). */
export function refreshWorkers(workers: WorkerRecord[] = loadWorkers()): WorkerRecord[] {
  let changed = false;
  for (const w of workers) {
    if (w.status === "running" && !isPidAlive(w.pid)) {
      w.status = "exited";
      w.endedAt = w.endedAt ?? new Date().toISOString();
      changed = true;
    }
  }
  if (changed) saveWorkers(workers);
  return workers;
}

function shortId(): string {
  // ULID-ish without external deps: time + random suffix. Not crypto; just a unique handle.
  const rand = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  const stamp = Date.now().toString(36);
  return `w_${stamp}${rand}`;
}

export interface SpawnWorkerInput {
  harness: WorkerHarness;
  goal: string;
  cwd: string;
  project?: string;
  host: string;
  /** Required when harness === "custom": full argv, with {prompt} substituted in any element. */
  customCommand?: string[];
}

export interface SpawnWorkerResult {
  ok: boolean;
  worker?: WorkerRecord;
  error?: string;
}

/**
 * Launch a worker harness detached, streaming its output to a per-worker log file, and record
 * it in the registry. Detached + unref so the worker outlives this CLI process (an orchestrator
 * dispatches and moves on; it does not block on the worker).
 */
export function spawnWorker(input: SpawnWorkerInput): SpawnWorkerResult {
  const { harness, goal, cwd, project, host } = input;

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    return { ok: false, error: `working directory does not exist: ${cwd}` };
  }

  let bin: string;
  let argv: string[];
  if (harness === "custom") {
    if (!input.customCommand || input.customCommand.length === 0) {
      return { ok: false, error: "custom harness requires customCommand argv" };
    }
    const subst = input.customCommand.map((part) => part.replace(/\{prompt\}/g, goal));
    bin = subst[0];
    argv = subst.slice(1);
  } else {
    const spec = HARNESS_SPECS[harness];
    const override = process.env[spec.overrideEnv];
    bin = override && override.trim() ? override.trim() : spec.bin;
    argv = spec.args(goal);
  }

  const id = shortId();
  const logFile = path.join(logsDir(), `${id}.log`);

  let pid: number | undefined;
  try {
    const out = fs.openSync(logFile, "a");
    fs.writeSync(
      out,
      `# you orchestrator worker ${id}\n# harness=${harness} project=${project ?? "-"} cwd=${cwd}\n# goal: ${goal}\n# started: ${new Date().toISOString()}\n\n`
    );
    const child = child_process.spawn(bin, argv, {
      cwd,
      detached: true,
      stdio: ["ignore", out, out],
      env: process.env,
    });
    pid = child.pid;
    child.unref();
    fs.closeSync(out);
  } catch (err) {
    return {
      ok: false,
      error: `failed to launch ${bin}: ${(err as Error).message} (is the harness installed and on PATH?)`,
    };
  }

  const worker: WorkerRecord = {
    id,
    harness,
    project,
    cwd,
    goal,
    pid,
    status: pid ? "running" : "failed",
    startedAt: new Date().toISOString(),
    logFile,
    host,
  };

  const workers = loadWorkers();
  workers.push(worker);
  saveWorkers(workers);

  return { ok: true, worker };
}

export function getWorker(id: string): WorkerRecord | undefined {
  return refreshWorkers().find((w) => w.id === id);
}

/** Tail the last `lines` of a worker's captured output. */
export function getWorkerOutput(id: string, lines = 40): { ok: boolean; output?: string; error?: string } {
  const worker = getWorker(id);
  if (!worker) return { ok: false, error: `no worker with id ${id}` };
  try {
    const raw = fs.readFileSync(worker.logFile, "utf-8");
    const tail = raw.split(/\r?\n/).slice(-lines).join("\n");
    return { ok: true, output: tail };
  } catch (err) {
    return { ok: false, error: `could not read log: ${(err as Error).message}` };
  }
}

/** Stop a running worker (SIGTERM the process group). */
export function stopWorker(id: string): { ok: boolean; error?: string } {
  const workers = refreshWorkers();
  const worker = workers.find((w) => w.id === id);
  if (!worker) return { ok: false, error: `no worker with id ${id}` };
  if (worker.status !== "running") return { ok: true };
  try {
    if (worker.pid && isPidAlive(worker.pid)) {
      // Negative pid → kill the detached process group.
      try {
        process.kill(-worker.pid, "SIGTERM");
      } catch {
        process.kill(worker.pid, "SIGTERM");
      }
    }
    worker.status = "stopped";
    worker.endedAt = new Date().toISOString();
    saveWorkers(workers);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `failed to stop: ${(err as Error).message}` };
  }
}

/** Drop exited/stopped workers older than `maxAgeMs` from the registry (keeps running ones). */
export function pruneWorkers(maxAgeMs = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  const workers = refreshWorkers();
  const kept = workers.filter((w) => {
    if (w.status === "running") return true;
    const ended = w.endedAt ? Date.parse(w.endedAt) : Date.parse(w.startedAt);
    return now - ended < maxAgeMs;
  });
  const removed = workers.length - kept.length;
  if (removed > 0) saveWorkers(kept);
  return removed;
}
