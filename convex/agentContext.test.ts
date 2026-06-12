/**
 * assembleAgentContext contract tests (T3 — convex-side anchor).
 *
 * convex/lib/agentContext.ts is the canonical, pure assembly imported by
 * the hosted MCP (convex/http.ts), the /ctx link handler, and the web You
 * Agent prompt builder. The CLI keeps a mirrored copy guarded by
 * cli/src/__tests__/agent-context-parity.test.ts; this suite is the
 * convex-side anchor that pins the canonical behavior itself (fixtures
 * mirror the parity test so both suites describe the same person).
 */
import { describe, expect, it } from "vitest";

import {
  AGENT_CONTEXT_MEMORY_CAP,
  DURABLE_MEMORY_CATEGORIES,
  IDENTITY_SUMMARY_MAX_CHARS,
  assembleAgentContext,
  extractIdentityCore,
  memoryOneLine,
  orderAgentMemories,
  renderIdentitySummary,
  selectPrivateContextFields,
  selectPublicIdentityFields,
  type AgentContextMemory,
} from "./lib/agentContext";
import {
  DURABLE_MEMORY_CATEGORIES as FULL_DURABLE_MEMORY_CATEGORIES,
  MIRROR_PARITY_DURABLE_CATEGORIES,
} from "./lib/memoryCategories";

// ─── Fixtures (mirrored from cli/src/__tests__/agent-context-parity.test.ts) ─

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
function mixedMemories(): AgentContextMemory[] {
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

// ─── Constants ───────────────────────────────────────────────────────────────

describe("agent context — canonical constants", () => {
  it("memory cap is 20", () => {
    expect(AGENT_CONTEXT_MEMORY_CAP).toBe(20);
  });

  it("exported durable set stays FROZEN at preference/decision/goal/fact for CLI mirror parity", () => {
    // cli/src/__tests__/agent-context-parity.test.ts compares this export
    // against the published CLI mirror's set — it must not grow until the
    // CLI mirror adopts `correction` in a follow-up release.
    expect(Array.from(DURABLE_MEMORY_CATEGORIES).sort()).toEqual([
      "decision",
      "fact",
      "goal",
      "preference",
    ]);
    expect(DURABLE_MEMORY_CATEGORIES).toBe(MIRROR_PARITY_DURABLE_CATEGORIES);
  });

  it("the FULL durable set (lib/memoryCategories) additionally includes correction", () => {
    expect(Array.from(FULL_DURABLE_MEMORY_CATEGORIES).sort()).toEqual([
      "correction",
      "decision",
      "fact",
      "goal",
      "preference",
    ]);
  });
});

// ─── Memory ordering + cap ───────────────────────────────────────────────────

describe("agent context — memory ordering and cap", () => {
  it("orders durable categories first, preserving newest-first within groups", () => {
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

  it("caps assembled memories at 20, durable filling the cap first", () => {
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
    // Durable memories win the cap even though ephemeral ones are newer.
    expect(assembled.memories.items.every((m) => m.category === "preference")).toBe(
      true
    );
    expect(assembled.memories.items[0].content).toBe("durable 0");
  });

  // ── P14: pinned / importance / superseded ordering semantics ──

  it("treats the new correction category as durable in ordering", () => {
    const ordered = orderAgentMemories([
      { category: "context", content: "ephemeral", createdAt: 100 },
      { category: "correction", content: "actually based in Miami, not Austin", createdAt: 90 },
    ]);
    expect(ordered.map((m) => m.category)).toEqual(["correction", "context"]);
  });

  it("pinned memories sort first, even ahead of durable categories", () => {
    const ordered = orderAgentMemories([
      { category: "preference", content: "durable newest", createdAt: 100 },
      { category: "context", content: "pinned ephemeral", createdAt: 90, pinned: true },
      { category: "fact", content: "durable older", createdAt: 80 },
    ]);
    expect(ordered.map((m) => m.content)).toEqual([
      "pinned ephemeral",
      "durable newest",
      "durable older",
    ]);
  });

  it("pinned memories NEVER fall out of the cap", () => {
    const many: AgentContextMemory[] = [];
    for (let i = 0; i < 40; i++) {
      many.push({ category: "preference", content: `durable ${i}`, createdAt: 1000 - i });
    }
    // Pinned ephemeral note buried at the bottom of a newest-first list.
    many.push({ category: "context", content: "pinned note", createdAt: 1, pinned: true });

    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      memories: many,
    });
    expect(assembled.memories.items).toHaveLength(AGENT_CONTEXT_MEMORY_CAP);
    expect(assembled.memories.items[0].content).toBe("pinned note");
  });

  it("orders by importance desc within a tier, then input order (recency)", () => {
    const ordered = orderAgentMemories([
      { category: "fact", content: "newest no-importance", createdAt: 100 },
      { category: "fact", content: "older important", createdAt: 90, importance: 5 },
      { category: "fact", content: "older mid", createdAt: 80, importance: 3 },
      { category: "fact", content: "oldest no-importance", createdAt: 70 },
    ]);
    expect(ordered.map((m) => m.content)).toEqual([
      "older important",
      "older mid",
      "newest no-importance",
      "oldest no-importance",
    ]);
  });

  it("keeps legacy ordering byte-identical for rows without the new fields", () => {
    // Same fixture the CLI parity test freezes — durable-first stable
    // partition, input order within groups. P14 must not change this.
    const ordered = orderAgentMemories(mixedMemories());
    expect(ordered.map((m) => m.content)).toEqual([
      "prefers terminal-native UI",
      "chose burnt orange accent",
      "launch you.md",
      "based in Miami",
      "talked about launch",
      "was debugging convex",
      "ships fast",
      "working on hubify",
    ]);
  });

  it("excludes superseded memories from the assembled brief", () => {
    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      memories: [
        { category: "fact", content: "lives in Miami", createdAt: 100 },
        { category: "fact", content: "lives in Austin", createdAt: 90, supersededBy: "mem_new" },
      ],
    });
    expect(assembled.memories.items.map((m) => m.content)).toEqual(["lives in Miami"]);
  });

  it("includeMemories=false strips items but flags the exclusion", () => {
    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      memories: mixedMemories(),
      includeMemories: false,
    });
    expect(assembled.memories.included).toBe(false);
    expect(assembled.memories.items).toEqual([]);
  });

  it("defaults to including memories and tolerates null/missing memories", () => {
    const assembled = assembleAgentContext({ username: "houston", youJson: YOU_JSON });
    expect(assembled.memories.included).toBe(true);
    expect(assembled.memories.items).toEqual([]);
  });
});

