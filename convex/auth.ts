import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { createUserAndProfile } from "./users";
import { issueApiKeyForUser } from "./apiKeys";
import { OWNER_SESSION_SCOPES } from "./lib/scopes";
import { canonicalUsername } from "./lib/profileDirectory";
import { generateSecureToken, secureRandomString } from "./lib/secureToken";

const CHALLENGE_LIFETIME_MS = 15 * 60 * 1000;
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function randomHex(bytes = 16): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateAuthSubject(): string {
  return `ym_auth_${randomHex(12)}`;
}

export const startEmailAuth = mutation({
  args: {
    email: v.string(),
    type: v.union(v.literal("login"), v.literal("signup")),
    codeHash: v.string(),
    tokenHash: v.string(),
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (args.type === "login" && !existingUser) {
      throw new Error("No account found with that email.");
    }

    if (args.type === "signup") {
      if (existingUser) {
        throw new Error("An account with that email already exists.");
      }
      if (!args.username) {
        throw new Error("Username is required for signup.");
      }
      const username = canonicalUsername(args.username);
      const usernameTaken = await ctx.db
        .query("users")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (usernameTaken) {
        throw new Error("Username already taken.");
      }
      const profileTaken = await ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", username))
        .first();
      if (profileTaken?.isClaimed) {
        throw new Error("Username already taken.");
      }
    }

    const existingChallenges = await ctx.db
      .query("authChallenges")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();
    for (const challenge of existingChallenges) {
      await ctx.db.delete(challenge._id);
    }

    await ctx.db.insert("authChallenges", {
      email,
      type: args.type,
      codeHash: args.codeHash,
      tokenHash: args.tokenHash,
      username: args.username !== undefined ? canonicalUsername(args.username) : undefined,
      displayName: args.displayName,
      expiresAt: Date.now() + CHALLENGE_LIFETIME_MS,
      attempts: 0,
      createdAt: Date.now(),
    });

    return {
      ok: true,
      email,
      expiresAt: Date.now() + CHALLENGE_LIFETIME_MS,
    };
  },
});

export const inspectAuthChallenges = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const now = Date.now();
    const challenges = await ctx.db
      .query("authChallenges")
      .withIndex("by_email", (q) => q.eq("email", email))
      .collect();

    return challenges
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((challenge) => ({
        _id: challenge._id,
        email: challenge.email,
        type: challenge.type,
        createdAt: challenge.createdAt,
        expiresAt: challenge.expiresAt,
        usedAt: challenge.usedAt ?? null,
        attempts: challenge.attempts,
        isExpired: challenge.expiresAt < now,
        isUsed: !!challenge.usedAt,
        ageMs: now - challenge.createdAt,
        codeHashSuffix: challenge.codeHash.slice(-8),
        tokenHashSuffix: challenge.tokenHash.slice(-8),
      }));
  },
});

async function consumeChallenge(
  challenge: Doc<"authChallenges"> | null
): Promise<Doc<"authChallenges">> {
  if (!challenge) {
    throw new Error("Invalid or expired verification.");
  }
  if (challenge.usedAt) {
    throw new Error("That verification has already been used.");
  }
  if (challenge.expiresAt < Date.now()) {
    throw new Error("Verification expired. Request a new code.");
  }
  if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) {
    throw new Error("Too many failed attempts. Request a new code.");
  }
  return challenge;
}

async function finalizeChallenge(
  ctx: MutationCtx,
  challenge: Doc<"authChallenges">,
  issueApiKey: boolean | undefined
) {
  const email = challenge.email;
  let user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (challenge.type === "signup") {
    if (user) {
      throw new Error("An account with that email already exists.");
    }
    const clerkId = generateAuthSubject();
    const userId = await createUserAndProfile(ctx, {
      clerkId,
      // startEmailAuth requires username for signup challenges.
      username: challenge.username!,
      email,
      displayName: challenge.displayName,
      verificationSource: "passwordless_email",
    });
    user = await ctx.db.get(userId);
  } else if (!user) {
    throw new Error("No account found with that email.");
  }

  await ctx.db.patch(challenge._id, {
    usedAt: Date.now(),
  });

  let apiKey: string | null = null;
  if (issueApiKey && user) {
    // P36: the login session key IS the owner's own credential, so it gets
    // full owner scopes (the user never chose a narrowed grant for their own
    // session). `ownerSession: true` bypasses the free-plan scope ceiling —
    // that ceiling gates third-party agent keys, not the owner's login.
    const issued = await issueApiKeyForUser(ctx, user, {
      label: "cli-auth",
      scopes: [...OWNER_SESSION_SCOPES],
      revokeExisting: true,
      ownerSession: true,
    });
    apiKey = issued.key;
  }

  return {
    ok: true,
    userId: user!._id,
    clerkId: user!.clerkId,
    username: user!.username,
    email: user!.email,
    displayName: user!.displayName,
    plan: user!.plan,
    apiKey,
    isNewUser: challenge.type === "signup",
  };
}

