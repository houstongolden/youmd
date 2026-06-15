/**
 * Public (non-Node.js) query and mutation for tracked GitHub projects.
 * Kept separate from githubProjects.ts (which has "use node" for the action)
 * because Convex does not allow queries or mutations in Node.js bundles.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOwner } from "./lib/auth";

// ---------------------------------------------------------------------------
// listTrackedProjects — public query (owner-gated)
// ---------------------------------------------------------------------------

export const listTrackedProjects = query({
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
    if (!user) return [];

    const projects = await ctx.db
      .query("trackedProjects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by pushedAt descending (most-recently-active first).
    return projects.sort((a, b) => b.pushedAt - a.pushedAt);
  },
});

// ---------------------------------------------------------------------------
// setProjectVisibility — public mutation (owner-gated)
// ---------------------------------------------------------------------------

export const setProjectVisibility = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    fullName: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found.");

    const project = await ctx.db
      .query("trackedProjects")
      .withIndex("by_userId_fullName", (q) =>
        q.eq("userId", user._id).eq("fullName", args.fullName)
      )
      .first();

    if (!project) {
      throw new Error(`Tracked project not found: ${args.fullName}`);
    }

    await ctx.db.patch(project._id, {
      visibility: args.visibility,
      updatedAt: Date.now(),
    });

    return { fullName: args.fullName, visibility: args.visibility };
  },
});
