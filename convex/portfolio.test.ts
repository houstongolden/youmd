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

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "machine",
      limit: 10,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      source: "machine",
      channel: "machine-proof",
      kind: "ready",
      status: "ok",
      title: "houston-mac-mini machine proof ready",
      detail: "12/12 projects ready · 0 need env · 0 failures",
      entityType: "machineProofReport",
      entityId: String(first.proofId),
      sourceHost: "houston-mac-mini",
      sourceAgent: "youmd machine verify",
      secretValuesExposed: false,
    });
    expect(activities[0].metadata).toMatchObject({
      scanned: 12,
      ready: 12,
      needsEnv: 0,
      failures: 0,
      proofSecretValuesExposed: false,
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

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "repo",
      limit: 10,
    });

    expect(activities.map((activity) => activity.title)).toEqual([
      "publish current You.md bundle",
      "check GitHub merge gate",
      "push identity files",
      "repo update complete",
    ]);
    expect(activities[0]).toMatchObject({
      source: "repo",
      kind: "success",
      status: "ok",
      entityType: "repoUpdateStep",
      secretValuesExposed: false,
    });
    expect(activities[3]).toMatchObject({
      source: "repo",
      kind: "success",
      status: "ok",
      entityType: "repoUpdateRun",
      detail: "merged PR #11 and refreshed mirror",
      secretValuesExposed: false,
    });
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

  it("updates task details without letting another owner edit the task", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    const { taskId } = await asOwner.mutation(api.portfolio.upsertTask, {
      clerkId: CLERK,
      projectSlug: "youmd",
      title: "Draft richer task update surface",
      description: "Initial task detail.",
      ownerType: "agent",
      ownerLabel: "You Agent",
      status: "open",
      priority: "normal",
      tags: ["task-graph"],
    });

    const updated = await asOwner.mutation(api.portfolio.updateTaskDetails, {
      clerkId: CLERK,
      taskId,
      projectSlug: "bamf-ai-app",
      title: "Verify task update surface",
      description: "Updated by an authenticated local agent.",
      ownerType: "human",
      ownerLabel: "Houston",
      status: "done",
      priority: "urgent",
      dueAt: 1_781_780_000_000,
      tags: ["task-graph", "proof"],
    });

    expect(updated).toMatchObject({
      taskId,
      projectSlug: "bamf-ai-app",
      title: "Verify task update surface",
      description: "Updated by an authenticated local agent.",
      ownerType: "human",
      ownerLabel: "Houston",
      status: "done",
      priority: "urgent",
      dueAt: 1_781_780_000_000,
      tags: ["task-graph", "proof"],
    });
    expect(updated.completedAt).toEqual(expect.any(Number));

    const cleared = await asOwner.mutation(api.portfolio.updateTaskDetails, {
      clerkId: CLERK,
      taskId,
      projectSlug: null,
      description: null,
      ownerLabel: null,
      dueAt: null,
      status: "in_progress",
      tags: [],
    });

    expect(cleared.projectSlug).toBeUndefined();
    expect(cleared.description).toBeUndefined();
    expect(cleared.ownerLabel).toBeUndefined();
    expect(cleared.dueAt).toBeUndefined();
    expect(cleared.completedAt).toBeUndefined();
    expect(cleared.status).toBe("in_progress");
    expect(cleared.tags).toEqual([]);

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "task",
      limit: 5,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      source: "task",
      kind: "in_progress",
      status: "live",
      title: "task updated: Verify task update surface",
      projectSlug: null,
      entityType: "portfolioTask",
      entityId: String(taskId),
      secretValuesExposed: false,
    });
    expect(activities[0].detail).toContain("owner human");
    expect(activities[0].detail).toContain("personal");

    await expect(
      asOther.mutation(api.portfolio.updateTaskDetails, {
        clerkId: OTHER_CLERK,
        taskId,
        status: "done",
      })
    ).rejects.toThrow("Task not found");
  });

  it("persists project focus status without letting another owner edit it", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    await asOwner.mutation(api.portfolio.upsertProject, {
      clerkId: CLERK,
      slug: "youmd",
      name: "You.md",
      stackName: "YouStack",
      status: "active",
      summary: "Agent brain and portfolio graph.",
      goal: "Make project context durable.",
      focus: "Project portfolio intelligence.",
      docs: ["project-context/PRD.md"],
      tags: ["youstack"],
    });

    const updated = await asOwner.mutation(api.portfolio.updateProjectFocus, {
      clerkId: CLERK,
      projectSlug: "youmd",
      focusStatus: "top-priority",
      focusRank: 1,
    });

    expect(updated).toMatchObject({
      projectSlug: "youmd",
      focusStatus: "top-priority",
      focusRank: 1,
    });

    const graph = await asOwner.query(api.portfolio.listPortfolioGraph, {
      clerkId: CLERK,
    });
    expect(graph.projects[0]).toMatchObject({
      slug: "youmd",
      focusStatus: "top-priority",
      focusRank: 1,
    });

    await expect(
      asOther.mutation(api.portfolio.updateProjectFocus, {
        clerkId: OTHER_CLERK,
        projectSlug: "youmd",
        focusStatus: "killed",
      })
    ).rejects.toThrow("Project not found");
  });

  it("persists manual project active/inactive status through tracked GitHub hydration", async () => {
    const t = convexTest(schema);
    const { ownerId } = await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    await asOwner.mutation(api.portfolio.upsertProject, {
      clerkId: CLERK,
      slug: "scratch-repo",
      name: "Scratch Repo",
      stackName: "Project Stack",
      status: "active",
      repoFullName: "houstongolden/scratch-repo",
      repoUrl: "https://github.com/houstongolden/scratch-repo",
    });

    const statusUpdate = await asOwner.mutation(api.portfolio.updateProjectStatus, {
      clerkId: CLERK,
      projectSlug: "scratch-repo",
      status: "inactive",
    });

    expect(statusUpdate).toMatchObject({
      projectSlug: "scratch-repo",
      status: "inactive",
      statusSource: "manual",
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("trackedProjects", {
        userId: ownerId,
        githubRepoId: 12345,
        fullName: "houstongolden/scratch-repo",
        name: "scratch-repo",
        url: "https://github.com/houstongolden/scratch-repo",
        repoName: "scratch-repo",
        directoryName: "scratch-repo",
        stackName: "Project Stack",
        pushedAt: Date.now(),
        commitsLast90d: 4,
        isPrivate: true,
        visibility: "private",
        trackedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await asOwner.mutation(api.portfolio.syncTrackedProjects, {
      clerkId: CLERK,
      days: 90,
      limit: 10,
    });

    const graph = await asOwner.query(api.portfolio.listPortfolioGraph, {
      clerkId: CLERK,
    });
    expect(graph.projects[0]).toMatchObject({
      slug: "scratch-repo",
      status: "inactive",
      statusSource: "manual",
    });

    await expect(
      asOther.mutation(api.portfolio.updateProjectStatus, {
        clerkId: OTHER_CLERK,
        projectSlug: "scratch-repo",
        status: "active",
      })
    ).rejects.toThrow("Project not found");
  });

  it("persists provider account metadata without exposing secrets across owners", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asOwner = t.withIdentity({ subject: CLERK });
    const asOther = t.withIdentity({ subject: OTHER_CLERK });

    const seed = await asOwner.mutation(api.portfolio.syncProviderAccountSeed, {
      clerkId: CLERK,
      accounts: [
        {
          provider: "OpenAI / OpenRouter",
          category: "llm",
          loginHint: "owner-managed; exact email stays in encrypted vault",
          billingOwner: "Houston",
          separationPolicy: "Separate production products when cost attribution matters.",
          encryptedStorage: "Vault reference only; never raw key material.",
          projects: ["youmd", "bamfsite"],
          keyNameAliases: ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "NEXT_OPENAI_API_KEY"],
          status: "audit",
          risk: "high",
          notes: "Shared light-use key is acceptable only for private/dev flows.",
        },
      ],
    });

    expect(seed).toMatchObject({ received: 1, created: 1, updated: 0, skipped: 0 });

    const update = await asOwner.mutation(api.portfolio.upsertProviderAccount, {
      clerkId: CLERK,
      provider: "OpenAI / OpenRouter",
      monthlyCostUsd: 42.5,
      status: "needs-split",
      projects: ["youmd", "bamfaiapp"],
      keyNameAliases: ["OPENAI_API_KEY", "OPENROUTER_API_KEY"],
      notes: "Split product keys before public usage scales.",
    });

    expect(update.created).toBe(false);

    const ownerAccounts = await asOwner.query(api.portfolio.listProviderAccounts, {
      clerkId: CLERK,
    });
    expect(ownerAccounts).toHaveLength(1);
    expect(ownerAccounts[0]).toMatchObject({
      slug: "openai-openrouter",
      provider: "OpenAI / OpenRouter",
      category: "llm",
      billingOwner: "Houston",
      status: "needs-split",
      risk: "high",
      monthlyCostUsd: 42.5,
      projects: ["youmd", "bamfaiapp"],
      keyNameAliases: ["OPENAI_API_KEY", "OPENROUTER_API_KEY"],
    });
    expect(JSON.stringify(ownerAccounts[0])).not.toContain("sk-");

    const projectSlice = await asOwner.query(api.portfolio.getProjectSlice, {
      clerkId: CLERK,
      projectSlug: "youmd",
    });
    expect(projectSlice.providerAccounts).toHaveLength(1);
    expect(projectSlice.providerAccounts[0].slug).toBe("openai-openrouter");

    const otherAccounts = await asOther.query(api.portfolio.listProviderAccounts, {
      clerkId: OTHER_CLERK,
    });
    expect(otherAccounts).toHaveLength(0);

    await expect(
      asOther.mutation(api.portfolio.upsertProviderAccount, {
        clerkId: OTHER_CLERK,
        provider: "OpenAI / OpenRouter",
        billingOwner: "Other",
      })
    ).resolves.toMatchObject({ created: true });

    const stillOwnerOnly = await asOwner.query(api.portfolio.listProviderAccounts, {
      clerkId: CLERK,
    });
    expect(stillOwnerOnly).toHaveLength(1);
    expect(stillOwnerOnly[0].billingOwner).toBe("Houston");
  });
});
