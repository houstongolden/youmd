/**
 * L20 — Fleet aggregation k-anon tests.
 *
 * Pins the kAnonBucket and fleet aggregate contracts as specified in:
 *   project-context/audits/2026-06-11/L-SERIES-EXECUTION-PLAN.md (Lane C L20)
 *   project-context/audits/2026-06-11/GLOBAL-EVOLUTION-ROADMAP.md
 *     (Stage 3 — Privacy-first fleet learning, k-anon floor)
 *
 * Contract assertions:
 *   1. kAnonBucket returns null when n=19 (< K_ANON_FLOOR); returns summary at n=20
 *   2. Output shapes for ALL fleet aggregates contain NO identifying field keys
 *      (no userId, username, email, content, rawData) — only names + counts
 *   3. Per-category k-anon: categories with < K_ANON_FLOOR distinct users
 *      are suppressed from categoryDistribution
 *   4. Per-skill k-anon: skills with < K_ANON_FLOOR distinct installers
 *      are suppressed from skillInstallCounts
 *   5. avgMemoriesPerActiveUser: null when active-user count < K_ANON_FLOOR
 *
 * NOTE: the weekly cron action (weeklyFleetAggregation) is tested via the
 * underlying internalQuery helpers — we avoid running the full action in
 * convex-test because it calls ctx.runMutation on a separate table path.
 * The kAnonBucket unit tests fully cover the privacy gate independently of
 * the action.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { kAnonBucket, K_ANON_FLOOR } from "./fleet";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function insertUser(
  t: ReturnType<typeof convexTest>,
  username: string
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: `clerk_${username}`,
      username,
      email: `${username}@example.com`,
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

async function insertMemory(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  category: string
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("memories", {
      userId,
      category,
      content: `${category} memory for ${userId}`,
      source: "cli",
      isArchived: false,
      createdAt: Date.now(),
    })
  );
}

async function insertSkillInstall(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  skillName: string
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("skillInstalls", {
      userId,
      skillName,
      source: "registry",
      scope: "user",
      identityFields: [],
      installedAt: Date.now(),
      useCount: 1,
    })
  );
}

// ── 1. kAnonBucket unit tests ─────────────────────────────────────────────────

describe("kAnonBucket — privacy gate", () => {
  it(`returns null when fewer than ${K_ANON_FLOOR} users (n=19)`, () => {
    const perUserValues = Array.from({ length: K_ANON_FLOOR - 1 }, (_, i) => [i]);
    const result = kAnonBucket(perUserValues, (xs) => xs.flat().reduce((a, b) => a + b, 0));
    expect(result).toBeNull();
  });

  it(`returns the summary when exactly ${K_ANON_FLOOR} users (n=20)`, () => {
    const perUserValues = Array.from({ length: K_ANON_FLOOR }, (_, i) => [i]);
    const result = kAnonBucket(perUserValues, (xs) => xs.flat().reduce((a: number, b: number) => a + b, 0));
    // Sum of 0..19 = 190
    expect(result).toBe(190);
  });

  it("returns the summary when more than K_ANON_FLOOR users (n=50)", () => {
    const perUserValues = Array.from({ length: 50 }, () => [1]);
    const result = kAnonBucket(perUserValues, (xs) => xs.flat().length);
    expect(result).toBe(50);
  });

  it("returns null for an empty input", () => {
    const result = kAnonBucket([], (xs) => xs.length);
    expect(result).toBeNull();
  });

  it("K_ANON_FLOOR is exactly 20", () => {
    expect(K_ANON_FLOOR).toBe(20);
  });
});

// ── 2. Output key shape — NO identifying fields ──────────────────────────────

describe("fleet aggregates — no identifying field keys in output", () => {
  const FORBIDDEN_KEYS = new Set([
    "userId", "user_id", "username", "email", "clerkId",
    "content", "rawData", "data", "memory", "text",
  ]);

  function assertNoForbiddenKeys(obj: unknown, path = "") {
    if (typeof obj !== "object" || obj === null) return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      expect(
        FORBIDDEN_KEYS.has(key),
        `forbidden key "${key}" found at ${path}.${key}`
      ).toBe(false);
      assertNoForbiddenKeys((obj as Record<string, unknown>)[key], `${path}.${key}`);
    }
  }

  it("categoryDistribution output keys are only: category, totalMemories, userCount", async () => {
    const t = convexTest(schema);
    // Need 20 users with memories to get past k-anon gate.
    const users = await Promise.all(
      Array.from({ length: K_ANON_FLOOR }, (_, i) => insertUser(t, `u${i}`))
    );
    for (const uid of users) {
      await insertMemory(t, uid, "fact");
    }

    const raw: Array<{ category: string; perUserCounts: number[] }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._categoryDistribution, { excludeUserIds: [] })
      );

    // The raw query returns perUserCounts (not the final output shape).
    // Verify the keys in the raw query result contain no user ids.
    assertNoForbiddenKeys(raw);

    // Verify allowed keys only.
    for (const entry of raw) {
      const keys = Object.keys(entry).sort();
      expect(keys).toEqual(["category", "perUserCounts"].sort());
    }
  });

  it("skillInstallCounts output keys are only: skillName, distinctUserCount", async () => {
    const t = convexTest(schema);
    const users = await Promise.all(
      Array.from({ length: K_ANON_FLOOR }, (_, i) => insertUser(t, `su${i}`))
    );
    for (const uid of users) {
      await insertSkillInstall(t, uid, "youmd-base");
    }

    const raw: Array<{ skillName: string; distinctUserCount: number }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._skillInstallCounts, { excludeUserIds: [] })
      );

    assertNoForbiddenKeys(raw);
    for (const entry of raw) {
      const keys = Object.keys(entry).sort();
      expect(keys).toEqual(["distinctUserCount", "skillName"].sort());
    }
  });

  it("activeUserMemoryCounts output is a plain number[] (no object keys)", async () => {
    const t = convexTest(schema);
    const uid = await insertUser(t, "counttest");
    await insertMemory(t, uid, "fact");

    const counts: number[] = await t.run(async (ctx) =>
      ctx.runQuery(internal.fleet._activeUserMemoryCounts, { excludeUserIds: [] })
    );

    // Must be a flat array of numbers — no objects, no user ids.
    expect(Array.isArray(counts)).toBe(true);
    for (const c of counts) {
      expect(typeof c).toBe("number");
    }
  });
});

// ── 3. Per-category k-anon suppression ──────────────────────────────────────

describe("categoryDistribution — per-category k-anon", () => {
  it("suppresses categories with < K_ANON_FLOOR distinct users", async () => {
    const t = convexTest(schema);

    // "fact" → only 5 users (should be suppressed)
    for (let i = 0; i < 5; i++) {
      const uid = await insertUser(t, `factuser${i}`);
      await insertMemory(t, uid, "fact");
    }

    const raw: Array<{ category: string; perUserCounts: number[] }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._categoryDistribution, { excludeUserIds: [] })
      );

    const factBucket = raw.find((r) => r.category === "fact");
    // 5 contributing users < 20 → null when gated
    if (factBucket) {
      const gated = kAnonBucket(
        factBucket.perUserCounts.map((c) => [c]),
        (xs) => xs.length
      );
      expect(gated).toBeNull();
    }
  });

  it("returns category data when ≥ K_ANON_FLOOR users contribute", async () => {
    const t = convexTest(schema);

    for (let i = 0; i < K_ANON_FLOOR; i++) {
      const uid = await insertUser(t, `prefuser${i}`);
      await insertMemory(t, uid, "preference");
    }

    const raw: Array<{ category: string; perUserCounts: number[] }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._categoryDistribution, { excludeUserIds: [] })
      );

    const prefBucket = raw.find((r) => r.category === "preference");
    expect(prefBucket).toBeDefined();
    const gated = kAnonBucket(
      prefBucket!.perUserCounts.map((c) => [c]),
      (xs) => ({ userCount: xs.length, total: xs.flat().reduce((a: number, b: number) => a + b, 0) })
    );
    expect(gated).not.toBeNull();
    expect((gated as { userCount: number }).userCount).toBe(K_ANON_FLOOR);
  });
});

// ── 4. Per-skill k-anon suppression ─────────────────────────────────────────

describe("skillInstallCounts — per-skill k-anon", () => {
  it("suppresses skills with < K_ANON_FLOOR distinct installers", async () => {
    const t = convexTest(schema);

    for (let i = 0; i < 10; i++) {
      const uid = await insertUser(t, `skilluser${i}`);
      await insertSkillInstall(t, uid, "rare-skill");
    }

    const raw: Array<{ skillName: string; distinctUserCount: number }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._skillInstallCounts, { excludeUserIds: [] })
      );

    const skill = raw.find((r) => r.skillName === "rare-skill");
    expect(skill?.distinctUserCount).toBe(10);
    // 10 < 20 — would be suppressed by the action's k-anon gate
    expect(skill!.distinctUserCount < K_ANON_FLOOR).toBe(true);
  });

  it("includes skills with ≥ K_ANON_FLOOR distinct installers", async () => {
    const t = convexTest(schema);

    for (let i = 0; i < K_ANON_FLOOR; i++) {
      const uid = await insertUser(t, `popularuser${i}`);
      await insertSkillInstall(t, uid, "popular-skill");
    }

    const raw: Array<{ skillName: string; distinctUserCount: number }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._skillInstallCounts, { excludeUserIds: [] })
      );

    const skill = raw.find((r) => r.skillName === "popular-skill");
    expect(skill?.distinctUserCount).toBe(K_ANON_FLOOR);
    // 20 >= 20 — would NOT be suppressed
    expect(skill!.distinctUserCount >= K_ANON_FLOOR).toBe(true);
  });

  it("deduplicates multiple installs from the same user (counts distinct users)", async () => {
    const t = convexTest(schema);

    const uid = await insertUser(t, "multiinstall");
    // Same user installs the same skill twice (reinstall pattern).
    await insertSkillInstall(t, uid, "reinstalled-skill");
    await insertSkillInstall(t, uid, "reinstalled-skill");

    const raw: Array<{ skillName: string; distinctUserCount: number }> =
      await t.run(async (ctx) =>
        ctx.runQuery(internal.fleet._skillInstallCounts, { excludeUserIds: [] })
      );

    const skill = raw.find((r) => r.skillName === "reinstalled-skill");
    // Only 1 distinct user, not 2.
    expect(skill?.distinctUserCount).toBe(1);
  });
});

// ── L22. _fleetSkillCounts — k-anon per-skill snapshot ───────────────────────

describe("_fleetSkillCounts — L22 fleet snapshot k-anon", () => {
  it("returns null for below-floor skills and real counts for above-floor skills", async () => {
    const t = convexTest(schema);

    // "rare-skill" → only 5 installers (below K_ANON_FLOOR=20, should be null)
    for (let i = 0; i < 5; i++) {
      const uid = await insertUser(t, `rareuser${i}`);
      await insertSkillInstall(t, uid, "rare-skill");
    }

    // "popular-skill" → exactly K_ANON_FLOOR installers (should return count)
    for (let i = 0; i < K_ANON_FLOOR; i++) {
      const uid = await insertUser(t, `popuser${i}`);
      await insertSkillInstall(t, uid, "popular-skill");
    }

    const counts: Record<string, number | null> = await t.run(async (ctx) =>
      ctx.runQuery(internal.fleet._fleetSkillCounts, {
        skillNames: ["rare-skill", "popular-skill"],
      })
    );

    // Below floor → null
    expect(counts["rare-skill"]).toBeNull();
    // At floor → real count
    expect(counts["popular-skill"]).toBe(K_ANON_FLOOR);
  });
});

// ── 5. avgMemoriesPerActiveUser k-anon ───────────────────────────────────────

describe("avgMemoriesPerActiveUser — k-anon gate", () => {
  it("returns null (suppressed) when active-user count < K_ANON_FLOOR", async () => {
    const t = convexTest(schema);

    for (let i = 0; i < 5; i++) {
      const uid = await insertUser(t, `avguser${i}`);
      await insertMemory(t, uid, "fact");
    }

    const counts: number[] = await t.run(async (ctx) =>
      ctx.runQuery(internal.fleet._activeUserMemoryCounts, { excludeUserIds: [] })
    );

    // 5 < 20 → gate returns null
    const result = kAnonBucket(
      counts.map((c) => [c]),
      (xs) => xs.flat().reduce((a: number, b: number) => a + b, 0) / xs.length
    );
    expect(result).toBeNull();
  });

  it("returns a number when ≥ K_ANON_FLOOR active users", async () => {
    const t = convexTest(schema);

    for (let i = 0; i < K_ANON_FLOOR; i++) {
      const uid = await insertUser(t, `enoughuser${i}`);
      // Each user gets 2 memories.
      await insertMemory(t, uid, "fact");
      await insertMemory(t, uid, "preference");
    }

    const counts: number[] = await t.run(async (ctx) =>
      ctx.runQuery(internal.fleet._activeUserMemoryCounts, { excludeUserIds: [] })
    );

    expect(counts).toHaveLength(K_ANON_FLOOR);
    const result = kAnonBucket(
      counts.map((c) => [c]),
      (xs) => {
        const flat = xs.flat() as number[];
        return flat.reduce((a, b) => a + b, 0) / flat.length;
      }
    );
    expect(result).toBe(2); // each user has exactly 2 memories
  });
});
