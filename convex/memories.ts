import { v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { computeMemoryContentHash } from "./lib/hash";
import { pageArgs, clampPageSize } from "./lib/pagination";

// ── P23: content-hash dedupe (PRODUCT-AUDIT #25) ────────────────
//
// Saving the exact same fact twice (same normalized content + category) for
// the same user is a no-op: the existing ACTIVE memory is returned marked
// `deduped: true` instead of inserting a duplicate row. Archived duplicates
// do NOT block — re-learning an archived fact inserts a fresh active row.
// Pre-P23 rows have no contentHash and therefore never dedupe-match.

/** Find an active memory with the same content hash, if any. */
async function findActiveDuplicate(
  ctx: MutationCtx,
  userId: Id<"users">,
  contentHash: string
): Promise<Doc<"memories"> | null> {
  const matches = await ctx.db
    .query("memories")
    .withIndex("by_userId_contentHash", (q) =>
      q.eq("userId", userId).eq("contentHash", contentHash)
    )
    .collect();
  return matches.find((m) => !m.isArchived) ?? null;
}

// ── Memory queries ──────────────────────────────────────────────

/** Get all active memories for a user */
export const listMemories = query({
  // Cycle 44: added auth. Previously took only userId — leaked all memories.
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

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
      .slice(0, Number.isFinite(args.limit) ? args.limit : 100);
  },
});

/**
 * P13: cursor-paginated variant of listMemories.
 *
 * Same auth + visibility contract (owner only, archived rows never surface),
 * same newest-first ordering. The no-category branch uses the
 * by_userId_archived index so pages are full; the category branch filters
 * archived rows inside pagination (Convex-native — pages may run short but
 * cursors stay correct).
 */
export const listMemoriesPage = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    category: v.optional(v.string()),
    ...pageArgs,
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const paginationOpts = {
      cursor: args.cursor ?? null,
      numItems: clampPageSize(args.numItems, 100, 500),
    };

    if (args.category) {
      const result = await ctx.db
        .query("memories")
        .withIndex("by_userId_category", (q) =>
          q.eq("userId", args.userId).eq("category", args.category!)
        )
        .order("desc")
        .filter((q) => q.neq(q.field("isArchived"), true))
        .paginate(paginationOpts);
      return result;
    }

    return await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Full-text search across a user's active memories (P5: memory search) */
export const searchMemories = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    searchText: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const searchText = args.searchText.trim();
    if (!searchText) return [];

    const limit =
      args.limit !== undefined && Number.isFinite(args.limit)
        ? Math.min(Math.max(Math.floor(args.limit), 1), 100)
        : 20;

    // Search index results come back in relevance order; isArchived filter
    // mirrors the soft-delete behavior of listMemories.
    return await ctx.db
      .query("memories")
      .withSearchIndex("search_content", (q) =>
        q
          .search("content", searchText)
          .eq("userId", args.userId)
          .eq("isArchived", false)
      )
      .take(limit);
  },
});

/**
 * P13: cursor-paginated variant of searchMemories.
 *
 * Convex search-index queries return an OrderedQuery, which natively
 * supports .paginate() (verified against convex 1.33 types) — so search
 * results page in relevance order with real cursors, same auth and
 * archived-row exclusion as searchMemories.
 */
export const searchMemoriesPage = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    searchText: v.string(),
    ...pageArgs,
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const searchText = args.searchText.trim();
    if (!searchText) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    return await ctx.db
      .query("memories")
      .withSearchIndex("search_content", (q) =>
        q
          .search("content", searchText)
          .eq("userId", args.userId)
          .eq("isArchived", false)
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: clampPageSize(args.numItems, 20, 100),
      });
  },
});

/** Get memory count by category */
export const getMemoryStats = query({
  // Cycle 44: added auth. Previously leaked memory category counts.
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

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
    _internalAuthToken: v.optional(v.string()),
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
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const results: Array<{ id: Id<"memories">; deduped: boolean }> = [];
    let saved = 0;
    for (const mem of args.memories) {
      const contentHash = await computeMemoryContentHash(
        mem.content,
        mem.category
      );
      const existing = await findActiveDuplicate(ctx, user._id, contentHash);
      if (existing) {
        results.push({ id: existing._id, deduped: true });
        continue;
      }
      const id = await ctx.db.insert("memories", {
        userId: user._id,
        category: mem.category,
        content: mem.content,
        source: mem.source,
        sourceAgent: mem.sourceAgent,
        tags: mem.tags,
        sessionId: mem.sessionId,
        isArchived: false,
        contentHash,
        createdAt: Date.now(),
      });
      saved++;
      results.push({ id, deduped: false });
    }

    // `saved` stays "rows actually inserted" (back-compat); `deduped` and
    // per-item `results` are additive (P23).
    return { saved, deduped: results.length - saved, results };
  },
});

/** Archive a memory (soft delete) */
export const archiveMemory = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    memoryId: v.id("memories"),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
    _internalAuthToken: v.optional(v.string()),
    memoryId: v.id("memories"),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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

    // Keep the dedupe hash truthful when content/category changes (P23).
    if (args.content !== undefined || args.category !== undefined) {
      updates.contentHash = await computeMemoryContentHash(
        args.content ?? memory.content,
        args.category ?? memory.category
      );
    }

    await ctx.db.patch(args.memoryId, updates);
  },
});

// ── Chat session tracking ───────────────────────────────────────

/** List recent chat sessions */
export const listSessions = query({
  // Cycle 44: added auth. Previously leaked all chat sessions for any user.
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

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
    _internalAuthToken: v.optional(v.string()),
    maxAgeDays: v.optional(v.number()), // default 90
    maxActive: v.optional(v.number()), // default 200
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
    _internalAuthToken: v.optional(v.string()),
    maxArchiveDays: v.optional(v.number()), // default 180
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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

/**
 * Save memories from an external agent.
 * Cycle 44: previously the comment said "no clerkId — caller must validate userId"
 * but no caller ever did. This was an anonymous-write P0. Now requires auth.
 */
export const saveFromAgent = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
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
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

    const results: Array<{ id: Id<"memories">; deduped: boolean }> = [];
    let saved = 0;
    for (const mem of args.memories) {
      const contentHash = await computeMemoryContentHash(
        mem.content,
        mem.category
      );
      const existing = await findActiveDuplicate(ctx, args.userId, contentHash);
      if (existing) {
        results.push({ id: existing._id, deduped: true });
        continue;
      }
      const id = await ctx.db.insert("memories", {
        userId: args.userId,
        category: mem.category,
        content: mem.content,
        source: "external-agent",
        sourceAgent: args.agentName,
        tags: mem.tags,
        isArchived: false,
        contentHash,
        createdAt: Date.now(),
      });
      saved++;
      results.push({ id, deduped: false });
    }
    // `saved` stays "rows actually inserted" (back-compat); `deduped` and
    // per-item `results` are additive (P23).
    return { saved, deduped: results.length - saved, results };
  },
});

/** Create or update a chat session */
export const upsertSession = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    sessionId: v.string(),
    surface: v.string(),
    summary: v.optional(v.string()),
    messageCount: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
    _internalAuthToken: v.optional(v.string()),
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
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

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
  // Cycle 44: added auth. Previously leaked the FULL chat history of any user.
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || owner._id !== args.userId) {
      throw new Error("not authorized: userId does not match authenticated user");
    }

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
