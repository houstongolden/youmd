import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// ── Username validation ──────────────────────────────────────

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
const RESERVED_USERNAMES = [
  "admin", "api", "app", "auth", "blog", "cdn", "claim", "create",
  "ctx", "dashboard", "docs", "help", "initialize", "login", "logout",
  "me", "mcp", "privacy", "profile", "profiles", "register", "settings",
  "shell", "sign-in", "sign-up", "spec", "status", "support", "terms", "www",
];

function generateSessionToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// ── Queries ──────────────────────────────────────────────────

/** Get a public profile — checks profiles table first, falls back to users+bundles */
export const getPublicProfile = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const uname = args.username.toLowerCase();

    // Check profiles table first
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();

    // Try to find the user and their published bundle
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();

    let publishedBundle = null;
    if (user) {
      const bundles = await ctx.db
        .query("bundles")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      publishedBundle = bundles
        .filter((b) => b.isPublished)
        .sort((a, b) => b.version - a.version)[0] ?? null;
    }

    // Prefer profiles table youJson (always synced on save/publish),
    // fall back to published bundle's youJson for legacy users
    const youJson = profile?.youJson ?? publishedBundle?.youJson ?? null;
    const youMd = profile?.youMd ?? publishedBundle?.youMd ?? null;

    if (profile && youJson) {
      return {
        source: "profiles" as const,
        username: profile.username,
        displayName: profile.name,
        avatarUrl: profile.avatarUrl,
        asciiPortrait: profile.asciiPortrait ?? null,
        youJson,
        youMd,
        isClaimed: profile.isClaimed,
        profileId: profile._id,
        contentHash: publishedBundle?.contentHash ?? null,
        updatedAt: profile.updatedAt ?? profile.createdAt ?? null,
      };
    }

    if (!user) {
      // Profile exists but has no bundle yet
      if (profile) {
        return {
          source: "profiles" as const,
          username: profile.username,
          displayName: profile.name,
          avatarUrl: profile.avatarUrl,
          asciiPortrait: profile.asciiPortrait ?? null,
          youJson: null,
          youMd: null,
          isClaimed: profile.isClaimed,
          profileId: profile._id,
          updatedAt: profile.updatedAt ?? profile.createdAt ?? null,
        };
      }
      return null;
    }

    if (!publishedBundle) return null;

    return {
      source: "legacy" as const,
      username: user.username,
      displayName: user.displayName,
      asciiPortrait: profile?.asciiPortrait ?? null,
      youJson: publishedBundle.youJson,
      youMd: publishedBundle.youMd,
      isClaimed: true,
      profileId: profile?._id ?? null,
      contentHash: publishedBundle.contentHash ?? null,
      updatedAt: publishedBundle.createdAt ?? null,
    };
  },
});

/** Get profile by ownerId (for dashboard — look up the authenticated user's profile) */
export const getByOwnerId = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.ownerId))
      .first();
  },
});

/** Get profile by username (lightweight, for checking existence) */
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
  },
});

/** Get profile by session token (for pre-auth editing) */
export const getBySessionToken = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_sessionToken", (q) => q.eq("sessionToken", args.sessionToken))
      .first();
    if (!profile || profile.isClaimed) return null;
    return profile;
  },
});

/** List all profiles for directory */
export const listAll = query({
  handler: async (ctx) => {
    const profiles = await ctx.db
      .query("profiles")
      .order("desc")
      .take(100);
    return profiles;
  },
});

/** Check username availability across both tables (v2 — fresh deploy) */
export const checkUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const uname = args.username.toLowerCase();

    // Validate format
    if (!USERNAME_RE.test(uname)) {
      return { available: false, reason: "invalid format. lowercase letters, numbers, hyphens. 3-30 chars." };
    }
    if (RESERVED_USERNAMES.includes(uname)) {
      return { available: false, reason: "reserved username." };
    }

    // Check profiles table
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (existingProfile) {
      return { available: false, reason: "taken in profiles." };
    }

    // Check users table
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (existingUser) {
      return { available: false, reason: "already taken." };
    }

    return { available: true, reason: null };
  },
});

/** Get security logs for a profile */
export const getSecurityLogs = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("securityLogs")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(50);
  },
});

