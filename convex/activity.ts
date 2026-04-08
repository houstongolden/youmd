import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

// Internal mutation — called by HTTP handlers and other server code
export const logActivity = internalMutation({
  args: {
    userId: v.id("users"),
    profileId: v.optional(v.id("profiles")),
    agentName: v.string(),
    agentSource: v.string(),
    agentVersion: v.optional(v.string()),
    action: v.string(),
    resource: v.optional(v.string()),
    scope: v.optional(v.string()),
    tokenId: v.optional(v.id("contextLinks")),
    apiKeyId: v.optional(v.id("apiKeys")),
    status: v.string(),
    details: v.optional(v.any()),
    bundleVersionBefore: v.optional(v.number()),
    bundleVersionAfter: v.optional(v.number()),
    contentHashBefore: v.optional(v.string()),
    contentHashAfter: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentActivity", { ...args, createdAt: Date.now() });
  },
});

// Public query — list activity for the authenticated user
export const listActivity = query({
  args: {
    clerkId: v.string(),
    limit: v.optional(v.number()),
    agentName: v.optional(v.string()),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return [];

    const items = await ctx.db
      .query("agentActivity")
      .withIndex("by_userId_date", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 100);

    return items.filter((item) => {
      if (args.agentName && item.agentName !== args.agentName) return false;
      if (args.action && item.action !== args.action) return false;
      return true;
    });
  },
});

// Public query — aggregate stats per agent
export const agentSummary = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return [];

    const all = await ctx.db
      .query("agentActivity")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const byAgent = new Map<
      string,
      {
        agentName: string;
        reads: number;
        writes: number;
        lastSeen: number;
        firstSeen: number;
        sources: Set<string>;
      }
    >();

    for (const a of all) {
      const existing = byAgent.get(a.agentName) || {
        agentName: a.agentName,
        reads: 0,
        writes: 0,
        lastSeen: 0,
        firstSeen: a.createdAt,
        sources: new Set<string>(),
      };
      if (a.action.includes("read") || a.action === "skill_use") existing.reads++;
      if (a.action.includes("write") || a.action === "push" || a.action === "publish")
        existing.writes++;
      existing.lastSeen = Math.max(existing.lastSeen, a.createdAt);
      existing.firstSeen = Math.min(existing.firstSeen, a.createdAt);
      existing.sources.add(a.agentSource);
      byAgent.set(a.agentName, existing);
    }

    return Array.from(byAgent.values())
      .map((a) => ({ ...a, sources: Array.from(a.sources) }))
      .sort((a, b) => b.lastSeen - a.lastSeen);
  },
});
