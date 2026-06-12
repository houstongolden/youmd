/**
 * P13 — shared helpers for cursor pagination (PRODUCT-AUDIT #15,
 * FEATURE-ROADMAP 2.9).
 *
 * Every paginated list query takes the same two optional knobs and returns a
 * Convex-native PaginationResult (`{ page, isDone, continueCursor }`). The
 * HTTP layer maps that to the additive response contract:
 *
 *   nextCursor: string | null   — pass back as ?cursor= to get the next page
 *   hasMore:    boolean          — false on the final page
 *
 * Cursors are opaque Convex index cursors — never fabricated over in-memory
 * slices. One `.paginate()` call per query function (Convex constraint).
 */
import { v } from "convex/values";

/** Arg validators shared by all `*Page` queries. */
export const pageArgs = {
  cursor: v.optional(v.union(v.string(), v.null())),
  numItems: v.number(),
};

/** Hard server-side ceiling on page size, regardless of HTTP-layer clamps. */
export const MAX_PAGE_SIZE = 200;

/** Clamp a requested page size to [1, max]. Non-finite input falls back to `fallback`. */
export function clampPageSize(
  n: number,
  fallback = 50,
  max: number = MAX_PAGE_SIZE
): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), 1), max);
}
