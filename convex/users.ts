import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";

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

export async function createUserAndProfile(
  ctx: MutationCtx,
  args: {
    clerkId: string;
    username: string;
    email: string;
    displayName?: string;
    verificationSource?: string;
  }
) {
  const username = args.username.toLowerCase();

  if (!USERNAME_REGEX.test(username)) {
    throw new Error("Invalid username format.");
  }

  if (RESERVED_USERNAMES.has(username)) {
    throw new Error("This username is reserved.");
  }

  const existingClerk = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
    .first();

  if (existingClerk) {
    return existingClerk._id;
  }

  const existingUsername = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();

  if (existingUsername) {
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

  const existingProfile = await ctx.db
    .query("profiles")
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();

  if (existingProfile && !existingProfile.isClaimed) {
    await ctx.db.patch(existingProfile._id, {
      ownerId: userId,
      isClaimed: true,
      claimedAt: Date.now(),
      sessionToken: undefined,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("profileVerifications", {
      profileId: existingProfile._id,
      method: "email",
      verifiedAt: Date.now(),
      isActive: true,
      metadata: {
        email: args.email,
        source: args.verificationSource || "email_code",
      },
    });

    return userId;
  }

  if (!existingProfile) {
    const newProfileId = await ctx.db.insert("profiles", {
      username,
      name: args.displayName || username,
      isClaimed: true,
      ownerId: userId,
      claimedAt: Date.now(),
      createdAt: Date.now(),
    });

    await ctx.db.insert("profileVerifications", {
      profileId: newProfileId,
      method: "email",
      verifiedAt: Date.now(),
      isActive: true,
      metadata: {
        email: args.email,
        source: args.verificationSource || "email_code",
      },
    });
  }

  return userId;
}

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

/**
 * Create a Convex user record. This is the bootstrap path that mirrors a
 * Clerk user into our database the first time we see them.
 *
 * Cycle 47: was previously unauth'd (the cycle 43 comment said "intentionally
 * callable without an existing Clerk session"). Audit revealed this was
 * exploitable: anonymous attacker could reserve any unclaimed username, insert
 * orphaned junk users with fake clerkIds, and create fake `profileVerifications`
 * rows with `source: "clerk_signup"` polluting the verification trust chain.
 *
 * Worst attack: namespace squatting on desirable usernames (`openai`,
 * `anthropic`, `jane`, etc.) preventing real users from claiming them.
 *
 * Now requires `requireOwner`. The 4 legitimate callers all qualify:
 *   1. Web init flow: user just completed Clerk sign-up, has a fresh JWT.
 *      Convex client auto-attaches the JWT. requireOwner sees JWT.sub == clerkId.
 *   2. Web dashboard flow: same.
 *   3. http.ts /api/v1/auth/register: calls Clerk Backend API first to create
 *      the Clerk user, then mirrors into Convex via the trusted bypass token.
 *   4. http.ts /api/v1/auth/login: verifies password via Clerk first, then
 *      mirrors via the trusted bypass token.
 */
export const createUser = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    username: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    return await createUserAndProfile(ctx, {
      clerkId: args.clerkId,
      username: args.username,
      email: args.email,
      displayName: args.displayName,
      verificationSource: "clerk_signup",
    });
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

/**
 * Internal: cascade-delete a user and ALL their data, by clerkId.
 *
 * Cycle 52: called from the Clerk webhook handler when Clerk fires a
 * `user.deleted` event. Removes the user record + every row in every table
 * tied to that user._id. This is the GDPR-compliant deletion path.
 *
 * Tables touched:
 *   - users (the user row itself)
 *   - profiles (by ownerId — the public profile page)
 *   - accessTokens (by profileId, looked up from profiles)
 *   - apiKeys (by_userId)
 *   - bundles (by_userId)
 *   - sources (by_userId)
 *   - analysisArtifacts (by_userId)
 *   - privateVault (by_userId)
 *   - pipelineJobs (by_userId)
 *   - contextLinks (by_userId)
 *   - memories (by_userId)
 *   - chatSessions (by_userId)
 *   - chatMessages (by_userId)
 *   - skillInstalls (by_userId)
 *   - agentActivity (by_userId)
 *
 * Tables NOT touched (audit / historical / public references):
 *   - securityLogs (audit trail — we ADD a deletion event)
 *   - profileVerifications (linked by profileId; stale rows can be cleaned later)
 *   - profileReports (audit; reporter may have been deleted)
 *   - profileViews (analytics; userId is optional, profile is gone anyway)
 *   - rateLimits, chatSpendLog (per-IP/per-day, not per-user)
 *
 * Returns counts so the webhook can log them.
 */
export const _internalDeleteByClerkId = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      return { deleted: false, reason: "user not found in Convex" };
    }
    const userId = user._id;

    const counts: Record<string, number> = {};

    // Profiles (public-facing — delete first so the profile page disappears immediately)
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .collect();
    for (const p of profiles) {
      // Delete accessTokens linked to this profile
      const tokens = await ctx.db
        .query("accessTokens")
        .withIndex("by_profileId", (q) => q.eq("profileId", p._id))
        .collect();
      for (const t of tokens) await ctx.db.delete(t._id);
      counts.accessTokens = (counts.accessTokens || 0) + tokens.length;

      await ctx.db.delete(p._id);
    }
    counts.profiles = profiles.length;

    // apiKeys
    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const k of apiKeys) await ctx.db.delete(k._id);
    counts.apiKeys = apiKeys.length;

    // bundles
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const b of bundles) await ctx.db.delete(b._id);
    counts.bundles = bundles.length;

    // sources
    const sources = await ctx.db
      .query("sources")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sources) await ctx.db.delete(s._id);
    counts.sources = sources.length;

    // analysisArtifacts
    const artifacts = await ctx.db
      .query("analysisArtifacts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const a of artifacts) await ctx.db.delete(a._id);
    counts.analysisArtifacts = artifacts.length;

    // privateVault
    const vault = await ctx.db
      .query("privateVault")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (vault) {
      await ctx.db.delete(vault._id);
      counts.privateVault = 1;
    }

    // pipelineJobs
    const jobs = await ctx.db
      .query("pipelineJobs")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const j of jobs) await ctx.db.delete(j._id);
    counts.pipelineJobs = jobs.length;

    // contextLinks
    const links = await ctx.db
      .query("contextLinks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const l of links) await ctx.db.delete(l._id);
    counts.contextLinks = links.length;

    // memories
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const m of memories) await ctx.db.delete(m._id);
    counts.memories = memories.length;

    // chatSessions
    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    counts.chatSessions = sessions.length;

    // chatMessages
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const m of messages) await ctx.db.delete(m._id);
    counts.chatMessages = messages.length;

    // skillInstalls
    const installs = await ctx.db
      .query("skillInstalls")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const i of installs) await ctx.db.delete(i._id);
    counts.skillInstalls = installs.length;

    // agentActivity
    const activity = await ctx.db
      .query("agentActivity")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const a of activity) await ctx.db.delete(a._id);
    counts.agentActivity = activity.length;

    // The user row itself (last)
    await ctx.db.delete(userId);
    counts.users = 1;

    // Audit log
    await ctx.db.insert("securityLogs", {
      eventType: "user_deleted_by_clerk_webhook",
      userId: undefined,
      details: { clerkId: args.clerkId, username: user.username, counts },
      createdAt: Date.now(),
    });

    return { deleted: true, clerkId: args.clerkId, username: user.username, counts };
  },
});

