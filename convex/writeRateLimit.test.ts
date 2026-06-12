/**
 * P22 — per-key write rate limit tests (PRODUCT-AUDIT #24).
 *
 * Covers the two layers the HTTP guard (convex/http.ts guardWrite) is built
 * from:
 *   - lib/rateLimit.ts checkAndRecordWrite — sliding-window math, per-bucket
 *     (per-key) isolation, reset/retry-after computation, blocked calls not
 *     recorded
 *   - lib/writeLimits.ts buildRateLimitHeaders — header set on success and
 *     on 429 (Retry-After only when blocked)
 *
 * NOTE (same gap as memories.test.ts / httpErrors.test.ts): convex-test does
 * not execute httpRouter routes, so the full request → guardWrite → 429 path
 * is not run end-to-end here. The exact mutation + header builder the guard
 * calls are tested instead.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";
import {
  BUILD_RATE_LIMIT,
  WRITE_RATE_LIMIT,
  buildRateLimitHeaders,
} from "./lib/writeLimits";

const WINDOW = { windowMs: 60_000, maxCalls: 3 };

describe("rateLimit.checkAndRecordWrite", () => {
  it("allows calls under the limit and decrements remaining", async () => {
    const t = convexTest(schema);

    const first = await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
      bucket: "write:keyA",
      ...WINDOW,
    });
    expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2 });
    expect(first.retryAfterSeconds).toBe(0);

    const second = await t.mutation(
      internal.lib.rateLimit.checkAndRecordWrite,
      { bucket: "write:keyA", ...WINDOW }
    );
    expect(second).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("blocks at the limit with a positive retry-after and a reset anchored to the oldest call", async () => {
    const t = convexTest(schema);
    const before = Date.now();

    for (let i = 0; i < 3; i++) {
      const r = await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
        bucket: "write:keyA",
        ...WINDOW,
      });
      expect(r.allowed).toBe(true);
    }

    const blocked = await t.mutation(
      internal.lib.rateLimit.checkAndRecordWrite,
      { bucket: "write:keyA", ...WINDOW }
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    // Reset = oldest in-window call + window.
    expect(blocked.resetAtMs).toBeGreaterThanOrEqual(before + WINDOW.windowMs);
    expect(blocked.resetAtMs).toBeLessThanOrEqual(Date.now() + WINDOW.windowMs);
  });

  it("does not record blocked calls (hammering a 429 never extends the window)", async () => {
    const t = convexTest(schema);
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
        bucket: "write:keyA",
        ...WINDOW,
      });
    }
    for (let i = 0; i < 5; i++) {
      const r = await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
        bucket: "write:keyA",
        ...WINDOW,
      });
      expect(r.allowed).toBe(false);
    }
    const rows = await t.run(async (ctx) =>
      ctx.db.query("rateLimits").collect()
    );
    expect(rows).toHaveLength(3);
  });

  it("ignores calls that have aged out of the sliding window", async () => {
    const t = convexTest(schema);
    // Seed 3 calls just past the window edge.
    await t.run(async (ctx) => {
      const old = Date.now() - WINDOW.windowMs - 1;
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert("rateLimits", {
          bucket: "write:keyA",
          timestamp: old,
        });
      }
    });

    const r = await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
      bucket: "write:keyA",
      ...WINDOW,
    });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it("isolates buckets — one maxed key never affects another", async () => {
    const t = convexTest(schema);
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.lib.rateLimit.checkAndRecordWrite, {
        bucket: "write:keyA",
        ...WINDOW,
      });
    }
    const blockedA = await t.mutation(
      internal.lib.rateLimit.checkAndRecordWrite,
      { bucket: "write:keyA", ...WINDOW }
    );
    expect(blockedA.allowed).toBe(false);

    const freshB = await t.mutation(
      internal.lib.rateLimit.checkAndRecordWrite,
      { bucket: "write:keyB", ...WINDOW }
    );
    expect(freshB).toMatchObject({ allowed: true, remaining: 2 });

    // Build buckets are separate from write buckets for the same key.
    const buildSameKey = await t.mutation(
      internal.lib.rateLimit.checkAndRecordWrite,
      { bucket: "build:keyA", ...WINDOW }
    );
    expect(buildSameKey.allowed).toBe(true);
  });
});

describe("writeLimits.buildRateLimitHeaders", () => {
  it("emits the X-RateLimit-* trio (no Retry-After) on allowed calls", () => {
    const headers = buildRateLimitHeaders({
      allowed: true,
      limit: 60,
      remaining: 59,
      resetAtMs: 1_750_000_000_500,
      retryAfterSeconds: 0,
    });
    expect(headers).toEqual({
      "X-RateLimit-Limit": "60",
      "X-RateLimit-Remaining": "59",
      // Epoch seconds, rounded up.
      "X-RateLimit-Reset": "1750000001",
    });
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("adds Retry-After (min 1s) and clamps remaining at 0 when blocked", () => {
    const headers = buildRateLimitHeaders({
      allowed: false,
      limit: 5,
      remaining: -2,
      resetAtMs: 2_000_000_000_000,
      retryAfterSeconds: 0,
    });
    expect(headers["Retry-After"]).toBe("1");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Limit"]).toBe("5");
  });

  it("passes through real retry-after values", () => {
    const headers = buildRateLimitHeaders({
      allowed: false,
      limit: 60,
      remaining: 0,
      resetAtMs: Date.now() + 42_000,
      retryAfterSeconds: 42,
    });
    expect(headers["Retry-After"]).toBe("42");
  });
});

describe("writeLimits constants", () => {
  it("pins the documented defaults (60 writes/min, 5 builds/10min)", () => {
    expect(WRITE_RATE_LIMIT).toEqual({
      name: "write",
      windowMs: 60_000,
      maxCalls: 60,
    });
    expect(BUILD_RATE_LIMIT).toEqual({
      name: "build",
      windowMs: 600_000,
      maxCalls: 5,
    });
  });
});
