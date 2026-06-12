/**
 * P23 — Idempotency-Key snapshot store tests (PRODUCT-AUDIT #25).
 *
 * Covers convex/lib/idempotency.ts, the storage layer behind the
 * `Idempotency-Key` header on mutating endpoints (convex/http.ts guardWrite):
 *   - save → get roundtrip (status + body preserved verbatim)
 *   - TTL: expired snapshots are invisible to getSnapshot and overwritten in
 *     place by the next save (no cron, no table growth per triple)
 *   - body size cap: oversized bodies are refused, never stored
 *   - (subject, route, keyHash) triple isolation
 *
 * NOTE (same gap as memories.test.ts / httpErrors.test.ts): convex-test does
 * not execute httpRouter routes, so the header → replay → Idempotency-
 * Replayed response path is not run end-to-end; the exact internal
 * query/mutation pair the guard calls is tested instead.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";
import {
  IDEMPOTENCY_MAX_BODY_CHARS,
  IDEMPOTENCY_TTL_MS,
} from "./lib/idempotency";

const TRIPLE = {
  subject: "apiKey_123",
  route: "POST /api/v1/me/bundle",
  keyHash: "a".repeat(64),
};

describe("idempotency snapshot store", () => {
  it("roundtrips a stored response snapshot", async () => {
    const t = convexTest(schema);

    const empty = await t.query(internal.lib.idempotency.getSnapshot, TRIPLE);
    expect(empty).toBeNull();

    const saved = await t.mutation(internal.lib.idempotency.saveSnapshot, {
      ...TRIPLE,
      status: 200,
      body: '{"version":4,"contentHash":"abc"}',
    });
    expect(saved).toEqual({ stored: true, overwrote: false });

    const replay = await t.query(internal.lib.idempotency.getSnapshot, TRIPLE);
    expect(replay).toEqual({
      status: 200,
      body: '{"version":4,"contentHash":"abc"}',
    });
  });

  it("isolates snapshots by subject, route, and key hash", async () => {
    const t = convexTest(schema);
    await t.mutation(internal.lib.idempotency.saveSnapshot, {
      ...TRIPLE,
      status: 200,
      body: '{"ok":true}',
    });

    expect(
      await t.query(internal.lib.idempotency.getSnapshot, {
        ...TRIPLE,
        subject: "apiKey_OTHER",
      })
    ).toBeNull();
    expect(
      await t.query(internal.lib.idempotency.getSnapshot, {
        ...TRIPLE,
        route: "POST /api/v1/me/publish",
      })
    ).toBeNull();
    expect(
      await t.query(internal.lib.idempotency.getSnapshot, {
        ...TRIPLE,
        keyHash: "b".repeat(64),
      })
    ).toBeNull();
  });

  it("treats snapshots past the 24h TTL as absent", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("idempotencyKeys", {
        ...TRIPLE,
        status: 200,
        body: '{"stale":true}',
        createdAt: Date.now() - IDEMPOTENCY_TTL_MS - 1000,
      });
    });

    const replay = await t.query(internal.lib.idempotency.getSnapshot, TRIPLE);
    expect(replay).toBeNull();
  });

  it("overwrites the expired row in place instead of growing the table", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("idempotencyKeys", {
        ...TRIPLE,
        status: 200,
        body: '{"stale":true}',
        createdAt: Date.now() - IDEMPOTENCY_TTL_MS - 1000,
      });
    });

    const saved = await t.mutation(internal.lib.idempotency.saveSnapshot, {
      ...TRIPLE,
      status: 201,
      body: '{"fresh":true}',
    });
    expect(saved).toEqual({ stored: true, overwrote: true });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("idempotencyKeys").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(201);
    expect(rows[0].body).toBe('{"fresh":true}');

    const replay = await t.query(internal.lib.idempotency.getSnapshot, TRIPLE);
    expect(replay).toEqual({ status: 201, body: '{"fresh":true}' });
  });

  it("refuses to store bodies above the size cap (write still succeeds upstream)", async () => {
    const t = convexTest(schema);
    const huge = "x".repeat(IDEMPOTENCY_MAX_BODY_CHARS + 1);

    const saved = await t.mutation(internal.lib.idempotency.saveSnapshot, {
      ...TRIPLE,
      status: 200,
      body: huge,
    });
    expect(saved).toEqual({ stored: false, reason: "body_too_large" });

    const rows = await t.run(async (ctx) =>
      ctx.db.query("idempotencyKeys").collect()
    );
    expect(rows).toHaveLength(0);

    // Exactly at the cap is fine.
    const atCap = await t.mutation(internal.lib.idempotency.saveSnapshot, {
      ...TRIPLE,
      status: 200,
      body: "x".repeat(IDEMPOTENCY_MAX_BODY_CHARS),
    });
    expect(atCap.stored).toBe(true);
  });
});