export const completeEmailAuthWithCode = mutation({
  args: {
    email: v.string(),
    codeHash: v.string(),
    issueApiKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const challenges = await ctx.db
      .query("authChallenges")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .collect();

    const activeChallenges = challenges
      .filter((challenge) => {
        if (challenge.usedAt) return false;
        if (challenge.expiresAt < Date.now()) return false;
        if (challenge.attempts >= MAX_CHALLENGE_ATTEMPTS) return false;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    const matchingChallenge = activeChallenges.find(
      (challenge) => challenge.codeHash === args.codeHash
    );

    if (!matchingChallenge) {
      const latestChallenge = activeChallenges[0];
      if (latestChallenge) {
        await ctx.db.patch(latestChallenge._id, {
          attempts: latestChallenge.attempts + 1,
        });
      }
      throw new Error("Invalid or expired verification code.");
    }

    const verifiedChallenge = await consumeChallenge(matchingChallenge);
    return await finalizeChallenge(ctx, verifiedChallenge, args.issueApiKey);
  },
});

export const completeEmailAuthWithToken = mutation({
  args: {
    tokenHash: v.string(),
    issueApiKey: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    const verifiedChallenge = await consumeChallenge(challenge);
    return await finalizeChallenge(ctx, verifiedChallenge, args.issueApiKey);
  },
});

export const createSession = mutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
    userAgent: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("authSessions", {
      userId: args.userId,
      tokenHash: args.tokenHash,
      userAgent: args.userAgent,
      ipAddress: args.ipAddress,
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const validateSession = query({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    const user = await ctx.db.get(session.userId);
    if (!user) {
      return null;
    }
    return {
      sessionId: session._id,
      userId: user._id,
      clerkId: user.clerkId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      expiresAt: session.expiresAt,
    };
  },
});

export const touchSession = mutation({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (!session || session.expiresAt < Date.now()) {
      return false;
    }
    await ctx.db.patch(session._id, {
      expiresAt: Date.now() + SESSION_LIFETIME_MS,
      lastUsedAt: Date.now(),
    });
    return true;
  },
});

export const deleteSession = mutation({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("authSessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { ok: true };
  },
});

// ============================================================
// DEVICE-FLOW AUTH (U7, RFC 8628-shaped, simplified)
// ============================================================
//
// `youmd login` default path:
//   1. CLI → POST /api/v1/auth/device/start (http.ts) → startDeviceAuth
//      mints a secret deviceCode (256-bit hex, kept by the CLI, never shown)
//      and a short userCode (8 chars, unambiguous alphabet, shown to the
//      user). Both are stored as SHA-256 hashes only.
//   2. User approves at https://you.md/device in a signed-in browser
//      session → lookupDeviceAuth / resolveDeviceAuth (identity-gated).
//   3. CLI → POST /api/v1/auth/device/poll → pollDeviceAuth. On approval it
//      mints the same full-scope "cli-auth" owner-session key as the email
//      flow, returns it exactly ONCE, and marks the row consumed.
//
// Security properties:
//   - deviceCode: 256 bits of entropy, hashed at rest, never displayed.
//   - userCode validation requires an authenticated web session AND is
//     rate-limited per user (failed attempts → lockout window), so the
//     31^8 (~8.5e11) code space cannot be brute-forced.
//   - Codes are single-use: approved rows are consumed on first successful
//     poll; denied/expired rows are deleted at read time (no cron).
//   - start/poll are internalMutations — reachable only via the rate-limited
//     HTTP routes in convex/http.ts, never via public /api/mutation.

export const DEVICE_CODE_LIFETIME_MS = 10 * 60 * 1000; // 600s
export const DEVICE_POLL_INTERVAL_SECONDS = 5;
const DEVICE_USER_CODE_LENGTH = 8;
// Unambiguous: no 0/O, 1/I/L — codes get read off a terminal and typed.
export const DEVICE_USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DEVICE_USER_CODE_MAX_FAILED_ATTEMPTS = 10;
const DEVICE_USER_CODE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const DEVICE_CLIENT_NAME_MAX_CHARS = 120;

/** Uppercase + strip separators so "abcd-efgh" matches "ABCDEFGH". */
export function normalizeUserCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Resolve the authenticated web user (Convex identity from the session JWT). */
async function requireWebUser(ctx: MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("authentication required: sign in to approve a device.");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .first();
  if (!user) {
    throw new Error("No account found for this session.");
  }
  return user;
}

/**
 * Per-user lockout on failed userCode validation. Rides the existing
 * rateLimits table (sliding window, rows cleaned by the hourly cron).
 * Only FAILED attempts are recorded — approving several devices in a row
 * never locks a legitimate user out.
 */
async function isUserCodeLockedOut(
  ctx: MutationCtx,
  userId: Doc<"users">["_id"]
): Promise<boolean> {
  const since = Date.now() - DEVICE_USER_CODE_ATTEMPT_WINDOW_MS;
  const recent = await ctx.db
    .query("rateLimits")
    .withIndex("by_bucket_ts", (q) =>
      q.eq("bucket", `deviceUserCode:${userId}`).gt("timestamp", since)
    )
    .collect();
  return recent.length >= DEVICE_USER_CODE_MAX_FAILED_ATTEMPTS;
}

async function recordFailedUserCodeAttempt(
  ctx: MutationCtx,
  userId: Doc<"users">["_id"]
): Promise<void> {
  await ctx.db.insert("rateLimits", {
    bucket: `deviceUserCode:${userId}`,
    timestamp: Date.now(),
  });
}

/**
 * Find the pending, unexpired device request matching a userCode.
 * Expired pending rows found along the way are deleted (read-time cleanup).
 * Rows in any other state are NOT returned — codes are single-use.
 */
async function findPendingDeviceRequestByUserCode(
  ctx: MutationCtx,
  userCode: string
): Promise<Doc<"deviceAuthRequests"> | null> {
  const userCodeHash = await sha256Hex(normalizeUserCode(userCode));
  const rows = await ctx.db
    .query("deviceAuthRequests")
    .withIndex("by_userCodeHash", (q) => q.eq("userCodeHash", userCodeHash))
    .collect();
  const now = Date.now();
  let match: Doc<"deviceAuthRequests"> | null = null;
  for (const row of rows) {
    if (row.status === "pending" && row.expiresAt < now) {
      await ctx.db.delete(row._id); // lazy cleanup, no cron
      continue;
    }
    if (row.status === "pending") match = row;
  }
  return match;
}

/**
 * Start a device-flow login. Internal — only the rate-limited HTTP route
 * POST /api/v1/auth/device/start may call this (anonymous callers must not
 * be able to mint codes via public /api/mutation without the IP limit).
 * Returns the plaintext codes exactly once; only hashes are stored.
 */
export const startDeviceAuth = internalMutation({
  args: {
    clientName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const deviceCode = generateSecureToken(32); // 64 hex chars, CLI-only secret
    let userCode = secureRandomString(
      DEVICE_USER_CODE_LENGTH,
      DEVICE_USER_CODE_ALPHABET
    );

    // 31^8 makes collisions vanishingly rare, but a pending duplicate would
    // make approval ambiguous — regenerate if one exists.
    for (let i = 0; i < 3; i++) {
      const clash = await findPendingDeviceRequestByUserCode(ctx, userCode);
      if (!clash) break;
      userCode = secureRandomString(
        DEVICE_USER_CODE_LENGTH,
        DEVICE_USER_CODE_ALPHABET
      );
    }

    const now = Date.now();
    const expiresAt = now + DEVICE_CODE_LIFETIME_MS;
    await ctx.db.insert("deviceAuthRequests", {
      deviceCodeHash: await sha256Hex(deviceCode),
      userCodeHash: await sha256Hex(normalizeUserCode(userCode)),
      status: "pending",
      clientName: args.clientName?.slice(0, DEVICE_CLIENT_NAME_MAX_CHARS),
      expiresAt,
      createdAt: now,
    });

    return {
      deviceCode,
      userCode,
      expiresAt,
      expiresIn: Math.floor(DEVICE_CODE_LIFETIME_MS / 1000),
      interval: DEVICE_POLL_INTERVAL_SECONDS,
    };
  },
});

/**
 * Web /device page: validate a typed userCode and show what is asking for
 * access. Requires an authenticated web session. Expected failures return
 * `{ ok: false, reason }` (plain Error messages are redacted in prod).
 */
export const lookupDeviceAuth = mutation({
  args: {
    userCode: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireWebUser(ctx);
    if (await isUserCodeLockedOut(ctx, user._id)) {
      return { ok: false as const, reason: "locked_out" as const };
    }
    const row = await findPendingDeviceRequestByUserCode(ctx, args.userCode);
    if (!row) {
      await recordFailedUserCodeAttempt(ctx, user._id);
      return { ok: false as const, reason: "invalid_code" as const };
    }
    return {
      ok: true as const,
      device: {
        clientName: row.clientName ?? "youmd CLI",
        requestedAt: row.createdAt,
        expiresAt: row.expiresAt,
      },
    };
  },
});

/**
 * Web /device page: approve or deny a pending device request. Requires an
 * authenticated web session; approval binds that user to the request. The
 * API key is NOT minted here — it is minted on the CLI's next poll so the
 * plaintext key only ever travels to the device that holds the deviceCode.
 */
export const resolveDeviceAuth = mutation({
  args: {
    userCode: v.string(),
    approve: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireWebUser(ctx);
    if (await isUserCodeLockedOut(ctx, user._id)) {
      return { ok: false as const, reason: "locked_out" as const };
    }
    const row = await findPendingDeviceRequestByUserCode(ctx, args.userCode);
    if (!row) {
      await recordFailedUserCodeAttempt(ctx, user._id);
      return { ok: false as const, reason: "invalid_code" as const };
    }

    if (args.approve) {
      await ctx.db.patch(row._id, {
        status: "approved",
        userId: user._id,
        approvedAt: Date.now(),
      });
      return { ok: true as const, status: "approved" as const };
    }

    await ctx.db.patch(row._id, {
      status: "denied",
      userId: user._id,
      approvedAt: Date.now(),
    });
    return { ok: true as const, status: "denied" as const };
  },
});

/**
 * CLI poll. Internal — only the rate-limited HTTP route
 * POST /api/v1/auth/device/poll may call this. Takes the HASH of the
 * deviceCode (hashed in http.ts) so the plaintext never enters a mutation arg
 * log. State machine:
 *   pending  → "pending" (or "slow_down" when polled faster than interval)
 *   approved → mint cli-auth owner-session key, return it ONCE, mark consumed
 *   denied   → "denied" once, then the row is deleted (single-use)
 *   expired  → "expired", row deleted (read-time cleanup, no cron)
 *   consumed/unknown → "invalid"
 */
export const pollDeviceAuth = internalMutation({
  args: {
    deviceCodeHash: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("deviceAuthRequests")
      .withIndex("by_deviceCodeHash", (q) =>
        q.eq("deviceCodeHash", args.deviceCodeHash)
      )
      .first();

    if (!row || row.status === "consumed" || row.status === "expired") {
      return { status: "invalid" as const };
    }

    const now = Date.now();
    if (row.expiresAt < now) {
      // Applies to pending AND approved-but-never-collected rows.
      await ctx.db.delete(row._id);
      return { status: "expired" as const };
    }

    if (row.status === "denied") {
      await ctx.db.delete(row._id);
      return { status: "denied" as const };
    }

    if (row.status === "pending") {
      const intervalMs = DEVICE_POLL_INTERVAL_SECONDS * 1000;
      if (row.lastPolledAt && now - row.lastPolledAt < intervalMs) {
        // Don't bump lastPolledAt — the next compliant poll should pass.
        return {
          status: "slow_down" as const,
          interval: DEVICE_POLL_INTERVAL_SECONDS,
        };
      }
      await ctx.db.patch(row._id, { lastPolledAt: now });
      return {
        status: "pending" as const,
        interval: DEVICE_POLL_INTERVAL_SECONDS,
      };
    }

    // status === "approved" — mint the owner-session key exactly once.
    const user = row.userId ? await ctx.db.get(row.userId) : null;
    if (!user) {
      await ctx.db.delete(row._id);
      return { status: "invalid" as const };
    }

    // Same key-mint path as completeEmailAuthWithCode (P36): the login
    // session key is the owner's own credential → full owner scopes.
    const issued = await issueApiKeyForUser(ctx, user, {
      label: "cli-auth",
      scopes: [...OWNER_SESSION_SCOPES],
      revokeExisting: true,
      ownerSession: true,
    });

    await ctx.db.patch(row._id, {
      status: "consumed",
      consumedAt: now,
    });

    return {
      status: "approved" as const,
      apiKey: issued.key,
      userId: user._id,
      clerkId: user.clerkId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
    };
  },
});
