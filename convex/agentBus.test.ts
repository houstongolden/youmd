import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

const CLERK_ID = "clerk_agent_bus";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: CLERK_ID,
      username: "agent-bus-owner",
      email: "agent-bus-owner@example.com",
      plan: "pro",
      createdAt: Date.now(),
    }),
  );
}

describe("agentBus.sendMessage brain activity coordination", () => {
  it("records explicit project, skill, and entity links without leaking secrets", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    const message = await t.withIdentity({ subject: CLERK_ID }).mutation(api.agentBus.sendMessage, {
      clerkId: CLERK_ID,
      channel: "machine-sync",
      kind: "status",
      body: "Mac mini restored project context with OPENAI_API_KEY=sk-test-secret-1234567890",
      sourceHost: "Houstons-Mini",
      sourceAgent: "Claude Code",
      sourceRuntime: "youmd-cli/v0.8.9",
      targetHost: "Houstons-MBP",
      metadata: {
        projectSlug: "youmd",
        skillName: "project-clarity-audit",
        entityType: "task",
        entityId: "task_123",
        skills: ["machine-sync", "project-clarity-audit"],
        secretValuesExposed: false,
      },
    });

    const activities = await t.withIdentity({ subject: CLERK_ID }).query(api.brainActivity.listRecent, {
      clerkId: CLERK_ID,
      source: "agent-bus",
      limit: 10,
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: `agent-bus:${message.messageId}`,
      source: "agent-bus",
      channel: "machine-sync",
      kind: "status",
      status: "live",
      projectSlug: "youmd",
      entityType: "task",
      entityId: "task_123",
      sourceHost: "Houstons-Mini",
      sourceAgent: "Claude Code",
      sourceRuntime: "youmd-cli/v0.8.9",
      secretValuesExposed: false,
    });
    expect(activities[0].metadata).toMatchObject({
      coordination: {
        projectSlug: "youmd",
        skillName: "project-clarity-audit",
        entityType: "task",
        entityId: "task_123",
        relatedProjects: ["youmd"],
        relatedSkills: ["project-clarity-audit", "machine-sync"],
        channel: "machine-sync",
        kind: "status",
        messageId: message.messageId,
      },
      targetHost: "Houstons-MBP",
      secretValuesExposed: false,
    });

    const serialized = JSON.stringify(activities);
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("sk-test-secret");
    expect(serialized).not.toContain("OPENAI_API_KEY=sk");
  });

  it("infers coordination links from common message labels", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    const message = await t.withIdentity({ subject: CLERK_ID }).mutation(api.agentBus.sendMessage, {
      clerkId: CLERK_ID,
      channel: "agent-coordination",
      kind: "blocked",
      body: "project: bamfsite skill: machine-sync task: env-restore blocked waiting on source Mac share",
      sourceAgent: "Codex",
      metadata: { secretValuesExposed: false },
    });

    const activities = await t.withIdentity({ subject: CLERK_ID }).query(api.brainActivity.listRecent, {
      clerkId: CLERK_ID,
      source: "agent-bus",
      limit: 10,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: `agent-bus:${message.messageId}`,
      status: "error",
      projectSlug: "bamfsite",
      entityType: "task",
      entityId: "env-restore",
      metadata: {
        coordination: {
          projectSlug: "bamfsite",
          skillName: "machine-sync",
          relatedProjects: ["bamfsite"],
          relatedSkills: ["machine-sync"],
        },
      },
    });
  });
});
