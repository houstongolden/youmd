import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  compileYouJson,
  compileYouMd,
  compileManifest,
  type ProfileData,
} from "./lib/compile";

/**
 * Authenticated user endpoints (/me/*).
 * These require a valid Clerk session.
 */

export const getMyProfile = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    return {
      user,
      latestBundle: latest ?? null,
      publishedBundle: published ?? null,
      bundleCount: bundles.length,
    };
  },
});

export const saveBundleFromForm = mutation({
  args: {
    clerkId: v.string(),
    profileData: v.any(), // ProfileData shape
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const data = args.profileData as ProfileData;
    data.username = user.username;

    const youJson = compileYouJson(data);
    const youMd = compileYouMd(data);
    const manifest = compileManifest(data);

    // Get next version
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const maxVersion = existing.reduce(
      (max, b) => Math.max(max, b.version),
      0
    );

    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest,
      youJson,
      youMd,
      isPublished: false,
      createdAt: Date.now(),
    });

    // Also sync youJson/youMd to the profiles table so public profile stays current
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();

    if (profile) {
      const profileUpdates: Record<string, unknown> = {
        youJson,
        youMd,
        updatedAt: Date.now(),
      };
      // Sync identity fields to profiles table
      const identity = youJson?.identity as Record<string, unknown> | undefined;
      if (identity?.name) profileUpdates.name = identity.name;
      if (identity?.tagline) profileUpdates.tagline = identity.tagline;
      if (identity?.location) profileUpdates.location = identity.location;
      if (identity?.bio) profileUpdates.bio = identity.bio;
      if (youJson?.links) profileUpdates.links = youJson.links;
      if (youJson?.now) {
        const now = youJson.now as Record<string, unknown>;
        if (now?.focus) profileUpdates.now = now.focus;
      }
      if (youJson?.projects) profileUpdates.projects = youJson.projects;
      if (youJson?.values) profileUpdates.values = youJson.values;
      if (youJson?.preferences) profileUpdates.preferences = youJson.preferences;

      await ctx.db.patch(profile._id, profileUpdates);
    }

    return { bundleId, version: maxVersion + 1 };
  },
});

export const publishLatest = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    if (!latest) throw new Error("No bundle to publish");

    // Unpublish all
    for (const b of bundles) {
      if (b.isPublished) {
        await ctx.db.patch(b._id, { isPublished: false });
      }
    }

    // Publish latest
    await ctx.db.patch(latest._id, {
      isPublished: true,
      publishedAt: Date.now(),
    });

    return {
      version: latest.version,
      username: user.username,
    };
  },
});

// Source management
export const addSource = mutation({
  args: {
    clerkId: v.string(),
    sourceType: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Check for existing source of same type
    const existing = await ctx.db
      .query("sources")
      .withIndex("by_userId_type", (q) =>
        q.eq("userId", user._id).eq("sourceType", args.sourceType)
      )
      .first();

    if (existing) {
      // Update existing source
      await ctx.db.patch(existing._id, {
        sourceUrl: args.sourceUrl,
        status: "pending",
      });
      return existing._id;
    }

    // Create new source
    const sourceId = await ctx.db.insert("sources", {
      userId: user._id,
      sourceType: args.sourceType,
      sourceUrl: args.sourceUrl,
      status: "pending",
    });

    return sourceId;
  },
});

export const getSources = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    return await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
  },
});

// Analytics
export const getAnalytics = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return null;

    const views = await ctx.db
      .query("profileViews")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const totalViews = views.length;
    const agentReads = views.filter((v) => v.isAgentRead).length;
    const webViews = totalViews - agentReads;

    // Last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentViews = views.filter((v) => v.viewedAt > weekAgo);

    return {
      totalViews,
      agentReads,
      webViews,
      last7Days: recentViews.length,
    };
  },
});