/**
 * Internal: patch a user record's email/username/displayName, by clerkId.
 *
 * Cycle 52: called from the Clerk webhook handler when Clerk fires a
 * `user.updated` event. Keeps the Convex user mirror in sync with Clerk's
 * source-of-truth fields.
 *
 * If the username changes, the linked profile's username is also patched
 * to keep them in sync.
 */
export const _internalUpdateByClerkId = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) {
      return { updated: false, reason: "user not found in Convex" };
    }

    const updates: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (args.email !== undefined && args.email !== user.email) {
      updates.email = args.email;
      changedFields.push("email");
    }
    if (
      args.username !== undefined &&
      args.username.length > 0 &&
      args.username !== user.username
    ) {
      updates.username = args.username;
      changedFields.push("username");
    }
    if (
      args.displayName !== undefined &&
      args.displayName !== user.displayName
    ) {
      updates.displayName = args.displayName;
      changedFields.push("displayName");
    }

    if (Object.keys(updates).length === 0) {
      return { updated: false, reason: "no fields changed" };
    }

    await ctx.db.patch(user._id, updates);

    // If username changed, sync it to the linked profile
    if ("username" in updates) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .first();
      if (profile) {
        await ctx.db.patch(profile._id, { username: updates.username as string });
      }
    }

    // Audit log
    await ctx.db.insert("securityLogs", {
      eventType: "user_updated_by_clerk_webhook",
      userId: user._id,
      details: { clerkId: args.clerkId, changedFields },
      createdAt: Date.now(),
    });

    return { updated: true, clerkId: args.clerkId, changedFields };
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
