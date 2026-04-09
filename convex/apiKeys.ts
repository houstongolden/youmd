import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";

/**
 * API key management.
 * Keys are prefixed with "ym_" and stored as SHA-256 hashes.
 * The plaintext is shown to the user exactly once at creation time.
 */

function generateApiKey(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "ym_";
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const createKey = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    label: v.optional(v.string()),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 38 P0 fix)
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) throw new Error("User not found");

    // Free users get 1 key max
    if (user.plan === "free") {
      const existingKeys = await ctx.db
        .query("apiKeys")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();

      const activeKeys = existingKeys.filter((k) => !k.revokedAt);
      if (activeKeys.length >= 1) {
        throw new Error(
          "Free plan allows 1 API key. Upgrade to Pro for unlimited keys."
        );
      }

      // Free users can only have read:public scope
      if (args.scopes.some((s) => s !== "read:public")) {
        throw new Error(
          "Free plan only supports read:public scope. Upgrade to Pro for all scopes."
        );
      }
    }

    const plaintext = generateApiKey();
    const keyHash = await hashKey(plaintext);

    await ctx.db.insert("apiKeys", {
      userId: user._id,
      keyHash,
      label: args.label,
      scopes: args.scopes,
      createdAt: Date.now(),
    });

    // Return plaintext ONCE — it will never be shown again
    return {
      key: plaintext,
      scopes: args.scopes,
      label: args.label,
    };
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
    };
  },
});

export const updateLastUsed = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
