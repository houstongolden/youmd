import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  canonicalUsername,
  hasRenderableAsciiPortrait,
} from "../lib/profileDirectory";

/**
 * Internal mutations used by pipeline actions to update database state.
 * Actions cannot write to the database directly — they must call mutations.
 */

// ---------------------------------------------------------------------------
// Source status updates
// ---------------------------------------------------------------------------

function sourceMetadata(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
}

function monitoringRequiresReview(metadata: unknown): boolean {
  const monitoring = sourceMetadata(metadata).monitoring;
  if (!monitoring || typeof monitoring !== "object") return false;
  return (monitoring as Record<string, unknown>).approvalRequired === true;
}

function normalizePreview(text?: string): string | undefined {
  if (!text) return undefined;
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  return cleaned ? cleaned.slice(0, 280) : undefined;
}

function normalizeHeadings(headings?: string[]): string[] | undefined {
  if (!headings) return undefined;
  const cleaned = headings
    .map((heading) => heading.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((heading) => heading.slice(0, 120));
  return cleaned.length > 0 ? cleaned : undefined;
}

function changeSummaryText(args: {
  sourceUrl: string;
  previousContentHash?: string;
  contentHash: string;
  contentLength?: number;
  contentHeadings?: string[];
}): { changeType: string; summary: string } {
  const shortHash = args.contentHash.slice(0, 16);
  const sizePart =
    typeof args.contentLength === "number"
      ? ` (${args.contentLength.toLocaleString()} chars)`
      : "";
  const headingPart =
    args.contentHeadings && args.contentHeadings.length > 0
      ? ` Top headings: ${args.contentHeadings.slice(0, 3).join(" | ")}.`
      : "";
  if (!args.previousContentHash) {
    return {
      changeType: "first_fetch",
      summary: `First monitored fetch for ${args.sourceUrl}${sizePart}; content hash ${shortHash}.${headingPart}`,
    };
  }
  return {
    changeType: "content_changed",
    summary: `Source content changed${sizePart}: ${args.previousContentHash.slice(0, 16)} -> ${shortHash}.${headingPart} Review before extraction/writeback if this source is approval-gated.`,
  };
}

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
    if (args.status === "failed") {
      const source = await ctx.db.get(args.sourceId);
      patch.failureCount = (source?.failureCount ?? 0) + 1;
    }
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

/**
 * Append an immutable raw-source version. A new version row is written only
 * when the fetched content hash is new or differs from the latest stored hash;
 * the source row's pointer (lastRawContentHash + latestVersionId) is updated,
 * but prior version rows are never modified or deleted. This is the
 * immutable-source enforcement point.
 */
export const recordRawSourceVersion = internalMutation({
  args: {
    sourceId: v.id("sources"),
    rawStorageId: v.optional(v.id("_storage")),
    contentHash: v.string(),
    fetchedAt: v.number(),
    contentLength: v.optional(v.number()),
    contentPreview: v.optional(v.string()),
    contentHeadings: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source) return { recorded: false as const, reason: "source not found" };

    if (source.lastRawContentHash === args.contentHash) {
      // Identical content — do not version, do not overwrite.
      return {
        recorded: false as const,
        reason: "unchanged",
        versionId: source.latestVersionId ?? null,
      };
    }

    const previousContentHash = source.lastRawContentHash;
    const previousVersionId = source.latestVersionId;
    const versionId = await ctx.db.insert("rawSourceVersions", {
      sourceId: args.sourceId,
      userId: source.userId,
      sourceUrl: source.sourceUrl,
      rawStorageId: args.rawStorageId,
      contentHash: args.contentHash,
      fetchedAt: args.fetchedAt,
    });
    const change = changeSummaryText({
      sourceUrl: source.sourceUrl,
      previousContentHash,
      contentHash: args.contentHash,
      contentLength: args.contentLength,
      contentHeadings: normalizeHeadings(args.contentHeadings),
    });
    const contentPreview = normalizePreview(args.contentPreview);
    const contentHeadings = normalizeHeadings(args.contentHeadings);
    const status = monitoringRequiresReview(source.metadata)
      ? "pending_review"
      : "auto_accepted";
    const changeSummaryId = await ctx.db.insert("sourceChangeSummaries", {
      sourceId: args.sourceId,
      userId: source.userId,
      sourceUrl: source.sourceUrl,
      versionId,
      previousVersionId,
      previousContentHash,
      contentHash: args.contentHash,
      contentLength: args.contentLength,
      contentPreview,
      contentHeadings,
      changeType: change.changeType,
      summary: change.summary,
      status,
      createdAt: args.fetchedAt,
    });
    const metadata = sourceMetadata(source.metadata);
    await ctx.db.patch(args.sourceId, {
      lastRawContentHash: args.contentHash,
      latestVersionId: versionId,
      lastChangedAt: args.fetchedAt,
      metadata: {
        ...metadata,
        lastChangeSummary: {
          id: changeSummaryId,
          summary: change.summary,
          status,
          changeType: change.changeType,
          contentHash: args.contentHash,
          previousContentHash: previousContentHash ?? null,
          contentLength: args.contentLength ?? null,
          contentPreview: contentPreview ?? null,
          contentHeadings: contentHeadings ?? [],
          createdAt: args.fetchedAt,
        },
      },
    });
    return { recorded: true as const, versionId, changeSummaryId, status };
  },
});

