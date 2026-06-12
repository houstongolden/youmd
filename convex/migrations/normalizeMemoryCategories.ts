/**
 * Normalize memory categories migration (P15).
 *
 * Memory categories were historically written by several surfaces with
 * different vocabularies: the hosted save_memory tool used
 * ["identity", "work", "preferences", "goals", "context"], the CLI MCP and
 * chat compactor used the canonical singular forms, and nothing validated
 * writes. This migration rewrites every stored `memories.category` to the
 * canonical form defined in convex/lib/memoryCategories.ts:
 *
 *   - canonical values (after trim/lowercase) are kept as-is
 *   - known legacy aliases map to canonical (identity→fact, work→project,
 *     preferences→preference, goals→goal, plurals, synonyms — see
 *     LEGACY_CATEGORY_ALIASES)
 *   - UNKNOWN values are mapped to DEFAULT_MEMORY_CATEGORY ("insight"),
 *     counted per raw value, and reported via console.warn + the migration
 *     report. Content is never dropped.
 *
 * When a row's category changes and the row already carries a P23
 * contentHash, the hash is recomputed (it covers normalized content +
 * category) so dedupe stays truthful. Rows without a contentHash stay
 * without one — pre-P23 rows never dedupe-match by design.
 *
 * Idempotent: re-running scans again, finds every category canonical, and
 * changes nothing.
 *
 * Run once after deploy:
 *   npx convex run --prod migrations/normalizeMemoryCategories:normalize
 */

import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  DEFAULT_MEMORY_CATEGORY,
  normalizeMemoryCategory,
} from "../lib/memoryCategories";
import { computeMemoryContentHash } from "../lib/hash";

const BATCH_SIZE = 200;

interface MigrationReport {
  scanned: number;
  normalized: number;
  /** raw value → { to: canonical, count } for recognized legacy variants. */
  mapped: Record<string, { to: string; count: number }>;
  /** raw value → count for unknown values defaulted to "insight". */
  defaulted: Record<string, number>;
}

// Follows the canonicalizeUsernames pattern: the table walk lives in ONE
// internalMutation (single paginated query stream over `memories`),
// orchestrated by an internalAction so the whole migration is one CLI call.
export const normalizeMemoriesTable = internalMutation({
  args: {},
  handler: async (ctx): Promise<MigrationReport> => {
    let scanned = 0;
    let normalized = 0;
    const mapped: MigrationReport["mapped"] = {};
    const defaulted: MigrationReport["defaulted"] = {};
    let cursor: string | null = null;

    for (;;) {
      const page = await ctx.db
        .query("memories")
        .paginate({ cursor, numItems: BATCH_SIZE });

      for (const doc of page.page) {
        scanned++;
        const raw = String(doc.category ?? "");
        const { category, changed, recognized } = normalizeMemoryCategory(raw);
        if (!changed) continue;

        const patch: { category: string; contentHash?: string } = { category };
        // The dedupe hash covers category — keep it truthful for rows that
        // already have one (P23). Pre-P23 rows keep no hash.
        if (doc.contentHash) {
          patch.contentHash = await computeMemoryContentHash(
            doc.content,
            category
          );
        }
        await ctx.db.patch(doc._id, patch);
        normalized++;

        if (recognized) {
          const entry = mapped[raw] ?? { to: category, count: 0 };
          entry.count++;
          mapped[raw] = entry;
        } else {
          defaulted[raw] = (defaulted[raw] ?? 0) + 1;
          console.warn(
            `[normalizeMemoryCategories] unknown category "${raw}" on ${doc._id} — ` +
              `defaulted to "${DEFAULT_MEMORY_CATEGORY}" (content preserved)`
          );
        }
      }

      if (page.isDone) break;
      cursor = page.continueCursor;
    }

    return { scanned, normalized, mapped, defaulted };
  },
});

export const normalize = internalAction({
  handler: async (ctx): Promise<MigrationReport> => {
    return await ctx.runMutation(
      internal.migrations.normalizeMemoryCategories.normalizeMemoriesTable,
      {}
    );
  },
});
