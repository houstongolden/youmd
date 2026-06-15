/**
 * Internal mutations for githubProjects.ts (split into a non-Node.js file
 * because Convex does not allow mutations in Node.js runtime bundles).
 * Called only by the analyzeActiveProjects action via ctx.runMutation.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const internalUpsertProject = internalMutation({
  args: {
    userId: v.id("users"),
    githubRepoId: v.number(),
    fullName: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    primaryLanguage: v.optional(v.string()),
    pushedAt: v.number(),
    commitsLast90d: v.number(),
    stars: v.optional(v.number()),
    isPrivate: v.boolean(),
    insight: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trackedProjects")
      .withIndex("by_userId_fullName", (q) =>
        q.eq("userId", args.userId).eq("fullName", args.fullName)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        githubRepoId: args.githubRepoId,
        name: args.name,
        description: args.description,
        primaryLanguage: args.primaryLanguage,
        pushedAt: args.pushedAt,
        commitsLast90d: args.commitsLast90d,
        stars: args.stars,
        isPrivate: args.isPrivate,
        insight: args.insight,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("trackedProjects", {
        userId: args.userId,
        githubRepoId: args.githubRepoId,
        fullName: args.fullName,
        name: args.name,
        description: args.description,
        primaryLanguage: args.primaryLanguage,
        pushedAt: args.pushedAt,
        commitsLast90d: args.commitsLast90d,
        stars: args.stars,
        isPrivate: args.isPrivate,
        insight: args.insight,
        visibility: "private",
        trackedAt: now,
        updatedAt: now,
      });
    }
  },
});
