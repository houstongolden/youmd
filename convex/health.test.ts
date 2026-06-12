/**
 * T13 — health endpoint tests (TECH-STACK-AUDIT).
 *
 * NOTE (same gap as memories.test.ts): convex-test does not execute
 * httpRouter routes, so GET /api/v1/health is not run end-to-end here.
 * Instead this pins the two pieces the route is built from:
 *   - internal.health.probe — the cheap db dependency probe — runs against
 *     the in-memory backend on both an empty and a seeded users table
 *   - the 503 degraded path uses the sanitized error envelope (covered in
 *     httpErrors.test.ts alongside the rest of the envelope contract)
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import schema from "./schema";

describe("internal.health.probe", () => {
  it("succeeds against an empty database", async () => {
    const t = convexTest(schema);
    const result = await t.query(internal.health.probe, {});
    expect(result).toEqual({ ok: true });
  });

  it("succeeds when users exist", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "clerk_health",
        username: "health-check",
        email: "health@example.com",
        plan: "pro",
        createdAt: Date.now(),
      });
    });

    const result = await t.query(internal.health.probe, {});
    expect(result).toEqual({ ok: true });
  });
});
