import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const CLERK = "clerk_source_run_policy";

async function seed(
  t: ReturnType<typeof convexTest>,
  crawlerProvider = "firecrawl"
): Promise<{ userId: Id<"users">; sourceId: Id<"sources"> }> {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: CLERK,
      username: "source-run-policy",
      email: "run-policy@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
  const sourceId = await t.run((ctx) =>
    ctx.db.insert("sources", {
      userId,
      sourceType: "website",
      sourceUrl: "https://example.com",
      crawlerProvider,
      refreshPolicy: "daily",
      status: "pending",
      failureCount: 0,
    })
  );
  return { userId, sourceId };
}

describe("source run policy", () => {
  it("blocks Firecrawl until the owner approves a run window", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t, "firecrawl");

    const decision = await t.mutation(internal.sourceRunPolicy.reserveSourceRun, {
      sourceId,
      provider: "firecrawl",
      now: 1000,
    });

    expect(decision).toMatchObject({
      allowed: false,
      reason: "approval_required",
      estimatedCostCents: 5,
    });

    const source = await t.run((ctx) => ctx.db.get(sourceId));
    expect(source?.status).toBe("failed");
    expect(source?.failureCount).toBe(1);
    expect(source?.errorMessage).toContain("requires owner approval");
  });

  it("allows approved Firecrawl runs and records a rate-limit reservation", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t, "firecrawl");
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(api.me.approveSourceRun, {
      clerkId: CLERK,
      sourceId,
      durationHours: 24,
      maxEstimatedCostCents: 5,
    });

    const decision = await t.mutation(internal.sourceRunPolicy.reserveSourceRun, {
      sourceId,
      provider: "firecrawl",
      now: Date.now(),
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allowed",
      estimatedCostCents: 5,
    });

    const reservations = await t.run((ctx) => ctx.db.query("rateLimits").collect());
    expect(reservations).toHaveLength(1);
    expect(reservations[0].bucket).toContain("source-crawl:firecrawl:");
  });

  it("allows native runs without approval", async () => {
    const t = convexTest(schema);
    const { sourceId } = await seed(t, "native");

    const decision = await t.mutation(internal.sourceRunPolicy.reserveSourceRun, {
      sourceId,
      provider: "native",
      now: 1000,
    });

    expect(decision).toMatchObject({
      allowed: true,
      reason: "allowed",
      estimatedCostCents: 0,
    });
  });
});
