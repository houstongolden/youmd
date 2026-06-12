/**
 * P22 — per-API-key rate limits for WRITE endpoints (PRODUCT-AUDIT #24).
 *
 * One place for the write-rate-limit constants and the standard rate-limit
 * header set. The actual counting lives in convex/lib/rateLimit.ts
 * (`checkAndRecordWrite`, same sliding-window `rateLimits` table the public
 * chat endpoints use); convex/http.ts (`guardWrite`) keys the bucket on the
 * caller's apiKeyId (every /api/v1/me/* caller authenticates with an API
 * key — userDbId is the documented fallback subject if a session-auth web
 * path ever reuses the guard).
 *
 * Limits:
 *   - General writes (POST/PUT/DELETE under /api/v1/me/*): 60/min per key.
 *   - Pipeline builds (POST /api/v1/me/build): 5 per 10 min per key. The
 *     pipeline already refuses concurrent runs per user ("A pipeline is
 *     already running"), but that is a concurrency guard, not a rate limit —
 *     rapid sequential triggers each spend LLM budget.
 *
 * Cleanup: rows ride the existing hourly `cleanupOldRateLimits` cron
 * (deletes rows older than 1h — both windows here are well under that).
 */

/** A named sliding-window limit. `name` prefixes the rateLimits bucket. */
export type WriteRateLimit = {
  name: string;
  windowMs: number;
  maxCalls: number;
};

/** Default for all authenticated write endpoints: 60 writes/min per key. */
export const WRITE_RATE_LIMIT: WriteRateLimit = {
  name: "write",
  windowMs: 60_000,
  maxCalls: 60,
};

/** Stricter limit for pipeline build triggers: 5 builds per 10 min per key. */
export const BUILD_RATE_LIMIT: WriteRateLimit = {
  name: "build",
  windowMs: 10 * 60_000,
  maxCalls: 5,
};

/** Result of a checkAndRecordWrite call (convex/lib/rateLimit.ts). */
export type RateLimitDecision = {
  allowed: boolean;
  /** The configured maximum for the window. */
  limit: number;
  /** Calls left in the current window (0 when blocked). */
  remaining: number;
  /** Epoch ms when the oldest in-window call ages out (a slot frees up). */
  resetAtMs: number;
  /** Whole seconds until resetAtMs (>= 1 when blocked). */
  retryAfterSeconds: number;
};

/**
 * Standard rate-limit response headers. Sent on 429s AND on successful
 * writes (guardWrite attaches them to the success response). `Retry-After`
 * is only included when the call was blocked.
 *
 * X-RateLimit-Reset is epoch SECONDS (the common convention — GitHub-style),
 * not a delta.
 */
export function buildRateLimitHeaders(
  decision: RateLimitDecision
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(Math.max(0, decision.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(decision.resetAtMs / 1000)),
  };
  if (!decision.allowed) {
    headers["Retry-After"] = String(Math.max(1, decision.retryAfterSeconds));
  }
  return headers;
}
