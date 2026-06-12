/**
 * Rate limiting helper for public unauth'd endpoints (cycle 46).
 *
 * Used by chat.* and other expensive LLM-calling actions to cap anonymous
 * abuse. Backed by the `rateLimits` Convex table — one row per call, indexed
 * by bucket+timestamp, queried within a sliding time window.
 *
 * Buckets are typically `<endpoint>:<ip>` for anonymous endpoints. The IP is
 * read from the `x-forwarded-for` request header by httpAction wrappers.
 *
 * This is intentionally simple. It does NOT:
 *   - Implement token bucket / leaky bucket
 *   - Block by IP after threshold (relies on the throwing 429)
 *   - Persist long-term (rows accumulate; periodic cleanup recommended)
 *
 * If a more sophisticated rate limiter is needed (e.g. per-IP daily caps),
 * upgrade this helper.
 */

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";

/**
 * Check whether a bucket has exceeded its rate limit, and if not, record a
 * call. Throws "rate limit exceeded" if over the cap.
 *
 * Called from httpAction wrappers via `ctx.runMutation(internal.lib.rateLimit.checkAndRecord, ...)`.
 *
 * @param bucket    bucket key, e.g. `"chat:1.2.3.4"` or `"research:anon"`
 * @param windowMs  sliding window in ms (e.g. 60_000 = 1 minute)
 * @param maxCalls  max calls allowed in the window
 */
export const checkAndRecord = internalMutation({
  args: {
    bucket: v.string(),
    windowMs: v.number(),
    maxCalls: v.number(),
  },
  handler: async (ctx, args) => {
    const since = Date.now() - args.windowMs;

    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_ts", (q) =>
        q.eq("bucket", args.bucket).gt("timestamp", since)
      )
      .collect();

    if (recent.length >= args.maxCalls) {
      throw new Error(
        `rate limit exceeded: ${recent.length}/${args.maxCalls} calls in last ${Math.round(args.windowMs / 1000)}s`
      );
    }

    await ctx.db.insert("rateLimits", {
      bucket: args.bucket,
      timestamp: Date.now(),
    });

    return { allowed: true, recentCount: recent.length + 1 };
  },
});

/**
 * P22 — sliding-window check for authenticated WRITE endpoints.
 *
 * Same `rateLimits` table and window math as `checkAndRecord`, but:
 *   - never throws — returns a structured decision so the HTTP layer can
 *     emit a proper 429 envelope WITH Retry-After / X-RateLimit-* headers
 *     (convex/lib/writeLimits.ts buildRateLimitHeaders)
 *   - reports `remaining` and `resetAtMs` (when the oldest in-window call
 *     ages out) so successful writes can carry the headers too
 *
 * Buckets are `<limitName>:<apiKeyId>` (per-key isolation; userDbId fallback
 * for non-key callers). Blocked calls are NOT recorded — a client hammering
 * a 429 does not push its own reset time further into the future.
 */
export const checkAndRecordWrite = internalMutation({
  args: {
    bucket: v.string(),
    windowMs: v.number(),
    maxCalls: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const since = now - args.windowMs;

    const recent = await ctx.db
      .query("rateLimits")
      .withIndex("by_bucket_ts", (q) =>
        q.eq("bucket", args.bucket).gt("timestamp", since)
      )
      .collect();

    // Index scan is ascending on timestamp, but don't rely on it.
    const oldestTs = recent.reduce(
      (min, row) => Math.min(min, row.timestamp),
      Number.POSITIVE_INFINITY
    );

    if (recent.length >= args.maxCalls) {
      const resetAtMs = oldestTs + args.windowMs;
      return {
        allowed: false,
        limit: args.maxCalls,
        remaining: 0,
        resetAtMs,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      };
    }

    await ctx.db.insert("rateLimits", {
      bucket: args.bucket,
      timestamp: now,
    });

    // The window resets when its oldest call (possibly the one just
    // recorded) ages out.
    const resetAtMs =
      (Number.isFinite(oldestTs) ? oldestTs : now) + args.windowMs;

    return {
      allowed: true,
      limit: args.maxCalls,
      remaining: args.maxCalls - (recent.length + 1),
      resetAtMs,
      retryAfterSeconds: 0,
    };
  },
});

/**
 * Periodic cleanup of stale rate limit rows. Wired up as an hourly cron in
 * convex/crons.ts; can also be run manually via Convex Dashboard.
 *
 * Deletes rows older than `maxAgeMs` in bounded batches (audit 2026-06-11
 * P0 #8): each invocation deletes at most CLEANUP_BATCH_SIZE rows via the
 * `by_timestamp` index (oldest-first, never a full-table collect) and
 * self-reschedules immediately when a full batch was deleted, until the
 * backlog is drained.
 */
const CLEANUP_BATCH_SIZE = 1000;

export const cleanupOldRateLimits = internalMutation({
  args: {
    maxAgeMs: v.optional(v.number()), // default: 1 hour
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.maxAgeMs ?? 60 * 60 * 1000);

    const stale = await ctx.db
      .query("rateLimits")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(CLEANUP_BATCH_SIZE);

    for (const row of stale) {
      await ctx.db.delete(row._id);
    }

    // A full batch means more stale rows likely remain — drain them in a
    // follow-up run instead of scanning unboundedly in this transaction.
    const rescheduled = stale.length === CLEANUP_BATCH_SIZE;
    if (rescheduled) {
      await ctx.scheduler.runAfter(
        0,
        internal.lib.rateLimit.cleanupOldRateLimits,
        args.maxAgeMs === undefined ? {} : { maxAgeMs: args.maxAgeMs }
      );
    }

    return { deleted: stale.length, rescheduled };
  },
});
