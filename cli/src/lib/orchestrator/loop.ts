// loop.ts — the iterative agent loop for the You agent orchestrator.
//
// This is the one genuinely net-new piece the audit identified: every existing path in the
// CLI is single-hop (route -> run -> template-summarize -> stop). This closes the loop:
// the model picks a tool, we run it, feed the result back, and repeat until the model calls
// `finish`. It is model-agnostic (the model caller is injected) and tool-agnostic (tools are
// a registry of typed handlers), so the same loop drives orchestrator tools, brain tools, or
// remote-machine tools without change.
//
// The loop deliberately stays small and uses a JSON tool-call convention over plain chat
// completions, so it works against the existing /api/v1/chat proxy without needing native
// provider tool_use. That keeps the You agent harness/model-agnostic by construction.

export interface LoopTool {
  name: string;
  /** Natural names real models may choose for the same deterministic tool. */
  aliases?: string[];
  description: string;
  /** Human-readable parameter hints, e.g. { harness: "claude|codex|cursor", goal: "task text" }. */
  parameters: Record<string, string>;
  run: (args: Record<string, unknown>) => Promise<string>;
}

export interface LoopMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Injected model caller — returns the assistant's raw text for a message list. */
export type ModelCaller = (messages: LoopMessage[]) => Promise<string>;

export interface LoopStep {
  index: number;
  tool: string;
  args: Record<string, unknown>;
  result: string;
  thought?: string;
}

export interface RunLoopOptions {
  goal: string;
  tools: LoopTool[];
  callModel: ModelCaller;
  maxSteps?: number;
  /** Extra orientation injected into the system prompt (identity, machine, fleet state). */
  context?: string;
  /** Progress callback per step (for spinner/log output). */
  onStep?: (step: LoopStep) => void;
  /**
   * Transient model-call failures to absorb before giving up on a step (real LLM APIs hiccup;
   * one network blip shouldn't abandon the whole goal). Default 2 retries → 3 attempts total.
   */
  maxModelRetries?: number;
  /** Injectable sleep (so tests don't wait on real backoff). Defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

export interface LoopOutcome {
  finished: boolean;
  summary: string;
  steps: LoopStep[];
}

interface ToolCall {
  thought?: string;
  tool: string;
  args: Record<string, unknown>;
}

const FINISH_TOOL = "finish";

function buildSystemPrompt(goal: string, tools: LoopTool[], context?: string): string {
  const toolDocs = tools
    .map((t) => {
      const params = Object.entries(t.parameters)
        .map(([k, v]) => `      - ${k}: ${v}`)
        .join("\n");
      const aliases = t.aliases?.length ? ` (aliases: ${t.aliases.join(", ")})` : "";
      return `  - ${t.name}${aliases}: ${t.description}${params ? `\n${params}` : ""}`;
    })
    .join("\n");

  return [
    "You are U — Houston's personal master ORCHESTRATOR agent (U = the ultimate orchestrator, a role, not a person).",
    "You do NOT write code or do the work yourself. You are model- and harness-agnostic: you",
    "route work to the best worker agent (Claude Code for coding, etc.), launch and monitor",
    "them across machines and projects, and report back. You are project-goal and task oriented.",
    context ? `\nContext:\n${context}` : "",
    "\nYou work in a loop. On EACH turn you call exactly one tool by replying with ONLY a JSON",
    "object (no prose, no markdown fences) of the form:",
    '  {"thought": "<one short sentence of reasoning>", "tool": "<tool_name>", "args": { ... }}',
    "\nAvailable tools:",
    toolDocs,
    `  - ${FINISH_TOOL}: end the loop and report back. args: { summary: "what you did / found, for Houston" }`,
    "\nRules:",
    "- Reply with ONE json object and nothing else.",
    "- Prefer delegating to a worker harness over doing work yourself.",
    `- When the goal is met (or blocked), call ${FINISH_TOOL} with a clear summary.`,
    `- Do not loop forever; if stuck, call ${FINISH_TOOL} and explain what is blocked.`,
    `\nGoal: ${goal}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function toolCallFromObject(obj: Record<string, unknown>): ToolCall | null {
  if (typeof obj.tool !== "string") return null;
  const args = obj.args && typeof obj.args === "object" ? (obj.args as Record<string, unknown>) : {};
  return {
    thought: typeof obj.thought === "string" ? obj.thought : undefined,
    tool: obj.tool,
    args,
  };
}

/**
 * Extract a tool call from a model reply, tolerating prose around/between JSON, code fences, and
 * multiple objects. Scans for every balanced `{…}` span and returns the first that parses to an
 * object with a string `tool` — so "Sure! {…prose…} {\"tool\":…}" still works (the naive
 * first-`{`-to-last-`}` slice would fail on that).
 */
/** Reject absurdly large candidate JSON before parsing — a sane tool call is small, and a
 * multi-hundred-KB span is either junk or a runaway response we don't want to parse/echo. */
const MAX_TOOL_CALL_CHARS = 256_000;

export function parseToolCall(raw: string): ToolCall | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Whole-string fast path.
  if (text.length <= MAX_TOOL_CALL_CHARS) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const call = toolCallFromObject(obj);
      if (call) return call;
    } catch {
      /* fall through to span scan */
    }
  }

  // Scan for balanced {…} spans (string-aware) and try each.
  let depth = 0;
  let startIdx = -1;
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") {
      if (depth === 0) startIdx = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && startIdx !== -1) {
          const candidate = text.slice(startIdx, i + 1);
          if (candidate.length > MAX_TOOL_CALL_CHARS) {
            startIdx = -1;
            continue;
          }
          try {
            const obj = JSON.parse(candidate) as Record<string, unknown>;
            const call = toolCallFromObject(obj);
            if (call) return call;
          } catch {
            /* try next span */
          }
          startIdx = -1;
        }
      }
    }
  }
  return null;
}