/** Get reports for a profile */
export const getReports = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("profileReports")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(20);
  },
});

// ── Mutations ────────────────────────────────────────────────

/** Create a profile (no auth required) */
export const createProfile = mutation({
  args: {
    username: v.string(),
    name: v.string(),
    tagline: v.optional(v.string()),
    links: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const uname = args.username.toLowerCase();

    // Validate
    if (!USERNAME_RE.test(uname)) {
      throw new Error("invalid username format: " + uname);
    }
    if (RESERVED_USERNAMES.includes(uname)) {
      throw new Error("reserved username: " + uname);
    }

    // Check availability — if profile already exists, return it (idempotent)
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (existingProfile) {
      return {
        profileId: existingProfile._id,
        sessionToken: existingProfile.sessionToken || generateSessionToken(),
        username: uname,
      };
    }

    // Check users table — if user exists with this username, create a profile for them
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (existingUser) {
      // Auto-create a profile linked to the existing user
      const sessionToken = generateSessionToken();
      const profileId = await ctx.db.insert("profiles", {
        username: uname,
        name: args.name || existingUser.displayName || uname,
        tagline: args.tagline,
        links: args.links,
        isClaimed: true,
        ownerId: existingUser._id,
        claimedAt: Date.now(),
        sessionToken,
        createdAt: Date.now(),
      });
      return { profileId, sessionToken, username: uname };
    }

    const sessionToken = generateSessionToken();

    const profileId = await ctx.db.insert("profiles", {
      username: uname,
      name: args.name,
      tagline: args.tagline,
      links: args.links,
      isClaimed: false,
      sessionToken,
      createdAt: Date.now(),
    });

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "profile_created",
      profileId,
      details: { username: uname },
      createdAt: Date.now(),
    });

    return { profileId, sessionToken, username: uname };
  },
});

/** Update a profile (session token or owner auth) */
export const updateProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    sessionToken: v.optional(v.string()),
    clerkId: v.optional(v.string()),
    name: v.optional(v.string()),
    tagline: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.object({
      short: v.optional(v.string()),
      medium: v.optional(v.string()),
      long: v.optional(v.string()),
    })),
    links: v.optional(v.any()),
    avatarUrl: v.optional(v.string()),
    now: v.optional(v.array(v.string())),
    projects: v.optional(v.array(v.any())),
    values: v.optional(v.array(v.string())),
    preferences: v.optional(v.any()),
    youJson: v.optional(v.any()),
    youMd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("profile not found");

    // Auth: session token for unclaimed, clerkId for claimed
    if (!profile.isClaimed) {
      if (args.sessionToken !== profile.sessionToken) {
        throw new Error("invalid session token");
      }
    } else {
      const clerkId = args.clerkId;
      if (!clerkId) throw new Error("authentication required");
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
        .first();
      if (!user || profile.ownerId !== user._id) {
        throw new Error("not the profile owner");
      }
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.tagline !== undefined) updates.tagline = args.tagline;
    if (args.location !== undefined) updates.location = args.location;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.links !== undefined) updates.links = args.links;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.now !== undefined) updates.now = args.now;
    if (args.projects !== undefined) updates.projects = args.projects;
    if (args.values !== undefined) updates.values = args.values;
    if (args.preferences !== undefined) updates.preferences = args.preferences;
    if (args.youJson !== undefined) updates.youJson = args.youJson;
    if (args.youMd !== undefined) updates.youMd = args.youMd;

    await ctx.db.patch(args.profileId, updates);

    return { success: true };
  },
});