export const approveSourceChangeSummary = internalMutation({
  args: {
    changeSummaryId: v.id("sourceChangeSummaries"),
    approvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const approvedAt = args.approvedAt ?? Date.now();
    const change = await ctx.db.get(args.changeSummaryId);
    if (!change) return { success: false as const, reason: "change summary not found" };

    await ctx.db.patch(args.changeSummaryId, {
      status: "approved",
      approvedAt,
    });

    const source = await ctx.db.get(change.sourceId);
    if (source) {
      const metadata = sourceMetadata(source.metadata);
      const lastChangeSummary = sourceMetadata(metadata.lastChangeSummary);
      await ctx.db.patch(change.sourceId, {
        metadata: {
          ...metadata,
          lastChangeSummary: {
            ...lastChangeSummary,
            id: args.changeSummaryId,
            status: "approved",
            approvedAt,
          },
        },
      });
    }

    return { success: true as const };
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

// ---------------------------------------------------------------------------
// Portrait source chain support (U17)
// ---------------------------------------------------------------------------

/**
 * Read everything the portrait source-chain action needs about a profile:
 * whether it already has a renderable portrait, plus all the link/handle
 * surfaces the chain resolves from (avatarUrl, socialImages, profile links,
 * embedded youJson links).
 */
export const getPortraitContext = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const username = canonicalUsername(args.username);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (!profile) return null;

    const youJson =
      profile.youJson && typeof profile.youJson === "object"
        ? (profile.youJson as Record<string, unknown>)
        : {};

    return {
      profileId: profile._id,
      username: profile.username,
      hasPortrait: hasRenderableAsciiPortrait(profile.asciiPortrait),
      avatarUrl: profile.avatarUrl ?? null,
      socialImages: profile.socialImages ?? null,
      primaryImage: profile.primaryImage ?? null,
      links: profile.links ?? null,
      youJsonLinks: youJson.links ?? null,
    };
  },
});

/**
 * Save a generated ASCII portrait — but ONLY if the profile still has no
 * renderable portrait (or `force` is set). This is the write-side guard for
 * the post-research retry: even if two pipeline runs race, a real existing
 * portrait is never overwritten.
 */
export const savePortraitIfMissing = internalMutation({
  args: {
    profileId: v.id("profiles"),
    portrait: v.object({
      lines: v.array(v.string()),
      coloredLines: v.optional(v.any()),
      cols: v.number(),
      rows: v.number(),
      format: v.string(),
      sourceUrl: v.string(),
    }),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) return { saved: false, reason: "profile_not_found" as const };

    if (!args.force && hasRenderableAsciiPortrait(profile.asciiPortrait)) {
      return { saved: false, reason: "portrait_exists" as const };
    }

    const updates: Record<string, unknown> = {
      asciiPortrait: {
        lines: args.portrait.lines,
        coloredLines: args.portrait.coloredLines,
        cols: args.portrait.cols,
        rows: args.portrait.rows,
        format: args.portrait.format,
        sourceUrl: args.portrait.sourceUrl,
        generatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    };

    // Keep avatarUrl in sync when the profile had none — mirrors the
    // CLI portrait-push behavior in http.ts.
    if (!profile.avatarUrl && args.portrait.sourceUrl.startsWith("http")) {
      updates.avatarUrl = args.portrait.sourceUrl;
    }

    await ctx.db.patch(args.profileId, updates);
    return { saved: true, reason: "saved" as const };
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
