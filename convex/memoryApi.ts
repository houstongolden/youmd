import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Memory API for external agents.
 * Authenticated via access tokens (ym_ prefix) through validateToken.
 */

/** Save memories from an external agent via access token */
export const saveFromAgent = mutation({
  args: {
    userId: v.id("users"),
    agentName: v.string(),
    memories: v.array(
      v.object({
        category: v.string(),
        content: v.string(),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const mem of args.memories) {
      const id = await ctx.db.insert("memories", {
        userId: args.userId,
        category: mem.category,
        content: mem.content,
        source: "external-agent",
        sourceAgent: args.agentName,
        tags: mem.tags,
        isArchived: false,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return { saved: ids.length };
  },
});

/** List memories for an external agent (via authenticated userId) */
export const listForAgent = query({
  args: {
    userId: v.id("users"),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q;
    if (args.category) {
      q = ctx.db
        .query("memories")
        .withIndex("by_userId_category", (q) =>
          q.eq("userId", args.userId).eq("category", args.category!)
        );
    } else {
      q = ctx.db
        .query("memories")
        .withIndex("by_userId", (q) => q.eq("userId", args.userId));
    }

    const memories = await q.collect();
    return memories
      .filter((m) => !m.isArchived)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 50)
      .map((m) => ({
        category: m.category,
        content: m.content,
        source: m.source,
        sourceAgent: m.sourceAgent,
        tags: m.tags,
        createdAt: m.createdAt,
      }));
  },
});
