import { ConvexError, v } from "convex/values";
import { query, mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOwner } from "./lib/auth";
import { computeMemoryContentHash } from "./lib/hash";
import { pageArgs, clampPageSize } from "./lib/pagination";
import {
  invalidMemoryCategoryMessage,
  resolveMemoryCategory,
} from "./lib/memoryCategories";

// ── P15: category validation (writes strict, reads tolerant) ───────
//
// Write paths reject unknown categories (ConvexError here, invalid_request
// envelope in convex/http.ts). Known legacy aliases normalize to canonical
// on write so older agents keep working. Reads never filter by category
// validity — legacy stored values surface as-is until
// migrations/normalizeMemoryCategories.ts cleans them.

/** Resolve a category for a write, throwing ConvexError when unknown. */
function coerceMemoryCategory(raw: string): string {
  const category = resolveMemoryCategory(raw);
  if (!category) throw new ConvexError(invalidMemoryCategoryMessage(raw));
  return category;
}

/** P14: importance must be an integer 1-5 when provided. */
function coerceImportance(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
    throw new ConvexError("invalid importance: must be an integer between 1 and 5");
  }
  return raw;
}

function buildChatTitleFromPrompt(prompt?: string): string | undefined {
  const cleaned = (prompt ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(yo|hey|ok|okay|please|can you|could you|i need you to)\b[\s,.:;-]*/i, "")
    .trim();
  if (!cleaned) return undefined;
  const sentence = cleaned.split(/[.!?\n]/)[0]?.trim() || cleaned;
  const title = sentence.length > 58 ? `${sentence.slice(0, 55).trim()}...` : sentence;
  return title || undefined;
}

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
    // P14: superseded memories are hidden by default; pass true to audit them.
    includeSuperseded: v.optional(v.boolean()),
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
      .filter((m) => args.includeSuperseded === true || !m.supersededBy)
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
    // P14: superseded memories are hidden by default; pass true to audit them.
    includeSuperseded: v.optional(v.boolean()),
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

    // P14: filter superseded rows inside pagination (Convex-native — pages
    // may run short but cursors stay correct, same as the archived filter).
    const includeSuperseded = args.includeSuperseded === true;

    if (args.category) {
      let q = ctx.db
        .query("memories")
        .withIndex("by_userId_category", (q) =>
          q.eq("userId", args.userId).eq("category", args.category!)
        )
        .order("desc")
        .filter((q) => q.neq(q.field("isArchived"), true));
      if (!includeSuperseded) {
        q = q.filter((q) => q.eq(q.field("supersededBy"), undefined));
      }
      return await q.paginate(paginationOpts);
    }

    let q = ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .order("desc");
    if (!includeSuperseded) {
      q = q.filter((q) => q.eq(q.field("supersededBy"), undefined));
    }
    return await q.paginate(paginationOpts);
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
    // mirrors the soft-delete behavior of listMemories. P14: superseded
    // memories never surface in search — the replacement row carries the truth.
    return await ctx.db
      .query("memories")
      .withSearchIndex("search_content", (q) =>
        q
          .search("content", searchText)
          .eq("userId", args.userId)
          .eq("isArchived", false)
      )
      .filter((q) => q.eq(q.field("supersededBy"), undefined))
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

    // P14: superseded memories never surface in search (see searchMemories).
    return await ctx.db
      .query("memories")
      .withSearchIndex("search_content", (q) =>
        q
          .search("content", searchText)
          .eq("userId", args.userId)
          .eq("isArchived", false)
      )
      .filter((q) => q.eq(q.field("supersededBy"), undefined))
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

// ── P14: review queue (cleanup proposals — humans/agents decide) ──

/** Review-queue selection: active rows older than this many days. */
const REVIEW_QUEUE_MAX_AGE_DAYS = 90;
/** importance <= this (or unset) counts as low-importance. */
const REVIEW_QUEUE_LOW_IMPORTANCE_MAX = 2;
/** Hard cap on queue size. */
const REVIEW_QUEUE_CAP = 50;

/**
 * Memories that are candidates for cleanup: active (not archived, not
 * superseded), NOT pinned, low-importance (<= 2) or importance-unset, and
 * older than 90 days. Capped at 50, oldest first. This is purely a surface
 * for agents/UI to PROPOSE cleanup — no cron, no auto-delete.
 */
