import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireOwner } from "./lib/auth";

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
  // _internalAuthToken accepted but unused — createUser is the bootstrap path
  // (called from sign-up webhooks and the auth/register HTTP route) and is
  // intentionally callable without an existing Clerk session. The arg is here
  // so http.ts can pass it uniformly (cycle 43).
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
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

    // Check if clerkId already has an account — if so, return it (idempotent)
    const existingClerk = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (existingClerk) {
      return existingClerk._id;
    }

    // Check username uniqueness
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existing) {
      throw new Error("Username already taken.");
    }

    const userId = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      username,
      email: args.email,
      displayName: args.displayName,
      plan: "free",
      createdAt: Date.now(),
    });

    // Auto-create or claim a profile entry
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();

    if (existingProfile && !existingProfile.isClaimed) {
      // Claim the unclaimed profile
      await ctx.db.patch(existingProfile._id, {
        ownerId: userId,
        isClaimed: true,
        claimedAt: Date.now(),
        sessionToken: undefined,
        updatedAt: Date.now(),
      });
    } else if (!existingProfile) {
      // Create a new profile entry linked to this user
      const newProfileId = await ctx.db.insert("profiles", {
        username,
        name: args.displayName || username,
        isClaimed: true,
        ownerId: userId,
        claimedAt: Date.now(),
        createdAt: Date.now(),
      });

      // Auto-create email verification (Clerk verifies email at sign-up)
      await ctx.db.insert("profileVerifications", {
        profileId: newProfileId,
        method: "email",
        verifiedAt: Date.now(),
        isActive: true,
        metadata: { email: args.email, source: "clerk_signup" },
      });
    }

    // If claiming an existing profile, also create email verification
    if (existingProfile && !existingProfile.isClaimed) {
      await ctx.db.insert("profileVerifications", {
        profileId: existingProfile._id,
        method: "email",
        verifiedAt: Date.now(),
        isActive: true,
        metadata: { email: args.email, source: "clerk_signup" },
      });
    }

    return userId;
  },
});

/**
 * Admin: set a user's plan (for testing pro features without billing).
 * Cycle 45: was previously `mutation` — anonymous P0 financial bypass. Anyone
 * could `curl /api/mutation` to upgrade themselves (or anyone) to "pro" plan
 * without paying. Now `internalMutation` — admin-only.
 */
export const setUserPlan = internalMutation({
  args: {
    username: v.string(),
    plan: v.union(v.literal("free"), v.literal("pro")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
    if (!user) throw new Error("user not found");
    await ctx.db.patch(user._id, { plan: args.plan });
    return { username: user.username, plan: args.plan };
  },
});

/**
 * Get a user record by clerkId.
 * Cycle 45: now self-only auth. Previously this was a public lookup that
 * returned a full user record (including the Convex `_id` and email) for any
 * clerkId. That made it the **enumeration vector** that chained the
 * userId-arg attacks together (closed in cycle 44): an attacker could resolve
 * a target's clerkId → user._id, then attack any function trusting userId.
 *
 * Now requires the caller to be authenticated as the same clerkId (or to pass
 * the trusted internal token, for httpAction callers). All web clients pass
 * `useUser().id` which always matches the Clerk JWT subject — no breakage.
 */
export const getByClerkId = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

/**
 * Get a user record by username.
 * Cycle 45: was previously `query` (public). Anyone could call it with a
 * known username (which is public) and get back the user's clerkId + email.
 * Now `internalQuery` — only callable from other Convex functions.
 *
 * Sole external caller: `convex/http.ts:124` (public profile read flow,
 * looks up the owning user to log activity). Updated to call via
 * `internal.users.getByUsername`.
 */
export const getByUsername = internalQuery({
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
