import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const CLERK = "clerk_loop_report_owner";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: CLERK,
      username: "loop-owner",
      email: "loop@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    await ctx.db.insert("bundles", {
      userId,
      version: 1,
      schemaVersion: "you-md/v1",
      manifest: {},
      youJson: {
        projects: [
          {
            name: "You.md",
            status: "building",
            url: "https://you.md",
            description: "Identity context protocol for the agent internet.",
          },
        ],
      },
      youMd: "# loop owner",
      isPublished: false,
      createdAt: Date.now(),
    });
    await ctx.db.insert("repoMirror", {
      userId,
      repoFullName: "loop-owner/loop-owner-you-md",
      files: [{ path: "you.md", content: "# loop owner", size: 12 }],
      fileCount: 1,
      totalBytes: 12,
      truncated: false,
      syncedAt: Date.parse("2026-06-16T12:00:00.000Z"),
    });
    await ctx.db.insert("agentActivity", {
      userId,
      agentName: "Codex",
      agentSource: "mcp",
      action: "write",
      resource: "reports",
      status: "success",
      createdAt: Date.parse("2026-06-16T15:00:00.000Z"),
    });
    await ctx.db.insert("sources", {
      userId,
      sourceType: "website",
      sourceUrl: "https://you.md",
      connectorKind: "url",
      crawlerProvider: "native",
      refreshPolicy: "daily",
      visibility: "private",
      trustLevel: "verified",
      status: "extracted",
    });
    return userId;
  });
}

describe("loop reports", () => {
  it("seeds defaults and runs a deterministic daily briefing artifact", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const defs = await asOwner.mutation(api.loopReports.seedDefaultDefinitions, {
      clerkId: CLERK,
      userId,
    });
    expect(defs.map((d) => d.slug)).toContain("daily-briefing");

    const result = await asOwner.mutation(api.loopReports.runDailyBriefingNow, {
      clerkId: CLERK,
      userId,
      date: "2026-06-16",
    });
    expect(result.reused).toBe(false);
    expect(result.artifactId).toBeTruthy();

    const artifacts = await asOwner.query(api.loopReports.listArtifacts, {
      clerkId: CLERK,
      userId,
    });
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].title).toBe("Daily Briefing — 2026-06-16");
    expect(artifacts[0].bodyMarkdown).toContain("## code carryover");
    expect(artifacts[0].bodyMarkdown).toContain("You.md");
    expect(artifacts[0].bodyMarkdown).toContain("Codex");
    expect(artifacts[0].facts.projectCount).toBe(1);
    expect(artifacts[0].facts.externalAdaptersPending).toContain("badapp");

    const reused = await asOwner.mutation(api.loopReports.runDailyBriefingNow, {
      clerkId: CLERK,
      userId,
      date: "2026-06-16",
    });
    expect(reused.reused).toBe(true);

    const snapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query("sourceSnapshots")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });
    expect(snapshots.map((s) => s.sourceKey).sort()).toEqual([
      "agent-activity",
      "projects",
      "repo-mirror",
      "sources",
    ]);
  });

  it("cron runner processes due daily report definitions", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const defs = await asOwner.mutation(api.loopReports.seedDefaultDefinitions, {
      clerkId: CLERK,
      userId,
    });
    const daily = defs.find((d) => d.slug === "daily-briefing")!;
    await t.run(async (ctx) => {
      await ctx.db.patch(daily._id, { nextRunAt: Date.now() - 1000 });
    });

    const result = await t.mutation(internal.loopReports.runDueLoopReports, { limit: 5 });
    expect(result.checked).toBe(1);

    const runs = await asOwner.query(api.loopReports.listRuns, {
      clerkId: CLERK,
      userId,
    });
    expect(runs[0].status).toBe("completed");
    expect(runs[0].definitionSlug).toBe("daily-briefing");
  });
});
