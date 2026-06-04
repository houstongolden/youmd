import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { computeContentHash } from "./lib/hash";
import { createUserAndProfile } from "./users";
import { requireOwner } from "./lib/auth";
import { encryptSecret } from "./lib/secretCrypto";

/**
 * GitHub OAuth + repo connection backend.
 *
 * This powers free GitHub sign-up and the "host your You.md in your own GitHub
 * repo" story. The web OAuth callback validates the GitHub handshake, then
 * calls `findOrCreateGithubUser` (gated by the trusted-internal token, since
 * there is no per-request challenge like the email-code flow has) to resolve
 * or create the You.md account and store the encrypted access token.
 */

// 3-30 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen.
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function randomHex(bytes = 12): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateAuthSubject(): string {
  return `ym_gh_${randomHex(12)}`;
}

/**
 * The github bootstrap mutation has no per-request challenge, so we gate it on
 * the server-side-only trusted internal token (256-bit secret). Public callers
 * to /api/mutation cannot guess it, which prevents identity forgery / username
 * squatting via a crafted githubUserId.
 */
function assertTrustedInternal(token: string | undefined) {
  const trusted = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;
  if (!token || !trusted || token.length < 32 || token !== trusted) {
    throw new Error(
      "unauthorized: github bootstrap requires the trusted internal token"
    );
  }
}

async function isUsernameAvailable(
  ctx: MutationCtx,
  username: string
): Promise<boolean> {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();
  if (existingUser) return false;
  const existingProfile = await ctx.db
    .query("profiles")
    .withIndex("by_username", (q) => q.eq("username", username))
    .first();
  if (existingProfile && existingProfile.isClaimed) return false;
  return true;
}

/**
 * Derive a valid, available You.md username from a GitHub login. Falls back to
 * numeric suffixes (and finally a random suffix) on collision so signup never
 * hard-fails just because the obvious handle is taken.
 */
async function deriveUsername(
  ctx: MutationCtx,
  githubLogin: string
): Promise<string> {
  let base = githubLogin
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length < 3) base = `${base}-you`.replace(/^-+/, "");
  base = base.slice(0, 30).replace(/-+$/g, "");
  if (base.length < 3) base = `you-${randomHex(3)}`;

  const candidates = [base];
  for (let i = 2; i <= 9; i += 1) {
    candidates.push(`${base.slice(0, 28)}-${i}`.replace(/-+/g, "-"));
  }
  candidates.push(`${base.slice(0, 21)}-${randomHex(3)}`);

  for (const candidate of candidates) {
    if (!USERNAME_REGEX.test(candidate)) continue;
    if (await isUsernameAvailable(ctx, candidate)) return candidate;
  }
  // Last resort: guaranteed-unique random handle.
  return `you-${randomHex(4)}`;
}

/**
 * Resolve-or-create a You.md account from a verified GitHub identity, and store
 * the encrypted OAuth token + scopes. Returns the same shape the email-auth
 * finalize path returns so the web route can mint a session the same way.
 */
