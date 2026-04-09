import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOwner } from "./lib/auth";

// ── Queries ──────────────────────────────────────────────────

/**
 * Browse published skills in the registry.
 */
export const listPublished = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_isPublished", (q) => q.eq("isPublished", true))
      .collect();

    return skills
      .sort((a, b) => b.downloads - a.downloads)
      .slice(0, args.limit ?? 50)
      .map((s) => ({
        _id: s._id,
        name: s.name,
        description: s.description,
        version: s.version,
        scope: s.scope,
        identityFields: s.identityFields,
        downloads: s.downloads,
        authorId: s.authorId,
        createdAt: s.createdAt,
      }));
  },
});

/**
 * Get skills published by a specific user.
 */
export const listByAuthor = query({
  args: {
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_authorId", (q) => q.eq("authorId", args.authorId))
      .collect();

    return skills.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get a single skill by name.
 */
export const getByName = query({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
  },
});

/**
 * Get user's installed skills.
 */
export const listInstalls = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const installs = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return installs.sort((a, b) => b.installedAt - a.installedAt);
  },
});

// ── Mutations ────────────────────────────────────────────────

/**
 * Publish a skill to the registry.
 */
export const publish = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    description: v.string(),
    version: v.string(),
    scope: v.union(v.literal("shared"), v.literal("project"), v.literal("private")),
    identityFields: v.array(v.string()),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if skill name already exists
    const existing = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      // Only the author can update
      if (existing.authorId !== user._id) {
        throw new Error("Skill name already taken by another author");
      }
      // Update existing
      await ctx.db.patch(existing._id, {
        description: args.description,
        version: args.version,
        scope: args.scope,
        identityFields: args.identityFields,
        content: args.content,
        updatedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    // Create new
    const skillId = await ctx.db.insert("skills", {
      authorId: user._id,
      name: args.name,
      description: args.description,
      version: args.version,
      scope: args.scope,
      identityFields: args.identityFields,
      content: args.content,
      isPublished: true,
      downloads: 0,
      createdAt: Date.now(),
    });

    return { id: skillId, updated: false };
  },
});

/**
 * Record a skill installation for a user.
 */
export const recordInstall = mutation({
  args: {
    clerkId: v.string(),
    skillName: v.string(),
    source: v.string(),
    scope: v.string(),
    identityFields: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    // Check if already installed
    const existing = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (existing) {
      // Update existing install
      await ctx.db.patch(existing._id, {
        source: args.source,
        scope: args.scope,
        identityFields: args.identityFields,
        installedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    const installId = await ctx.db.insert("skillInstalls", {
      userId: user._id,
      skillName: args.skillName,
      source: args.source,
      scope: args.scope,
      identityFields: args.identityFields,
      installedAt: Date.now(),
      lastUsedAt: 0,
      useCount: 0,
    });

    // Increment download count on the registry skill if it exists
    const registrySkill = await ctx.db
      .query("skills")
      .withIndex("by_name", (q) => q.eq("name", args.skillName))
      .first();
    if (registrySkill) {
      await ctx.db.patch(registrySkill._id, {
        downloads: registrySkill.downloads + 1,
      });
    }

    return { id: installId, updated: false };
  },
});

/**
 * Track a skill usage event.
 */
export const trackUsage = mutation({
  args: {
    clerkId: v.string(),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.patch(install._id, {
        useCount: install.useCount + 1,
        lastUsedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Remove a skill installation.
 */
export const removeInstall = mutation({
  args: {
    clerkId: v.string(),
    skillName: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const install = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId_skillName", (q) =>
        q.eq("userId", user._id).eq("skillName", args.skillName)
      )
      .first();

    if (install) {
      await ctx.db.delete(install._id);
    }

    return { success: true };
  },
});
