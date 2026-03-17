import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Internal mutations used by pipeline actions to update database state.
 * Actions cannot write to the database directly — they must call mutations.
 */

// ---------------------------------------------------------------------------
// Source status updates
// ---------------------------------------------------------------------------

export const updateSourceStatus = internalMutation({
  args: {
    sourceId: v.id("sources"),
    status: v.union(
      v.literal("pending"),
      v.literal("fetching"),
      v.literal("fetched"),
      v.literal("extracting"),
      v.literal("extracted"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.errorMessage !== undefined) {
      patch.errorMessage = args.errorMessage;
    }
    await ctx.db.patch(args.sourceId, patch);
  },
});

export const updateSourceFetched = internalMutation({
  args: {
    sourceId: v.id("sources"),
    rawStorageId: v.id("_storage"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      rawStorageId: args.rawStorageId,
      status: "fetched" as const,
      lastFetched: Date.now(),
      // Store the extracted text temporarily in the extracted field
      // so the extract step can read it without hitting file storage
      extracted: { _rawText: args.extractedText },
    });
  },
});

export const updateSourceExtracted = internalMutation({
  args: {
    sourceId: v.id("sources"),
    extracted: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sourceId, {
      status: "extracted" as const,
      extracted: args.extracted,
    });
  },
});

// ---------------------------------------------------------------------------
// Analysis artifact upsert
// ---------------------------------------------------------------------------

export const upsertAnalysisArtifact = internalMutation({
  args: {
    userId: v.id("users"),
    artifactType: v.string(),
    content: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("analysisArtifacts")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", args.userId).eq("artifactType", args.artifactType)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { content: args.content });
      return existing._id;
    }

    return await ctx.db.insert("analysisArtifacts", {
      userId: args.userId,
      artifactType: args.artifactType,
      content: args.content,
    });
  },
});

// ---------------------------------------------------------------------------
// Pipeline job management
// ---------------------------------------------------------------------------

export const createPipelineJob = internalMutation({
  args: {
    userId: v.id("users"),
    sourceId: v.optional(v.id("sources")),
    stage: v.union(
      v.literal("discover"),
      v.literal("fetch"),
      v.literal("extract"),
      v.literal("analyze"),
      v.literal("compile"),
      v.literal("review")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pipelineJobs", {
      userId: args.userId,
      sourceId: args.sourceId,
      stage: args.stage,
      status: "queued",
      retryCount: 0,
      createdAt: Date.now(),
    });
  },
});

export const updatePipelineJob = internalMutation({
  args: {
    jobId: v.id("pipelineJobs"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = { status: args.status };
    if (args.errorMessage !== undefined) {
      patch.errorMessage = args.errorMessage;
    }
    await ctx.db.patch(args.jobId, patch);
  },
});

// ---------------------------------------------------------------------------
// Bundle creation
// ---------------------------------------------------------------------------

export const createBundle = internalMutation({
  args: {
    userId: v.id("users"),
    manifest: v.any(),
    youJson: v.any(),
    youMd: v.string(),
  },
  handler: async (ctx, args) => {
    // Get next version
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const maxVersion = existing.reduce(
      (max, b) => Math.max(max, b.version),
      0
    );

    const bundleId = await ctx.db.insert("bundles", {
      userId: args.userId,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest: args.manifest,
      youJson: args.youJson,
      youMd: args.youMd,
      isPublished: false,
      createdAt: Date.now(),
    });

    return { bundleId, version: maxVersion + 1 };
  },
});

// ---------------------------------------------------------------------------
// Read helpers (internal queries exposed as mutations for action access)
// ---------------------------------------------------------------------------

export const getSourcesByUserId = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getAnalysisArtifacts = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analysisArtifacts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getUserByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const getPipelineJobsByUserId = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineJobs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});