export const findOrCreateGithubUser = mutation({
  args: {
    _internalAuthToken: v.optional(v.string()),
    githubUserId: v.number(),
    githubLogin: v.string(),
    githubName: v.optional(v.string()),
    githubEmail: v.optional(v.string()),
    githubAvatarUrl: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    scopes: v.array(v.string()),
    tokenType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertTrustedInternal(args._internalAuthToken);

    const now = Date.now();
    const email = args.githubEmail?.trim().toLowerCase() || undefined;

    let encrypted: { ciphertext: string; iv: string } | null = null;
    if (args.accessToken) {
      encrypted = await encryptSecret(args.accessToken);
    }

    const tokenPatch = encrypted
      ? {
          accessTokenEncrypted: encrypted.ciphertext,
          accessTokenIv: encrypted.iv,
        }
      : {};

    // 1) Existing GitHub connection → log that user back in.
    const existingConnection = await ctx.db
      .query("githubConnections")
      .withIndex("by_githubUserId", (q) =>
        q.eq("githubUserId", args.githubUserId)
      )
      .first();

    if (existingConnection) {
      const user = await ctx.db.get(existingConnection.userId);
      if (user) {
        await ctx.db.patch(existingConnection._id, {
          githubLogin: args.githubLogin,
          githubName: args.githubName,
          githubEmail: email,
          githubAvatarUrl: args.githubAvatarUrl,
          scopes: args.scopes,
          tokenType: args.tokenType,
          updatedAt: now,
          ...tokenPatch,
        });
        return {
          ok: true,
          userId: user._id,
          clerkId: user.clerkId,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          plan: user.plan,
          isNewUser: false,
        };
      }
      // Orphaned connection (user deleted) — drop it and fall through.
      await ctx.db.delete(existingConnection._id);
    }

    // 2) No connection yet, but a verified GitHub email matches an existing
    //    account → link GitHub to it instead of creating a duplicate.
    let user: Doc<"users"> | null = null;
    if (email) {
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
    }

    let isNewUser = false;
    if (!user) {
      // 3) Brand-new account.
      const username = await deriveUsername(ctx, args.githubLogin);
      const userId = await createUserAndProfile(ctx, {
        clerkId: generateAuthSubject(),
        username,
        email: email || `${username}@users.noreply.github.com`,
        displayName: args.githubName || args.githubLogin,
        verificationSource: "github_oauth",
      });
      user = await ctx.db.get(userId);
      isNewUser = true;
    }

    if (!user) throw new Error("Failed to resolve GitHub account.");

    await ctx.db.insert("githubConnections", {
      userId: user._id,
      githubUserId: args.githubUserId,
      githubLogin: args.githubLogin,
      githubName: args.githubName,
      githubEmail: email,
      githubAvatarUrl: args.githubAvatarUrl,
      scopes: args.scopes,
      tokenType: args.tokenType,
      connectedAt: now,
      updatedAt: now,
      ...tokenPatch,
    });

    await ctx.db.insert("securityLogs", {
      eventType: isNewUser ? "profile_created" : "github_linked",
      userId: user._id,
      details: {
        provider: "github",
        githubLogin: args.githubLogin,
        githubUserId: args.githubUserId,
        linkedToExisting: !isNewUser,
      },
      createdAt: now,
    });

    return {
      ok: true,
      userId: user._id,
      clerkId: user.clerkId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      isNewUser,
    };
  },
});

/** Owner-only: read the GitHub connection state (no token plaintext). */
export const getConnection = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const connection = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!connection) return null;

    return {
      githubLogin: connection.githubLogin,
      githubName: connection.githubName ?? null,
      githubAvatarUrl: connection.githubAvatarUrl ?? null,
      scopes: connection.scopes,
      hasToken: !!connection.accessTokenEncrypted,
      repoFullName: connection.repoFullName ?? null,
      repoVisibility: connection.repoVisibility ?? null,
      repoDefaultBranch: connection.repoDefaultBranch ?? null,
      repoConnectedAt: connection.repoConnectedAt ?? null,
      lastSyncedSha: connection.lastSyncedSha ?? null,
      lastSyncedAt: connection.lastSyncedAt ?? null,
      connectedAt: connection.connectedAt,
    };
  },
});

/**
 * Owner-only: link (or update) the You.md repo this account syncs to. Set when
 * the user connects an existing repo or creates a new one through the app.
 */
export const linkRepo = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    repoFullName: v.string(),
    repoVisibility: v.union(v.literal("public"), v.literal("private")),
    repoDefaultBranch: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");

    const connection = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!connection) {
      throw new Error("Connect your GitHub account before linking a repo.");
    }

    const now = Date.now();
    await ctx.db.patch(connection._id, {
      repoFullName: args.repoFullName,
      repoVisibility: args.repoVisibility,
      repoDefaultBranch: args.repoDefaultBranch || "main",
      repoConnectedAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("securityLogs", {
      eventType: "github_repo_linked",
      userId: user._id,
      details: {
        repoFullName: args.repoFullName,
        repoVisibility: args.repoVisibility,
      },
      createdAt: now,
    });

    return { ok: true, repoFullName: args.repoFullName };
  },
});

// ── Internal helpers for the repo action layer (convex/githubRepo.ts) ──────
// These skip auth on purpose: the calling action already authorized the owner
// via requireOwner before invoking them.

