/**
 * L19 — Nightly memory consolidation tests (convex-test, deterministic v1).
 *
 * Pins the consolidateUser contract as specified in:
 *   project-context/audits/2026-06-11/L-SERIES-EXECUTION-PLAN.md (Lane C L19)
 *   project-context/audits/2026-06-11/SELF-IMPROVING-SYSTEM-DESIGN.md
 *     (consolidation loop, Stage-1 deterministic gates)
 *
 * Contract assertions:
 *   1. Duplicate supersede: keep oldest; mark rest supersededBy=oldestId (NEVER delete)
 *   2. Pinned/durable/correction memories are NEVER archived
 *   3. Idempotency: second run on the same date = no-op (skipped: true)
 *   4. 200-mutation cap: stops after MAX_MUTATIONS_PER_USER writes
 *   5. consolidationRuns row is written after a real (non-skipped) run
 *
 * NOTE: consolidateUser is an internalMutation; convex-test exercises it via
 * t.run (direct db access) and we use internal.consolidation.consolidateUser
 * via t.run to simulate the cron calling it.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const DAY = 86400000;

async function seedUser(t: ReturnType<typeof convexTest>, username = "alice") {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `clerk_${username}`,
      username,
      email: `${username}@example.com`,
      plan: "pro",
      createdAt: Date.now(),
    });
  });
}

/**
 * Insert a memory directly via t.run (bypasses auth — internal test helper).
 */
async function insertMemory(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  opts: {
    content: string;
    category?: string;
    contentHash?: string;
    pinned?: boolean;
    importance?: number;
    isArchived?: boolean;
    createdAt?: number;
  }
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("memories", {
      userId,
      category: opts.category ?? "context",
      content: opts.content,
      source: "cli",
      isArchived: opts.isArchived ?? false,
      pinned: opts.pinned,
      importance: opts.importance,
      contentHash: opts.contentHash,
      createdAt: opts.createdAt ?? Date.now(),
    })
  );
}

// ── 1. Duplicate supersede keeps oldest ──────────────────────────────────────

describe("consolidateUser — exact-duplicate sweep", () => {
  it("keeps the oldest memory and supersedes the newer duplicates", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const HASH = "deadbeef".repeat(8); // 64-char fake sha256

    const oldId = await insertMemory(t, userId, {
      content: "based in Miami",
      contentHash: HASH,
      createdAt: 100,
    });
    const newId1 = await insertMemory(t, userId, {
      content: "based in Miami",
      contentHash: HASH,
      createdAt: 200,
    });
    const newId2 = await insertMemory(t, userId, {
      content: "based in Miami",
      contentHash: HASH,
      createdAt: 300,
    });

    const result = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    expect(result).toMatchObject({ skipped: false, duplicatesSuperseded: 2 });

    const docs = await t.run(async (ctx) => ctx.db.query("memories").collect());
    const byId = Object.fromEntries(docs.map((d) => [d._id, d]));

    // Oldest: NOT superseded.
    expect(byId[oldId]?.supersededBy).toBeUndefined();
    // Newer duplicates: superseded → oldId.
    expect(byId[newId1]?.supersededBy).toBe(oldId);
    expect(byId[newId2]?.supersededBy).toBe(oldId);
    // Rows are NOT deleted.
    expect(docs).toHaveLength(3);
  });

  it("ignores memories without a contentHash (pre-P23 rows)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    // Two rows with identical content but no hash — should not be touched.
    await insertMemory(t, userId, { content: "no hash row 1", createdAt: 100 });
    await insertMemory(t, userId, { content: "no hash row 2", createdAt: 200 });

    const result = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    expect(result.duplicatesSuperseded).toBe(0);
    const docs = await t.run(async (ctx) => ctx.db.query("memories").collect());
    // No supersededBy set on either.
    for (const d of docs) {
      expect(d.supersededBy).toBeUndefined();
    }
  });
});

// ── 2. Protected memories are NEVER archived ─────────────────────────────────

