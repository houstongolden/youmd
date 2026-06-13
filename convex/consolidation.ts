/**
 * L19 — Nightly dreaming loop (deterministic v1, no LLM).
 *
 * Runs every night at 09:00 UTC (2am PT) via convex/crons.ts.
 *
 * What it does, per user (deterministic — zero LLM calls):
 *
 *   1. Idempotency gate: if a consolidationRuns row exists for this user
 *      and today's UTC date, skip entirely.
 *
 *   2. Exact-duplicate sweep: find memories that share a contentHash
 *      with an older active memory. Keep the oldest, set supersededBy on
 *      the rest.  NEVER deletes rows — supersededBy is the soft link.
 *
 *   3. Stale-ephemeral demotion: memories in a non-durable category,
 *      not pinned, with no importance set, older than STALE_THRESHOLD_DAYS
 *      → set isArchived: true.  Mirrors the archiveStale logic in
 *      convex/memories.ts but scoped to ephemeral categories so durable
 *      facts/decisions/goals/preferences/corrections are never touched.
 *
 *   4. Mutation cap: at most MAX_MUTATIONS_PER_USER writes per user per
 *      night.  If the cap is reached, the run completes gracefully; the
 *      remaining work will be picked up on the next nightly run.
 *
 *   5. Write consolidationRuns row last (success signal).
 *
 * Safety invariants (never archived, never superseded here):
 *   - pinned === true
 *   - category in DURABLE_MEMORY_CATEGORIES (preference/decision/goal/fact)
 *   - category === "correction"
 *   - memory already isArchived or already has supersededBy
 *
 * See project-context/audits/2026-06-11/SELF-IMPROVING-SYSTEM-DESIGN.md
 * (consolidation loop, Stage-1 deterministic gates) for design rationale.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { DURABLE_MEMORY_CATEGORIES } from "./lib/memoryCategories";

// ── Constants ────────────────────────────────────────────────────────────────

/** Max DB writes per user per nightly run (duplicate + archive combined). */
const MAX_MUTATIONS_PER_USER = 200;

/**
 * Age threshold for stale-ephemeral demotion.
 * Memories in non-durable categories that are older than this AND have no
 * importance set AND are not pinned are archived.
 * Matches the sessionMaintenance policy in memories.ts (90 days).
 */
const STALE_THRESHOLD_DAYS = 30;

/** How many users to process per page in nightlyConsolidation. */
const USER_PAGE_SIZE = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's UTC date as "YYYY-MM-DD". */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when a category is protected from archiving. */
function isProtectedCategory(category: string): boolean {
  // DURABLE_MEMORY_CATEGORIES covers preference/decision/goal/fact.
  // correction is always protected (see design doc).
  return DURABLE_MEMORY_CATEGORIES.has(category) || category === "correction";
}

// ── Internal queries (readable by consolidateUser) ───────────────────────────

/** Fetch all users — paged by cursor offset for scalability. */
export const _listUserIds = internalQuery({
  args: { pageSize: v.number(), skip: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("users").collect();
    return all.slice(args.skip, args.skip + args.pageSize).map((u) => u._id);
  },
});

/** Total user count (used to page in nightlyConsolidation). */
export const _userCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    return all.length;
  },
});

/** Check whether a consolidationRuns row exists for (userId, ranAt). */
export const _hasRunToday = internalQuery({
  args: { userId: v.id("users"), ranAt: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("consolidationRuns")
      .withIndex("by_userId_ranAt", (q) =>
        q.eq("userId", args.userId).eq("ranAt", args.ranAt)
      )
      .first();
    return row !== null;
  },
});

/** Fetch all active, non-superseded memories for a user. */
export const _listActiveMemories = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .filter((q) => q.eq(q.field("supersededBy"), undefined))
      .collect();
  },
});

/** Count the current review queue size for a user (non-pinned, non-superseded, >90d, low-importance). */
export const _reviewQueueSize = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 90 * 86400000;
    const active = await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .collect();
    return active.filter(
      (m) =>
        !m.supersededBy &&
        m.pinned !== true &&
        (m.importance === undefined || m.importance <= 2) &&
        m.createdAt < cutoff
    ).length;
  },
});

// ── Core per-user mutation ───────────────────────────────────────────────────

/**
 * consolidateUser — the per-user nightly consolidation mutation.
 *
 * Called by nightlyConsolidation via ctx.runMutation for each user.
 * Safe to call directly for manual e2e testing:
 *
 *   npx convex run consolidation:consolidateUser '{"userId":"<id>"}'
 */
