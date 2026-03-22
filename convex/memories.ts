import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ── Memory queries ──────────────────────────────────────────────

/** Get all active memories for a user */
export const listMemories = query({
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
      .slice(0, args.limit ?? 100);
  },
});

/** Get memory count by category */
export const getMemoryStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const active = memories.filter((m) => !m.isArchived);
    const byCategory: Record<string, number> = {};
    for (const m of active) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }

    return {
      total: active.length,
      archived: memories.length - active.length,
      byCategory,
    };
  },
});

// ── Memory mutations ────────────────────────────────────────────

/** Save one or more memories (used by agent auto-capture) */
export const saveMemories = mutation({
  args: {
    clerkId: v.string(),
    memories: v.array(
      v.object({
        category: v.string(),
        content: v.string(),
        source: v.string(),
        sourceAgent: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        sessionId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const ids = [];
    for (const mem of args.memories) {
      const id = await ctx.db.insert("memories", {
        userId: user._id,
        category: mem.category,
        content: mem.content,
        source: mem.source,
        sourceAgent: mem.sourceAgent,
        tags: mem.tags,
        sessionId: mem.sessionId,
        isArchived: false,
        createdAt: Date.now(),
      });
      ids.push(id);
    }

    return { saved: ids.length };
  },
});

/** Archive a memory (soft delete) */
export const archiveMemory = mutation({
  args: {
    clerkId: v.string(),
    memoryId: v.id("memories"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== user._id) throw new Error("memory not found");

    await ctx.db.patch(args.memoryId, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});

/** Update a memory's content */
export const updateMemory = mutation({
  args: {
    clerkId: v.string(),
    memoryId: v.id("memories"),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== user._id) throw new Error("memory not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.content !== undefined) updates.content = args.content;
    if (args.category !== undefined) updates.category = args.category;
    if (args.tags !== undefined) updates.tags = args.tags;

    await ctx.db.patch(args.memoryId, updates);
  },
});

// ── Chat session tracking ───────────────────────────────────────

/** List recent chat sessions */
export const listSessions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return sessions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 20);
  },
});

/** Create or update a chat session */
export const upsertSession = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.string(),
    surface: v.string(),
    summary: v.optional(v.string()),
    messageCount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const existing = await ctx.db
      .query("chatSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        messageCount: args.messageCount,
        lastMessageAt: Date.now(),
        summary: args.summary ?? existing.summary,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("chatSessions", {
        userId: user._id,
        sessionId: args.sessionId,
        surface: args.surface,
        summary: args.summary,
        messageCount: args.messageCount,
        lastMessageAt: Date.now(),
        createdAt: Date.now(),
      });
    }
  },
});
