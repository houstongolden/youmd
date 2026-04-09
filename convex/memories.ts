import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOwner } from "./lib/auth";

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
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

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
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

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
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

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

/**
 * Archive stale memories based on policy.
 * Default: archive memories older than 90 days, keep max 200 active.
 */
export const archiveStale = mutation({
  args: {
    clerkId: v.string(),
    maxAgeDays: v.optional(v.number()), // default 90
    maxActive: v.optional(v.number()), // default 200
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const maxAge = (args.maxAgeDays ?? 90) * 86400000;
    const maxActive = args.maxActive ?? 200;
    const cutoff = Date.now() - maxAge;

    const memories = await ctx.db
      .query("memories")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const active = memories
      .filter((m) => !m.isArchived)
      .sort((a, b) => b.createdAt - a.createdAt);

    let archivedCount = 0;

    // Archive by age
    for (const m of active) {
      if (m.createdAt < cutoff) {
        await ctx.db.patch(m._id, { isArchived: true, updatedAt: Date.now() });
        archivedCount++;
      }
    }

    // Archive excess (keep newest maxActive)
    const remaining = active.filter((m) => m.createdAt >= cutoff);
    if (remaining.length > maxActive) {
      const toArchive = remaining.slice(maxActive);
      for (const m of toArchive) {
        await ctx.db.patch(m._id, { isArchived: true, updatedAt: Date.now() });
        archivedCount++;
      }
    }

    return { archived: archivedCount };
  },
});

/**
 * Clean up old archived memories to prevent unbounded growth.
 * Deletes archived memories older than maxArchiveDays (default 180).
 */
export const purgeOldArchived = mutation({
  args: {
    clerkId: v.string(),
    maxArchiveDays: v.optional(v.number()), // default 180
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const maxAge = (args.maxArchiveDays ?? 180) * 86400000;
    const cutoff = Date.now() - maxAge;

    const memories = await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", user._id).eq("isArchived", true)
      )
      .collect();

    let purged = 0;
    for (const m of memories) {
      if (m.createdAt < cutoff) {
        await ctx.db.delete(m._id);
        purged++;
      }
    }

    return { purged };
  },
});

/**
 * Session-start maintenance: archive stale + purge old archived.
 * Call this once when a chat session begins (web or CLI).
 */
export const sessionMaintenance = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { archived: 0, purged: 0 };

    const memories = await ctx.db
      .query("memories")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const active = memories.filter((m) => !m.isArchived);
    const archived = memories.filter((m) => m.isArchived);

    // Archive stale active memories (>90 days or >200 active)
    const ageCutoff = Date.now() - 90 * 86400000;
    let archivedCount = 0;

    const sorted = active.sort((a, b) => b.createdAt - a.createdAt);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].createdAt < ageCutoff || i >= 200) {
        await ctx.db.patch(sorted[i]._id, { isArchived: true, updatedAt: Date.now() });
        archivedCount++;
      }
    }

    // Purge archived memories older than 180 days
    const purgeCutoff = Date.now() - 180 * 86400000;
    let purgedCount = 0;
    for (const m of archived) {
      if (m.createdAt < purgeCutoff) {
        await ctx.db.delete(m._id);
        purgedCount++;
      }
    }

    return { archived: archivedCount, purged: purgedCount };
  },
});

/** Save memories from an external agent (no clerkId — caller must validate userId) */
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
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

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

// ── Chat message persistence ──────────────────────────────────────

/** Save display + LLM messages for a session (upsert) */
export const saveChatMessages = mutation({
  args: {
    clerkId: v.string(),
    sessionId: v.string(),
    displayMessages: v.array(v.object({
      id: v.string(),
      role: v.string(),
      content: v.string(),
    })),
    llmMessages: v.array(v.object({
      role: v.string(),
      content: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const existing = await ctx.db
      .query("chatMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayMessages: args.displayMessages,
        llmMessages: args.llmMessages,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("chatMessages", {
        userId: user._id,
        sessionId: args.sessionId,
        displayMessages: args.displayMessages,
        llmMessages: args.llmMessages,
        updatedAt: Date.now(),
      });
    }
  },
});

/** Load chat messages for the most recent session */
export const loadLatestChatMessages = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(1);

    if (sessions.length === 0) return null;
    const latestSession = sessions[0];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", latestSession.sessionId))
      .first();

    if (!messages) return null;

    return {
      sessionId: latestSession.sessionId,
      displayMessages: messages.displayMessages,
      llmMessages: messages.llmMessages,
      messageCount: latestSession.messageCount,
      summary: latestSession.summary,
      updatedAt: messages.updatedAt,
    };
  },
});
