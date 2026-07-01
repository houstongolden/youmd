/**
 * Tests for the orchestrator loop's tolerant tool-call parsing and bounded retry on
 * unparseable model replies.
 */
import { describe, expect, it } from "vitest";
import { parseToolCall, runAgentLoop } from "../lib/orchestrator/loop";

describe("parseToolCall", () => {
  it("parses a clean JSON object", () => {
    expect(parseToolCall('{"tool":"list_agents","args":{}}')?.tool).toBe("list_agents");
  });

  it("parses inside ```json fences", () => {
    expect(parseToolCall('```json\n{"tool":"finish","args":{"summary":"ok"}}\n```')?.tool).toBe("finish");
  });

  it("parses JSON that follows prose (the naive first-{ to last-} slice failed here)", () => {
    const reply = 'Sure, here is the plan {step 1 do x}. {"tool":"spawn_agent","args":{"goal":"x"}}';
    const call = parseToolCall(reply);
    expect(call?.tool).toBe("spawn_agent");
    expect(call?.args.goal).toBe("x");
  });

  it("returns the first VALID tool object when multiple braces appear", () => {
    const reply = '{"notatool":1} then {"tool":"list_agents","args":{}}';
    expect(parseToolCall(reply)?.tool).toBe("list_agents");
  });

  it("returns null for replies with no JSON object", () => {
    expect(parseToolCall("I cannot do that")).toBeNull();
  });

  it("rejects an absurdly large tool-call object instead of parsing it", () => {
    const huge = JSON.stringify({ tool: "x", args: { blob: "a".repeat(300_000) } });
    expect(parseToolCall(huge)).toBeNull();
  });
});

describe("runAgentLoop model-call retry", () => {
  it("absorbs transient model failures and still completes", async () => {
    let attempts = 0;
    const callModel = async () => {
      attempts++;
      if (attempts <= 2) throw new Error("transient network blip");
      return JSON.stringify({ tool: "finish", args: { summary: "recovered" } });
    };
    const outcome = await runAgentLoop({
      goal: "g",
      tools: [],
      callModel,
      sleep: async () => {}, // no real backoff in tests
    });
    expect(attempts).toBe(3); // 2 failures + 1 success
    expect(outcome.finished).toBe(true);
    expect(outcome.summary).toBe("recovered");
  });

  it("gives up cleanly after exhausting retries", async () => {
    let attempts = 0;
    const callModel = async () => {
      attempts++;
      throw new Error("model down");
    };
    const outcome = await runAgentLoop({
      goal: "g",
      tools: [],
      callModel,
      maxModelRetries: 2,
      sleep: async () => {},
    });
    expect(attempts).toBe(3); // maxModelRetries + 1
    expect(outcome.finished).toBe(false);
    expect(outcome.summary).toContain("Model call failed");
  });
});

describe("runAgentLoop bounded retry", () => {
  it("stops after repeated unparseable replies instead of burning the whole step budget", async () => {
    let calls = 0;
    const callModel = async () => {
      calls++;
      return "no json here, just prose";
    };
    const outcome = await runAgentLoop({
      goal: "do something",
      tools: [{ name: "noop", description: "", parameters: {}, run: async () => "ok" }],
      callModel,
      maxSteps: 12,
    });
    expect(outcome.finished).toBe(false);
    // 2-failure guard → at most 2 model calls, far below maxSteps.
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("runs a scripted tool then finishes", async () => {
    const script = [
      JSON.stringify({ tool: "noop", args: {} }),
      JSON.stringify({ tool: "finish", args: { summary: "done" } }),
    ];
    let i = 0;
    const outcome = await runAgentLoop({
      goal: "g",
      tools: [{ name: "noop", description: "", parameters: {}, run: async () => "result" }],
      callModel: async () => script[i++],
      maxSteps: 5,
    });
    expect(outcome.finished).toBe(true);
    expect(outcome.summary).toBe("done");
    expect(outcome.steps).toHaveLength(1);
  });

  it("accepts model-chosen tool aliases and records the canonical tool name", async () => {
    const script = [
      JSON.stringify({ tool: "list_synced_machines", args: {} }),
      JSON.stringify({ tool: "finish", args: { summary: "machines checked" } }),
    ];
    let i = 0;
    const outcome = await runAgentLoop({
      goal: "check machines",
      tools: [
        {
          name: "list_machines",
          aliases: ["list_synced_machines"],
          description: "",
          parameters: {},
          run: async () => "Houstons-Mini.lan — warn",
        },
      ],
      callModel: async () => script[i++],
      maxSteps: 5,
    });
    expect(outcome.finished).toBe(true);
    expect(outcome.steps[0]?.tool).toBe("list_machines");
    expect(outcome.steps[0]?.result).toContain("Houstons-Mini.lan");
  });
});
