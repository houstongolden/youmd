import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireOwner } from "./lib/auth";

// ── Ephemeral, zero-knowledge env handoffs ─────────────────────
//
// These let an owner move a project's `.env.local` from one of their
// machines to another without ever committing it to git. The ciphertext
// is encrypted CLIENT-SIDE (AES-256-GCM): the server never sees the
// plaintext or the decryption key. The access code is split into a
// lookup-id half (hashed to `codeHash` for storage) and a key half that
// never leaves the source machine. Retrieval requires BOTH the owner's
// vault-scoped API key AND the one-time expiring code.

const MAX_TTL_MINUTES = 24 * 60; // 24h ceiling
const MAX_READS = 10;
const MAX_CIPHERTEXT_BYTES = 256 * 1024; // 256KB of base64 ciphertext per project
const MAX_ACTIVE_HANDOFFS = 100;

function resolveUser(ctx: QueryCtx | MutationCtx, clerkId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
}

/** Create a handoff: store CLIENT-SIDE-encrypted ciphertext for one project. */
export const createEnvHandoff = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projectName: v.string(),
    codeHash: v.string(),
    ciphertext: v.string(),
    iv: v.string(),
    authTag: v.string(),
    varNames: v.array(v.string()),
    byteSize: v.number(),
    maxReads: v.number(),
    ttlMinutes: v.number(),
    clientName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await resolveUser(ctx, args.clerkId);
    if (!user) throw new Error("not authenticated");

    if (!args.codeHash || args.codeHash.length < 32) {
      throw new Error("invalid codeHash");
    }
    if (args.ciphertext.length > MAX_CIPHERTEXT_BYTES) {
      throw new Error("env payload too large");
    }

    const now = Date.now();
    const ttl = Math.max(1, Math.min(MAX_TTL_MINUTES, Math.floor(args.ttlMinutes || 60)));
    const reads = Math.max(1, Math.min(MAX_READS, Math.floor(args.maxReads || 1)));
    const expiresAt = now + ttl * 60_000;

    // Best-effort cleanup of this user's expired/consumed rows so the table
    // never accumulates dead secrets, and enforce an active-row ceiling.
    const existing = await ctx.db
      .query("envHandoffs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    let active = 0;
    for (const row of existing) {
      const dead = row.consumedAt != null || row.expiresAt < now || row.readCount >= row.maxReads;
      if (dead) {
        await ctx.db.delete(row._id);
      } else {
        active += 1;
      }
    }
    if (active >= MAX_ACTIVE_HANDOFFS) {
      throw new Error("too many active env handoffs — claim or let some expire first");
    }

    // A given code is unique; replace any prior row with the same hash.
    const clash = await ctx.db
      .query("envHandoffs")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .first();
    if (clash) await ctx.db.delete(clash._id);

    const id = await ctx.db.insert("envHandoffs", {
      userId: user._id,
      projectName: args.projectName.slice(0, 200),
      codeHash: args.codeHash,
      ciphertext: args.ciphertext,
      iv: args.iv,
      authTag: args.authTag,
      varNames: args.varNames.slice(0, 500).map((n) => n.slice(0, 200)),
      byteSize: args.byteSize,
      maxReads: reads,
      readCount: 0,
      expiresAt,
      createdAt: now,
      clientName: args.clientName?.slice(0, 120),
    });

    await ctx.db.insert("securityLogs", {
      eventType: "env_handoff_created",
      userId: user._id,
      details: { projectName: args.projectName, varCount: args.varNames.length, expiresAt, maxReads: reads },
      createdAt: now,
    });

    return { id, expiresAt, maxReads: reads };
  },
});

/** Claim a handoff by code hash. Burns the row after maxReads. */
export const claimEnvHandoff = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    codeHash: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await resolveUser(ctx, args.clerkId);
    if (!user) throw new Error("not authenticated");

    const row = await ctx.db
      .query("envHandoffs")
      .withIndex("by_codeHash", (q) => q.eq("codeHash", args.codeHash))
      .first();

    // Owner isolation: never reveal another user's handoff.
    if (!row || row.userId !== user._id) {
      throw new Error("HANDOFF_NOT_FOUND");
    }

    const now = Date.now();
    if (row.consumedAt != null || row.readCount >= row.maxReads) {
      await ctx.db.delete(row._id);
      throw new Error("HANDOFF_CONSUMED");
    }
    if (row.expiresAt < now) {
      await ctx.db.delete(row._id);
      throw new Error("HANDOFF_EXPIRED");
    }

    const nextReadCount = row.readCount + 1;
    if (nextReadCount >= row.maxReads) {
      // Burn after the final allowed read.
      await ctx.db.patch(row._id, { readCount: nextReadCount, consumedAt: now });
    } else {
      await ctx.db.patch(row._id, { readCount: nextReadCount });
    }

    await ctx.db.insert("securityLogs", {
      eventType: "env_handoff_claimed",
      userId: user._id,
      details: { projectName: row.projectName, readCount: nextReadCount, maxReads: row.maxReads },
      createdAt: now,
    });

    return {
      projectName: row.projectName,
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
      varNames: row.varNames,
      byteSize: row.byteSize,
      readsRemaining: Math.max(0, row.maxReads - nextReadCount),
    };
  },
});

/** List active handoffs — metadata only (NO ciphertext, NO values). */
export const listEnvHandoffs = query({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await resolveUser(ctx, args.clerkId);
    if (!user) throw new Error("not authenticated");

    const now = Date.now();
    const rows = await ctx.db
      .query("envHandoffs")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return rows
      .filter((r) => r.consumedAt == null && r.expiresAt >= now && r.readCount < r.maxReads)
      .map((r) => ({
        projectName: r.projectName,
        varNames: r.varNames,
        byteSize: r.byteSize,
        expiresAt: r.expiresAt,
        readsRemaining: Math.max(0, r.maxReads - r.readCount),
        createdAt: r.createdAt,
        clientName: r.clientName ?? null,
      }));
  },
});

/** Revoke (delete) every active handoff for a project, or all if no name. */
export const revokeEnvHandoffs = mutation({
  args: {
    clerkId: v.string(),
    _internalAuthToken: v.optional(v.string()),
    projectName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.clerkId, args._internalAuthToken);
    const user = await resolveUser(ctx, args.clerkId);
    if (!user) throw new Error("not authenticated");

    const rows = await ctx.db
      .query("envHandoffs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    let removed = 0;
    for (const row of rows) {
      if (args.projectName && row.projectName !== args.projectName) continue;
      await ctx.db.delete(row._id);
      removed += 1;
    }
    return { removed };
  },
});