function truncate(s: string, max = 4000): string {
  return s.length > max ? s.slice(0, max) + `\n…[truncated ${s.length - max} chars]` : s;
}

/**
 * Run the orchestrator loop until the model calls `finish` or maxSteps is hit.
 * Each step: ask the model for a tool call → run it → append the result → repeat.
 */
export async function runAgentLoop(options: RunLoopOptions): Promise<LoopOutcome> {
  const { goal, tools, callModel, context } = options;
  const maxSteps = options.maxSteps ?? 12;
  const maxModelRetries = options.maxModelRetries ?? 2;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const toolByName = new Map<string, LoopTool>();
  for (const tool of tools) {
    toolByName.set(tool.name, tool);
    for (const alias of tool.aliases ?? []) toolByName.set(alias, tool);
  }

  // Absorb transient model-call failures (timeouts, 5xx, socket resets) with bounded
  // exponential backoff. Real LLM/proxy endpoints hiccup; a single blip shouldn't abandon
  // the whole goal mid-run. Throws the last error only after every attempt fails.
  const callModelWithRetry = async (msgs: LoopMessage[]): Promise<string> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxModelRetries; attempt++) {
      try {
        return await callModel(msgs);
      } catch (err) {
        lastErr = err;
        if (attempt < maxModelRetries) await sleep(Math.min(250 * 2 ** attempt, 4000));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };

  const messages: LoopMessage[] = [
    { role: "system", content: buildSystemPrompt(goal, tools, context) },
    { role: "user", content: `Begin. Goal: ${goal}` },
  ];

  const steps: LoopStep[] = [];
  let consecutiveParseFailures = 0;
  const MAX_PARSE_FAILURES = 2;
  // Safety net for high maxSteps: each step appends 1-2 messages, so a long/stuck run could
  // grow the context unboundedly. Stop cleanly well before that becomes a token problem.
  const MAX_MESSAGES = 256;

  for (let i = 0; i < maxSteps; i++) {
    if (messages.length > MAX_MESSAGES) {
      return {
        finished: false,
        summary: `Stopped: conversation grew past ${MAX_MESSAGES} messages without finishing (likely stuck). Narrow the goal or run again.`,
        steps,
      };
    }

    let reply: string;
    try {
      reply = await callModelWithRetry(messages);
    } catch (err) {
      return {
        finished: false,
        summary: `Model call failed at step ${i + 1} after ${maxModelRetries + 1} attempt(s): ${(err as Error).message}`,
        steps,
      };
    }

    const call = parseToolCall(reply);
    if (!call) {
      // Model didn't emit a valid tool call — nudge, but bail after a couple of failures so a
      // model that can't produce JSON doesn't silently burn the whole step budget.
      consecutiveParseFailures++;
      if (consecutiveParseFailures >= MAX_PARSE_FAILURES) {
        return {
          finished: false,
          summary: `Stopped: the model did not return a valid tool call after ${MAX_PARSE_FAILURES} tries. Last reply: ${reply.slice(0, 200)}`,
          steps,
        };
      }
      messages.push({ role: "assistant", content: reply });
      messages.push({
        role: "user",
        content:
          'That was not a valid tool call. Reply with ONLY a json object: {"thought":"...","tool":"...","args":{...}}.',
      });
      continue;
    }
    consecutiveParseFailures = 0;

    messages.push({ role: "assistant", content: JSON.stringify(call) });

    if (call.tool === FINISH_TOOL) {
      const summary =
        typeof call.args.summary === "string" && call.args.summary.trim()
          ? (call.args.summary as string)
          : "Done.";
      return { finished: true, summary, steps };
    }

    const tool = toolByName.get(call.tool);
    let result: string;
    if (!tool) {
      result = `error: unknown tool "${call.tool}". Available: ${tools.map((t) => t.name).join(", ")}, ${FINISH_TOOL}.`;
    } else {
      try {
        result = await tool.run(call.args);
      } catch (err) {
        result = `error running ${call.tool}: ${(err as Error).message}`;
      }
    }

    const step: LoopStep = { index: i, tool: tool?.name ?? call.tool, args: call.args, result, thought: call.thought };
    steps.push(step);
    options.onStep?.(step);

    messages.push({
      role: "user",
      content: `Result of ${call.tool}:\n${truncate(result)}\n\nChoose the next tool (or ${FINISH_TOOL}).`,
    });
  }

  return {
    finished: false,
    summary: `Reached the ${maxSteps}-step limit without finishing. Last activity is in the step log; consider a narrower goal or running again.`,
    steps,
  };
}
