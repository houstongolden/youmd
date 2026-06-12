/**
 * Agent-context parity test (PRODUCT-AUDIT #3 / FEATURE-ROADMAP 2.1).
 *
 * The canonical assembly lives in convex/lib/agentContext.ts and is imported
 * directly by the hosted MCP (convex/http.ts), the /ctx link handler
 * (convex/contextLinks.ts), and the web You Agent prompt builder
 * (src/hooks/agent-utils.ts) — those surfaces are parity-by-construction.
 *
 * The CLI stdio MCP (cli/src/mcp/server.ts) is a separately published npm
 * package and keeps a mirrored implementation. This test imports BOTH the
 * canonical module and the CLI mirror and asserts they never drift on:
 * memory cap, durable-category set, memory ordering, one-line collapse,
 * and the compact identity summary.
 */
import { describe, expect, it } from "vitest";

import {
  AGENT_CONTEXT_MEMORY_CAP,
  DURABLE_MEMORY_CATEGORIES as CANONICAL_DURABLE,
  assembleAgentContext,
  extractIdentityCore,
  memoryOneLine,
  orderAgentMemories,
  renderIdentitySummary,
  selectPrivateContextFields,
  selectPublicIdentityFields,
  type AgentContextMemory,
} from "../../../convex/lib/agentContext";

import {
  AGENT_BRIEF_MEMORY_CAP,
  DURABLE_MEMORY_CATEGORIES as CLI_DURABLE,
  briefOneLine,
  buildWhoamiSummaryFromYouJson,
  orderBriefMemories,
  type BriefMemory,
} from "../mcp/server";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const YOU_JSON: Record<string, unknown> = {
  identity: {
    name: "Houston Golden",
    tagline: "founder, you.md",
    location: "Miami",
    bio: { short: "growth pioneer" },
  },
  preferences: {
    agent: { tone: "direct, no fluff", avoid: ["corporate speak", "emoji"] },
  },
  agent_directives: {
    default_stack: "next.js + convex",
    current_goal: "ship the identity protocol",
  },
  projects: [
    { name: "you.md", status: "active" },
    { name: "hubify" },
    "bamf.ai",
    { name: "fourth-should-be-dropped" },
  ],
  values: ["speed"],
  voice: { style: "dry" },
  links: { github: "https://github.com/houstongolden" },
  now: { focus: ["you.md launch"] },
  meta: { version: "you-md/v1" },
};

/** Newest-first mixed memories, like memories.listMemories returns. */
function mixedMemories(): AgentContextMemory[] & BriefMemory[] {
  return [
    { category: "session_summary", content: "talked about launch", createdAt: 100 },
    { category: "preference", content: "prefers terminal-native UI", createdAt: 90 },
    { category: "context", content: "was debugging convex", createdAt: 80 },
    { category: "decision", content: "chose burnt orange accent", createdAt: 70 },
    { category: "insight", content: "ships fast", createdAt: 60 },
    { category: "goal", content: "launch you.md", createdAt: 50 },
    { category: "fact", content: "based in Miami", createdAt: 40 },
    { category: "project", content: "working on hubify", createdAt: 30 },
  ];
}

// ─── Parity: constants ───────────────────────────────────────────────────────

describe("agent context parity — constants", () => {
  it("hosted/canonical and CLI memory caps are identical", () => {
    expect(AGENT_BRIEF_MEMORY_CAP).toBe(AGENT_CONTEXT_MEMORY_CAP);
    expect(AGENT_CONTEXT_MEMORY_CAP).toBe(20);
  });

  it("durable category sets are identical", () => {
    expect([...CLI_DURABLE].sort()).toEqual([...CANONICAL_DURABLE].sort());
  });
});

// ─── Parity: memory ordering + cap ───────────────────────────────────────────

