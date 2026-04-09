import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOwner } from "./lib/auth";

// ── Agent interaction stats ──────────────────────────────────

/** Get agent interaction stats for a profile */
export const getAgentStats = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const interactions = await ctx.db
      .query("agentInteractions")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .collect();

    const totalReads = interactions
      .filter((i) => i.agentType === "read")
      .reduce((sum, i) => sum + i.interactionCount, 0);
    const totalWrites = interactions
      .filter((i) => i.agentType === "write")
      .reduce((sum, i) => sum + i.interactionCount, 0);
    const uniqueAgents = interactions.length;
    const totalInteractions = interactions.reduce((sum, i) => sum + i.interactionCount, 0);

    return {
      totalReads,
      totalWrites,
      uniqueAgents,
      totalInteractions,
      agents: interactions.map((i) => ({
        name: i.agentName,
        type: i.agentType,
        count: i.interactionCount,
        lastUsed: i.lastInteractionAt,
      })),
    };
  },
});

// ── SHA-256 hash helper ──────────────────────────────────────

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "ym_";
  for (let i = 0; i < 40; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ── Private context queries ──────────────────────────────────

/** Get private context — owner only (requires authenticated Clerk identity) */
export const getPrivateContext = query({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    // Then verify they own the profile
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.ownerId !== user._id) return null;

    return ctx.db
      .query("privateContext")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();
  },
});

// ── Private context mutations ────────────────────────────────

/** Update private context — owner only */
export const updatePrivateContext = mutation({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
    privateNotes: v.optional(v.string()),
    privateProjects: v.optional(v.array(v.any())),
    internalLinks: v.optional(v.any()),
    calendarContext: v.optional(v.string()),
    communicationPrefs: v.optional(v.any()),
    investmentThesis: v.optional(v.string()),
    customData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    // Then verify they own the profile
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.ownerId !== user._id) throw new Error("not the profile owner");

    // Get or create private context
    const existing = await ctx.db
      .query("privateContext")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .first();

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.privateNotes !== undefined) updates.privateNotes = args.privateNotes;
    if (args.privateProjects !== undefined) updates.privateProjects = args.privateProjects;
    if (args.internalLinks !== undefined) updates.internalLinks = args.internalLinks;
    if (args.calendarContext !== undefined) updates.calendarContext = args.calendarContext;
    if (args.communicationPrefs !== undefined) updates.communicationPrefs = args.communicationPrefs;
    if (args.investmentThesis !== undefined) updates.investmentThesis = args.investmentThesis;
    if (args.customData !== undefined) updates.customData = args.customData;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("privateContext", {
        profileId: args.profileId,
        ...updates,
        createdAt: Date.now(),
      });
    }

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "private_context_updated",
      profileId: args.profileId,
      userId: user._id,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Access token management ──────────────────────────────────

/** Create an access token — owner only */
export const createAccessToken = mutation({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
    name: v.string(),
    scopes: v.array(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.ownerId !== user._id) throw new Error("not the profile owner");

    // Generate token
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 86400000
      : undefined;

    const tokenId = await ctx.db.insert("accessTokens", {
      profileId: args.profileId,
      name: args.name,
      tokenHash,
      scopes: args.scopes,
      expiresAt,
      isRevoked: false,
      createdAt: Date.now(),
    });

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "token_created",
      profileId: args.profileId,
      userId: user._id,
      details: { tokenName: args.name, scopes: args.scopes },
      createdAt: Date.now(),
    });

    // Return the raw token ONCE — it can't be retrieved again
    return { tokenId, token: rawToken, name: args.name, scopes: args.scopes };
  },
});

/** Revoke an access token — owner only */
export const revokeAccessToken = mutation({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
    tokenId: v.id("accessTokens"),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.ownerId !== user._id) throw new Error("not the profile owner");

    const token = await ctx.db.get(args.tokenId);
    if (!token || token.profileId !== args.profileId) throw new Error("token not found");

    await ctx.db.patch(args.tokenId, { isRevoked: true });

    await ctx.db.insert("securityLogs", {
      eventType: "token_revoked",
      profileId: args.profileId,
      userId: user._id,
      details: { tokenName: token.name },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** List access tokens for a profile — owner only */
export const listAccessTokens = query({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return [];

    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.ownerId !== user._id) return [];

    const tokens = await ctx.db
      .query("accessTokens")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .collect();

    // Never return the hash — just metadata
    return tokens.map((t) => ({
      _id: t._id,
      name: t.name,
      scopes: t.scopes,
      expiresAt: t.expiresAt,
      isRevoked: t.isRevoked,
      lastUsedAt: t.lastUsedAt,
      createdAt: t.createdAt,
    }));
  },
});

/** Validate an access token — used by external agents */
export const validateToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const tokenHash = await hashToken(args.token);

    const accessToken = await ctx.db
      .query("accessTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!accessToken) return { valid: false, error: "token not found" };
    if (accessToken.isRevoked) return { valid: false, error: "token revoked" };
    if (accessToken.expiresAt && accessToken.expiresAt < Date.now()) {
      return { valid: false, error: "token expired" };
    }

    // Update last used
    await ctx.db.patch(accessToken._id, { lastUsedAt: Date.now() });

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "token_used",
      profileId: accessToken.profileId,
      details: { tokenName: accessToken.name },
      createdAt: Date.now(),
    });

    // Track agent interaction
    const agentName = accessToken.name || "Unknown Agent";
    const agentType = accessToken.scopes.includes("write") ? "write" : "read";
    const existingInteraction = await ctx.db
      .query("agentInteractions")
      .withIndex("by_profileId", (q) => q.eq("profileId", accessToken.profileId))
      .collect()
      .then((interactions) => interactions.find((i) => i.agentName === agentName));

    if (existingInteraction) {
      await ctx.db.patch(existingInteraction._id, {
        interactionCount: existingInteraction.interactionCount + 1,
        lastInteractionAt: Date.now(),
      });
    } else {
      await ctx.db.insert("agentInteractions", {
        profileId: accessToken.profileId,
        agentName,
        agentType,
        interactionCount: 1,
        lastInteractionAt: Date.now(),
        createdAt: Date.now(),
      });
    }

    // Get profile (public data)
    const profile = await ctx.db.get(accessToken.profileId);

    // Get private context if read scope
    let privateContext = null;
    if (accessToken.scopes.includes("read")) {
      privateContext = await ctx.db
        .query("privateContext")
        .withIndex("by_profileId", (q) => q.eq("profileId", accessToken.profileId))
        .first();
    }

    return {
      valid: true,
      scopes: accessToken.scopes,
      profile: profile
        ? {
            username: profile.username,
            name: profile.name,
            tagline: profile.tagline,
            bio: profile.bio,
            links: profile.links,
            youJson: profile.youJson,
          }
        : null,
      privateContext: privateContext
        ? {
            privateNotes: privateContext.privateNotes,
            privateProjects: privateContext.privateProjects,
            internalLinks: privateContext.internalLinks,
            customData: privateContext.customData,
          }
        : null,
    };
  },
});
