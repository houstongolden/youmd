import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
