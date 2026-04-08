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

/**
 * Compute a "trust level" for an activity event:
 * - "verified-third-party": Anonymous external fetch with detected User-Agent (no auth)
 *   OR resolved via context-link token. These are TRULY external — agents reading
 *   the user's identity without being logged in as the user.
 * - "self-attributed": The request was authenticated as the profile owner (API key).
 *   These could be the user themselves OR an MCP client they've installed locally —
 *   we trust the auth but the "agent" identity is self-reported.
 * - "unknown": Couldn't determine.
 */
function computeTrust(source: string, hasToken: boolean, hasApiKey: boolean): string {
  if (source === "context-link" || hasToken) return "verified-third-party";
  if (source === "web-fetch") return "verified-third-party";
  if (source === "api-key" || source === "mcp" || hasApiKey) return "self-attributed";
  if (source === "cli") return "self-attributed";
  return "unknown";
}

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

    const filtered = items.filter((item) => {
      if (args.agentName && item.agentName !== args.agentName) return false;
      if (args.action && item.action !== args.action) return false;
      return true;
    });

    // Add computed trust level for UI display
    return filtered.map((item) => ({
      ...item,
      trust: computeTrust(item.agentSource, !!item.tokenId, !!item.apiKeyId),
    }));
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
        trustLevel: string; // "verified-third-party" | "self-attributed" | "mixed"
        verifiedReads: number;
        selfReads: number;
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
        trustLevel: "unknown",
        verifiedReads: 0,
        selfReads: 0,
      };
      if (a.action.includes("read") || a.action === "skill_use") existing.reads++;
      if (a.action.includes("write") || a.action === "push" || a.action === "publish")
        existing.writes++;
      existing.lastSeen = Math.max(existing.lastSeen, a.createdAt);
      existing.firstSeen = Math.min(existing.firstSeen, a.createdAt);
      existing.sources.add(a.agentSource);

      // Compute trust per event and aggregate
      const trust = computeTrust(a.agentSource, !!a.tokenId, !!a.apiKeyId);
      if (trust === "verified-third-party") existing.verifiedReads++;
      if (trust === "self-attributed") existing.selfReads++;

      byAgent.set(a.agentName, existing);
    }

    // Determine overall trust level for each agent
    return Array.from(byAgent.values())
      .map((a) => {
        let trustLevel = "unknown";
        if (a.verifiedReads > 0 && a.selfReads === 0) trustLevel = "verified-third-party";
        else if (a.selfReads > 0 && a.verifiedReads === 0) trustLevel = "self-attributed";
        else if (a.verifiedReads > 0 && a.selfReads > 0) trustLevel = "mixed";
        return { ...a, sources: Array.from(a.sources), trustLevel };
      })
      .sort((a, b) => b.lastSeen - a.lastSeen);
  },
});

/** Aggregate counts by user — for the history tab summary */
export const userActivityStats = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return { reads: 0, writes: 0, total: 0, verifiedReads: 0, selfReads: 0 };

    const all = await ctx.db
      .query("agentActivity")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    let reads = 0, writes = 0, verifiedReads = 0, selfReads = 0;
    for (const a of all) {
      if (a.action.includes("read") || a.action === "skill_use") reads++;
      if (a.action.includes("write") || a.action === "push" || a.action === "publish") writes++;
      const trust = computeTrust(a.agentSource, !!a.tokenId, !!a.apiKeyId);
      if (trust === "verified-third-party") verifiedReads++;
      if (trust === "self-attributed") selfReads++;
    }

    return { reads, writes, total: all.length, verifiedReads, selfReads };
  },
});