/** Internal: resolve a user's GitHub connection + encrypted token by clerkId. */
export const internalGetConnectionContext = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();
    if (!user) return null;
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!conn) return null;
    return {
      connectionId: conn._id,
      userId: user._id,
      username: user.username,
      githubLogin: conn.githubLogin,
      scopes: conn.scopes,
      accessTokenEncrypted: conn.accessTokenEncrypted ?? null,
      accessTokenIv: conn.accessTokenIv ?? null,
      repoFullName: conn.repoFullName ?? null,
      repoDefaultBranch: conn.repoDefaultBranch ?? null,
    };
  },
});

/** Internal: latest compiled identity content to seed a new repo with. */
export const internalGetSeedContent = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const bundles = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const latest = bundles.sort((a, b) => b.version - a.version)[0];
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .first();
    return {
      youMd: latest?.youMd ?? null,
      youJson: latest?.youJson ?? null,
      name: profile?.name ?? null,
      username: profile?.username ?? null,
      tagline: profile?.tagline ?? null,
    };
  },
});

/** Internal: persist the linked repo on the connection + audit it. */
export const internalSetRepo = internalMutation({
  args: {
    connectionId: v.id("githubConnections"),
    userId: v.id("users"),
    repoFullName: v.string(),
    repoVisibility: v.string(),
    repoDefaultBranch: v.string(),
    lastSyncedSha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      repoFullName: args.repoFullName,
      repoVisibility: args.repoVisibility,
      repoDefaultBranch: args.repoDefaultBranch,
      repoConnectedAt: now,
      lastSyncedSha: args.lastSyncedSha,
      lastSyncedAt: args.lastSyncedSha ? now : undefined,
      updatedAt: now,
    });
    await ctx.db.insert("securityLogs", {
      eventType: "github_repo_linked",
      userId: args.userId,
      details: {
        repoFullName: args.repoFullName,
        repoVisibility: args.repoVisibility,
      },
      createdAt: now,
    });
  },
});

/** Internal: record a successful push (repo is now in sync at this sha). */
export const internalMarkSynced = internalMutation({
  args: {
    connectionId: v.id("githubConnections"),
    repoSha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      lastSyncedSha: args.repoSha,
      lastSyncedAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal: write a new bundle from content pulled out of the user's repo, sync
 * it to the public profile, and mark the connection synced. The repo is the
 * source of truth on pull, so we store its content as-is (no form validation).
 */
export const internalSaveBundleFromRepo = internalMutation({
  args: {
    userId: v.id("users"),
    connectionId: v.id("githubConnections"),
    youMd: v.string(),
    youJson: v.any(),
    repoSha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bundles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    const maxVersion = existing.reduce((m, b) => Math.max(m, b.version), 0);
    const latest = existing.sort((a, b) => b.version - a.version)[0];
    const youJson = (args.youJson ?? {}) as Record<string, unknown>;
    const contentHash = await computeContentHash(youJson, args.youMd);

    await ctx.db.insert("bundles", {
      userId: args.userId,
      version: maxVersion + 1,
      schemaVersion: "you-md/v1",
      manifest: {},
      youJson,
      youMd: args.youMd,
      isPublished: false,
      createdAt: Date.now(),
      contentHash,
      parentHash: latest?.contentHash ?? undefined,
      source: "github-repo",
      changeNote: "pulled from GitHub repo",
    });

    // Keep the public profile current (mirror of saveBundleFromForm's sync).
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.userId))
      .first();
    if (profile) {
      const updates: Record<string, unknown> = {
        youJson,
        youMd: args.youMd,
        updatedAt: Date.now(),
      };
      const identity = youJson?.identity as Record<string, unknown> | undefined;
      if (identity?.name) updates.name = identity.name;
      if (identity?.tagline) updates.tagline = identity.tagline;
      if (identity?.location) updates.location = identity.location;
      if (identity?.bio) updates.bio = identity.bio;
      if (youJson?.links) updates.links = youJson.links;
      if (youJson?.projects) updates.projects = youJson.projects;
      if (youJson?.values) updates.values = youJson.values;
      if (youJson?.preferences) updates.preferences = youJson.preferences;
      await ctx.db.patch(profile._id, updates);
    }

    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      lastSyncedSha: args.repoSha,
      lastSyncedAt: now,
      updatedAt: now,
    });

    return { version: maxVersion + 1, contentHash };
  },
});
