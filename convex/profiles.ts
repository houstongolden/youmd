import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getPublicProfile = query({
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

    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    if (!published) return null;

    return {
      username: user.username,
      displayName: user.displayName,
      youJson: published.youJson,
      youMd: published.youMd,
    };
  },
});

export const recordView = mutation({
  args: {
    username: v.string(),
    referrer: v.optional(v.string()),
    isAgentRead: v.boolean(),
    isContextLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();

    if (!user) return;

    await ctx.db.insert("profileViews", {
      userId: user._id,
      viewedAt: Date.now(),
      referrer: args.referrer,
      isAgentRead: args.isAgentRead,
      isContextLink: args.isContextLink,
    });
  },
});
