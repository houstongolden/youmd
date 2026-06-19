import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { computeContentHash } from "./lib/hash";
import { createUserAndProfile } from "./users";
import { requireOwner } from "./lib/auth";
import { encryptSecret } from "./lib/secretCrypto";
import { canonicalUsername } from "./lib/profileDirectory";
import {
  GITHUB_PUSH_DEBOUNCE_MS,
  hasMirrorDiverged,
  isMirrorStale,
  shouldDebounceAutoPush,
} from "./lib/githubSync";

const ACTIVITY_FIELD_CHARS = 160;
const ACTIVITY_TITLE_CHARS = 180;
const ACTIVITY_DETAIL_CHARS = 800;

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

function cleanActivityText(value: string | undefined, fallback: string, maxChars: number): string {
  const cleaned = (value ?? fallback)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, maxChars);
}

async function recordGithubActivity(
  ctx: MutationCtx,
  fields: {
    userId: Id<"users">;
    activityId: string;
    kind: string;
    title: string;
    detail?: string;
    status?: "live" | "ok" | "warn" | "error" | "info";
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: number;
  },
) {
  const now = Date.now();
  const activityId = cleanActivityText(fields.activityId, "github", ACTIVITY_FIELD_CHARS);
  const existing = await ctx.db
    .query("brainActivities")
    .withIndex("by_userId_activityId", (q) => q.eq("userId", fields.userId).eq("activityId", activityId))
    .first();
  const patch = {
    source: "github",
    channel: "repo-mirror",
    kind: cleanActivityText(fields.kind, "event", ACTIVITY_FIELD_CHARS),
    title: cleanActivityText(fields.title, "GitHub activity", ACTIVITY_TITLE_CHARS),
    detail: fields.detail ? cleanActivityText(fields.detail, "", ACTIVITY_DETAIL_CHARS) : undefined,
    status: fields.status ?? (fields.kind === "stale" ? "warn" : "ok"),
    entityType: fields.entityType,
    entityId: fields.entityId,
    sourceAgent: "github-mirror",
    metadata: fields.metadata,
    occurredAt: fields.occurredAt ?? now,
    updatedAt: now,
    secretValuesExposed: false,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return;
  }

  await ctx.db.insert("brainActivities", {
    userId: fields.userId,
    activityId,
    ...patch,
    createdAt: now,
  });
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

/**
 * Link a GitHub account to a SPECIFIC already-authenticated user (connect flow).
 *
 * Unlike findOrCreateGithubUser (which resolves a user by GitHub identity/email
 * and is used for sign-up/sign-in), this links to the caller's CURRENT session
 * user — so a user who signed up via email can connect GitHub even when their
 * GitHub email differs from their account email, without creating a duplicate.
 *
 * Rejects if the GitHub account is already connected to a different user.
 * If the user already has a (different) GitHub connection, it is replaced.
 */
export const linkGithubToUser = mutation({
  args: {
    _internalAuthToken: v.optional(v.string()),
    linkToUserId: v.id("users"),
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

    // OAuth proves the current session user controls this GitHub account, so
    // RE-HOME the link to them if it was attached to a different (usually stale
    // or duplicate) you.md account. Without this, the connect flow gets stuck
    // showing "not connected" forever whenever an earlier sign-in created the
    // github identity on a separate account record.
    const byGithub = await ctx.db
      .query("githubConnections")
      .withIndex("by_githubUserId", (q) => q.eq("githubUserId", args.githubUserId))
      .first();
    if (byGithub && byGithub.userId !== args.linkToUserId) {
      await ctx.db.delete(byGithub._id);
    }

    let encrypted: { ciphertext: string; iv: string } | null = null;
    if (args.accessToken) {
      encrypted = await encryptSecret(args.accessToken);
    }
    const tokenPatch = encrypted
      ? { accessTokenEncrypted: encrypted.ciphertext, accessTokenIv: encrypted.iv }
      : {};

    const identityPatch = {
      githubUserId: args.githubUserId,
      githubLogin: args.githubLogin,
      githubName: args.githubName,
      githubEmail: email,
      githubAvatarUrl: args.githubAvatarUrl,
      scopes: args.scopes,
      tokenType: args.tokenType,
      updatedAt: now,
      ...tokenPatch,
    };

    // Reuse the user's existing connection row if present (one per user),
    // otherwise insert a fresh one.
    const existingForUser =
      byGithub && byGithub.userId === args.linkToUserId
        ? byGithub
        : await ctx.db
            .query("githubConnections")
            .withIndex("by_userId", (q) => q.eq("userId", args.linkToUserId))
            .first();

    if (existingForUser) {
      await ctx.db.patch(existingForUser._id, identityPatch);
    } else {
      await ctx.db.insert("githubConnections", {
        userId: args.linkToUserId,
        connectedAt: now,
        ...identityPatch,
      });
    }

    await ctx.db.insert("securityLogs", {
      eventType: "github_linked",
      userId: args.linkToUserId,
      details: {
        provider: "github",
        githubLogin: args.githubLogin,
        githubUserId: args.githubUserId,
        linkedToExisting: true,
      },
      createdAt: now,
    });

    return { ok: true as const, userId: args.linkToUserId };
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
      appInstalled: !!connection.installationId,
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
      webhookId: conn.webhookId ?? null,
      installationId: conn.installationId ?? null,
      installationTokenEnc: conn.installationTokenEnc ?? null,
      installationTokenIv: conn.installationTokenIv ?? null,
      installationTokenExp: conn.installationTokenExp ?? null,
      // P17: auto-push bookkeeping for convex/githubAutoPush.ts.
      pendingPushAt: conn.pendingPushAt ?? null,
      lastPushedCommitSha: conn.lastPushedCommitSha ?? null,
      mirrorStale: conn.mirrorStale ?? false,
    };
  },
});

