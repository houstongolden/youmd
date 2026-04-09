import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";

export const getPublishedBundle = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();

    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Find the latest published bundle
    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    return published ?? null;
  },
});

export const getLatestBundle = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles.sort((a, b) => b.version - a.version)[0] ?? null;
  },
});

/**
 * Get a specific bundle by version number for the authenticated user.
 * Returns the full bundle (manifest, youJson, youMd) so callers can diff
 * two arbitrary versions.
 */
export const getBundleByVersion = query({
  args: { clerkId: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const target = bundles.find((b) => b.version === args.version);
    if (!target) return null;

    return {
      version: target.version,
      isPublished: target.isPublished,
      createdAt: target.createdAt,
      publishedAt: target.publishedAt,
      contentHash: target.contentHash,
      manifest: target.manifest,
      youJson: target.youJson,
      youMd: target.youMd,
    };
  },
});

export const saveBundle = mutation({
  args: {
    userId: v.id("users"),
    manifest: v.any(),
    youJson: v.any(),
    youMd: v.string(),
  },
  handler: async (ctx, args) => {
    // Get next version number
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

    return bundleId;
  },
});

export const listRecentBundles = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles
      .sort((a, b) => b.version - a.version)
      .slice(0, args.limit ?? 10)
      .map((b) => ({
        _id: b._id,
        version: b.version,
        isPublished: b.isPublished,
        createdAt: b.createdAt,
        publishedAt: b.publishedAt,
      }));
  },
});

export const publishBundle = mutation({
  args: { bundleId: v.id("bundles") },
  handler: async (ctx, args) => {
    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) throw new Error("Bundle not found.");

    // Unpublish all previous bundles for this user
    const userBundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", bundle.userId))
      .collect();

    for (const b of userBundles) {
      if (b.isPublished) {
        await ctx.db.patch(b._id, { isPublished: false });
      }
    }

    // Publish the target bundle
    await ctx.db.patch(args.bundleId, {
      isPublished: true,
      publishedAt: Date.now(),
    });
  },
});

/**
 * Get full version history for a user's bundles.
 * Returns version, timestamp, hash, source, changed sections, publish status.
 */
export const getHistory = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles
      .sort((a, b) => b.version - a.version)
      .slice(0, 50)
      .map((b) => ({
        _id: b._id,
        version: b.version,
        isPublished: b.isPublished,
        createdAt: b.createdAt,
        publishedAt: b.publishedAt,
        contentHash: b.contentHash?.slice(0, 12),
        parentHash: b.parentHash?.slice(0, 12),
        source: (b as any).source || "unknown",
        changeNote: (b as any).changeNote || null,
        changedSections: (b as any).changedSections || null,
      }));
  },
});

/**
 * Rollback to a specific version — creates a new version from an old one.
 */
export const rollbackToVersion = mutation({
  args: {
    clerkId: v.string(),
    targetVersion: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const target = bundles.find((b) => b.version === args.targetVersion);
    if (!target) throw new Error(`Version ${args.targetVersion} not found`);

    const maxVersion = bundles.reduce((max, b) => Math.max(max, b.version), 0);

    // Create a new version with the old content
    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: target.schemaVersion,
      manifest: target.manifest,
      youJson: target.youJson,
      youMd: target.youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash: target.contentHash,
      parentHash: target.contentHash,
      source: "rollback",
      changeNote: `rolled back to v${args.targetVersion}`,
    });

    return { bundleId, version: maxVersion + 1 };
  },
});

/**
 * Track an agent interaction (read or write).
 */
export const trackAgentInteraction = mutation({
  args: {
    profileId: v.optional(v.id("profiles")),
    userId: v.optional(v.id("users")),
    agentName: v.string(),
    agentType: v.string(), // "read" | "write" | "chat"
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Find profile by userId if not provided directly
    let profileId = args.profileId;
    if (!profileId && args.userId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", args.userId))
        .first();
      profileId = profile?._id;
    }

    if (!profileId) return;

    // Check if this agent already has an interaction record
    const existing = await ctx.db
      .query("agentInteractions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profileId))
      .collect();

    const match = existing.find((e) => e.agentName === args.agentName && e.agentType === args.agentType);

    if (match) {
      await ctx.db.patch(match._id, {
        interactionCount: match.interactionCount + 1,
        lastInteractionAt: Date.now(),
        metadata: args.metadata ?? match.metadata,
      });
    } else {
      await ctx.db.insert("agentInteractions", {
        profileId,
        agentName: args.agentName,
        agentType: args.agentType,
        interactionCount: 1,
        lastInteractionAt: Date.now(),
        metadata: args.metadata,
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Get agent interaction stats for a profile.
 */
export const getAgentStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.userId))
      .first();

    if (!profile) return { interactions: [], totalReads: 0, totalWrites: 0 };

    const interactions = await ctx.db
      .query("agentInteractions")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .collect();

    const totalReads = interactions
      .filter((i) => i.agentType === "read")
      .reduce((sum, i) => sum + i.interactionCount, 0);
    const totalWrites = interactions
      .filter((i) => i.agentType === "write" || i.agentType === "chat")
      .reduce((sum, i) => sum + i.interactionCount, 0);

    return {
      interactions: interactions.sort((a, b) => b.lastInteractionAt - a.lastInteractionAt),
      totalReads,
      totalWrites,
    };
  },
});
