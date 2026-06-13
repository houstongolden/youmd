/**
 * L20 — Fleet learning (aggregate-only, k-anon ≥ 20).
 *
 * Privacy contract (stated in GLOBAL-EVOLUTION-ROADMAP.md, enforced here):
 * "Only event names and counters ever cross a user boundary — never memory
 * content, identity field values, prompts, or stack journals."
 *
 * Every aggregate in this file MUST pass through kAnonBucket(), which returns
 * null when the contributing user count is below K_ANON_FLOOR (20). The
 * output shape is restricted to counts, rates, and percentiles — no
 * usernames, user IDs, or content strings appear in any return value.
 *
 * Runs weekly (Sundays 10:00 UTC) via convex/crons.ts:
 *   weeklyFleetAggregation → all internal aggregate queries → one fleetReports row.
 *
 * See project-context/audits/2026-06-11/GLOBAL-EVOLUTION-ROADMAP.md
 * (Stage 3 — Privacy-first fleet learning) for design rationale.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

// ── K-anonymity floor ────────────────────────────────────────────────────────

/**
 * The minimum number of distinct contributing users required before an
 * aggregate is released. Below this threshold, kAnonBucket returns null.
 * Exported so tests can import and assert against it.
 */
export const K_ANON_FLOOR = 20;

/**
 * kAnonBucket — the privacy gate for every fleet aggregate.
 *
 * @param perUserValues  Array of per-user value lists. Each inner array is
 *                       one user's contribution. The LENGTH of the outer
 *                       array is the number of distinct contributing users
 *                       and is the value compared against K_ANON_FLOOR.
 * @param summarizer     A function that collapses all values into a summary.
 *                       Only called when the user count meets the floor.
 * @returns The summary, or null when too few users contributed.
 *
 * Usage:
 *   const result = kAnonBucket(perUserCounts, (xs) => {
 *     const flat = xs.flat();
 *     return { total: flat.reduce((a, b) => a + b, 0) };
 *   });
 */
export function kAnonBucket<T>(
  perUserValues: T[][],
  summarizer: (xs: T[][]) => unknown
): unknown | null {
  if (perUserValues.length < K_ANON_FLOOR) return null;
  return summarizer(perUserValues);
}

// ── Output types ─────────────────────────────────────────────────────────────

/**
 * Fleet metrics payload written to the fleetReports table.
 * null fields indicate k-anon suppression (< 20 distinct users).
 *
 * INVARIANT: this type must NOT contain any field whose value could be a
 * username, userId, or memory content string. Only names + counts.
 */
export interface FleetMetrics {
  /** Count of memories per category across the fleet.
   *  null when contributing user count < K_ANON_FLOOR for that category.
   *  Each entry: { category: string; totalMemories: number; userCount: number }
   */
  categoryDistribution: Array<{
    category: string;
    totalMemories: number;
    userCount: number;
  }> | null;

  /** Count of installs per skill name across the fleet.
   *  null when total distinct-user count < K_ANON_FLOOR.
   *  Entries with < K_ANON_FLOOR distinct installers are individually suppressed.
   */
  skillInstallCounts: Array<{
    skillName: string;
    installCount: number;
  }> | null;

  /** Average active-memory count per active user.
   *  null when active-user count < K_ANON_FLOOR.
   */
  avgMemoriesPerActiveUser: number | null;
}

// ── Internal aggregate queries ───────────────────────────────────────────────

/**
 * _categoryDistribution — per-category per-user memory counts for k-anon gating.
 *
 * Returns only category names and per-user counts — no userIds, no content.
 */
export const _categoryDistribution = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Fleet-wide scan — internal only, never a public endpoint.
    // Filters for active (non-archived, non-superseded) rows.
    const all = await ctx.db
      .query("memories")
      .collect();

    const active = all.filter((m) => !m.isArchived && !m.supersededBy);

    // category → userId → count  (no user-identifying data leaves this handler)
    const catUserCount = new Map<string, Map<string, number>>();
    for (const m of active) {
      const uid = m.userId as string;
      const byUser = catUserCount.get(m.category) ?? new Map<string, number>();
      byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
      catUserCount.set(m.category, byUser);
    }

    // Return counts only — caller gets distinct-user count from .length
    return Array.from(catUserCount.entries()).map(([category, byUser]) => ({
      category,
      perUserCounts: Array.from(byUser.values()), // number[] — no user ids
    }));
  },
});

/**
 * _skillInstallCounts — per-skill distinct-user install counts for k-anon gating.
 *
 * Returns only skill names and a count of distinct installers.
 */
