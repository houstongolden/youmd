import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const CLERK = "clerk_source_run_policy";
const SOURCE_URL_WITH_SECRET_QUERY = "https://example.com/path?api_key=SECRET_SHOULD_NOT_APPEAR";

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
      sourceUrl: SOURCE_URL_WITH_SECRET_QUERY,
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

    const activities = await t.withIdentity({ subject: CLERK }).query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "source-crawl",
      limit: 10,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: `source-crawl:${sourceId}`,
      source: "source-crawl",
      channel: "sources",
      kind: "blocked",
      status: "warn",
      title: "source crawl needs approval: website via firecrawl",
      entityType: "source",
      entityId: String(sourceId),
      sourceAgent: "source-run-policy",
      secretValuesExposed: false,
    });
    expect(activities[0].detail).toContain("https://example.com/path");
    expect(activities[0].detail).not.toContain("api_key");
    expect(activities[0].metadata).toMatchObject({
      provider: "firecrawl",
      allowed: false,
      reason: "approval_required",
      estimatedCostCents: 5,
      requiresApproval: true,
    });
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

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "source-crawl",
      limit: 10,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: `source-crawl:${sourceId}`,
      source: "source-crawl",
      kind: "reserved",
      status: "live",
      title: "source crawl reserved: website via firecrawl",
      entityType: "source",
      entityId: String(sourceId),
      sourceAgent: "source-run-policy",
      secretValuesExposed: false,
    });
    expect(activities[0].detail).toContain("https://example.com/path");
    expect(activities[0].detail).not.toContain("api_key");
    expect(activities[0].metadata).toMatchObject({
      provider: "firecrawl",
      allowed: true,
      reason: "allowed",
      estimatedCostCents: 5,
      requiresApproval: true,
      hourlyLimit: 30,
      remainingThisHour: 29,
    });
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
