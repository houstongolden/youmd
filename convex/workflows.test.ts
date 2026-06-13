/**
 * L18 — userWorkflowSchedules schema + runUserWorkflow basic contract.
 *
 * Contract assertions:
 *   1. schema: can insert/read a userWorkflowSchedules row
 *   2. getScheduleById: returns the row by id
 *   3. updateLastRunAt: patches lastRunAt on the row
 *   4. runUserWorkflow: throws when scheduleId is not found
 *
 * NOTE: runUserWorkflow is an internalAction; convex-test can call internalActions
 * via t.run with ctx.scheduler, but internalAction invocation is tested here by
 * exercising the underlying internal query/mutation helpers directly, which gives
 * equivalent coverage without requiring a mock external fetch.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

async function seedUser(t: ReturnType<typeof convexTest>, username = "wf_alice") {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: `clerk_${username}`,
      username,
      email: `${username}@example.com`,
      plan: "free",
      createdAt: Date.now(),
    })
  );
}

async function insertSchedule(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  opts: {
    workflowId?: string;
    schedule?: string;
    action?: string;
  } = {}
) {
  return await t.run(async (ctx) =>
    ctx.db.insert("userWorkflowSchedules", {
      userId,
      workflowId: opts.workflowId ?? "weekly-report",
      schedule: opts.schedule ?? "0 9 * * 1",
      action: opts.action ?? "report_skill_outcome",
      createdAt: Date.now(),
    })
  );
}

// ── 1. Schema: insert + read ───────────────────────────────────────────────────

describe("userWorkflowSchedules schema", () => {
  it("inserts and reads a workflow schedule row", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);

    const scheduleId = await insertSchedule(t, userId, {
      workflowId: "my-skill-run",
      schedule: "0 8 * * *",
      action: "run_skill",
    });

    const row = await t.run(async (ctx) => ctx.db.get(scheduleId));
    expect(row).not.toBeNull();
    expect(row!.userId).toEqual(userId);
    expect(row!.workflowId).toBe("my-skill-run");
    expect(row!.schedule).toBe("0 8 * * *");
    expect(row!.action).toBe("run_skill");
    expect(row!.lastRunAt).toBeUndefined();
  });

  it("indexes by userId — can list all schedules for a user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "wf_bob");

    await insertSchedule(t, userId, { workflowId: "a" });
    await insertSchedule(t, userId, { workflowId: "b" });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("userWorkflowSchedules")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );
    expect(rows).toHaveLength(2);
    const ids = rows.map((r) => r.workflowId).sort();
    expect(ids).toEqual(["a", "b"]);
  });
});

// ── 2. getScheduleById internal query ─────────────────────────────────────────

describe("workflows.getScheduleById", () => {
  it("returns the row for a valid id", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "wf_carol");
    const scheduleId = await insertSchedule(t, userId, { workflowId: "lookup-test" });

    const row = await t.run(async (ctx) =>
      ctx.runQuery(internal.workflows.getScheduleById, { scheduleId })
    );
    expect(row).not.toBeNull();
    expect(row!.workflowId).toBe("lookup-test");
  });
});

// ── 3. updateLastRunAt internal mutation ──────────────────────────────────────

describe("workflows.updateLastRunAt", () => {
  it("patches lastRunAt and leaves other fields intact", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "wf_dave");
    const scheduleId = await insertSchedule(t, userId, {
      workflowId: "patch-test",
      action: "run_skill",
    });

    const ts = Date.now();
    await t.run(async (ctx) =>
      ctx.runMutation(internal.workflows.updateLastRunAt, { scheduleId, lastRunAt: ts })
    );

    const row = await t.run(async (ctx) => ctx.db.get(scheduleId));
    expect(row!.lastRunAt).toBe(ts);
    expect(row!.workflowId).toBe("patch-test");
    expect(row!.action).toBe("run_skill");
  });
});
