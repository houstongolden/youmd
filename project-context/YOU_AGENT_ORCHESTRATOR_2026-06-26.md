# The You Agent as Master Orchestrator

**Date:** 2026-06-26
**Status:** Core shipped this session (`cli/src/lib/orchestrator/*`, `you orchestrate`).
Deterministic substrate fully tested; live multi-step LLM behavior needs a real-session tuning pass.

---

## 0. The resolution (Houston's reframe)

Houston was at odds with building a "harness" because the goal is to stay **model- and
harness-agnostic**. The reframe dissolves it: the You agent is **not** a worker/coding agent
(Claude Code, Codex, Cursor are workers — each best at certain tasks). The You agent is the
**master ORCHESTRATOR** above them:

> A personalized, contextual, skill-syncing, project-aware, project-goal/task-oriented agent
> that launches, runs, controls, and monitors your other agentic harnesses — across multiple
> machines, multiple projects — and is always on to report back to you. You are never the
> worker; U is your conductor.

This is **why** it stays agnostic: it treats every harness as a swappable executor. It competes
with none of them; it sits in the layer none of them occupy. And the audit showed ~80% of the
substrate already existed (broad MCP surface, 3 host adapters, skill registry, safe remote
executor) — the only net-new piece was the **iterative loop**, now built.

---

## 1. What shipped

```
cli/src/lib/orchestrator/
  supervisor.ts   deterministic process supervisor over worker harnesses (no LLM)
  loop.ts         the iterative agent loop (plan→act→observe→finish), model-agnostic
  tools.ts        supervisor → LoopTools, + a harness/model-agnostic model caller
cli/src/commands/orchestrate.ts   `you orchestrate` (run | spawn | list | logs | stop | prune)
```

### supervisor.ts (the conductor's hands)
- `spawnWorker({harness, goal, cwd, project, host})` launches a worker **detached** with output
  capture; harnesses: `claude` (`claude -p`), `codex` (`codex exec`), `cursor` (`cursor-agent -p`),
  `custom` (explicit argv). Bins overridable via `YOU_HARNESS_CLAUDE|CODEX|CURSOR`.
- Persisted registry at `~/.you/orchestrator/workers.json`; `refreshWorkers` reconciles status
  against live pids; `getWorkerOutput` tails logs; `stopWorker` SIGTERMs the group; `pruneWorkers`.
- **No LLM** — pure, testable process management. This is the part that makes "run and monitor
  your other agents" real.

### loop.ts (the conductor's judgment)
- `runAgentLoop({goal, tools, callModel, maxSteps, context, onStep})`: asks the model for ONE
  tool call (JSON), runs it, feeds the result back, repeats until the model calls `finish` or the
  step cap is hit. `ModelCaller` and the tool registry are **injected** → model- and tool-agnostic.
- JSON tool-call convention over plain chat completions, so it works against the existing
  `/api/v1/chat` proxy with **no native provider tool_use** — agnostic by construction.
- Tolerant `parseToolCall` (handles fenced / prose-wrapped JSON).

### Verified
- tsc clean. Functional smoke: parser cases (incl. ```json fences and prose-wrapped), full
  `spawn → list → tail → stop` lifecycle (captured a real worker's stdout), and the loop iterating
  `model → tool → finish` via a mock model. Live LLM behavior reuses the proven chat proxy.

---

## 2. Roadmap to the full vision (next sessions)

The vision has reach beyond what one session builds. Mapped to substrate:

1. **Cross-machine orchestration — SHIPPED (2026-06-26).** The supervisor runs workers locally;
   the remote-executor now also carries `agent.spawn`/`agent.list`/`agent.output`/`agent.stop`
   over the agent bus, so U on your MacBook can launch + monitor a worker on the office Mac mini
   or a Hostinger VPS: `you remote run <machine> agent.spawn --harness claude --project youmd
   --goal "…"`. `agent.spawn`/`agent.stop` require `YOU_REMOTE_AGENT_HOST=1` on the target (an
   autonomous worker is a real escalation past the git whitelist); read-only list/output do not.
   9 unit tests cover the gating + whitelist. **The loop tools are now remote-capable too
   (2026-06-26):** `spawn_agent`/`list_agents`/`get_agent_output`/`stop_agent` take an optional
   `machine` arg that dispatches the `agent.*` action over the bus + polls for the result, and a
   new `list_machines` tool lets U discover targets — so `you orchestrate run` can delegate across
   machines autonomously, not just via explicit `you remote run`. Unauthenticated calls fail
   gracefully (no throw).
2. **Brain-aware routing.** Wire the existing MCP brain tools (identity, portfolio graph, project
   goals/tasks) into the loop's tool set so U routes by *project goal*, not just by prompt — "push
   the youmd PR" knows which repo, which machine, which harness.
3. **Always-on report-back — MECHANISM SHIPPED (2026-06-26).** `you orchestrate watch`
   (`--once` or `--interval`) reconciles worker status and posts a `worker-complete` message to
   the agent-bus `orchestrator` channel **exactly once** per completion (report-once via a
   `reported` flag on the registry record), so U on any machine sees when a worker finishes/fails.
   `collectUnreportedCompletions()` is the primitive; 2 unit tests lock the terminal-status +
   report-once semantics. **Now genuinely always-on (2026-06-26):** `you orchestrate watch --once`
   is a 5th resident daemon (`com.you.orchestrator-watch`, every 60s) installed by BOTH the launchd
   plist and the systemd `--user` timer, so report-back runs with zero user action on Mac and Linux
   hosts alike.
4. **Computer-use of GUI agent apps.** The desktop app (not the CLI) is the right home for U
   driving the Claude/Codex/Cursor **desktop apps** via computer-use, for harnesses without a clean
   headless CLI. CLI-spawn covers the headless case today; computer-use covers the GUI case later.
5. **Capability map.** A registry of "which harness is best at coding vs research vs design vs
   planning" so U picks the executor, not the user. Seed from `.agent-shared` skill metadata.

---

## 3. Guardrails (PRINCIPLES.md)

- **Stay the conductor.** The moment U drifts toward doing the work itself (general planning,
  arbitrary code-exec, becoming a Cursor) it has left its lane. U delegates and monitors.
- **Reversible/safe by default.** Remote spawning rides the existing whitelist + opt-in
  `remote:command` scope + audit; no arbitrary remote shell.
- **Agnostic by construction.** Never hard-code one model or one harness. New executors are config
  (`YOU_HARNESS_*` / a capability map), not forks.
- **No user homework.** U launching/monitoring/reporting is the point — the human watches, U works.

---

## 4. Usage (today)

```bash
# manual conducting (works now, no LLM):
you orchestrate spawn "implement the linux daemon tests" --harness claude --project youmd
you orchestrate list
you orchestrate logs <id>
you orchestrate stop <id>

# autonomous delegation (reuses the you.md chat proxy / your OpenRouter key):
you orchestrate run "check my youmd PR is green and have a worker fix any lint failures"
```
