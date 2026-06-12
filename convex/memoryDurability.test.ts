/**
 * P14/P15 — memory durability + category validation integration tests.
 *
 * Runs convex/memories.ts against the in-memory convex-test backend and pins:
 * - P15 write validation: unknown categories rejected (ConvexError), known
 *   legacy aliases normalized to canonical on insert
 * - P14 write paths: pinned/importance persisted, importance range enforced
 * - supersedeMemory: old→new link, ownership checks, self-supersede rejected
 * - superseded exclusion: list/search/page hide superseded rows by default;
 *   includeSuperseded=true surfaces them on list queries
 * - listReviewQueue: active, non-pinned, low/unset-importance rows older
 *   than 90 days, oldest first, capped at 50
 * - pinned exemption from archiveStale decay
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const ALICE_CLERK = "clerk_alice";
const BOB_CLERK = "clerk_bob";

const DAY = 86400000;

async function seedUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      clerkId: ALICE_CLERK,
      username: "alice",
      email: "alice@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    const bobId = await ctx.db.insert("users", {
      clerkId: BOB_CLERK,
      username: "bob",
      email: "bob@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    return { aliceId, bobId };
  });
}

function asAlice(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({ subject: ALICE_CLERK });
}

describe("P15 — category validation on writes", () => {
  it("rejects unknown categories in saveMemories with a ConvexError", async () => {
    const t = convexTest(schema);
    await seedUsers(t);

    await expect(
      asAlice(t).mutation(api.memories.saveMemories, {
        clerkId: ALICE_CLERK,
        memories: [{ category: "vibes", content: "nope", source: "cli" }],
      })
    ).rejects.toThrow(/invalid memory category: vibes/);
  });

  it("rejects unknown categories in saveFromAgent", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);

    await expect(
      asAlice(t).mutation(api.memories.saveFromAgent, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        agentName: "test-agent",
        memories: [{ category: "definitely-not-real", content: "nope" }],
      })
    ).rejects.toThrow(/invalid memory category/);
  });

  it("rejects unknown categories in updateMemory but tolerates legacy stored values on read", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const memoryId = await t.run(async (ctx) =>
      ctx.db.insert("memories", {
        userId: aliceId,
        category: "identity", // legacy stored value — must still be readable
        content: "legacy row",
        source: "you-agent",
        isArchived: false,
        createdAt: Date.now(),
      })
    );

    // Read tolerance: the legacy row surfaces as-is.
    const listed = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(listed.map((m) => m.category)).toEqual(["identity"]);

    // Write strictness: an unknown category on update is rejected.
    await expect(
      asAlice(t).mutation(api.memories.updateMemory, {
        clerkId: ALICE_CLERK,
        memoryId,
        category: "blorp",
      })
    ).rejects.toThrow(/invalid memory category/);
  });

  it("normalizes known legacy aliases to canonical on insert", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);

    await asAlice(t).mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [
        { category: "identity", content: "born in Texas", source: "you-agent" },
        { category: "goals", content: "ship you.md", source: "you-agent" },
      ],
    });

    const listed = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(listed.map((m) => m.category).sort()).toEqual(["fact", "goal"]);
  });

  it("accepts and persists the new correction category", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);

    const saved = await asAlice(t).mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [
        {
          category: "correction",
          content: "actually uses Convex, NOT Supabase",
          source: "you-agent",
        },
      ],
    });
    expect(saved.saved).toBe(1);

    const listed = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      category: "correction",
    });
    expect(listed).toHaveLength(1);
    expect(listed[0].category).toBe("correction");
  });
});

describe("P14 — pinned/importance write paths", () => {
  it("saveMemories persists pinned and importance", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);

    await asAlice(t).mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [
        {
          category: "preference",
          content: "monochrome plus burnt orange",
          source: "you-agent",
          pinned: true,
          importance: 5,
        },
      ],
    });

    const listed = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(listed[0].pinned).toBe(true);
    expect(listed[0].importance).toBe(5);
  });

  it("rejects importance outside 1-5 and non-integers", async () => {
    const t = convexTest(schema);
    await seedUsers(t);

    for (const importance of [0, 6, 2.5]) {
      await expect(
        asAlice(t).mutation(api.memories.saveMemories, {
          clerkId: ALICE_CLERK,
          memories: [
            { category: "fact", content: `imp ${importance}`, source: "cli", importance },
          ],
        })
      ).rejects.toThrow(/invalid importance/);
    }
  });

  it("updateMemory supports pinning (PATCH path)", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const memoryId = await t.run(async (ctx) =>
      ctx.db.insert("memories", {
        userId: aliceId,
        category: "fact",
        content: "pin me",
        source: "cli",
        isArchived: false,
        createdAt: Date.now(),
      })
    );

    await asAlice(t).mutation(api.memories.updateMemory, {
      clerkId: ALICE_CLERK,
      memoryId,
      pinned: true,
      importance: 4,
    });

    const doc = await t.run(async (ctx) => ctx.db.get(memoryId));
    expect(doc?.pinned).toBe(true);
    expect(doc?.importance).toBe(4);
  });
});

describe("P14 — supersedeMemory", () => {
  async function seedPair(t: ReturnType<typeof convexTest>, userId: Id<"users">) {
    return await t.run(async (ctx) => {
      const oldId = await ctx.db.insert("memories", {
        userId,
        category: "fact",
        content: "lives in Austin",
        source: "cli",
        isArchived: false,
        createdAt: 100,
      });
      const newId = await ctx.db.insert("memories", {
        userId,
        category: "correction",
        content: "lives in Miami",
        source: "cli",
        isArchived: false,
        createdAt: 200,
      });
      return { oldId, newId };
    });
  }

  it("links old to new and excludes the old row from default reads", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const { oldId, newId } = await seedPair(t, aliceId);

    const result = await asAlice(t).mutation(api.memories.supersedeMemory, {
      clerkId: ALICE_CLERK,
      memoryId: oldId,
      supersededBy: newId,
    });
    expect(result).toEqual({ superseded: oldId, by: newId });

    // Default list hides the superseded row.
    const listed = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(listed.map((m) => m.content)).toEqual(["lives in Miami"]);

    // includeSuperseded=true surfaces it again.
    const audited = await asAlice(t).query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      includeSuperseded: true,
    });
    expect(audited.map((m) => m.content).sort()).toEqual([
      "lives in Austin",
      "lives in Miami",
    ]);

    // Search never surfaces superseded rows.
    const found = await asAlice(t).query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "Austin",
    });
    expect(found).toEqual([]);

    // Paginated list hides it by default and shows it with the flag.
    const page = await asAlice(t).query(api.memories.listMemoriesPage, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      numItems: 10,
    });
    expect(page.page.map((m) => m.content)).toEqual(["lives in Miami"]);
    const auditedPage = await asAlice(t).query(api.memories.listMemoriesPage, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      includeSuperseded: true,
      numItems: 10,
    });
    expect(auditedPage.page).toHaveLength(2);
  });

  it("rejects superseding with another user's memory (ownership check)", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    const { oldId } = await seedPair(t, aliceId);
    const bobMemId = await t.run(async (ctx) =>
      ctx.db.insert("memories", {
        userId: bobId,
        category: "fact",
        content: "bob's memory",
        source: "cli",
        isArchived: false,
        createdAt: 100,
      })
    );

    // New memory belongs to Bob — rejected.
    await expect(
      asAlice(t).mutation(api.memories.supersedeMemory, {
        clerkId: ALICE_CLERK,
        memoryId: oldId,
        supersededBy: bobMemId,
      })
    ).rejects.toThrow(/memory not found/);

    // Old memory belongs to Bob — rejected.
    const { newId } = await seedPair(t, aliceId);
    await expect(
      asAlice(t).mutation(api.memories.supersedeMemory, {
        clerkId: ALICE_CLERK,
        memoryId: bobMemId,
        supersededBy: newId,
      })
    ).rejects.toThrow(/memory not found/);

    // Bob's row was never touched.
    const bobDoc = await t.run(async (ctx) => ctx.db.get(bobMemId));
    expect(bobDoc?.supersededBy).toBeUndefined();
  });

  it("rejects self-supersede", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const { oldId } = await seedPair(t, aliceId);

    await expect(
      asAlice(t).mutation(api.memories.supersedeMemory, {
        clerkId: ALICE_CLERK,
        memoryId: oldId,
        supersededBy: oldId,
      })
    ).rejects.toThrow(/cannot supersede itself/);
  });
});

describe("P14 — listReviewQueue", () => {
  it("returns only active, non-pinned, low/unset-importance rows older than 90 days", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const old = Date.now() - 120 * DAY;

    const newMemId = await t.run(async (ctx) => {
      const mem = (
        content: string,
        opts: {
          createdAt: number;
          pinned?: boolean;
          importance?: number;
          isArchived?: boolean;
          supersededBy?: Id<"memories">;
        }
      ) =>
        ctx.db.insert("memories", {
          userId: aliceId,
          category: "context",
          content,
          source: "cli",
          isArchived: opts.isArchived ?? false,
          createdAt: opts.createdAt,
          pinned: opts.pinned,
          importance: opts.importance,
          supersededBy: opts.supersededBy,
        });

      const replacement = await mem("replacement", { createdAt: Date.now() });
      await mem("old unset importance", { createdAt: old });
      await mem("old low importance", { createdAt: old + 1, importance: 2 });
      await mem("old but important", { createdAt: old, importance: 5 });
      await mem("old but pinned", { createdAt: old, pinned: true });
      await mem("old but archived", { createdAt: old, isArchived: true });
      await mem("old but superseded", { createdAt: old, supersededBy: replacement });
      await mem("recent unset importance", { createdAt: Date.now() });
      return replacement;
    });
    void newMemId;

    const queue = await asAlice(t).query(api.memories.listReviewQueue, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });

    expect(queue.map((m) => m.content)).toEqual([
      "old unset importance",
      "old low importance",
    ]);
  });

  it("caps the queue at 50, oldest first", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const base = Date.now() - 200 * DAY;

    await t.run(async (ctx) => {
      for (let i = 0; i < 60; i++) {
        await ctx.db.insert("memories", {
          userId: aliceId,
          category: "context",
          content: `stale ${i}`,
          source: "cli",
          isArchived: false,
          createdAt: base + i,
        });
      }
    });

    const queue = await asAlice(t).query(api.memories.listReviewQueue, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(queue).toHaveLength(50);
    expect(queue[0].content).toBe("stale 0");
    expect(queue[49].content).toBe("stale 49");
  });

  it("rejects cross-user access", async () => {
    const t = convexTest(schema);
    const { bobId } = await seedUsers(t);

    await expect(
      asAlice(t).query(api.memories.listReviewQueue, {
        clerkId: ALICE_CLERK,
        userId: bobId,
      })
    ).rejects.toThrow(/not authorized/);
  });
});

describe("P14 — pinned memories survive decay", () => {
  it("archiveStale never archives pinned memories", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const old = Date.now() - 365 * DAY;

    const { pinnedId, staleId } = await t.run(async (ctx) => {
      const pinnedId = await ctx.db.insert("memories", {
        userId: aliceId,
        category: "context",
        content: "pinned forever",
        source: "cli",
        isArchived: false,
        createdAt: old,
        pinned: true,
      });
      const staleId = await ctx.db.insert("memories", {
        userId: aliceId,
        category: "context",
        content: "stale note",
        source: "cli",
        isArchived: false,
        createdAt: old,
      });
      return { pinnedId, staleId };
    });

    const result = await asAlice(t).mutation(api.memories.archiveStale, {
      clerkId: ALICE_CLERK,
    });
    expect(result.archived).toBe(1);

    const pinnedDoc = await t.run(async (ctx) => ctx.db.get(pinnedId));
    const staleDoc = await t.run(async (ctx) => ctx.db.get(staleId));
    expect(pinnedDoc?.isArchived).toBe(false);
    expect(staleDoc?.isArchived).toBe(true);
  });
});
