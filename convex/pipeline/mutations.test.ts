/**
 * Immutable-source enforcement tests for recordRawSourceVersion.
 *
 * 1. First fetch records a version and sets the source pointer.
 * 2. Re-fetching identical content does NOT create a new version (no overwrite).
 * 3. Changed content appends a NEW version; the prior version row survives.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

async function seed(t: ReturnType<typeof convexTest>): Promise<{ userId: Id<"users">; sourceId: Id<"sources"> }> {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { clerkId: "ck_x", username: "x", email: "x@x.com", plan: "pro", createdAt: Date.now() }),
  );
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      userId,
      sourceType: "website",
      sourceUrl: "https://a.com",
      status: "fetched",
    }),
  );
  return { userId, sourceId };
}

function versions(t: ReturnType<typeof convexTest>, sourceId: Id<"sources">) {
  return t.run((ctx) =>
    ctx.db
      .query("rawSourceVersions")
      .withIndex("by_sourceId", (q) => q.eq("sourceId", sourceId))
      .collect(),
  );
}

describe("recordRawSourceVersion — immutable source ledger", () => {
  it("records the first version and points the source at it", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);

    const res = await t.mutation(internal.pipeline.mutations.recordRawSourceVersion, {
      sourceId,
      contentHash: "hash-1",
      fetchedAt: 1000,
    });
    expect(res.recorded).toBe(true);

    const rows = await versions(t, sourceId);
    expect(rows).toHaveLength(1);
    expect(rows[0].contentHash).toBe("hash-1");

    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.lastRawContentHash).toBe("hash-1");
    expect(source?.latestVersionId).toBe(rows[0]._id);
  });

  it("does not version identical content (no in-place churn)", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);

    await t.mutation(internal.pipeline.mutations.recordRawSourceVersion, { sourceId, contentHash: "hash-1", fetchedAt: 1000 });
    const res = await t.mutation(internal.pipeline.mutations.recordRawSourceVersion, { sourceId, contentHash: "hash-1", fetchedAt: 2000 });

    expect(res.recorded).toBe(false);
    expect(await versions(t, sourceId)).toHaveLength(1);
  });

  it("appends a new version on change and never deletes the prior one", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);

    await t.mutation(internal.pipeline.mutations.recordRawSourceVersion, { sourceId, contentHash: "hash-1", fetchedAt: 1000 });
    await t.mutation(internal.pipeline.mutations.recordRawSourceVersion, { sourceId, contentHash: "hash-2", fetchedAt: 2000 });

    const rows = await versions(t, sourceId);
    expect(rows).toHaveLength(2);
    const hashes = rows.map((r) => r.contentHash).sort();
    expect(hashes).toEqual(["hash-1", "hash-2"]); // prior version preserved

    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.lastRawContentHash).toBe("hash-2"); // pointer advanced
  });
});