/** Internal: cache an encrypted installation token + expiry on the connection. */
export const internalCacheInstallationToken = internalMutation({
  args: {
    connectionId: v.id("githubConnections"),
    enc: v.string(),
    iv: v.string(),
    exp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      installationTokenEnc: args.enc,
      installationTokenIv: args.iv,
      installationTokenExp: args.exp,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: clear a GitHub App installation (and its cached token) when the
 * App is uninstalled/suspended. Called from the `installation` webhook.
 */
export const internalClearInstallationById = internalMutation({
  args: { installationId: v.number() },
  handler: async (ctx, { installationId }) => {
    const conns = await ctx.db
      .query("githubConnections")
      .withIndex("by_installationId", (q) =>
        q.eq("installationId", installationId)
      )
      .collect();
    for (const conn of conns) {
      await ctx.db.patch(conn._id, {
        installationId: undefined,
        installationTokenEnc: undefined,
        installationTokenIv: undefined,
        installationTokenExp: undefined,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("securityLogs", {
        eventType: "github_app_uninstalled",
        userId: conn.userId,
        details: { installationId },
        createdAt: Date.now(),
      });
    }
    return { cleared: conns.length };
  },
});

/** Owner-only: record the GitHub App installation id for this user (Phase 5). */
export const setInstallation = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    installationId: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("User not found");
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!conn) {
      throw new Error("Connect GitHub before installing the GitHub App.");
    }
    await ctx.db.patch(conn._id, {
      installationId: args.installationId,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("securityLogs", {
      eventType: "github_app_installed",
      userId: user._id,
      details: { installationId: args.installationId },
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Internal: resolve the owner's clerkId from a linked repo full name. */
export const internalGetClerkIdByRepo = internalQuery({
  args: { repoFullName: v.string() },
  handler: async (ctx, { repoFullName }) => {
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_repoFullName", (q) => q.eq("repoFullName", repoFullName))
      .first();
    if (!conn) return null;
    const user = await ctx.db.get(conn.userId);
    if (!user) return null;
    return { clerkId: user.clerkId, defaultBranch: conn.repoDefaultBranch ?? "main" };
  },
});

/** Internal: store the registered webhook id on the connection. */
export const internalSetWebhook = internalMutation({
  args: { connectionId: v.id("githubConnections"), webhookId: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      webhookId: args.webhookId,
      updatedAt: Date.now(),
    });
  },
});

// ── Repo mirror (Phase 4) ──────────────────────────────────

/** Internal: upsert the repo mirror snapshot for a user (one row per user). */
export const internalUpsertMirror = internalMutation({
  args: {
    userId: v.id("users"),
    repoFullName: v.string(),
    commitSha: v.optional(v.string()),
    files: v.array(
      v.object({ path: v.string(), content: v.string(), size: v.number() })
    ),
    truncated: v.boolean(),
  },
  handler: async (ctx, args) => {
    const totalBytes = args.files.reduce((n, f) => n + f.size, 0);
    const existing = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    const row = {
      userId: args.userId,
      repoFullName: args.repoFullName,
      commitSha: args.commitSha,
      files: args.files,
      fileCount: args.files.length,
      totalBytes,
      truncated: args.truncated,
      syncedAt: Date.now(),
    };
    let mirrorId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      mirrorId = await ctx.db.insert("repoMirror", row);
    }

    // P17 ancestry check: if the mirrored head moved past the commit we last
    // pushed, the repo changed out from under us (manual pushes count). Flag
    // the connection stale so reads prefer canonical content; clear the flag
    // when the heads agree again (the next auto-push reconciles the repo).
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (conn && conn.lastPushedCommitSha) {
      const stale = hasMirrorDiverged(conn.lastPushedCommitSha, args.commitSha);
      if (stale !== (conn.mirrorStale === true)) {
        await ctx.db.patch(conn._id, { mirrorStale: stale, updatedAt: Date.now() });
      }
    }

    const stale = conn?.lastPushedCommitSha
      ? hasMirrorDiverged(conn.lastPushedCommitSha, args.commitSha)
      : conn?.mirrorStale === true;
    await recordGithubActivity(ctx, {
      userId: args.userId,
      activityId: `github:repo-mirror:${args.repoFullName}`,
      kind: stale ? "stale" : "synced",
      title: stale ? `GitHub mirror stale: ${args.repoFullName}` : `GitHub mirror synced: ${args.repoFullName}`,
      detail: `${args.files.length} files / ${totalBytes} bytes${args.truncated ? " / capped" : ""}${args.commitSha ? ` / ${args.commitSha.slice(0, 12)}` : ""}`,
      status: stale ? "warn" : "ok",
      entityType: "repoMirror",
      entityId: mirrorId ? String(mirrorId) : args.repoFullName,
      metadata: {
        repoFullName: args.repoFullName,
        commitSha: args.commitSha,
        commitShaShort: args.commitSha?.slice(0, 12),
        fileCount: args.files.length,
        totalBytes,
        truncated: args.truncated,
        stale,
        lastPushedCommitSha: conn?.lastPushedCommitSha,
        secretValuesExposed: false,
      },
      occurredAt: row.syncedAt,
    });

    return { fileCount: args.files.length, totalBytes };
  },
});

/**
 * Internal: read a user's mirror by clerkId (for authenticated API/MCP reads).
 *
 * P17 ancestor check: when the mirror is stale (head moved past what we last
 * pushed, or the staleness flag is set), the canonical Convex store wins —
 * the latest bundle's you.md/you.json are overlaid onto the returned files so
 * repo-file reads never serve stale identity content. We never merge FROM the
 * mirror. Stack files can't be overlaid (no canonical copy), so callers get a
 * `stale` flag alongside.
 */
export const internalGetMirrorByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();
    if (!user) return null;
    const mirror = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!mirror) return null;

    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const stale = isMirrorStale(conn, mirror.commitSha);
    if (!stale) return { ...mirror, stale: false };

    const latest = await ctx.db
      .query("bundles")
      .withIndex("by_userId_version", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!latest) return { ...mirror, stale: true };

    const canonical = new Map<string, string>([
      ["you.md", latest.youMd ?? ""],
      ["you.json", JSON.stringify(latest.youJson ?? {}, null, 2)],
    ]);
    const files = mirror.files.map((f) =>
      canonical.has(f.path)
        ? {
            path: f.path,
            content: canonical.get(f.path)!,
            size: canonical.get(f.path)!.length,
          }
        : f
    );
    canonical.forEach((content, path) => {
      if (!files.some((f) => f.path === path)) {
        files.push({ path, content, size: content.length });
      }
    });
    return { ...mirror, files, stale: true };
  },
});

/**
 * L23 — internal query to load the repo mirror by userId (no clerkId lookup).
 * Used by the per-stack MCP namespace to resolve public stacks for a target
 * user without requiring authentication.
 */
export const internalGetMirrorByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const mirror = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!mirror) return null;
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const stale = isMirrorStale(conn, mirror.commitSha);
    return { ...mirror, stale };
  },
});

