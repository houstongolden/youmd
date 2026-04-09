import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireOwner } from "./lib/auth";

// ── Vault initialization ──────────────────────────────────────

/** Store the wrapped vault key for a user (called once on vault init). */
export const initVault = mutation({
  args: {
    clerkId: v.string(),
    wrappedVaultKey: v.bytes(),
    vaultSalt: v.bytes(),
    vaultKeyIv: v.bytes(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    // Check if vault already exists
    const existing = await ctx.db
      .query("privateVault")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // Update the wrapped key (e.g. passphrase change)
      await ctx.db.patch(existing._id, {
        wrappedVaultKey: args.wrappedVaultKey,
        vaultSalt: args.vaultSalt,
        vaultKeyIv: args.vaultKeyIv,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("privateVault", {
        userId: user._id,
        wrappedVaultKey: args.wrappedVaultKey,
        vaultSalt: args.vaultSalt,
        vaultKeyIv: args.vaultKeyIv,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Log
    await ctx.db.insert("securityLogs", {
      eventType: "vault_initialized",
      userId: user._id,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Save encrypted vault data ─────────────────────────────────

/** Store encrypted markdown and JSON vault data. */
export const saveEncryptedVault = mutation({
  args: {
    clerkId: v.string(),
    encryptedMd: v.bytes(),
    encryptedJson: v.bytes(),
    iv: v.bytes(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) throw new Error("not authenticated");

    const existing = await ctx.db
      .query("privateVault")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!existing) {
      throw new Error("vault not initialized — call initVault first");
    }

    await ctx.db.patch(existing._id, {
      encryptedMd: args.encryptedMd,
      encryptedJson: args.encryptedJson,
      iv: args.iv,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Get encrypted vault data ──────────────────────────────────

/** Return encrypted vault data + wrapped key for the authenticated user. */
export const getEncryptedVault = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify the caller IS the user they claim to be (cycle 37 P0 fix)
    await requireOwner(ctx, args.clerkId);

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();
    if (!user) return null;

    const vault = await ctx.db
      .query("privateVault")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!vault) return null;

    return {
      encryptedMd: vault.encryptedMd ?? null,
      encryptedJson: vault.encryptedJson ?? null,
      iv: vault.iv ?? null,
      wrappedVaultKey: vault.wrappedVaultKey ?? null,
      vaultSalt: vault.vaultSalt ?? null,
      vaultKeyIv: vault.vaultKeyIv ?? null,
      createdAt: vault.createdAt ?? null,
      updatedAt: vault.updatedAt ?? null,
    };
  },
});