export const _skillInstallCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("skillInstalls").collect();

    const skillUserIds = new Map<string, Set<string>>();
    for (const si of all) {
      const uid = si.userId as string;
      const users = skillUserIds.get(si.skillName) ?? new Set<string>();
      users.add(uid);
      skillUserIds.set(si.skillName, users);
    }

    // Return (skillName, distinctUserCount) only — no user ids
    return Array.from(skillUserIds.entries()).map(([skillName, users]) => ({
      skillName,
      distinctUserCount: users.size,
    }));
  },
});

/**
 * _activeUserMemoryCounts — count of active memories per active user.
 *
 * Returns an array of counts (one per user) — no user ids.
 */
export const _activeUserMemoryCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Fleet-wide scan — internal only, never a public endpoint.
    const all = await ctx.db.query("memories").collect();
    const active = all.filter((m) => !m.isArchived && !m.supersededBy);

    const byUser = new Map<string, number>();
    for (const m of active) {
      const uid = m.userId as string;
      byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
    }

    return Array.from(byUser.values()); // counts only
  },
});

// ── Internal write mutation ───────────────────────────────────────────────────

/** Persist a FleetMetrics blob to the fleetReports table. */
export const _writeFleetReport = internalMutation({
  args: {
    ranAt: v.string(),
    metrics: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("fleetReports", {
      ranAt: args.ranAt,
      metrics: args.metrics,
    });
  },
});

// ── Weekly aggregation action ─────────────────────────────────────────────────

/**
 * weeklyFleetAggregation — the cron entry point (internalAction).
 *
 * Runs all aggregate queries, applies kAnonBucket() to every result, and
 * writes a single fleetReports row.  No usernames, userId strings, or content
 * appear in the written row.
 */
export const weeklyFleetAggregation = internalAction({
  args: {},
  handler: async (ctx): Promise<FleetMetrics> => {
    const ranAt = new Date().toISOString();

    // ── categoryDistribution ─────────────────────────────────────────
    const rawCats: Array<{ category: string; perUserCounts: number[] }> =
      await ctx.runQuery(internal.fleet._categoryDistribution, {});

    // Gate per-category on that category's distinct user count.
    // We also need the total fleet size for the outer gate — use the sum
    // of distinct users across all categories as a proxy (always ≥ actual).
    // The per-category gate is the conservative choice specified in the plan.
    const categoryDistribution: FleetMetrics["categoryDistribution"] =
      rawCats.length === 0
        ? null
        : rawCats
            .map((c) => {
              type CatRow = { category: string; totalMemories: number; userCount: number };
              const result = kAnonBucket([...c.perUserCounts.map((n) => [n])], (xs) => ({
                category: c.category,
                totalMemories: xs.flat().reduce((a: number, b: number) => a + b, 0),
                userCount: xs.length,
              })) as CatRow | null;
              return result;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);

    // ── skillInstallCounts ───────────────────────────────────────────
    const rawSkills: Array<{ skillName: string; distinctUserCount: number }> =
      await ctx.runQuery(internal.fleet._skillInstallCounts, {});

    // Gate on total distinct users across all skills (outer gate), then
    // suppress individual skills with < K_ANON_FLOOR distinct installers.
    const allSkillUsers = rawSkills.map((s) => Array(s.distinctUserCount).fill(0) as number[]);
    const skillInstallCounts = kAnonBucket(allSkillUsers, (_) =>
      rawSkills
        .filter((s) => s.distinctUserCount >= K_ANON_FLOOR)
        .map((s) => ({
          skillName: s.skillName,
          installCount: s.distinctUserCount,
        }))
    ) as FleetMetrics["skillInstallCounts"];

    // ── avgMemoriesPerActiveUser ─────────────────────────────────────
    const memoryCounts: number[] = await ctx.runQuery(
      internal.fleet._activeUserMemoryCounts,
      {}
    );

    // Each user contributes one value; outer array length = distinct users.
    const avgMemoriesPerActiveUser = kAnonBucket(
      memoryCounts.map((c) => [c]),
      (xs) => {
        const flat = xs.flat() as number[];
        return Math.round((flat.reduce((a, b) => a + b, 0) / flat.length) * 100) / 100;
      }
    ) as FleetMetrics["avgMemoriesPerActiveUser"];

    // ── Write fleetReports row ───────────────────────────────────────
    const metrics: FleetMetrics = {
      categoryDistribution,
      skillInstallCounts,
      avgMemoriesPerActiveUser,
    };

    await ctx.runMutation(internal.fleet._writeFleetReport, { ranAt, metrics });

    return metrics;
  },
});
