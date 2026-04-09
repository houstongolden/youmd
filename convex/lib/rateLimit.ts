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
 * Periodic cleanup of stale rate limit rows. Should be called from a cron
 * (not yet wired up) or manually via Convex Dashboard.
 *
 * Deletes rows older than `maxAgeMs`.
 */
export const cleanupOldRateLimits = internalMutation({
  args: {
    maxAgeMs: v.optional(v.number()), // default: 1 hour
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.maxAgeMs ?? 60 * 60 * 1000);

    const stale = await ctx.db.query("rateLimits").collect();
    let deleted = 0;
    for (const row of stale) {
      if (row.timestamp < cutoff) {
        await ctx.db.delete(row._id);
        deleted++;
      }
    }
    return { deleted };
  },
});
