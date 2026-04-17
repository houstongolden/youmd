import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireOwner } from "./lib/auth";
import type { MutationCtx } from "./_generated/server";

/**
 * API key management.
 * Keys are prefixed with "ym_" and stored as SHA-256 hashes.
 * The plaintext is shown to the user exactly once at creation time.
 */

export function generateApiKey(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "ym_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cycle 56: default API key lifetime if `expiresInDays` not specified. */
const DEFAULT_API_KEY_LIFETIME_DAYS = 365;

export async function issueApiKeyForUser(
  ctx: MutationCtx,
  user: { _id: any; plan: "free" | "pro" },
  options: {
    label?: string;
    scopes: string[];
    expiresInDays?: number | null;
    revokeExisting?: boolean;
  }
) {
  if (user.plan === "free") {
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    if (options.revokeExisting) {
      for (const key of existingKeys) {
        if (!key.revokedAt) {
          await ctx.db.patch(key._id, { revokedAt: Date.now() });
        }
      }
    } else {
      const activeKeys = existingKeys.filter((k) => !k.revokedAt);
      if (activeKeys.length >= 1) {
        throw new Error(
          "Free plan allows 1 API key. Upgrade to Pro for unlimited keys."
        );
      }
    }

    if (options.scopes.some((s) => s !== "read:public")) {
      throw new Error(
        "Free plan only supports read:public scope. Upgrade to Pro for all scopes."
      );
    }
  }

  const plaintext = generateApiKey();
  const keyHash = await hashKey(plaintext);

  let expiresAt: number | undefined;
  if (options.expiresInDays === null || options.expiresInDays === 0) {
    expiresAt = undefined;
  } else {
    const days = options.expiresInDays ?? DEFAULT_API_KEY_LIFETIME_DAYS;
    expiresAt = Date.now() + days * 86400000;
  }

  await ctx.db.insert("apiKeys", {
    userId: user._id,
    keyHash,
    label: options.label,
    scopes: options.scopes,
    expiresAt,
    createdAt: Date.now(),
  });

  return {
    key: plaintext,
    scopes: options.scopes,
    label: options.label,
    expiresAt: expiresAt ?? null,
  };
}

export const createKey = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
    revokeExisting: v.optional(v.boolean()),
    // Cycle 56: optional expiry override. Defaults to 365 days. Pass `null`
    // (or `0`) for a never-expiring key. The default exists so leaked keys
    // age out automatically rather than living forever.
    expiresInDays: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    return await issueApiKeyForUser(ctx, user, {
      label: args.label,
      scopes: args.scopes,
      revokeExisting: args.revokeExisting,
      expiresInDays: args.expiresInDays,
    });
  },
});

export const listKeys = query({
  args: { clerkId: v.string(), _internalAuthToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) return [];

    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return keys.map((k) => ({
      id: k._id,
      label: k.label,
      scopes: k.scopes,
      lastUsedAt: k.lastUsedAt
        ? new Date(k.lastUsedAt).toISOString()
        : null,
      createdAt: new Date(k.createdAt).toISOString(),
      isRevoked: !!k.revokedAt,
      // Cycle 56: surface expiresAt + isExpired so the UI can show it
      expiresAt: k.expiresAt ? new Date(k.expiresAt).toISOString() : null,
      isExpired: k.expiresAt ? k.expiresAt < Date.now() : false,
      // Never return the hash
      keyPrefix: "ym_****",
    }));
  },
});

export const revokeKey = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== user._id) {
      throw new Error("API key not found");
    }

    await ctx.db.patch(args.keyId, { revokedAt: Date.now() });
  },
});

export const revokeAllKeys = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    const now = Date.now();
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    let revokedCount = 0;
    for (const key of keys) {
      if (!key.revokedAt) {
        await ctx.db.patch(key._id, { revokedAt: now });
        revokedCount += 1;
      }
    }

    if (revokedCount > 0) {
      await ctx.db.insert("securityLogs", {
        eventType: "token_revoked",
        userId: user._id,
        details: {
          reason: "bulk api key revoke",
          count: revokedCount,
        },
        createdAt: now,
      });
    }

    return { revokedCount };
  },
});

// Internal: Look up a key by hash (used by HTTP auth)
export const getByHash = query({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!key) return null;

    const user = await ctx.db.get(key.userId);
    if (!user) return null;

    return {
      _id: key._id,
      userId: user.clerkId, // Return clerkId for compatibility with /me endpoints
      username: user.username,
      plan: user.plan,
      scopes: key.scopes,
      revokedAt: key.revokedAt,
      // Cycle 56: surface expiresAt so authenticateRequest can enforce it.
      // Existing keys without expiresAt are returned as undefined → never expire (backward-compat).
      expiresAt: key.expiresAt,
    };
  },
});

/**
 * Internal: mark an API key as used (updates lastUsedAt timestamp).
 *
 * Cycle 49: previously a public `mutation`. Practical attack surface was
 * negligible (an attacker would need to know an existing apiKey._id, which
 * is a 32-char base32 random string, and the only "damage" is updating a
 * timestamp). But there was no legitimate reason to expose it publicly —
 * the only caller is `authenticateRequest` in convex/http.ts. Now
 * `internalMutation` so it cannot be reached via /api/mutation at all.
 */
export const updateLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
