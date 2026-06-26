// tools.ts — orchestrator tool registry + model caller for the You agent loop.
//
// Wires the deterministic supervisor (spawn/list/tail/stop other harnesses) into LoopTools the
// iterative loop can drive, and provides a harness/model-agnostic model caller that reuses the
// existing /api/v1/chat proxy (with an OpenRouter fallback), so no new LLM plumbing is needed.

import * as os from "os";
import * as path from "path";
import { LoopTool, LoopMessage, ModelCaller } from "./loop";
import {
  spawnWorker,
  refreshWorkers,
  getWorkerOutput,
  stopWorker,
  WorkerHarness,
} from "./supervisor";
import { readGlobalConfig } from "../config";

const SITE = process.env.YOU_APP_URL || process.env.YOUMD_APP_URL || "https://you.md";
const CHAT_PROXY_URL = `${SITE}/api/v1/chat`;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.YOU_ORCHESTRATOR_MODEL || "anthropic/claude-sonnet-4.6";

/** Resolve a You.md project name to a directory under known roots, else treat as a path. */
export function resolveProjectDir(project: string | undefined, fallbackCwd: string): string {
  if (!project) return fallbackCwd;
  if (path.isAbsolute(project)) return project;
  // Common workspace roots; the daemon/machine layer keeps these in sync.
  const home = os.homedir();
  const candidates = [
    path.join(process.cwd(), project),
    path.join(home, "Desktop", "CODE_YOU", project),
    path.join(home, "Desktop", "CODE_2025", project),
    path.join(home, "Desktop", "CODE_2026", project),
    path.join(home, project),
  ];
  // We do not stat here (supervisor validates); return the first plausible candidate that the
  // caller can override. The supervisor returns a clear error if it does not exist.
  return candidates[0];
}

export interface BuildToolsOptions {
  host?: string;
  /** Default cwd for spawns when no project/dir is supplied. */
  cwd?: string;
}

/** Build the orchestrator tool set (process supervision over worker harnesses). */
export function buildOrchestratorTools(opts: BuildToolsOptions = {}): LoopTool[] {
  const host = opts.host || os.hostname();
  const cwd = opts.cwd || process.cwd();

  return [
    {
      name: "spawn_agent",
      description:
        "Launch a worker agent harness on a task in a project directory (delegate the actual work).",
      parameters: {
        harness: "claude | codex | cursor | custom",
        goal: "the task prompt for the worker",
        project: "(optional) You.md project name or absolute path to run in",
        dir: "(optional) explicit working directory (overrides project)",
      },
      run: async (args) => {
        const harness = String(args.harness || "claude") as WorkerHarness;
        const goal = String(args.goal || "").trim();
        if (!goal) return "error: spawn_agent requires a non-empty goal";
        const dir = args.dir
          ? String(args.dir)
          : resolveProjectDir(args.project ? String(args.project) : undefined, cwd);
        const res = spawnWorker({
          harness,
          goal,
          cwd: dir,
          project: args.project ? String(args.project) : undefined,
          host,
        });
        if (!res.ok || !res.worker) return `error: ${res.error}`;
        return `launched ${harness} worker ${res.worker.id} (pid ${res.worker.pid}) in ${dir}`;
      },
    },
    {
      name: "list_agents",
      description: "List worker agents and their status (running/exited/stopped) on this host.",
      parameters: {},
      run: async () => {
        const workers = refreshWorkers();
        if (workers.length === 0) return "no workers yet";
        return workers
          .map(
            (w) =>
              `${w.id} [${w.status}] ${w.harness} project=${w.project ?? "-"} :: ${w.goal.slice(0, 80)}`
          )
          .join("\n");
      },
    },
    {
      name: "get_agent_output",
      description: "Tail a worker agent's captured output to see progress or results.",
      parameters: { id: "worker id", lines: "(optional) number of lines to tail (default 40)" },
      run: async (args) => {
        const id = String(args.id || "").trim();
        if (!id) return "error: get_agent_output requires id";
        const lines = Number(args.lines) > 0 ? Number(args.lines) : 40;
        const res = getWorkerOutput(id, lines);
        return res.ok ? res.output || "(empty)" : `error: ${res.error}`;
      },
    },
    {
      name: "stop_agent",
      description: "Stop a running worker agent.",
      parameters: { id: "worker id" },
      run: async (args) => {
        const id = String(args.id || "").trim();
        if (!id) return "error: stop_agent requires id";
        const res = stopWorker(id);
        return res.ok ? `stopped ${id}` : `error: ${res.error}`;
      },
    },
  ];
}

/**
 * A harness/model-agnostic model caller: try the You.md chat proxy (no key needed), fall back to
 * the user's OpenRouter key if present. Mirrors the proven onboarding.ts pattern.
 */
export function makeModelCaller(): ModelCaller {
  return async (messages: LoopMessage[]): Promise<string> => {
    // Try the proxy first.
    try {
      const res = await fetch(CHAT_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: string };
        if (data.content) return data.content;
      }
    } catch {
      // fall through to direct call
    }

    const cfg = readGlobalConfig();
    const key = cfg.openrouterKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("orchestrator model unavailable (no chat proxy, no OpenRouter key)");

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://you.md",
        "X-Title": "you.md orchestrator",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { choices?: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty model response");
    return content;
  };
}
