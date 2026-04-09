/**
 * Daily LLM spend cap kill switch (cycle 48).
 *
 * Defense-in-depth above the cycle 46 per-IP rate limits. Tracks total
 * estimated cost across ALL chat.* endpoints per UTC day. When today's
 * accumulated cost exceeds CHAT_DAILY_SPEND_LIMIT_USD (Convex env var,
 * default $50), all further chat calls fail with 503 until midnight UTC.
 *
 * Per-IP rate limits handle single-attacker abuse. The spend cap handles
 * botnet abuse (where many IPs each stay under their per-IP limit but
 * collectively burn the budget).
 *
 * Cost estimates are intentionally pessimistic — they should overestimate
 * normal usage so the cap trips on real abuse, not on a busy day. Real
 * costs are typically 30-70% lower than the estimates here.
 *
 * To temporarily disable, set the env var to a very high number:
 *   npx convex env set CHAT_DAILY_SPEND_LIMIT_USD 10000
 *
 * To check current usage:
 *   npx convex run lib/spendCap:getSpendStatus
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const DEFAULT_DAILY_LIMIT_USD = 50;

/** UTC YYYY-MM-DD string for today */
function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Estimated cost per call by endpoint, in USD. Pessimistic — real costs
 * are usually lower. Tuned so a $50/day cap = ~1000 chat calls/day worst
 * case, which is far above legitimate single-user usage.
 */
const COST_ESTIMATES = {
  chat: 0.05,       // Sonnet 4.6, ~4k tokens worst case
  research: 0.01,   // Perplexity Sonar
  verify: 0.015,    // Perplexity Sonar Pro (more expensive)
  enrich: 0.005,    // xAI Grok-3-mini
  compact: 0.002,   // Haiku, longer prompt
  summarize: 0.001, // Haiku, short prompt
  // Cycle 54: Apify scraping endpoints
  scrape: 0.05,     // Apify single-actor run (varies by actor cost)
  linkedin: 0.10,   // Apify LinkedIn enrichment runs TWO actors per call
} as const;

/**
 * Check whether today's accumulated chat.* spend allows another call of the
 * given endpoint type, and if so, record the call. Throws "daily spend cap
 * exceeded" if over the limit.
 *
 * Called from chat httpAction wrappers AFTER the per-IP rate limit check
 * (so rate-limited calls don't count against the spend cap).
 */
export const checkAndRecord = internalMutation({
  args: {
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const dailyLimitUsd =
      Number(process.env.CHAT_DAILY_SPEND_LIMIT_USD) || DEFAULT_DAILY_LIMIT_USD;

    const cost = (COST_ESTIMATES as Record<string, number>)[args.endpoint] ?? 0.05;
    const today = todayBucket();

    // Sum today's estimated cost across all endpoints
    const todayRows = await ctx.db
      .query("chatSpendLog")
      .withIndex("by_bucketDay", (q) => q.eq("bucketDay", today))
      .collect();

    const totalToday = todayRows.reduce((sum, r) => sum + r.estimatedCostUsd, 0);

    if (totalToday + cost > dailyLimitUsd) {
      throw new Error(
        `daily spend cap exceeded: today $${totalToday.toFixed(2)} + this call $${cost.toFixed(4)} > limit $${dailyLimitUsd}. Resets at midnight UTC.`
      );
    }

    // Update existing endpoint row or insert new one
    const existing = todayRows.find((r) => r.endpoint === args.endpoint);
    if (existing) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        estimatedCostUsd: existing.estimatedCostUsd + cost,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("chatSpendLog", {
        bucketDay: today,
        endpoint: args.endpoint,
        count: 1,
        estimatedCostUsd: cost,
        updatedAt: Date.now(),
      });
    }

    return {
      allowed: true,
      totalTodayAfter: totalToday + cost,
      dailyLimitUsd,
      endpoint: args.endpoint,
      thisCallCost: cost,
    };
  },
});

/**
 * Read-only status — returns today's totals across all chat endpoints.
 * For Convex Dashboard inspection / monitoring.
 */
export const getSpendStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const dailyLimitUsd =
      Number(process.env.CHAT_DAILY_SPEND_LIMIT_USD) || DEFAULT_DAILY_LIMIT_USD;

    const today = todayBucket();
    const rows = await ctx.db
      .query("chatSpendLog")
      .withIndex("by_bucketDay", (q) => q.eq("bucketDay", today))
      .collect();

    const totalUsd = rows.reduce((sum, r) => sum + r.estimatedCostUsd, 0);
    const totalCalls = rows.reduce((sum, r) => sum + r.count, 0);

    return {
      bucketDay: today,
      dailyLimitUsd,
      totalUsd: Number(totalUsd.toFixed(4)),
      totalCalls,
      remainingUsd: Number((dailyLimitUsd - totalUsd).toFixed(4)),
      remainingPercent: Number(((1 - totalUsd / dailyLimitUsd) * 100).toFixed(1)),
      byEndpoint: rows.map((r) => ({
        endpoint: r.endpoint,
        count: r.count,
        estimatedCostUsd: Number(r.estimatedCostUsd.toFixed(4)),
      })),
    };
  },
});

/**
 * Manual reset (for testing or after a false positive trip). Deletes today's
 * spend log rows. Call via Convex Dashboard or `npx convex run`.
 */
export const resetTodaySpend = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = todayBucket();
    const rows = await ctx.db
      .query("chatSpendLog")
      .withIndex("by_bucketDay", (q) => q.eq("bucketDay", today))
      .collect();

    for (const row of rows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: rows.length, bucketDay: today };
  },
});
