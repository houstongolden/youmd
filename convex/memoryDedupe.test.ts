/**
 * P23 — memory content-hash dedupe tests (PRODUCT-AUDIT #25).
 *
 * Pins the dedupe contract on convex/memories.ts saveMemories /
 * saveFromAgent (the mutations behind POST /api/v1/me/memories and the You
 * Agent auto-capture):
 *   - an exact duplicate (same normalized content + category) of an ACTIVE
 *     memory is skipped and the existing memory is returned `deduped: true`
 *   - normalization: whitespace/case differences still dedupe
 *   - same content under a DIFFERENT category inserts normally
 *   - an ARCHIVED duplicate never blocks a fresh insert
 *   - rows keep `saved` = actually-inserted count (back-compat) with the
 *     additive `deduped` count + per-item `results`
 *
 * NOTE (same gap as memories.test.ts): the httpAction route layer is not
 * executed by convex-test; the mutations the route calls are tested via
 * t.withIdentity.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";
import { computeMemoryContentHash, normalizeMemoryText } from "./lib/hash";

const ALICE_CLERK = "clerk_alice";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: ALICE_CLERK,
      username: "alice",
      email: "alice@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

const MEM = {
  category: "fact",
  content: "Based in Miami",
  source: "cli",
};

describe("lib/hash memory hashing", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeMemoryText("  Based   in\nMiami ")).toBe("based in miami");
  });

  it("hash differs when category differs, matches across formatting", async () => {
    const a = await computeMemoryContentHash("Based in Miami", "fact");
    const b = await computeMemoryContentHash("based  in   miami", "FACT");
    const c = await computeMemoryContentHash("Based in Miami", "context");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("memories.saveMemories dedupe", () => {
  it("skips an exact duplicate of an active memory and returns it deduped", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const first = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    expect(first.saved).toBe(1);
    expect(first.deduped).toBe(0);
    const firstId = first.results[0].id;

    const second = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    expect(second.saved).toBe(0);
    expect(second.deduped).toBe(1);
    // The EXISTING memory is returned, marked deduped.
    expect(second.results).toEqual([{ id: firstId, deduped: true }]);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("memories").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("dedupes across whitespace/case variants (normalized hash)", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    const variant = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [{ ...MEM, content: "  based   IN miami " }],
    });
    expect(variant.saved).toBe(0);
    expect(variant.deduped).toBe(1);
  });

  it("inserts the same content under a different category", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    const other = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [{ ...MEM, category: "context" }],
    });
    expect(other.saved).toBe(1);
    expect(other.deduped).toBe(0);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("memories").collect()
    );
    expect(rows).toHaveLength(2);
  });

  it("an archived duplicate does not block a fresh insert", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const first = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    await asAlice.mutation(api.memories.archiveMemory, {
      clerkId: ALICE_CLERK,
      memoryId: first.results[0].id,
    });

    const again = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    expect(again.saved).toBe(1);
    expect(again.deduped).toBe(0);
    expect(again.results[0].id).not.toBe(first.results[0].id);

    const rows = await t.run(async (ctx) =>
      ctx.db.query("memories").collect()
    );
    expect(rows).toHaveLength(2);
    expect(rows.filter((m) => !m.isArchived)).toHaveLength(1);
  });

  it("dedupes duplicates within a single batch", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const result = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM, { ...MEM, content: "BASED IN MIAMI" }],
    });
    expect(result.saved).toBe(1);
    expect(result.deduped).toBe(1);
    expect(result.results[1]).toEqual({
      id: result.results[0].id,
      deduped: true,
    });
  });
});

describe("memories.saveFromAgent dedupe", () => {
  it("skips active duplicates through the agent path too (retried POST /me/memories)", async () => {
    const t = convexTest(schema);
    const aliceId = await seedUser(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const first = await asAlice.mutation(api.memories.saveFromAgent, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      agentName: "Claude Code",
      memories: [{ category: "fact", content: "Based in Miami" }],
    });
    expect(first.saved).toBe(1);

    const retry = await asAlice.mutation(api.memories.saveFromAgent, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      agentName: "Claude Code",
      memories: [{ category: "fact", content: "Based in Miami" }],
    });
    expect(retry.saved).toBe(0);
    expect(retry.deduped).toBe(1);
    expect(retry.results[0]).toEqual({
      id: first.results[0].id,
      deduped: true,
    });
  });

  it("pre-P23 rows without contentHash never dedupe-match", async () => {
    const t = convexTest(schema);
    const aliceId = await seedUser(t);
    // Legacy row: same content, no contentHash field.
    await t.run(async (ctx) => {
      await ctx.db.insert("memories", {
        userId: aliceId,
        category: "fact",
        content: "Based in Miami",
        source: "cli",
        isArchived: false,
        createdAt: Date.now(),
      });
    });
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    const result = await asAlice.mutation(api.memories.saveMemories, {
      clerkId: ALICE_CLERK,
      memories: [MEM],
    });
    // Legacy rows are invisible to the hash index — new row inserts.
    expect(result.saved).toBe(1);
  });
});