describe("consolidateUser — stale-ephemeral demotion guards", () => {
  const OLD = Date.now() - 60 * DAY; // 60 days old, > STALE_THRESHOLD_DAYS (30)

  it("never archives pinned memories", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const pinnedId = await insertMemory(t, userId, {
      content: "pinned context",
      category: "context",
      pinned: true,
      createdAt: OLD,
    });

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const doc = await t.run(async (ctx) => ctx.db.get(pinnedId));
    expect(doc?.isArchived).toBe(false);
  });

  it("never archives durable categories (preference/decision/goal/fact)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const ids = await Promise.all(
      ["preference", "decision", "goal", "fact"].map((category) =>
        insertMemory(t, userId, { content: `${category} memory`, category, createdAt: OLD })
      )
    );

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const docs = await t.run(async (ctx) =>
      Promise.all(ids.map((id) => ctx.db.get(id)))
    );
    for (const doc of docs) {
      expect(doc?.isArchived).toBe(false);
    }
  });

  it("never archives correction category", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const id = await insertMemory(t, userId, {
      content: "actually uses Convex, not Supabase",
      category: "correction",
      createdAt: OLD,
    });

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.isArchived).toBe(false);
  });

  it("never archives memories with importance set (even if old and non-durable)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const id = await insertMemory(t, userId, {
      content: "old but important context",
      category: "context",
      importance: 3,
      createdAt: OLD,
    });

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.isArchived).toBe(false);
  });

  it("archives old non-durable, non-pinned, no-importance memories", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const id = await insertMemory(t, userId, {
      content: "stale ephemeral context",
      category: "context",
      createdAt: OLD,
    });

    const result = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    expect(result.archived).toBeGreaterThan(0);
    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.isArchived).toBe(true);
  });

  it("does not archive memories newer than the stale threshold", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const RECENT = Date.now() - 5 * DAY; // 5 days old — below threshold
    const id = await insertMemory(t, userId, {
      content: "fresh context",
      category: "context",
      createdAt: RECENT,
    });

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.isArchived).toBe(false);
  });
});

// ── 3. Idempotency per date ──────────────────────────────────────────────────

describe("consolidateUser — idempotency", () => {
  it("skips a second run on the same UTC date", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const first = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );
    expect(first.skipped).toBe(false);

    const second = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );
    expect(second).toMatchObject({ skipped: true, reason: "already_ran_today" });
  });

  it("does not write a second consolidationRuns row", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );
    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const rows = await t.run(async (ctx) =>
      ctx.db.query("consolidationRuns").collect()
    );
    expect(rows).toHaveLength(1);
  });
});

// ── 4. 200-mutation cap ──────────────────────────────────────────────────────

describe("consolidateUser — mutation cap", () => {
  it("stops after MAX_MUTATIONS_PER_USER (200) writes and returns gracefully", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const OLD = Date.now() - 60 * DAY;
    // Insert 250 stale non-durable memories — more than the cap.
    await t.run(async (ctx) => {
      for (let i = 0; i < 250; i++) {
        await ctx.db.insert("memories", {
          userId,
          category: "context",
          content: `stale context ${i}`,
          source: "cli",
          isArchived: false,
          createdAt: OLD + i,
        });
      }
    });

    const result = await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    // No more than 200 mutations should have been applied.
    const totalMutations =
      (result.duplicatesSuperseded ?? 0) + (result.archived ?? 0);
    expect(totalMutations).toBeLessThanOrEqual(200);
    // Run completes (does not throw) — cap is a soft stop, not an error.
    expect(result.skipped).toBe(false);
  });
});

// ── 5. consolidationRuns row is written ──────────────────────────────────────

describe("consolidateUser — consolidationRuns record", () => {
  it("writes a consolidationRuns row with today's UTC date after a successful run", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const rows = await t.run(async (ctx) =>
      ctx.db.query("consolidationRuns").collect()
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.userId).toBe(userId);
    expect(row.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}$/); // "YYYY-MM-DD"
    expect(typeof row.duplicatesSuperseded).toBe("number");
    expect(typeof row.archived).toBe("number");
    expect(typeof row.reviewQueueSize).toBe("number");
  });

  it("records correct duplicatesSuperseded count in the run row", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const HASH = "aabbccdd".repeat(8);
    // 3 rows same hash: 2 should be superseded.
    for (let i = 0; i < 3; i++) {
      await insertMemory(t, userId, {
        content: "same content",
        contentHash: HASH,
        createdAt: 100 + i,
      });
    }

    await t.run(async (ctx) =>
      ctx.runMutation(internal.consolidation.consolidateUser, { userId })
    );

    const rows = await t.run(async (ctx) =>
      ctx.db.query("consolidationRuns").collect()
    );
    expect(rows[0].duplicatesSuperseded).toBe(2);
  });
});
