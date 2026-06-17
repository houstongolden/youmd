import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

const CLERK = "clerk_portfolio_owner";
const OTHER_CLERK = "clerk_portfolio_other";

async function seedUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      clerkId: CLERK,
      username: "portfolio-owner",
      email: "portfolio@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    const otherId = await ctx.db.insert("users", {
      clerkId: OTHER_CLERK,
      username: "portfolio-other",
      email: "portfolio-other@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    return { ownerId, otherId };
  });
}

describe("portfolio repo update history", () => {
  it("upserts and lists machine proof records per owner", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    const first = await asOwner.mutation(api.portfolio.upsertMachineProof, {
      clerkId: CLERK,
      hostName: "houston-mac-mini",
      platform: "darwin 25.0.0",
      rootDir: "/Users/houston/Desktop/CODE_YOU",
      proofSchemaVersion: 1,
      status: "warn",
      scanned: 12,
      ready: 9,
      needsEnv: 2,
      partial: 1,
      installPassed: 0,
      checksPassed: 0,
      serversPassed: 0,
      failures: 0,
      warnings: ["2 projects need env restore"],
      secretValuesExposed: false,
      reportPath: "/Users/houston/.youmd/machine-reports/latest.json",
      source: "cli",
      agentName: "youmd machine verify",
      generatedAt: 1_781_700_000_000,
    });

    const second = await asOwner.mutation(api.portfolio.upsertMachineProof, {
      clerkId: CLERK,
      hostName: "houston-mac-mini",
      platform: "darwin 25.0.0",
      rootDir: "/Users/houston/Desktop/CODE_YOU",
      proofSchemaVersion: 1,
      status: "ready",
      scanned: 12,
      ready: 12,
      needsEnv: 0,
      partial: 0,
      installPassed: 4,
      checksPassed: 8,
      serversPassed: 3,
      failures: 0,
      warnings: [],
      secretValuesExposed: false,
      reportPath: "/Users/houston/.youmd/machine-reports/latest.json",
      source: "cli",
      agentName: "youmd machine verify",
      generatedAt: 1_781_700_100_000,
    });

    expect(second.proofId).toBe(first.proofId);
    expect(second.created).toBe(false);

    const ownerProofs = await asOwner.query(api.portfolio.listMachineProofs, {
      clerkId: CLERK,
      limit: 10,
    });
    expect(ownerProofs).toHaveLength(1);
    expect(ownerProofs[0]).toMatchObject({
      hostName: "houston-mac-mini",
      status: "ready",
      scanned: 12,
      ready: 12,
      needsEnv: 0,
      secretValuesExposed: false,
    });

    const otherProofs = await asOther.query(api.portfolio.listMachineProofs, {
      clerkId: OTHER_CLERK,
      limit: 10,
    });
    expect(otherProofs).toHaveLength(0);
  });

  it("persists repo update runs with ordered steps", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    const { runId } = await asOwner.mutation(api.portfolio.startRepoUpdateRun, {
      clerkId: CLERK,
      source: "shell",
      trigger: "update-button",
      actorLabel: "web-shell",
      repoFullName: "houstongolden/houstongolden-you-md",
      branch: "main",
      summary: "manual shell update",
    });

    await asOwner.mutation(api.portfolio.appendRepoUpdateStep, {
      clerkId: CLERK,
      runId,
      order: 10,
      stepKey: "publish",
      label: "publish current You.md bundle",
      status: "success",
      detail: "published v108",
      metadata: { version: 108 },
      completedAt: Date.now(),
    });
    await asOwner.mutation(api.portfolio.appendRepoUpdateStep, {
      clerkId: CLERK,
      runId,
      order: 20,
      stepKey: "github:github-checks-merge-gate",
      label: "check GitHub merge gate",
      status: "pending",
      detail: "required checks are still pending",
      metadata: { prNumber: 11, checkState: "pending" },
      completedAt: Date.now(),
    });
    await asOwner.mutation(api.portfolio.appendRepoUpdateStep, {
      clerkId: CLERK,
      runId,
      order: 30,
      stepKey: "push",
      label: "push identity files",
      status: "success",
      detail: "merged PR #11",
      metadata: { prNumber: 11 },
      completedAt: Date.now(),
    });
    await asOwner.mutation(api.portfolio.completeRepoUpdateRun, {
      clerkId: CLERK,
      runId,
      status: "success",
      summary: "merged PR #11 and refreshed mirror",
      publishVersion: 108,
      profileUrl: "https://you.md/houstongolden",
      pushedFiles: ["you.md", "you.json", "projects/youmd/tasks.md"],
      route: "pr",
      prUrl: "https://github.com/houstongolden/houstongolden-you-md/pull/11",
      prNumber: 11,
      merged: true,
      commitSha: "a8188ac7bcfe905d3767997d63fdd177e1bbdf99",
      mirrorFileCount: 50,
      mirrorTruncated: false,
    });

    const runs = await asOwner.query(api.portfolio.listRepoUpdateRuns, {
      clerkId: CLERK,
      limit: 3,
      includeSteps: true,
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      source: "shell",
      trigger: "update-button",
      actorLabel: "web-shell",
      repoFullName: "houstongolden/houstongolden-you-md",
      status: "success",
      publishVersion: 108,
      prNumber: 11,
      merged: true,
      mirrorFileCount: 50,
    });
    expect(runs[0].pushedFiles).toEqual(["you.md", "you.json", "projects/youmd/tasks.md"]);
    expect(runs[0].steps.map((step) => step.stepKey)).toEqual(["publish", "github:github-checks-merge-gate", "push"]);
    expect(runs[0].steps[1]).toMatchObject({
      label: "check GitHub merge gate",
      status: "pending",
      detail: "required checks are still pending",
      metadata: { prNumber: 11, checkState: "pending" },
    });
    expect(runs[0].steps[2].metadata).toEqual({ prNumber: 11 });
  });

  it("does not let another owner append to someone else's update run", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    const { runId } = await asOwner.mutation(api.portfolio.startRepoUpdateRun, {
      clerkId: CLERK,
      source: "shell",
      trigger: "update-button",
    });

    await expect(
      asOther.mutation(api.portfolio.appendRepoUpdateStep, {
        clerkId: OTHER_CLERK,
        runId,
        order: 1,
        stepKey: "push",
        label: "push identity files",
        status: "success",
      })
    ).rejects.toThrow("Repo update run not found");
  });
});
