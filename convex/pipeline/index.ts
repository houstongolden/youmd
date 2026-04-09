import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireOwner } from "../lib/auth";

/**
 * Public-facing pipeline endpoints.
 * startPipeline: kicks off the ingestion pipeline via scheduler.
 * getPipelineStatus: returns current pipeline job statuses.
 *
 * Cycle 43: added requireOwner. Previously these accepted any clerkId from
 * any caller (same shape as the cycle 42 data-leak bug). Without auth, an
 * anonymous caller could kick off a $-billing LLM pipeline for any user, or
 * read any user's pipeline status. This was missed by cycles 37/38 because
 * the audit didn't sweep convex/pipeline/.
 */

// ---------------------------------------------------------------------------
// startPipeline — Create pipeline jobs and schedule the orchestrator
// ---------------------------------------------------------------------------

export const startPipeline = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Check if there's already a running pipeline
    const existingJobs = await ctx.db
      .query("pipelineJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const hasRunningJob = existingJobs.some(
      (j) => j.status === "queued" || j.status === "running"
    );

    if (hasRunningJob) {
      throw new Error("A pipeline is already running. Wait for it to complete.");
    }

    // Check that there are sources to process
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    if (sources.length === 0) {
      throw new Error("No sources configured. Add at least one source URL first.");
    }

    // Clear old completed/failed pipeline jobs for this user
    for (const job of existingJobs) {
      await ctx.db.delete(job._id);
    }

    // Schedule the orchestrator action
    await ctx.scheduler.runAfter(
      0,
      internal.pipeline.orchestrator.runPipeline,
      {
        userId: user._id,
        username: user.username,
      }
    );

    return {
      status: "started",
      sourceCount: sources.length,
    };
  },
});

// ---------------------------------------------------------------------------
// getPipelineStatus — Get current pipeline status for a user
// ---------------------------------------------------------------------------

export const getPipelineStatus = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const jobs = await ctx.db
      .query("pipelineJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Determine overall pipeline status
    const hasRunning = jobs.some(
      (j) => j.status === "running" || j.status === "queued"
    );
    const hasFailed = jobs.some((j) => j.status === "failed");
    const allCompleted =
      jobs.length > 0 && jobs.every((j) => j.status === "completed");
    const hasReview = jobs.some((j) => j.stage === "review");

    let overallStatus: "idle" | "running" | "completed" | "failed" | "review";
    if (jobs.length === 0) {
      overallStatus = "idle";
    } else if (hasReview) {
      overallStatus = "review";
    } else if (hasRunning) {
      overallStatus = "running";
    } else if (allCompleted) {
      overallStatus = "completed";
    } else if (hasFailed) {
      overallStatus = "failed";
    } else {
      overallStatus = "idle";
    }

    // Current stage = the most recent running/queued job
    const currentStage = jobs
      .filter((j) => j.status === "running" || j.status === "queued")
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.stage;

    return {
      overallStatus,
      currentStage: currentStage ?? null,
      jobs: jobs.map((j) => ({
        stage: j.stage,
        status: j.status,
        errorMessage: j.errorMessage,
        createdAt: j.createdAt,
      })),
      sources: sources.map((s) => ({
        sourceType: s.sourceType,
        sourceUrl: s.sourceUrl,
        status: s.status,
        errorMessage: s.errorMessage,
        lastFetched: s.lastFetched,
      })),
    };
  },
});