/** Claim a profile (requires Clerk auth) */
export const claimProfile = mutation({
  args: {
    clerkId: v.string(),
    profileId: v.id("profiles"),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("profile not found");
    if (profile.isClaimed) throw new Error("profile already claimed");
    if (profile.sessionToken !== args.sessionToken) {
      throw new Error("invalid session token");
    }

    // Look up or verify the user
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("user not found — sign up first");

    // Claim
    await ctx.db.patch(args.profileId, {
      ownerId: user._id,
      isClaimed: true,
      claimedAt: Date.now(),
      sessionToken: undefined, // clear session token
      updatedAt: Date.now(),
    });

    // If profile has youJson, create a proper bundle entry
    if (profile.youJson) {
      await ctx.db.insert("bundles", {
        userId: user._id,
        profileId: args.profileId,
        version: 1,
        schemaVersion: "you-md/v1",
        manifest: {},
        youJson: profile.youJson,
        youMd: profile.youMd || "",
        isPublished: true,
        createdAt: Date.now(),
        publishedAt: Date.now(),
      });
    }

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "profile_claimed",
      profileId: args.profileId,
      userId: user._id,
      details: { username: profile.username },
      createdAt: Date.now(),
    });

    return { success: true, username: profile.username };
  },
});

/** Report a profile (no auth required) */
export const reportProfile = mutation({
  args: {
    profileId: v.id("profiles"),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profileReports", {
      profileId: args.profileId,
      reason: args.reason,
      details: args.details,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.insert("securityLogs", {
      eventType: "profile_reported",
      profileId: args.profileId,
      details: { reason: args.reason },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** Record a view (updated to support profileId) */
export const recordView = mutation({
  args: {
    username: v.string(),
    referrer: v.optional(v.string()),
    isAgentRead: v.boolean(),
    isContextLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();

    // Also check profiles table
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) =>
        q.eq("username", args.username.toLowerCase())
      )
      .first();

    if (!user && !profile) return;

    await ctx.db.insert("profileViews", {
      userId: user?._id,
      profileId: profile?._id,
      viewedAt: Date.now(),
      referrer: args.referrer,
      isAgentRead: args.isAgentRead,
      isContextLink: args.isContextLink,
    });
  },
});

/** Set profile images (multi-image storage + primary selection) */
export const setProfileImages = mutation({
  args: {
    profileId: v.id("profiles"),
    clerkId: v.string(),
    socialImages: v.object({
      x: v.optional(v.string()),
      github: v.optional(v.string()),
      linkedin: v.optional(v.string()),
      custom: v.optional(v.string()),
    }),
    primaryImage: v.string(), // "x" | "github" | "linkedin" | "custom"
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("profile not found");

    // Auth check
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user || profile.ownerId !== user._id) {
      throw new Error("not the profile owner");
    }

    // Compute avatarUrl from selected primary image
    const images = args.socialImages as Record<string, string | undefined>;
    const avatarUrl = images[args.primaryImage] || profile.avatarUrl;

    await ctx.db.patch(args.profileId, {
      socialImages: args.socialImages,
      primaryImage: args.primaryImage,
      avatarUrl,
      updatedAt: Date.now(),
    });

    return { success: true, avatarUrl };
  },
});

/** Update links (merge with existing, supports any custom label) */
export const updateLinks = mutation({
  args: {
    profileId: v.id("profiles"),
    clerkId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    links: v.any(), // Record<string, string>
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("profile not found");

    // Auth: session token for unclaimed, clerkId for claimed
    if (!profile.isClaimed) {
      if (args.sessionToken !== profile.sessionToken) {
        throw new Error("invalid session token");
      }
    } else {
      const clerkId = args.clerkId;
      if (!clerkId) throw new Error("authentication required");
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
        .first();
      if (!user || profile.ownerId !== user._id) {
        throw new Error("not the profile owner");
      }
    }

    // Merge with existing links (don't replace all)
    const existingLinks = (profile.links as Record<string, string>) || {};
    const newLinks = args.links as Record<string, string>;
    const mergedLinks = { ...existingLinks, ...newLinks };

    await ctx.db.patch(args.profileId, {
      links: mergedLinks,
      updatedAt: Date.now(),
    });

    return { success: true, links: mergedLinks };
  },
});

/** Save a pre-rendered ASCII portrait to a profile */
export const savePortrait = mutation({
  args: {
    profileId: v.id("profiles"),
    clerkId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    portrait: v.object({
      lines: v.array(v.string()),
      coloredLines: v.optional(v.any()),
      cols: v.number(),
      rows: v.number(),
      format: v.string(),
      sourceUrl: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile) throw new Error("profile not found");

    // Auth: session token for unclaimed, clerkId for claimed
    if (!profile.isClaimed) {
      if (args.sessionToken !== profile.sessionToken) {
        throw new Error("invalid session token");
      }
    } else {
      const clerkId = args.clerkId;
      if (!clerkId) throw new Error("authentication required");
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
        .first();
      if (!user || profile.ownerId !== user._id) {
        throw new Error("not the profile owner");
      }
    }

    await ctx.db.patch(args.profileId, {
      asciiPortrait: {
        lines: args.portrait.lines,
        coloredLines: args.portrait.coloredLines,
        cols: args.portrait.cols,
        rows: args.portrait.rows,
        format: args.portrait.format,
        sourceUrl: args.portrait.sourceUrl,
        generatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Verification Mutations ────────────────────────────────

/** Create a verification record for a profile */
export const createVerification = mutation({
  args: {
    clerkId: v.string(),
    method: v.string(), // "domain" | "social" | "email" | "manual"
    platform: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("user not found");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .first();
    if (!profile) throw new Error("profile not found");

    // Check for existing active verification of same method+platform
    const existing = await ctx.db
      .query("profileVerifications")
      .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
      .collect();
    const duplicate = existing.find(
      (v) => v.method === args.method && v.platform === args.platform && v.isActive
    );
    if (duplicate) {
      return { verificationId: duplicate._id, alreadyExists: true };
    }

    const verificationId = await ctx.db.insert("profileVerifications", {
      profileId: profile._id,
      method: args.method,
      platform: args.platform,
      verifiedAt: Date.now(),
      isActive: true,
      metadata: args.metadata,
    });

    await ctx.db.insert("securityLogs", {
      eventType: "verification_created",
      profileId: profile._id,
      userId: user._id,
      details: { method: args.method, platform: args.platform },
      createdAt: Date.now(),
    });

    return { verificationId, alreadyExists: false };
  },
});

/** List active verifications for a profile */
export const listVerifications = query({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("profileVerifications")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .collect();
    return all.filter((v) => v.isActive);
  },
});

/** Revoke (deactivate) a verification */
export const revokeVerification = mutation({
  args: {
    clerkId: v.string(),
    verificationId: v.id("profileVerifications"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("user not found");

    const verification = await ctx.db.get(args.verificationId);
    if (!verification) throw new Error("verification not found");

    const profile = await ctx.db.get(verification.profileId);
    if (!profile || profile.ownerId !== user._id) {
      throw new Error("not the profile owner");
    }

    await ctx.db.patch(args.verificationId, { isActive: false });

    await ctx.db.insert("securityLogs", {
      eventType: "verification_revoked",
      profileId: verification.profileId,
      userId: user._id,
      details: { method: verification.method, platform: verification.platform },
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

/** Admin: delete a profile by username (for cleanup) */
export const deleteByUsername = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
    if (profile) {
      await ctx.db.delete(profile._id);
      return { deleted: true, username: args.username };
    }
    return { deleted: false, username: args.username };
  },
});

/** Internal: create social verification after identity cross-reference */
export const createSocialVerification = internalMutation({
  args: {
    username: v.string(),
    platforms: v.array(v.string()),
    confidence: v.number(),
    signals: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_username", (q) => q.eq("username", args.username.toLowerCase()))
      .first();
    if (!profile) return;

    // Create a verification for each platform
    for (const platform of args.platforms) {
      const existing = await ctx.db
        .query("profileVerifications")
        .withIndex("by_profileId", (q) => q.eq("profileId", profile._id))
        .collect();
      const dup = existing.find(
        (v) => v.method === "social" && v.platform === platform && v.isActive
      );
      if (dup) continue;

      await ctx.db.insert("profileVerifications", {
        profileId: profile._id,
        method: "social",
        platform,
        verifiedAt: Date.now(),
        isActive: true,
        metadata: { confidence: args.confidence, signals: args.signals },
      });
    }
  },
});

/** Internal: log a security event */
export const logSecurityEvent = internalMutation({
  args: {
    eventType: v.string(),
    profileId: v.optional(v.id("profiles")),
    userId: v.optional(v.id("users")),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityLogs", {
      eventType: args.eventType,
      profileId: args.profileId,
      userId: args.userId,
      details: args.details,
      createdAt: Date.now(),
    });
  },
});
