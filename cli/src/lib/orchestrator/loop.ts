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
      return `  - ${t.name}: ${t.description}${params ? `\n${params}` : ""}`;
    })
    .join("\n");

  return [
    "You are U — Houston's personal master ORCHESTRATOR agent.",
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

/** Extract the first JSON object from a model reply (tolerates stray prose / fences). */
export function parseToolCall(raw: string): ToolCall | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip code fences if the model added them despite instructions.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    const obj = JSON.parse(candidate) as Record<string, unknown>;
    if (typeof obj.tool !== "string") return null;
    const args =
      obj.args && typeof obj.args === "object" ? (obj.args as Record<string, unknown>) : {};
    return {
      thought: typeof obj.thought === "string" ? obj.thought : undefined,
      tool: obj.tool,
      args,
    };
  } catch {
    return null;
  }
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
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const messages: LoopMessage[] = [
    { role: "system", content: buildSystemPrompt(goal, tools, context) },
    { role: "user", content: `Begin. Goal: ${goal}` },
  ];

  const steps: LoopStep[] = [];

  for (let i = 0; i < maxSteps; i++) {
    let reply: string;
    try {
      reply = await callModel(messages);
    } catch (err) {
      return {
        finished: false,
        summary: `Model call failed at step ${i + 1}: ${(err as Error).message}`,
        steps,
      };
    }

    const call = parseToolCall(reply);
    if (!call) {
      // Model didn't emit a valid tool call — nudge once, then treat as finish.
      messages.push({ role: "assistant", content: reply });
      messages.push({
        role: "user",
        content:
          'That was not a valid tool call. Reply with ONLY a json object: {"thought":"...","tool":"...","args":{...}}.',
      });
      continue;
    }

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

    const step: LoopStep = { index: i, tool: call.tool, args: call.args, result, thought: call.thought };
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