// ─── Identity core extraction ────────────────────────────────────────────────

describe("agent context — identity core extraction", () => {
  it("extracts the canonical fields from a you-md/v1 bundle", () => {
    expect(extractIdentityCore(YOU_JSON, "houston")).toEqual({
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
    expect(extractIdentityCore({}, "houston").name).toBe("houston");
  });

  it("falls back to bio.short for role when tagline is missing", () => {
    const core = extractIdentityCore(
      { identity: { name: "H", bio: { short: "growth pioneer" } } },
      "houston"
    );
    expect(core.role).toBe("growth pioneer");
  });

  it("handles a null bundle without throwing", () => {
    expect(extractIdentityCore(null, null)).toEqual({
      name: "",
      role: "",
      location: "",
      stack: "",
      tone: "",
      avoid: [],
      topProjects: [],
      goal: "",
    });
  });

  it("renders the compact summary within the 500-char budget", () => {
    const summary = renderIdentitySummary(extractIdentityCore(YOU_JSON, "houston"));
    expect(summary).toContain("Name: Houston Golden");
    expect(summary).toContain("Top projects: you.md, hubify, bamf.ai");
    expect(summary.length).toBeLessThanOrEqual(IDENTITY_SUMMARY_MAX_CHARS);
  });

  it("truncates oversized summaries with an ellipsis", () => {
    const summary = renderIdentitySummary(
      extractIdentityCore(
        {
          identity: { name: "x".repeat(600) },
        },
        "houston"
      )
    );
    expect(summary.length).toBe(IDENTITY_SUMMARY_MAX_CHARS);
    expect(summary.endsWith("...")).toBe(true);
  });

  it("assembleAgentContext exposes the same summary the whoami tools render", () => {
    const assembled = assembleAgentContext({ username: "houston", youJson: YOU_JSON });
    expect(assembled.identitySummary).toBe(
      renderIdentitySummary(extractIdentityCore(YOU_JSON, "houston"))
    );
  });
});

// ─── memoryOneLine ───────────────────────────────────────────────────────────

describe("agent context — memoryOneLine", () => {
  it("collapses whitespace to a single line", () => {
    expect(memoryOneLine("multi\nline\n\n  content\twith   whitespace")).toBe(
      "multi line content with whitespace"
    );
  });

  it("caps at 200 chars with an ellipsis", () => {
    const out = memoryOneLine("x".repeat(400));
    expect(out.length).toBe(200);
    expect(out.endsWith("…")).toBe(true);
  });
});

// ─── Field selectors ─────────────────────────────────────────────────────────

describe("agent context — field selectors", () => {
  it("selectPublicIdentityFields exposes exactly the nine public sections", () => {
    expect(Object.keys(selectPublicIdentityFields(YOU_JSON)).sort()).toEqual([
      "agent_directives",
      "identity",
      "links",
      "meta",
      "now",
      "preferences",
      "projects",
      "values",
      "voice",
    ]);
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
    expect(selectPrivateContextFields(undefined)).toBeNull();
  });

  it("assembleAgentContext never leaks unselected privateContext columns", () => {
    const assembled = assembleAgentContext({
      username: "houston",
      youJson: YOU_JSON,
      privateContext: { _id: "row", userId: "u1", privateNotes: "n" },
    });
    expect(assembled.privateContext).not.toBeNull();
    expect(Object.keys(assembled.privateContext!)).not.toContain("_id");
    expect(Object.keys(assembled.privateContext!)).not.toContain("userId");
    expect(assembled.privateContext!.privateNotes).toBe("n");
  });
});

// ─── Top-level assembly shape ────────────────────────────────────────────────

describe("agent context — assembly shape", () => {
  it("normalizes username/plan to null and sorts installedSkills", () => {
    const assembled = assembleAgentContext({
      youJson: null,
      installedSkills: ["zeta", "alpha", "mid"],
    });
    expect(assembled.username).toBeNull();
    expect(assembled.plan).toBeNull();
    expect(assembled.privateContext).toBeNull();
    expect(assembled.installedSkills).toEqual(["alpha", "mid", "zeta"]);
    expect(assembled.youJson).toEqual({});
  });
});