/**
 * Owner-only: mirror summary (file paths + sizes, no content) plus derived
 * stacks. Powers the Settings-pane mirror status and the stacks list.
 */
export const getRepoMirror = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;
    const mirror = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!mirror) return null;

    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    return {
      repoFullName: mirror.repoFullName,
      commitSha: mirror.commitSha ?? null,
      fileCount: mirror.fileCount,
      totalBytes: mirror.totalBytes,
      truncated: mirror.truncated,
      syncedAt: mirror.syncedAt,
      // P17: mirror moved out from under us (manual pushes) — canonical
      // content wins; the next auto-push force-updates the repo.
      stale: isMirrorStale(conn, mirror.commitSha),
      pendingPushAt: conn?.pendingPushAt ?? null,
      lastPushError: conn?.lastPushError ?? null,
      files: mirror.files.map((f) => ({ path: f.path, size: f.size })),
      stacks: deriveStacks(mirror.files),
    };
  },
});

/**
 * Derive named stacks from mirrored `stacks/<slug>/...` files. A stack is any
 * top-level folder under `stacks/`; we report its file count + whether it has
 * a manifest so the UI/API can list the user's repo-hosted YouStacks.
 */
export function deriveStacks(
  files: { path: string }[]
): { slug: string; fileCount: number; hasManifest: boolean }[] {
  const bySlug = new Map<string, { fileCount: number; hasManifest: boolean }>();
  for (const f of files) {
    const m = f.path.match(/^stacks\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const slug = m[1];
    const rest = m[2];
    const entry = bySlug.get(slug) ?? { fileCount: 0, hasManifest: false };
    entry.fileCount += 1;
    if (/^(manifest|youstack)\.(json|ya?ml)$/i.test(rest)) {
      entry.hasManifest = true;
    }
    bySlug.set(slug, entry);
  }
  return Array.from(bySlug.entries()).map(([slug, v]) => ({ slug, ...v }));
}

/**
 * Public: the YouStacks a user hosts in their own repo — but ONLY when that
 * repo is public. Returns null for users with no public repo so the public
 * profile / MCP never leak private-repo stack names.
 */
export const getPublicRepoStacks = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const uname = canonicalUsername(username).replace(/^@/, "");
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", uname))
      .first();
    if (!user) return null;
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!conn || conn.repoVisibility !== "public" || !conn.repoFullName) {
      return null;
    }
    const repoUrl = `https://github.com/${conn.repoFullName}`;
    const mirror = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    return {
      repoFullName: conn.repoFullName,
      repoUrl,
      stacks: mirror ? deriveStacks(mirror.files) : [],
      // P17: surfaced so consumers know the stack list may lag canonical.
      stale: mirror ? isMirrorStale(conn, mirror.commitSha) : false,
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
      // P17: a push (manual included) re-anchors ancestry and reconciles any
      // mirror divergence — the canonical store just force-won.
      lastPushedCommitSha: args.repoSha,
      pendingPushAt: undefined,
      mirrorStale: false,
      lastPushError: undefined,
      lastPushErrorAt: undefined,
      updatedAt: now,
    });
  },
});

