/**
 * Canonical agent-context assembly (PRODUCT-AUDIT #3 / FEATURE-ROADMAP 2.1).
 *
 * Every surface that introduces the user to an agent — the hosted MCP
 * (whoami / get_agent_brief / get_identity in convex/http.ts), the /ctx
 * context-link handler (convex/contextLinks.ts + convex/http.ts), and the
 * web You Agent system prompt (src/hooks/agent-utils.ts) — must draw the
 * same identity core, the same memory ordering, and the same memory cap
 * from this module. The CLI stdio MCP (cli/src/mcp/server.ts) is a separate
 * npm package and keeps a mirrored copy; cli/src/__tests__/
 * agent-context-parity.test.ts asserts that mirror never drifts.
 *
 * DESIGN: this module is PURE and dependency-free on purpose.
 * - No auth inside — callers pass only the data their scopes allow.
 * - No Convex imports — so it is importable from convex server functions,
 *   Next.js client code (src/hooks), and the CLI vitest suite alike.
 * Callers load raw rows however their context allows (ctx.runQuery,
 * ctx.db, useQuery) and hand them to `assembleAgentContext`.
 */

// ─── Canonical constants ─────────────────────────────────────────────────────

/** Max memories any surface renders into an agent-facing context block. */
export const AGENT_CONTEXT_MEMORY_CAP = 20;

/** Categories considered durable — surfaced ahead of newer ephemeral notes. */
export const DURABLE_MEMORY_CATEGORIES: ReadonlySet<string> = new Set([
  "preference",
  "decision",
  "goal",
  "fact",
]);

/** Char budget for the compact identity summary (whoami / brief header). */
export const IDENTITY_SUMMARY_MAX_CHARS = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentContextMemory = {
  category: string;
  content: string;
  source?: string | null;
  sourceAgent?: string | null;
  tags?: string[];
  createdAt?: number;
};

/** The identity fields every surface agrees on — the "same version of you". */
export type AgentIdentityCore = {
  /** identity.name, falling back to the username when absent. */
  name: string;
  /** identity.tagline, falling back to bio.short. */
  role: string;
  location: string;
  /** agent_directives.default_stack */
  stack: string;
  /** preferences.agent.tone */
  tone: string;
  /** preferences.agent.avoid */
  avoid: string[];
  /** First 3 project names. */
  topProjects: string[];
  /** agent_directives.current_goal */
  goal: string;
};

export type AssembleAgentContextInput = {
  username?: string | null;
  plan?: string | null;
  youJson: Record<string, unknown> | null;
  /** Raw memories, expected newest-first (memories.listMemories order). */
  memories?: AgentContextMemory[] | null;
  /** Default true. When false, memories are stripped but flagged. */
  includeMemories?: boolean;
  /**
   * Private context row — pass ONLY when the caller's scope allows it
   * (full-scope /ctx link, read:private API key). No auth happens here.
   */
  privateContext?: Record<string, unknown> | null;
  installedSkills?: string[] | null;
};

export type AssembledAgentContext = {
  username: string | null;
  plan: string | null;
  identityCore: AgentIdentityCore;
  /** Canonical compact summary (≤ IDENTITY_SUMMARY_MAX_CHARS). */
  identitySummary: string;
  youJson: Record<string, unknown>;
  memories: {
    included: boolean;
    /** Durable-first, newest-first within group, capped. */
    items: AgentContextMemory[];
  };
  privateContext: Record<string, unknown> | null;
  installedSkills: string[];
};

// ─── Small helpers ───────────────────────────────────────────────────────────

/** Narrow unknown to a plain record (canonical `briefRecord`). */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Canonical memory ordering: durable categories first, preserving input
 * order (newest-first) within each group. Stable partition.
 */
export function orderAgentMemories(
  memories: AgentContextMemory[]
): AgentContextMemory[] {
  const durable: AgentContextMemory[] = [];
  const rest: AgentContextMemory[] = [];
  for (const memory of memories) {
    (DURABLE_MEMORY_CATEGORIES.has(memory.category) ? durable : rest).push(memory);
  }
  return [...durable, ...rest];
}