export const listReviewQueue = query({
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

    const cutoff = Date.now() - REVIEW_QUEUE_MAX_AGE_DAYS * 86400000;

    const active = await ctx.db
      .query("memories")
      .withIndex("by_userId_archived", (q) =>
        q.eq("userId", args.userId).eq("isArchived", false)
      )
      .collect();

    return active
      .filter(
        (m) =>
          !m.supersededBy &&
          m.pinned !== true &&
          (m.importance === undefined ||
            m.importance <= REVIEW_QUEUE_LOW_IMPORTANCE_MAX) &&
          m.createdAt < cutoff
      )
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, REVIEW_QUEUE_CAP);
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
        // P14 durability (optional/additive)
        pinned: v.optional(v.boolean()),
        importance: v.optional(v.number()),
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
      // P15: reject unknown categories, normalize legacy aliases.
      const category = coerceMemoryCategory(mem.category);
      const importance = coerceImportance(mem.importance);
      const contentHash = await computeMemoryContentHash(
        mem.content,
        category
      );
      const existing = await findActiveDuplicate(ctx, user._id, contentHash);
      if (existing) {
        results.push({ id: existing._id, deduped: true });
        continue;
      }
      const id = await ctx.db.insert("memories", {
        userId: user._id,
        category,
        content: mem.content,
        source: mem.source,
        sourceAgent: mem.sourceAgent,
        tags: mem.tags,
        sessionId: mem.sessionId,
        pinned: mem.pinned,
        importance,
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
    // P14 durability (optional/additive) — pinning support for the update path.
    pinned: v.optional(v.boolean()),
    importance: v.optional(v.number()),
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

    // P15: reject unknown categories, normalize legacy aliases.
    const category =
      args.category !== undefined ? coerceMemoryCategory(args.category) : undefined;
    const importance = coerceImportance(args.importance);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.content !== undefined) updates.content = args.content;
    if (category !== undefined) updates.category = category;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.pinned !== undefined) updates.pinned = args.pinned;
    if (importance !== undefined) updates.importance = importance;

    // Keep the dedupe hash truthful when content/category changes (P23).
    if (args.content !== undefined || category !== undefined) {
      updates.contentHash = await computeMemoryContentHash(
        args.content ?? memory.content,
        category ?? memory.category
      );
    }

    await ctx.db.patch(args.memoryId, updates);
  },
});

/**
 * P14: mark an old memory as superseded by a newer one (old→new link).
 * The old row stays stored (auditable via includeSuperseded=true) but is
 * excluded from briefs, search, and default lists. Both memories must
 * belong to the authenticated user.
 */
export const supersedeMemory = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    /** The OLD memory being replaced. */
    memoryId: v.id("memories"),
    /** The NEW memory that replaces it. */
    supersededBy: v.id("memories"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    if (args.memoryId === args.supersededBy) {
      throw new ConvexError("a memory cannot supersede itself");
    }

    const oldMemory = await ctx.db.get(args.memoryId);
    if (!oldMemory || oldMemory.userId !== user._id) {
      throw new Error("memory not found");
    }
    const newMemory = await ctx.db.get(args.supersededBy);
    if (!newMemory || newMemory.userId !== user._id) {
      throw new Error("memory not found");
    }

    await ctx.db.patch(args.memoryId, {
      supersededBy: args.supersededBy,
      updatedAt: Date.now(),
    });
    return { superseded: args.memoryId, by: args.supersededBy };
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

    const recentSessions = sessions
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
      .slice(0, args.limit ?? 20);

    return await Promise.all(
      recentSessions.map(async (session) => {
        if (session.summary?.trim()) return session;
        const messages = await ctx.db
          .query("chatMessages")
          .withIndex("by_sessionId", (q) => q.eq("sessionId", session.sessionId))
          .first();
        const firstDisplayUser = messages?.displayMessages.find((message) => message.role === "user");
        const firstLlmUser = messages?.llmMessages.find((message) => message.role === "user");
        const summary = buildChatTitleFromPrompt(firstDisplayUser?.content ?? firstLlmUser?.content);
        return summary ? { ...session, summary } : session;
      })
    );
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

    // Archive by age (P14: pinned memories are exempt — pinning means
    // "never decays away", so age/overflow policies skip them)
    for (const m of active) {
      if (m.pinned !== true && m.createdAt < cutoff) {
        await ctx.db.patch(m._id, { isArchived: true, updatedAt: Date.now() });
        archivedCount++;
      }
    }

    // Archive excess (keep newest maxActive; pinned exempt)
    const remaining = active.filter((m) => m.pinned !== true && m.createdAt >= cutoff);
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

    // Archive stale active memories (>90 days or >200 active).
    // P14: pinned memories are exempt — pinning means "never decays away".
    const ageCutoff = Date.now() - 90 * 86400000;
    let archivedCount = 0;

    const sorted = active
      .filter((m) => m.pinned !== true)
      .sort((a, b) => b.createdAt - a.createdAt);
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
        // P14 durability (optional/additive)
        pinned: v.optional(v.boolean()),
        importance: v.optional(v.number()),
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
      // P15: reject unknown categories, normalize legacy aliases.
      const category = coerceMemoryCategory(mem.category);
      const importance = coerceImportance(mem.importance);
      const contentHash = await computeMemoryContentHash(
        mem.content,
        category
      );
      const existing = await findActiveDuplicate(ctx, args.userId, contentHash);
      if (existing) {
        results.push({ id: existing._id, deduped: true });
        continue;
      }
      const id = await ctx.db.insert("memories", {
        userId: args.userId,
        category,
        content: mem.content,
        source: "external-agent",
        sourceAgent: args.agentName,
        tags: mem.tags,
        pinned: mem.pinned,
        importance,
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

/** Load chat messages for a specific session owned by the authenticated user */
export const loadChatMessagesBySession = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    userId: v.id("users"),
    sessionId: v.string(),
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

    const session = await ctx.db
      .query("chatSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session || session.userId !== args.userId) return null;

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!messages || messages.userId !== args.userId) return null;

    return {
      sessionId: session.sessionId,
      displayMessages: messages.displayMessages,
      llmMessages: messages.llmMessages,
      messageCount: session.messageCount,
      summary: session.summary,
      updatedAt: messages.updatedAt,
    };
  },
});
