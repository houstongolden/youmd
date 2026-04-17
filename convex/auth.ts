import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createUserAndProfile } from "./users";
import { issueApiKeyForUser } from "./apiKeys";

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
      const username = args.username.toLowerCase();
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
      username: args.username?.toLowerCase(),
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

async function consumeChallenge(challenge: any) {
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
  ctx: any,
  challenge: any,
  issueApiKey: boolean | undefined
) {
  const email = challenge.email as string;
  let user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();

  if (challenge.type === "signup") {
    if (user) {
      throw new Error("An account with that email already exists.");
    }
    const clerkId = generateAuthSubject();
    const userId = await createUserAndProfile(ctx, {
      clerkId,
      username: challenge.username,
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
    const issued = await issueApiKeyForUser(ctx, user, {
      label: "cli-auth",
      scopes: ["read:public"],
      revokeExisting: true,
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
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .first();

    const verifiedChallenge = await consumeChallenge(challenge);

    if (verifiedChallenge.codeHash !== args.codeHash) {
      await ctx.db.patch(verifiedChallenge._id, {
        attempts: verifiedChallenge.attempts + 1,
      });
      throw new Error("Invalid or expired verification code.");
    }

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
