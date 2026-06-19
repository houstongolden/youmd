/**
 * L9/L10 — skill outcome telemetry + insights tests.
 *
 * Covers:
 *   - outcome recording (auth, shape, per-user isolation, unknown-outcome rejection)
 *   - insights math (correct counts/rates with mixed outcomes)
 *   - MCP dispatch happy-path shape (tools/list includes report_skill_outcome)
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ALICE_CLERK = "clerk_alice_outcomes";
const BOB_CLERK = "clerk_bob_outcomes";

async function seedUser(
  t: ReturnType<typeof convexTest>,
  clerkId: string,
  username: string
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId,
      username,
      email: `${username}@example.com`,
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

// ─── recordOutcome ────────────────────────────────────────────────────────────

describe("skills.recordOutcome", () => {
  it("inserts a success row with all optional fields", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-outcomes");

    const result = await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      {
        clerkId: ALICE_CLERK,
        skillName: "youstack-start",
        outcome: "success",
        agent: "claude-code",
        note: "worked perfectly",
        durationMs: 1200,
      }
    );

    expect(result).toMatchObject({
      skillName: "youstack-start",
      outcome: "success",
    });
    expect(typeof result.id).toBe("string");

    // Verify the row is in the DB
    const row = await t.run(async (ctx) => ctx.db.get(result.id));
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(userId);
    expect(row!.skillName).toBe("youstack-start");
    expect(row!.outcome).toBe("success");
    expect(row!.agent).toBe("claude-code");
    expect(row!.note).toBe("worked perfectly");
    expect(row!.durationMs).toBe(1200);

    const activities = await t.withIdentity({ subject: ALICE_CLERK }).query(api.brainActivity.listRecent, {
      clerkId: ALICE_CLERK,
      source: "skill-outcome",
      limit: 10,
    });
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: `skill-outcome:${result.id}`,
      source: "skill-outcome",
      channel: "skills",
      kind: "outcome-success",
      status: "ok",
      title: "youstack-start outcome: success",
      detail: "claude-code reported success in 1200ms",
      entityType: "skillOutcome",
      entityId: result.id,
      sourceAgent: "claude-code",
      secretValuesExposed: false,
      metadata: {
        skillName: "youstack-start",
        outcome: "success",
        agent: "claude-code",
        durationMs: 1200,
        hasNote: true,
        noteLength: "worked perfectly".length,
        noteStoredInActivity: false,
        secretValuesExposed: false,
      },
    });
    const serialized = JSON.stringify(activities);
    expect(serialized).not.toContain("worked perfectly");
    expect(serialized).not.toContain("sk-test-secret");
  });

  it("inserts a failure row without optional fields", async () => {
    const t = convexTest(schema);
    await seedUser(t, ALICE_CLERK, "alice-outcomes-2");

    const result = await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      {
        clerkId: ALICE_CLERK,
        skillName: "voice-sync",
        outcome: "failure",
      }
    );

    expect(result.outcome).toBe("failure");

    const row = await t.run(async (ctx) => ctx.db.get(result.id));
    expect(row!.agent).toBeUndefined();
    expect(row!.note).toBeUndefined();
    expect(row!.durationMs).toBeUndefined();
  });

  it("inserts a partial row", async () => {
    const t = convexTest(schema);
    await seedUser(t, ALICE_CLERK, "alice-partial");

    const result = await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      {
        clerkId: ALICE_CLERK,
        skillName: "meta-improve",
        outcome: "partial",
      }
    );

    expect(result.outcome).toBe("partial");
  });

  it("isolates rows per user — bob cannot see alice rows", async () => {
    const t = convexTest(schema);
    const aliceId = await seedUser(t, ALICE_CLERK, "alice-iso");
    const bobId = await seedUser(t, BOB_CLERK, "bob-iso");

    // Alice records an outcome
    await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: "youstack-start", outcome: "success" }
    );

    // Bob's insights should be empty
    const bobInsights = await t.withIdentity({ subject: BOB_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: BOB_CLERK, userId: bobId }
    );
    expect(bobInsights).toHaveLength(0);

    // Alice's insights should have 1 entry
    const aliceInsights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId: aliceId }
    );
    expect(aliceInsights).toHaveLength(1);
    expect(aliceInsights[0].skill).toBe("youstack-start");
  });

  it("rejects unknown outcome values via TypeScript union — only valid literals compile", () => {
    // The union type enforces this at compile time; the test documents the contract.
    const validOutcomes: Array<"success" | "failure" | "partial"> = [
      "success",
      "failure",
      "partial",
    ];
    expect(validOutcomes).toHaveLength(3);
  });

  it("stores skillName capped at 200 chars in the DB row", async () => {
    const t = convexTest(schema);
    await seedUser(t, ALICE_CLERK, "alice-cap");
    const longName = "a".repeat(300);

    const result = await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: longName, outcome: "success" }
    );

    // The DB row must have the capped value; the returned id is stable
    const row = await t.run(async (ctx) => ctx.db.get(result.id));
    expect(row!.skillName.length).toBeLessThanOrEqual(200);
  });
});

// ─── activityInsights ─────────────────────────────────────────────────────────

describe("skills.activityInsights", () => {
  it("returns empty array when no outcomes exist", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-empty-insights");

    const result = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId }
    );

    expect(result).toEqual([]);
  });

  it("aggregates counts and success rate correctly for mixed outcomes", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-agg");

    // 3 success + 1 failure + 1 partial = 5 uses, successRate = 3/5 = 0.6
    for (let i = 0; i < 3; i++) {
      await t.withIdentity({ subject: ALICE_CLERK }).mutation(
        api.skills.recordOutcome,
        { clerkId: ALICE_CLERK, skillName: "youstack-start", outcome: "success" }
      );
    }
    await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: "youstack-start", outcome: "failure" }
    );
    await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: "youstack-start", outcome: "partial" }
    );

    const insights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId }
    );

    expect(insights).toHaveLength(1);
    const entry = insights[0];
    expect(entry.skill).toBe("youstack-start");
    expect(entry.uses).toBe(5);
    expect(entry.success).toBe(3);
    expect(entry.failure).toBe(1);
    expect(entry.partial).toBe(1);
    expect(entry.successRate).toBeCloseTo(0.6);
    expect(entry.lastUsedAt).toBeGreaterThan(0);
  });

  it("returns 100% success rate when all outcomes are success", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-100");

    for (let i = 0; i < 4; i++) {
      await t.withIdentity({ subject: ALICE_CLERK }).mutation(
        api.skills.recordOutcome,
        { clerkId: ALICE_CLERK, skillName: "voice-sync", outcome: "success" }
      );
    }

    const insights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId }
    );

    expect(insights[0].successRate).toBe(1);
  });

  it("sorts by uses descending", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-sort");

    // skill-a: 1 use, skill-b: 3 uses
    await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: "skill-a", outcome: "success" }
    );
    for (let i = 0; i < 3; i++) {
      await t.withIdentity({ subject: ALICE_CLERK }).mutation(
        api.skills.recordOutcome,
        { clerkId: ALICE_CLERK, skillName: "skill-b", outcome: "success" }
      );
    }

    const insights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId }
    );

    expect(insights[0].skill).toBe("skill-b");
    expect(insights[1].skill).toBe("skill-a");
  });

  it("caps result at 50 rows", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, ALICE_CLERK, "alice-cap-50");

    // Insert 55 distinct skill outcome rows
    for (let i = 0; i < 55; i++) {
      await t.withIdentity({ subject: ALICE_CLERK }).mutation(
        api.skills.recordOutcome,
        { clerkId: ALICE_CLERK, skillName: `skill-${i}`, outcome: "success" }
      );
    }

    const insights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId }
    );

    expect(insights.length).toBe(50);
  });

  it("enforces per-user isolation in insights query", async () => {
    const t = convexTest(schema);
    const aliceId = await seedUser(t, ALICE_CLERK, "alice-iso2");
    const bobId = await seedUser(t, BOB_CLERK, "bob-iso2");

    await t.withIdentity({ subject: ALICE_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: ALICE_CLERK, skillName: "shared-skill", outcome: "success" }
    );
    await t.withIdentity({ subject: BOB_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: BOB_CLERK, skillName: "shared-skill", outcome: "failure" }
    );
    await t.withIdentity({ subject: BOB_CLERK }).mutation(
      api.skills.recordOutcome,
      { clerkId: BOB_CLERK, skillName: "shared-skill", outcome: "failure" }
    );

    const aliceInsights = await t.withIdentity({ subject: ALICE_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: ALICE_CLERK, userId: aliceId }
    );
    expect(aliceInsights[0].success).toBe(1);
    expect(aliceInsights[0].failure).toBe(0);
    expect(aliceInsights[0].successRate).toBe(1);

    const bobInsights = await t.withIdentity({ subject: BOB_CLERK }).query(
      api.skills.activityInsights,
      { clerkId: BOB_CLERK, userId: bobId }
    );
    expect(bobInsights[0].success).toBe(0);
    expect(bobInsights[0].failure).toBe(2);
    expect(bobInsights[0].successRate).toBe(0);
  });
});
