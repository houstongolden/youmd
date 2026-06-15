import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const CLERK = "clerk_source_action_owner";

async function seed(t: ReturnType<typeof convexTest>): Promise<{
  userId: Id<"users">;
  sourceId: Id<"sources">;
}> {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: CLERK,
      username: "source-action-owner",
      email: "source-action@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      userId,
      sourceType: "website",
      sourceUrl: "https://example.com",
      crawlerProvider: "native",
      refreshPolicy: "daily",
      visibility: "private",
      trustLevel: "medium",
      status: "extracted",
      nextRefreshAt: Date.now() + 24 * 60 * 60 * 1000,
      failureCount: 2,
      errorMessage: "old error",
    })
  );
  return { userId, sourceId };
}

describe("source owner actions", () => {
  it("marks a source pending for immediate refresh", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(api.me.refreshSourceNow, { clerkId: CLERK, sourceId });

    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.status).toBe("pending");
    expect(source?.errorMessage).toBeUndefined();
    expect(source?.metadata).toMatchObject({ refreshRequestedFrom: "sources-pane" });
  });

  it("pauses cron refreshes and updates connector policy", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(api.me.pauseSourceRefresh, { clerkId: CLERK, sourceId });
    let source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.refreshPolicy).toBe("manual");
    expect(source?.nextRefreshAt).toBeUndefined();

    await asOwner.mutation(api.me.updateSourcePolicy, {
      clerkId: CLERK,
      sourceId,
      crawlerProvider: "firecrawl",
      refreshPolicy: "weekly",
      visibility: "scoped",
      trustLevel: "high",
    });

    source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source).toMatchObject({
      crawlerProvider: "firecrawl",
      refreshPolicy: "weekly",
      visibility: "scoped",
      trustLevel: "high",
    });
    expect(source?.nextRefreshAt).toBeGreaterThan(Date.now());
  });

  it("lists raw source versions for the owning user", async () => {
    const t = convexTest(schema);
    const { userId, sourceId } = await seed(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await t.run((ctx) =>
      ctx.db.insert("rawSourceVersions", {
        userId,
        sourceId,
        sourceUrl: "https://example.com",
        contentHash: "hash-1",
        fetchedAt: 1000,
      })
    );

    const versions = await asOwner.query(api.me.getSourceVersions, {
      clerkId: CLERK,
      sourceId,
    });

    expect(versions).toHaveLength(1);
    expect(versions[0].contentHash).toBe("hash-1");
  });

  it("approves a cost-bounded crawler run window", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const result = await asOwner.mutation(api.me.approveSourceRun, {
      clerkId: CLERK,
      sourceId,
      durationHours: 12,
      maxEstimatedCostCents: 5,
    });

    const source = await t.run((ctx) => ctx.db.get(sourceId));
    const metadata = source?.metadata as Record<string, unknown>;
    const runPolicy = metadata.runPolicy as Record<string, unknown>;

    expect(result.approvedUntil).toBeGreaterThan(Date.now());
    expect(runPolicy.maxEstimatedCostCents).toBe(5);
    expect(runPolicy.approvedFrom).toBe("sources-pane");
  });
});
