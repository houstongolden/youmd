import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Context links — shareable URLs that return identity context.
 * GET /ctx/:username/:token returns public or full bundle depending on scope.
 */

// Generate a URL-safe random token
function generateToken(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const createLink = mutation({
  args: {
    clerkId: v.string(),
    scope: v.union(v.literal("public"), v.literal("full")),
    ttl: v.optional(v.string()), // "1h", "24h", "7d", "30d", "90d", "never"
    maxUses: v.optional(v.number()),
    profileId: v.optional(v.id("profiles")),
    name: v.optional(v.string()), // optional memorable name for the link
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Full scope requires Pro plan
    if (args.scope === "full" && user.plan !== "pro") {
      throw new Error(
        "Full-scope context links require a Pro plan. Private vault content is a Pro feature."
      );
    }

    // Calculate expiry
    let expiresAt: number | undefined;
    if (args.ttl && args.ttl !== "never") {
      const ttlMs: Record<string, number> = {
        "1h": 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000,
        "90d": 90 * 24 * 60 * 60 * 1000,
      };
      const ms = ttlMs[args.ttl];
      if (!ms) throw new Error(`Invalid TTL: ${args.ttl}`);
      expiresAt = Date.now() + ms;
    }

    const token = generateToken();

    // Look up the user's profile if profileId wasn't provided
    let profileId = args.profileId;
    if (!profileId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .first();
      if (profile) {
        profileId = profile._id;
      }
    }

    const linkId = await ctx.db.insert("contextLinks", {
      userId: user._id,
      profileId,
      name: args.name,
      token,
      scope: args.scope,
      expiresAt,
      maxUses: args.maxUses,
      useCount: 0,
      createdAt: Date.now(),
    });

    return {
      id: linkId,
      token,
      name: args.name,
      url: `https://you.md/ctx/${user.username}/${token}`,
      scope: args.scope,
      expiresAt: expiresAt
        ? new Date(expiresAt).toISOString()
        : "never",
    };
  },
});

export const listLinks = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const links = await ctx.db
      .query("contextLinks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Filter out revoked links
    return links
      .filter((link) => !link.revokedAt)
      .map((link) => ({
        id: link._id,
        name: link.name ?? null,
        token: link.token,
        url: `https://you.md/ctx/${user.username}/${link.token}`,
        scope: link.scope,
        expiresAt: link.expiresAt
          ? new Date(link.expiresAt).toISOString()
          : "never",
        maxUses: link.maxUses ?? "unlimited",
        useCount: link.useCount,
        lastUsedAt: link.lastUsedAt
          ? new Date(link.lastUsedAt).toISOString()
          : null,
        createdAt: new Date(link.createdAt).toISOString(),
        isExpired: link.expiresAt ? link.expiresAt < Date.now() : false,
      }));
  },
});

export const revokeLink = mutation({
  args: {
    clerkId: v.string(),
    linkId: v.id("contextLinks"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const link = await ctx.db.get(args.linkId);
    if (!link || link.userId !== user._id) {
      throw new Error("Link not found");
    }

    await ctx.db.patch(args.linkId, { revokedAt: Date.now() });
  },
});

export const revokeAllLinks = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const links = await ctx.db
      .query("contextLinks")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    for (const link of links) {
      if (!link.revokedAt) {
        await ctx.db.patch(link._id, { revokedAt: Date.now() });
      }
    }
  },
});

// Resolve a context link — used by the HTTP endpoint
export const resolveLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("contextLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!link) return { error: "Link not found", status: 404 };
    if (link.revokedAt) return { error: "Link has been revoked", status: 401 };
    if (link.expiresAt && link.expiresAt < Date.now()) {
      return { error: "Link has expired", status: 410 };
    }
    if (link.maxUses && link.useCount >= link.maxUses) {
      return { error: "Link has reached maximum uses", status: 410 };
    }

    // Get the user
    const user = await ctx.db.get(link.userId);
    if (!user) return { error: "User not found", status: 404 };

    // Check profiles table first if we have a profileId
    if (link.profileId) {
      const profile = await ctx.db.get(link.profileId);
      if (profile?.youJson) {
        const result: Record<string, unknown> = {
          bundle: {
            ...(profile.youJson as Record<string, unknown>),
            _scope: link.scope,
          },
          markdown: profile.youMd || "",
          username: profile.username,
          scope: link.scope,
        };

        // Include private context for full-scope links
        if (link.scope === "full") {
          const privateCtx = await ctx.db
            .query("privateContext")
            .withIndex("by_profileId", (q) => q.eq("profileId", link.profileId!))
            .first();
          if (privateCtx) {
            result.privateContext = {
              privateNotes: privateCtx.privateNotes,
              privateProjects: privateCtx.privateProjects,
              internalLinks: privateCtx.internalLinks,
              calendarContext: privateCtx.calendarContext,
              communicationPrefs: privateCtx.communicationPrefs,
              customData: privateCtx.customData,
            };
          }
        }

        return result;
      }
    }

    // Fallback: get the published bundle from bundles table
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    if (!published) return { error: "No published bundle", status: 404 };

    const fallbackResult: Record<string, unknown> = {
      bundle: {
        ...published.youJson,
        _scope: link.scope,
      },
      markdown: published.youMd,
      username: user.username,
      scope: link.scope,
    };

    // Include private context for full-scope links (look up by user's profile)
    if (link.scope === "full") {
      const userProfile = await ctx.db
        .query("profiles")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .first();
      if (userProfile) {
        const privateCtx = await ctx.db
          .query("privateContext")
          .withIndex("by_profileId", (q) => q.eq("profileId", userProfile._id))
          .first();
        if (privateCtx) {
          fallbackResult.privateContext = {
            privateNotes: privateCtx.privateNotes,
            privateProjects: privateCtx.privateProjects,
            internalLinks: privateCtx.internalLinks,
            calendarContext: privateCtx.calendarContext,
            communicationPrefs: privateCtx.communicationPrefs,
            customData: privateCtx.customData,
          };
        }
      }
    }

    return fallbackResult;
  },
});

export const incrementUseCount = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("contextLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (link) {
      await ctx.db.patch(link._id, {
        useCount: link.useCount + 1,
        lastUsedAt: Date.now(),
      });
    }
  },
});

/**
 * Lightweight lookup — returns only the link's ids/scope metadata for the
 * cross-agent activity logger. Does NOT return bundle content (use
 * `resolveLink` for that).
 */
export const getLinkMeta = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("contextLinks")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!link) return null;
    return {
      _id: link._id,
      userId: link.userId,
      profileId: link.profileId,
      scope: link.scope,
      name: link.name,
    };
  },
});