/** Collapse memory content to a single line capped at `max` chars. */
export function memoryOneLine(content: string, max = 200): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max - 1).trimEnd()}…` : collapsed;
}

// ─── Identity core ───────────────────────────────────────────────────────────

/**
 * Extract the canonical identity core from a you-md/v1 youJson bundle.
 * Field selection mirrors what the local stdio MCP's buildWhoamiSummary
 * uses, so agents get the same person regardless of transport.
 */
export function extractIdentityCore(
  youJson: Record<string, unknown> | null,
  username?: string | null
): AgentIdentityCore {
  const bundle = asRecord(youJson);
  const identity = asRecord(bundle.identity);
  const preferences = asRecord(bundle.preferences);
  const agentPrefs = asRecord(preferences.agent);
  const directives = asRecord(bundle.agent_directives);
  const projects = Array.isArray(bundle.projects) ? bundle.projects : [];

  const bio = asRecord(identity.bio);
  const name =
    typeof identity.name === "string" && identity.name
      ? identity.name
      : username || "";
  const role =
    typeof identity.tagline === "string" && identity.tagline
      ? identity.tagline
      : typeof bio.short === "string"
        ? bio.short
        : "";
  const location = typeof identity.location === "string" ? identity.location : "";
  const stack =
    typeof directives.default_stack === "string" ? directives.default_stack : "";
  const tone = typeof agentPrefs.tone === "string" ? agentPrefs.tone : "";
  const avoid = Array.isArray(agentPrefs.avoid)
    ? agentPrefs.avoid.filter((item): item is string => typeof item === "string")
    : [];
  const topProjects = projects
    .slice(0, 3)
    .map((project) => {
      if (typeof project === "string") return project;
      const record = asRecord(project);
      return typeof record.name === "string" ? record.name : "";
    })
    .filter(Boolean);
  const goal =
    typeof directives.current_goal === "string" ? directives.current_goal : "";

  return { name, role, location, stack, tone, avoid, topProjects, goal };
}

/**
 * Render the canonical compact identity summary (hosted whoami output).
 * Byte-compatible with the previous buildHostedWhoamiSummary in http.ts.
 */
export function renderIdentitySummary(core: AgentIdentityCore): string {
  const lines: string[] = [];
  lines.push(`Name: ${core.name}`);
  if (core.role) lines.push(`Role: ${core.role}`);
  if (core.stack) lines.push(`Stack: ${core.stack}`);
  if (core.tone) lines.push(`Tone: ${core.tone}`);
  if (core.avoid.length > 0) lines.push(`Avoid: ${core.avoid.join(", ")}`);
  if (core.topProjects.length > 0)
    lines.push(`Top projects: ${core.topProjects.join(", ")}`);
  if (core.goal) lines.push(`Goal: ${core.goal}`);

  let summary = lines.join("\n");
  if (summary.length > IDENTITY_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, IDENTITY_SUMMARY_MAX_CHARS - 3) + "...";
  }
  return summary;
}

// ─── Field selectors (public bundle / private context) ───────────────────────

/**
 * Canonical public identity field selection for the hosted MCP get_identity
 * tool. One place decides which youJson sections agents see publicly.
 */
export function selectPublicIdentityFields(
  youJson: Record<string, unknown> | null
): Record<string, unknown> {
  const bundle = asRecord(youJson);
  return {
    identity: bundle.identity ?? null,
    projects: bundle.projects ?? null,
    values: bundle.values ?? null,
    voice: bundle.voice ?? null,
    agent_directives: bundle.agent_directives ?? null,
    preferences: bundle.preferences ?? null,
    links: bundle.links ?? null,
    now: bundle.now ?? null,
    meta: bundle.meta ?? null,
  };
}

/**
 * Canonical private-context field selection for full-scope surfaces
 * (/ctx full links, read:private callers). One place decides which
 * privateContext columns ever leave the database.
 */
export function selectPrivateContextFields(
  privateCtx: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!privateCtx) return null;
  return {
    privateNotes: privateCtx.privateNotes,
    privateProjects: privateCtx.privateProjects,
    internalLinks: privateCtx.internalLinks,
    calendarContext: privateCtx.calendarContext,
    communicationPrefs: privateCtx.communicationPrefs,
    customData: privateCtx.customData,
  };
}

// ─── The canonical assembly ──────────────────────────────────────────────────

/**
 * Assemble the ONE canonical agent context for a user. Pure — no auth, no
 * I/O. Callers load raw rows under their own scope rules and pass only what
 * the requesting agent is allowed to see (e.g. omit `privateContext` unless
 * the link/key has full/private scope).
 */
export function assembleAgentContext(
  input: AssembleAgentContextInput
): AssembledAgentContext {
  const youJson = asRecord(input.youJson);
  const username = input.username ?? null;
  const includeMemories = input.includeMemories !== false;

  const identityCore = extractIdentityCore(youJson, username);

  const items = includeMemories
    ? orderAgentMemories(input.memories ?? []).slice(0, AGENT_CONTEXT_MEMORY_CAP)
    : [];

  return {
    username,
    plan: input.plan ?? null,
    identityCore,
    identitySummary: renderIdentitySummary(identityCore),
    youJson,
    memories: { included: includeMemories, items },
    privateContext: selectPrivateContextFields(input.privateContext),
    installedSkills: [...(input.installedSkills ?? [])].sort(),
  };
}