export const consolidateUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const today = todayUtc();

    // 1. Idempotency: bail if already ran for this user today.
    const existing = await ctx.db
      .query("consolidationRuns")
      .withIndex("by_userId_ranAt", (q) =>
        q.eq("userId", args.userId).eq("ranAt", today)
      )
      .first();
    if (existing) return { skipped: true, reason: "already_ran_today" };

    const now = Date.now();
    const staleCutoff = now - STALE_THRESHOLD_DAYS * 86400000;
    let mutationCount = 0;
    let duplicatesSuperseded = 0;
    let archived = 0;

    // 2. Exact-duplicate sweep (contentHash collisions).
    //    Group active non-superseded memories by contentHash.
    //    For each group of >1 that share a hash, keep the oldest (min createdAt),
    //    supersede the rest.
    const allActive = await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .filter((q) => q.eq(q.field("supersededBy"), undefined))
      .collect();

    // Build hash → sorted-by-createdAt list
    const byHash = new Map<string, typeof allActive>();
    for (const m of allActive) {
      if (!m.contentHash) continue; // pre-P23 rows have no hash — skip
      const bucket = byHash.get(m.contentHash) ?? [];
      bucket.push(m);
      byHash.set(m.contentHash, bucket);
    }

    for (const group of Array.from(byHash.values())) {
      if (group.length <= 1) continue;
      // Keep the oldest (lowest createdAt) — consistent with design doc.
      group.sort((a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt);
      const keepId = group[0]._id;
      for (let i = 1; i < group.length; i++) {
        if (mutationCount >= MAX_MUTATIONS_PER_USER) break;
        await ctx.db.patch(group[i]._id, {
          supersededBy: keepId,
          updatedAt: now,
        });
        mutationCount++;
        duplicatesSuperseded++;
      }
      if (mutationCount >= MAX_MUTATIONS_PER_USER) break;
    }

    // 3. Stale-ephemeral demotion.
    //    Only act on memories that are:
    //      - active (already filtered above — re-query for any that became
    //        active after step 2 changes; in practice this is the same set
    //        minus the ones we just superseded)
    //      - NOT pinned
    //      - NOT in a durable/protected category
    //      - importance unset (undefined or null)
    //      - older than STALE_THRESHOLD_DAYS
    if (mutationCount < MAX_MUTATIONS_PER_USER) {
      // Re-read active set to pick up supersededBy changes we just made.
      // This is safe — internalMutation reads are consistent within the same tx.
      const candidates = allActive.filter(
        (m) =>
          m.pinned !== true &&
          !isProtectedCategory(m.category) &&
          m.importance === undefined &&
          m.createdAt < staleCutoff &&
          !m.supersededBy // some were just patched above
      );

      for (const m of candidates) {
        if (mutationCount >= MAX_MUTATIONS_PER_USER) break;
        // Re-confirm it isn't already superseded (the in-memory allActive
        // snapshot was pre-step-2 for those we patched; skip them).
        // (The .filter above catches the ones patched in step 2 via the
        //  in-memory !m.supersededBy check — the snapshot was captured before
        //  patches so supersededBy is still undefined. We therefore read back
        //  the actual document to be safe.)
        const live = await ctx.db.get(m._id);
        if (!live || live.isArchived || live.supersededBy) continue;

        await ctx.db.patch(m._id, { isArchived: true, updatedAt: now });
        mutationCount++;
        archived++;
      }
    }

    // 4. Compute review queue size (read-only, doesn't count toward cap).
    const reviewCutoff = now - 90 * 86400000;
    const reviewQueueSize = allActive.filter(
      (m) =>
        !m.supersededBy &&
        m.pinned !== true &&
        (m.importance === undefined || m.importance <= 2) &&
        m.createdAt < reviewCutoff
    ).length;

    // 5. Write the consolidationRuns record last (success signal).
    await ctx.db.insert("consolidationRuns", {
      userId: args.userId,
      ranAt: today,
      duplicatesSuperseded,
      archived,
      reviewQueueSize,
    });

    return { skipped: false, duplicatesSuperseded, archived, reviewQueueSize, mutationCount };
  },
});

// ── Nightly orchestrator ─────────────────────────────────────────────────────

/**
 * nightlyConsolidation — the cron entry point (internalAction).
 *
 * Pages through all users in batches of USER_PAGE_SIZE and schedules
 * consolidateUser for each. Using an action so we can loop without hitting
 * Convex's single-mutation row-read limit; each per-user consolidateUser is
 * its own mutation and can read/write freely.
 */
export const nightlyConsolidation = internalAction({
  args: {},
  handler: async (ctx) => {
    let skip = 0;
    let processed = 0;

    while (true) {
      const userIds: Id<"users">[] = await ctx.runQuery(
        internal.consolidation._listUserIds,
        { pageSize: USER_PAGE_SIZE, skip }
      );
      if (userIds.length === 0) break;

      for (const userId of userIds) {
        await ctx.runMutation(internal.consolidation.consolidateUser, { userId });
        processed++;
      }

      skip += userIds.length;
      if (userIds.length < USER_PAGE_SIZE) break; // last page
    }

    return { processed };
  },
});
