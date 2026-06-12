/**
 * P15 — normalizeMemoryCategories migration tests.
 *
 * Pins the migration contract: legacy/variant category strings map to
 * canonical, unknown values default to "insight" and are REPORTED (never
 * dropped), the P23 contentHash is recomputed when the category changes,
 * and a re-run is a no-op (idempotency).
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { computeMemoryContentHash } from "../lib/hash";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: "clerk_alice",
      username: "alice",
      email: "alice@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

async function seedMemory(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  category: string,
  content: string,
  contentHash?: string
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("memories", {
      userId,
      category,
      content,
      source: "you-agent",
      isArchived: false,
      createdAt: Date.now(),
      contentHash,
    })
  );
}

describe("migrations/normalizeMemoryCategories", () => {
  it("maps legacy variants to canonical and defaults unknowns to insight", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const identityId = await seedMemory(t, userId, "identity", "born in Texas");
    const workId = await seedMemory(t, userId, "work", "runs BAMF");
    const goalsId = await seedMemory(t, userId, "goals", "ship you.md");
    const prefsId = await seedMemory(t, userId, "preferences", "no emoji");
    const casedId = await seedMemory(t, userId, "Fact", "cased fact");
    const unknownId = await seedMemory(t, userId, "vibes", "mystery note");
    const canonicalId = await seedMemory(t, userId, "fact", "already canonical");

    const report = await t.action(
      internal.migrations.normalizeMemoryCategories.normalize,
      {}
    );

    expect(report.scanned).toBe(7);
    expect(report.normalized).toBe(6);
    expect(report.mapped).toMatchObject({
      identity: { to: "fact", count: 1 },
      work: { to: "project", count: 1 },
      goals: { to: "goal", count: 1 },
      preferences: { to: "preference", count: 1 },
      Fact: { to: "fact", count: 1 },
    });
    // Unknown values are reported, not dropped.
    expect(report.defaulted).toEqual({ vibes: 1 });

    const categories = await t.run(async (ctx) => ({
      identity: (await ctx.db.get(identityId))?.category,
      work: (await ctx.db.get(workId))?.category,
      goals: (await ctx.db.get(goalsId))?.category,
      prefs: (await ctx.db.get(prefsId))?.category,
      cased: (await ctx.db.get(casedId))?.category,
      unknown: (await ctx.db.get(unknownId))?.category,
      unknownContent: (await ctx.db.get(unknownId))?.content,
      canonical: (await ctx.db.get(canonicalId))?.category,
    }));
    expect(categories).toEqual({
      identity: "fact",
      work: "project",
      goals: "goal",
      prefs: "preference",
      cased: "fact",
      unknown: "insight",
      unknownContent: "mystery note", // content preserved
      canonical: "fact",
    });
  });

  it("recomputes the dedupe contentHash when the category changes (P23 truthfulness)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const staleHash = await computeMemoryContentHash("born in Texas", "identity");
    const hashedId = await seedMemory(t, userId, "identity", "born in Texas", staleHash);
    // Pre-P23 row: no hash — must stay hashless.
    const hashlessId = await seedMemory(t, userId, "work", "runs BAMF");

    await t.action(internal.migrations.normalizeMemoryCategories.normalize, {});

    const expectedHash = await computeMemoryContentHash("born in Texas", "fact");
    const docs = await t.run(async (ctx) => ({
      hashed: await ctx.db.get(hashedId),
      hashless: await ctx.db.get(hashlessId),
    }));
    expect(docs.hashed?.contentHash).toBe(expectedHash);
    expect(docs.hashless?.category).toBe("project");
    expect(docs.hashless?.contentHash).toBeUndefined();
  });

  it("is idempotent — the second run changes nothing", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    await seedMemory(t, userId, "identity", "born in Texas");
    await seedMemory(t, userId, "vibes", "mystery note");
    await seedMemory(t, userId, "fact", "already canonical");

    const first = await t.action(
      internal.migrations.normalizeMemoryCategories.normalize,
      {}
    );
    expect(first.normalized).toBe(2);

    const second = await t.action(
      internal.migrations.normalizeMemoryCategories.normalize,
      {}
    );
    expect(second.scanned).toBe(3);
    expect(second.normalized).toBe(0);
    expect(second.mapped).toEqual({});
    expect(second.defaulted).toEqual({});
  });
});