// ── P17: debounced auto-push on save/publish (PRODUCT-AUDIT #19) ───────────

/**
 * Schedule a debounced GitHub mirror push for a user. Called from the bundle
 * save/publish mutations (convex/me.ts, convex/bundles.ts) so the repo mirror
 * stops going stale between explicit syncs.
 *
 * Debounce: pendingPushAt on the connection records when the scheduled push
 * will run. While that time is in the future, further saves are no-ops — the
 * pending push reads the LATEST bundle when it runs, so it captures them.
 * Best-effort by design: never throws, so a scheduling hiccup can't fail the
 * save itself. No-op for users without a linked repo.
 */
export async function scheduleGithubAutoPush(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<{ scheduled: boolean; reason?: string; runAt?: number }> {
  try {
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!conn || !conn.repoFullName) {
      return { scheduled: false, reason: "no_repo" };
    }
    const now = Date.now();
    if (shouldDebounceAutoPush(conn.pendingPushAt, now)) {
      return { scheduled: false, reason: "debounced", runAt: conn.pendingPushAt };
    }
    const user = await ctx.db.get(userId);
    if (!user) return { scheduled: false, reason: "no_user" };

    const runAt = now + GITHUB_PUSH_DEBOUNCE_MS;
    await ctx.db.patch(conn._id, { pendingPushAt: runAt, updatedAt: now });
    await ctx.scheduler.runAfter(
      GITHUB_PUSH_DEBOUNCE_MS,
      internal.githubAutoPush.runAutoPush,
      { clerkId: user.clerkId, attempt: 0 }
    );
    return { scheduled: true, runAt };
  } catch (err) {
    // Scheduling must never break the save/publish that triggered it.
    console.error("[github auto-push] scheduling failed", err);
    return { scheduled: false, reason: "error" };
  }
}