describe("agent context parity — memory ordering", () => {
  it("CLI and canonical produce the same durable-first order", () => {
    const canonical = orderAgentMemories(mixedMemories());
    const cli = orderBriefMemories(mixedMemories());
    expect(cli.map((m) => m.content)).toEqual(canonical.map((m) => m.content));
  });

  it("orders durable categories first, newest-first within each group", () => {
    const ordered = orderAgentMemories(mixedMemories());
    expect(ordered.map((m) => m.category)).toEqual([
      // durable, in input (newest-first) order
      "preference",
      "decision",
      "goal",
      "fact",
      // ephemeral, in input order
      "session_summary",
      "context",
      "insight",
      "project",
    ]);
  });

  it("assembleAgentContext applies the canonical order and cap", () => {
    const many: AgentContextMemory[] = [];
    for (let i = 0; i < 30; i++) {
      many.push({ category: "context", content: `ephemeral ${i}`, createdAt: 1000 - i });
    }
    for (let i = 0; i < 30; i++) {
      many.push({ category: "preference", content: `durable ${i}`, createdAt: 500 - i });
    }

    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      memories: many,
    });

    expect(assembled.memories.included).toBe(true);
    expect(assembled.memories.items).toHaveLength(AGENT_CONTEXT_MEMORY_CAP);
    // Durable memories fill the cap even though ephemeral ones are newer.
    expect(assembled.memories.items.every((m) => m.category === "preference")).toBe(true);
    expect(assembled.memories.items[0].content).toBe("durable 0");

    // The CLI mirror slices the same way.
    const cliOrdered = orderBriefMemories(many as BriefMemory[]).slice(0, AGENT_BRIEF_MEMORY_CAP);
    expect(cliOrdered.map((m) => m.content)).toEqual(
      assembled.memories.items.map((m) => m.content)
    );
  });

  it("includeMemories=false strips items but flags exclusion", () => {
    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      memories: mixedMemories(),
      includeMemories: false,
    });
    expect(assembled.memories.included).toBe(false);
    expect(assembled.memories.items).toEqual([]);
  });
});

// ─── Parity: one-line collapse ───────────────────────────────────────────────

describe("agent context parity — one-line collapse", () => {
  it("CLI briefOneLine and canonical memoryOneLine are identical", () => {
    const samples = [
      "simple",
      "multi\nline\n\n  content\twith   whitespace",
      "x".repeat(400),
      `${"word ".repeat(60)}end`,
    ];
    for (const sample of samples) {
      expect(briefOneLine(sample)).toBe(memoryOneLine(sample));
    }
  });
});

// ─── Parity: identity core / summary ─────────────────────────────────────────

describe("agent context parity — identity core", () => {
  it("extractIdentityCore picks the canonical fields", () => {
    const core = extractIdentityCore(YOU_JSON, "houston");
    expect(core).toEqual({
      name: "Houston Golden",
      role: "founder, you.md",
      location: "Miami",
      stack: "next.js + convex",
      tone: "direct, no fluff",
      avoid: ["corporate speak", "emoji"],
      topProjects: ["you.md", "hubify", "bamf.ai"],
      goal: "ship the identity protocol",
    });
  });

  it("falls back to username when identity.name is missing", () => {
    const core = extractIdentityCore({}, "houston");
    expect(core.name).toBe("houston");
  });

  it("CLI whoami summary matches the canonical identity summary", () => {
    const canonical = renderIdentitySummary(extractIdentityCore(YOU_JSON, "houston"));
    const cli = buildWhoamiSummaryFromYouJson(YOU_JSON);
    expect(cli).toBe(canonical);
    expect(canonical).toContain("Name: Houston Golden");
    expect(canonical).toContain("Top projects: you.md, hubify, bamf.ai");
    expect(canonical.length).toBeLessThanOrEqual(500);
  });

  it("assembleAgentContext exposes the same summary the whoami tools render", () => {
    const assembled = assembleAgentContext({ username: "houston", youJson: YOU_JSON });
    expect(assembled.identitySummary).toBe(
      renderIdentitySummary(extractIdentityCore(YOU_JSON, "houston"))
    );
  });
});

// ─── Canonical field selectors (hosted get_identity + /ctx private scope) ────

describe("agent context — canonical field selectors", () => {
  it("selectPublicIdentityFields exposes exactly the public sections", () => {
    expect(Object.keys(selectPublicIdentityFields(YOU_JSON)).sort()).toEqual(
      [
        "agent_directives",
        "identity",
        "links",
        "meta",
        "now",
        "preferences",
        "projects",
        "values",
        "voice",
      ]
    );
  });

  it("selectPrivateContextFields only passes the six allowed columns", () => {
    const row = {
      _id: "secret-row-id",
      profileId: "secret-profile-id",
      privateNotes: "notes",
      privateProjects: ["p"],
      internalLinks: ["l"],
      calendarContext: "cal",
      communicationPrefs: "prefs",
      customData: { k: "v" },
    };
    expect(selectPrivateContextFields(row)).toEqual({
      privateNotes: "notes",
      privateProjects: ["p"],
      internalLinks: ["l"],
      calendarContext: "cal",
      communicationPrefs: "prefs",
      customData: { k: "v" },
    });
    expect(selectPrivateContextFields(null)).toBeNull();
  });
});
