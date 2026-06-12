/**
 * Memories integration tests via convex-test (T3).
 *
 * Runs convex/memories.ts against the in-memory convex-test backend:
 * seeds rows with t.run, calls the real query/mutation handlers, and pins
 * the auth + filtering contract that the HTTP layer (convex/http.ts memory
 * routes, MCP search_memories) depends on:
 *   - requireOwner: unauthenticated callers are rejected
 *   - userId must match the authenticated user (no cross-user reads)
 *   - archived memories never surface
 *   - search results carry full memory docs (relevance shape)
 *
 * NOTE: the httpAction auth flow itself (Bearer key -> requireScope ->
 * _internalAuthToken bypass) is not exercised here — convex-test does not
 * run httpRouter routes with the production env secrets. The underlying
 * queries/mutations are tested instead via t.withIdentity.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const ALICE_CLERK = "clerk_alice";
const BOB_CLERK = "clerk_bob";

async function seed(t: ReturnType<typeof convexTest>) {
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

    const mem = (
      userId: Id<"users">,
      content: string,
      opts: { category?: string; isArchived?: boolean; createdAt?: number } = {}
    ) =>
      ctx.db.insert("memories", {
        userId,
        category: opts.category ?? "fact",
        content,
        source: "cli",
        isArchived: opts.isArchived ?? false,
        createdAt: opts.createdAt ?? Date.now(),
      });

    await mem(aliceId, "prefers convex over supabase", {
      category: "preference",
      createdAt: 100,
    });
    await mem(aliceId, "was debugging convex search indexes", {
      category: "context",
      createdAt: 200,
    });
    await mem(aliceId, "archived convex note that must never surface", {
      isArchived: true,
      createdAt: 300,
    });
    await mem(aliceId, "based in Miami", { category: "fact", createdAt: 400 });
    // Bob has a matching memory that must never leak into Alice's results.
    await mem(bobId, "bob also loves convex", { category: "fact", createdAt: 500 });

    return { aliceId, bobId };
  });
}

describe("memories.searchMemories", () => {
  it("returns only the caller's active memories matching the search text", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "convex",
    });

    const contents = results.map((m) => m.content).sort();
    expect(contents).toEqual([
      "prefers convex over supabase",
      "was debugging convex search indexes",
    ]);
    // userId filtering: nothing of Bob's, even though it matches.
    expect(results.every((m) => m.userId === aliceId)).toBe(true);
    // isArchived exclusion: the archived convex note is absent.
    expect(results.every((m) => m.isArchived === false)).toBe(true);
  });

  it("returns full memory docs (relevance shape)", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "supabase",
    });

    expect(results).toHaveLength(1);
    const doc = results[0];
    expect(doc._id).toBeDefined();
    expect(doc._creationTime).toBeDefined();
    expect(doc).toMatchObject({
      userId: aliceId,
      category: "preference",
      content: "prefers convex over supabase",
      source: "cli",
      isArchived: false,
    });
  });

  it("returns [] for blank search text", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "   ",
    });
    expect(results).toEqual([]);
  });

  it("clamps limit to at least 1 result max when limit=1", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "convex",
      limit: 1,
    });
    expect(results).toHaveLength(1);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);

    await expect(
      t.query(api.memories.searchMemories, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        searchText: "convex",
      })
    ).rejects.toThrow(/authentication required/);
  });

  it("rejects a caller searching another user's memories", async () => {
    const t = convexTest(schema);
    const { bobId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    // Alice authenticates as herself but asks for Bob's userId.
    await expect(
      asAlice.query(api.memories.searchMemories, {
        clerkId: ALICE_CLERK,
        userId: bobId,
        searchText: "convex",
      })
    ).rejects.toThrow(/not authorized/);

    // And she cannot simply claim Bob's clerkId either.
    await expect(
      asAlice.query(api.memories.searchMemories, {
        clerkId: BOB_CLERK,
        userId: bobId,
        searchText: "convex",
      })
    ).rejects.toThrow(/not authorized/);
  });
});

describe("memories.listMemories", () => {
  it("lists active memories newest-first, excluding archived", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });

    expect(results.map((m) => m.content)).toEqual([
      "based in Miami",
      "was debugging convex search indexes",
      "prefers convex over supabase",
    ]);
  });

  it("filters by category via the by_userId_category index", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const results = await asAlice.query(api.memories.listMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      category: "preference",
    });
    expect(results.map((m) => m.content)).toEqual([
      "prefers convex over supabase",
    ]);
  });
});

describe("memories.saveMemories", () => {
  it("writes memories for the authenticated user and round-trips via search", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seed(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const saved = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [
        {
          category: "decision",
          content: "switched the accent color to burnt orange",
          source: "you-agent",
        },
      ],
    });
    // P23: `saved` stays the inserted count; `deduped`/`results` are additive
    // (see memoryDedupe.test.ts for the dedupe contract).
    expect(saved).toMatchObject({ saved: 1, deduped: 0 });
    expect(saved.results).toHaveLength(1);
    expect(saved.results[0].deduped).toBe(false);

    const results = await asAlice.query(api.memories.searchMemories, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "burnt orange",
    });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe(aliceId);
    expect(results[0].isArchived).toBe(false);
  });

  it("rejects unauthenticated writes", async () => {
    const t = convexTest(schema);
    await seed(t);

    await expect(
      t.mutation(api.memories.saveMemories, {
        clerkId: ALICE_CLERK,
        memories: [
          { category: "fact", content: "anonymous write", source: "cli" },
        ],
      })
    ).rejects.toThrow(/authentication required/);
  });
});