/** Internal: scheduling entry point for tests/tooling (same logic as the hook). */
export const internalScheduleAutoPush = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await scheduleGithubAutoPush(ctx, userId);
  },
});

/** Internal: flag (or clear) mirror divergence detected by the push action. */
export const internalSetMirrorStale = internalMutation({
  args: { connectionId: v.id("githubConnections"), stale: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      mirrorStale: args.stale,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: record a completed auto-push. Re-anchors ancestry at the new
 * commit, clears the debounce marker, the staleness flag, and any prior
 * failure note. `commitSha` is the pushed commit (or the observed head when
 * the repo was already up to date).
 */
export const internalMarkAutoPushed = internalMutation({
  args: {
    connectionId: v.id("githubConnections"),
    commitSha: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.connectionId, {
      lastPushedCommitSha: args.commitSha,
      lastSyncedSha: args.commitSha,
      lastSyncedAt: now,
      pendingPushAt: undefined,
      mirrorStale: false,
      lastPushError: undefined,
      lastPushErrorAt: undefined,
      updatedAt: now,
    });
  },
});

/** Internal: clear the debounce marker without claiming a sync happened. */
export const internalClearPendingPush = internalMutation({
  args: { connectionId: v.id("githubConnections") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      pendingPushAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Internal: record an auto-push failure. When a retry is scheduled, the
 * debounce marker is moved to the retry time so saves in between don't
 * double-schedule; when retries are exhausted it is cleared so the NEXT
 * save can schedule a fresh push (no infinite loops, no wedged state).
 */
export const internalRecordAutoPushFailure = internalMutation({
  args: {
    clerkId: v.string(),
    error: v.string(),
    retryAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return;
    const conn = await ctx.db
      .query("githubConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!conn) return;
    const now = Date.now();
    await ctx.db.patch(conn._id, {
      lastPushError: args.error.slice(0, 500),
      lastPushErrorAt: now,
      pendingPushAt: args.retryAt ?? undefined,
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
