/**
 * L18 — YouStack workflow schedule runner.
 *
 * This file provides the server-side stub for YouStack manifest `workflows`
 * entries. Real cron registration is deferred — a future iteration will wire
 * each userWorkflowSchedules row into Convex scheduled functions (crons.ts)
 * once the scheduling surface stabilises.
 *
 * For now, `runUserWorkflow` acts as the execution entry point: it logs the
 * intent, updates `lastRunAt` on the schedule row, and returns a summary. The
 * CLI and dashboard can call it manually (or a cron can once registered).
 *
 * TODO(L18-cron): Register a Convex cron per schedule row when Convex supports
 * dynamic cron creation (or use a single polling cron that iterates due rows).
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── Internal helpers ──────────────────────────────────────────────────────────

export const getScheduleById = internalQuery({
  args: { scheduleId: v.id("userWorkflowSchedules") },
  handler: async (ctx, { scheduleId }) => {
    return await ctx.db.get(scheduleId);
  },
});

export const updateLastRunAt = internalMutation({
  args: {
    scheduleId: v.id("userWorkflowSchedules"),
    lastRunAt: v.number(),
  },
  handler: async (ctx, { scheduleId, lastRunAt }) => {
    await ctx.db.patch(scheduleId, { lastRunAt });
  },
});

/**
 * Stub execution entry point for a per-user YouStack workflow.
 *
 * Logs intent, updates lastRunAt, and returns a summary. Actual skill dispatch
 * is deferred — see the TODO above.
 */
export const runUserWorkflow = internalAction({
  args: {
    scheduleId: v.id("userWorkflowSchedules"),
  },
  handler: async (ctx, { scheduleId }): Promise<{
    scheduleId: string;
    workflowId: string;
    action: string;
    ranAt: number;
  }> => {
    const row = await ctx.runQuery(internal.workflows.getScheduleById, { scheduleId });
    if (!row) {
      throw new Error(`userWorkflowSchedules row not found: ${scheduleId}`);
    }

    const ranAt = Date.now();

    // TODO(L18-cron): Dispatch to the real skill executor once the workflow
    // action surface (run_skill / report_skill_outcome) is wired. For now we
    // just log intent so the contract is exercisable.
    console.log(
      `[workflows:runUserWorkflow] intent — workflowId=${row.workflowId} action=${row.action} userId=${row.userId}`
    );

    await ctx.runMutation(internal.workflows.updateLastRunAt, {
      scheduleId,
      lastRunAt: ranAt,
    });

    return { scheduleId, workflowId: row.workflowId, action: row.action, ranAt };
  },
});
