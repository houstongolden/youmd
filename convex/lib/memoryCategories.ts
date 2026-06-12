/**
 * P15 — THE canonical memory-category module.
 *
 * Every surface that defines or assumes memory categories imports from here:
 * - convex/memories.ts (write-path validation in saveMemories / saveFromAgent /
 *   updateMemory)
 * - convex/lib/agentContext.ts (durable-first ordering)
 * - convex/http.ts (POST /api/v1/me/memories validation, save_memory tool enum)
 * - convex/chat.ts (compaction memory-extraction prompt)
 * - convex/migrations/normalizeMemoryCategories.ts (legacy-value cleanup)
 *
 * Contract:
 * - WRITES are strict: unknown categories are rejected (invalid_request
 *   envelope on HTTP, ConvexError in mutations). Known legacy aliases are
 *   normalized to canonical on write so old agents keep working.
 * - READS are tolerant: stored legacy values are never hidden or dropped —
 *   unknown categories simply order as ephemeral until the migration
 *   normalizes them.
 *
 * DESIGN: pure and dependency-free (like lib/agentContext.ts) so it is
 * importable from convex functions, migrations, and vitest alike.
 */

/** The canonical category list. `correction` is new in P15. */
export const MEMORY_CATEGORIES = [
  "fact",
  "insight",
  "decision",
  "preference",
  "context",
  "goal",
  "relationship",
  "project",
  "session_summary",
  "correction",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_SET: ReadonlySet<string> = new Set(MEMORY_CATEGORIES);

/**
 * Durable categories — these survive ordering decay and are surfaced ahead
 * of newer ephemeral notes in agent briefs. `correction` is durable on
 * purpose: corrections are exactly the memories that must persist.
 */
export const DURABLE_MEMORY_CATEGORIES: ReadonlySet<string> = new Set([
  "preference",
  "decision",
  "goal",
  "fact",
  "correction",
]);

/**
 * FROZEN mirror-parity durable set. The published CLI stdio MCP
 * (cli/src/mcp/server.ts) ships a mirrored DURABLE_MEMORY_CATEGORIES, and
 * cli/src/__tests__/agent-context-parity.test.ts asserts set equality with
 * the export from convex/lib/agentContext.ts. Until the CLI mirror adopts
 * `correction` (and pinned-first ordering) in a follow-up release,
 * agentContext keeps re-exporting THIS set. Do NOT extend this set — extend
 * DURABLE_MEMORY_CATEGORIES above.
 */
export const MIRROR_PARITY_DURABLE_CATEGORIES: ReadonlySet<string> = new Set([
  "preference",
  "decision",
  "goal",
  "fact",
]);

/**
 * Categories agents may write (tool enums, prompt builders). Excludes the
 * platform-internal `session_summary`, which only the compaction pipeline
 * produces.
 */
export const AGENT_WRITABLE_MEMORY_CATEGORIES: readonly MemoryCategory[] =
  MEMORY_CATEGORIES.filter((category) => category !== "session_summary");

/** Where unknown legacy values land during migration — reported, not dropped. */
export const DEFAULT_MEMORY_CATEGORY: MemoryCategory = "insight";

/**
 * Legacy/variant spellings observed in stored rows and old tool schemas.
 * The pre-P15 hosted save_memory tool enum was
 * ["identity", "work", "preferences", "goals", "context"]; plurals and a
 * few synonyms are mapped defensively.
 */
export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, MemoryCategory>> = {
  // pre-P15 hosted save_memory tool enum ("context" was already canonical)
  identity: "fact",
  work: "project",
  preferences: "preference",
  goals: "goal",
  // defensive plurals
  facts: "fact",
  insights: "insight",
  decisions: "decision",
  projects: "project",
  relationships: "relationship",
  corrections: "correction",
  contexts: "context",
  // defensive synonyms
  pref: "preference",
  note: "insight",
  notes: "insight",
  learning: "insight",
  observation: "insight",
};

/** True when `value` is exactly one of the canonical categories. */
export function isCanonicalMemoryCategory(value: string): value is MemoryCategory {
  return MEMORY_CATEGORY_SET.has(value);
}

/**
 * Resolve a raw category for WRITE paths: canonical values pass through,
 * known legacy aliases map to canonical, anything else returns null so the
 * caller can reject it (invalid_request / ConvexError). Trims + lowercases
 * before matching.
 */
export function resolveMemoryCategory(raw: unknown): MemoryCategory | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (isCanonicalMemoryCategory(value)) return value;
  return LEGACY_CATEGORY_ALIASES[value] ?? null;
}

/**
 * Normalize a stored category for MIGRATION / read-tolerant paths.
 * Unknown values fall back to DEFAULT_MEMORY_CATEGORY with
 * `recognized: false` so callers can report (never drop) them.
 */
export function normalizeMemoryCategory(raw: unknown): {
  category: MemoryCategory;
  /** true when the stored value differs from the canonical result. */
  changed: boolean;
  /** false when the value was unknown and fell back to the default. */
  recognized: boolean;
} {
  const resolved = resolveMemoryCategory(raw);
  if (resolved) {
    return { category: resolved, changed: resolved !== raw, recognized: true };
  }
  return { category: DEFAULT_MEMORY_CATEGORY, changed: true, recognized: false };
}

/** Human-readable rejection message shared by HTTP and mutation validation. */
export function invalidMemoryCategoryMessage(raw: unknown): string {
  const shown = typeof raw === "string" && raw.trim() ? raw.trim() : "(missing)";
  return `invalid memory category: ${shown}. valid categories: ${AGENT_WRITABLE_MEMORY_CATEGORIES.join(", ")}`;
}
