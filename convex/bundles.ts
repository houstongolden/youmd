import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";

export const getPublishedBundle = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();

    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    // Find the latest published bundle
    const published = bundles
      .filter((b) => b.isPublished)
      .sort((a, b) => b.version - a.version)[0];

    return published ?? null;
  },
});

export const getLatestBundle = query({
  // Cycle 44: added auth. Previously this took only userId and returned the
  // full latest bundle (youJson + youMd) for ANYONE — anonymous P0 read leak.
  // Now requires the caller to authenticate as the owning user.
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

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles.sort((a, b) => b.version - a.version)[0] ?? null;
  },
});

/**
 * Get a specific bundle by version number for the authenticated user.
 * Returns the full bundle (manifest, youJson, youMd) so callers can diff
 * two arbitrary versions.
 */
export const getBundleByVersion = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()), version: v.number() },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const target = bundles.find((b) => b.version === args.version);
    if (!target) return null;

    return {
      version: target.version,
      isPublished: target.isPublished,
      createdAt: target.createdAt,
      publishedAt: target.publishedAt,
      contentHash: target.contentHash,
      manifest: target.manifest,
      youJson: target.youJson,
      youMd: target.youMd,
    };
  },
});

// Cycle 44: DELETED `saveBundle` (mutation, unauth'd, ZERO callers in src/cli/convex).
// It was anonymous-write dead code that let any anonymous caller insert a new
// bundle for any userId with arbitrary contents. The CLI's saveBundle function
// goes through /api/v1/me/bundle → me.saveBundleFromForm (which has auth).

export const listRecentBundles = query({
  // Cycle 44: added auth. Previously took only userId — leaked bundle metadata.
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

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles
      .sort((a, b) => b.version - a.version)
      .slice(0, args.limit ?? 10)
      .map((b) => ({
        _id: b._id,
        version: b.version,
        isPublished: b.isPublished,
        createdAt: b.createdAt,
        publishedAt: b.publishedAt,
      }));
  },
});

export const publishBundle = mutation({
  // Cycle 44: added auth. Previously took only bundleId — combined with the
  // (now deleted) saveBundle, this allowed ANONYMOUS PUBLIC PROFILE DEFACEMENT:
  // attacker could insert a malicious bundle and publish it as the live profile.
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    bundleId: v.id("bundles"),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const bundle = await ctx.db.get(args.bundleId);
    if (!bundle) throw new Error("Bundle not found.");

    const owner = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!owner || bundle.userId !== owner._id) {
      throw new Error("not authorized: bundle is not owned by authenticated user");
    }

    // Unpublish all previous bundles for this user
    const userBundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", bundle.userId))
      .collect();

    for (const b of userBundles) {
      if (b.isPublished) {
        await ctx.db.patch(b._id, { isPublished: false });
      }
    }

    // Publish the target bundle
    await ctx.db.patch(args.bundleId, {
      isPublished: true,
      publishedAt: Date.now(),
    });
  },
});

/**
 * Get full version history for a user's bundles.
 * Returns version, timestamp, hash, source, changed sections, publish status.
 */
export const getHistory = query({
  // Cycle 44: added auth. Previously took only userId — leaked bundle history.
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

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return bundles
      .sort((a, b) => b.version - a.version)
      .slice(0, 50)
      .map((b) => ({
        _id: b._id,
        version: b.version,
        isPublished: b.isPublished,
        createdAt: b.createdAt,
        publishedAt: b.publishedAt,
        contentHash: b.contentHash?.slice(0, 12),
        parentHash: b.parentHash?.slice(0, 12),
        source: (b as any).source || "unknown",
        changeNote: (b as any).changeNote || null,
        changedSections: (b as any).changedSections || null,
      }));
  },
});

/**
 * Rollback to a specific version — creates a new version from an old one.
 */
export const rollbackToVersion = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    targetVersion: v.number(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const target = bundles.find((b) => b.version === args.targetVersion);
    if (!target) throw new Error(`Version ${args.targetVersion} not found`);

    const maxVersion = bundles.reduce((max, b) => Math.max(max, b.version), 0);

    // Create a new version with the old content
    const bundleId = await ctx.db.insert("bundles", {
      userId: user._id,
      version: maxVersion + 1,
      schemaVersion: target.schemaVersion,
      manifest: target.manifest,
      youJson: target.youJson,
      youMd: target.youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash: target.contentHash,
      parentHash: target.contentHash,
      source: "rollback",
      changeNote: `rolled back to v${args.targetVersion}`,
    });

    return { bundleId, version: maxVersion + 1 };
  },
});

// Cycle 44: DELETED `trackAgentInteraction` (mutation, unauth'd, ZERO callers).
// It allowed anonymous writes to the agentInteractions table for any user.
// The active interaction tracking lives in convex/private.ts:validateToken,
// which writes only after API token validation.

// Cycle 44: DELETED `getAgentStats` (query, unauth'd, ZERO callers).
// Replaced by convex/private.ts:getAgentStats which has proper auth.
