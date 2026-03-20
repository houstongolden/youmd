import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Reserved usernames that cannot be claimed
const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "cdn",
  "ctx",
  "dashboard",
  "docs",
  "help",
  "login",
  "logout",
  "me",
  "mcp",
  "privacy",
  "profile",
  "register",
  "settings",
  "spec",
  "status",
  "support",
  "terms",
  "www",
]);

// Username validation: 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const username = args.username.toLowerCase();

    if (!USERNAME_REGEX.test(username)) {
      return {
        available: false,
        reason:
          "Username must be 3-30 characters, lowercase alphanumeric and hyphens only, cannot start or end with a hyphen.",
      };
    }

    if (RESERVED_USERNAMES.has(username)) {
      return { available: false, reason: "This username is reserved." };
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existing) {
      return { available: false, reason: "This username is already taken." };
    }

    // Also check profiles table
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existingProfile) {
      return { available: false, reason: "This username is already taken." };
    }

    return { available: true, reason: null };
  },
});

export const createUser = mutation({
  args: {
    clerkId: v.string(),
    username: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const username = args.username.toLowerCase();

    // Validate username
    if (!USERNAME_REGEX.test(username)) {
      throw new Error("Invalid username format.");
    }

    if (RESERVED_USERNAMES.has(username)) {
      throw new Error("This username is reserved.");
    }

    // Check uniqueness
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existing) {
      throw new Error("Username already taken.");
    }

    // Check if clerkId already has an account
    const existingClerk = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingClerk) {
      throw new Error("Account already exists for this user.");
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      username,
      email: args.email,
      displayName: args.displayName,
      plan: "free",
      createdAt: Date.now(),
    });

    return userId;
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();
  },
});

/** List all legacy users that have published bundles (for directory) */
export const listAllLegacy = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").order("desc").take(100);

    // For each user, check if they have a published bundle
    const results = [];
    for (const user of users) {
      // Skip sample/test users
      if (user.isSample) continue;

      // Check if this user already exists in profiles table (avoid duplicates)
      const existingProfile = await ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", user.username))
        .first();
      if (existingProfile) continue;

      // Check for a published bundle
      const bundle = await ctx.db
        .query("bundles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .first();

      const hasBundle = bundle?.isPublished ?? false;

      results.push({
        username: user.username,
        displayName: user.displayName ?? null,
        hasBundle,
        createdAt: user.createdAt,
      });
    }

    return results;
  },
});
