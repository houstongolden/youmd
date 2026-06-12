/**
 * P23 — Idempotency-Key support for mutating HTTP endpoints
 * (PRODUCT-AUDIT #25).
 *
 * Contract (wired in convex/http.ts guardWrite):
 *   - A client sends `Idempotency-Key: <opaque string>` on a write.
 *   - First successful execution stores a response snapshot keyed on
 *     (subject = apiKeyId, route = "METHOD /path", keyHash = sha256(key)).
 *   - A repeat of the same key+route+subject within the TTL returns the
 *     stored snapshot verbatim with an `Idempotency-Replayed: true` header
 *     instead of re-executing the write.
 *
 * Storage rules:
 *   - TTL ~24h, enforced at READ time (creation-time filter). No cron:
 *     expired rows are simply ignored, and a new save for the same triple
 *     overwrites its expired (or stale) row, so the table stays one row per
 *     in-use (subject, route, key) triple.
 *   - Bodies above IDEMPOTENCY_MAX_BODY_CHARS are not stored (the write
 *     still succeeds — the request just isn't replayable).
 *   - Only snapshots the caller hands us are stored; http.ts only snapshots
 *     responses with status < 500 (5xx should re-execute on retry).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/** Replay window: snapshots older than this are ignored/overwritten. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Sanity cap on stored response bodies (chars ≈ bytes for JSON). */
export const IDEMPOTENCY_MAX_BODY_CHARS = 64_000;

/**
 * Look up a stored response snapshot. Returns null when absent or expired
 * (TTL is enforced here, not by deletion).
 */
export const getSnapshot = internalQuery({
  args: {
    subject: v.string(),
    route: v.string(),
    keyHash: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_subject_route_key", (q) =>
        q
          .eq("subject", args.subject)
          .eq("route", args.route)
          .eq("keyHash", args.keyHash)
      )
      .first();

    if (!row) return null;
    if (row.createdAt < Date.now() - IDEMPOTENCY_TTL_MS) return null;

    return { status: row.status, body: row.body };
  },
});

/**
 * Store (or overwrite) a response snapshot for replay. Oversized bodies are
 * rejected with { stored: false } — never throws, the original write already
 * succeeded.
 */
export const saveSnapshot = internalMutation({
  args: {
    subject: v.string(),
    route: v.string(),
    keyHash: v.string(),
    status: v.number(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.body.length > IDEMPOTENCY_MAX_BODY_CHARS) {
      return { stored: false, reason: "body_too_large" as const };
    }

    const existing = await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_subject_route_key", (q) =>
        q
          .eq("subject", args.subject)
          .eq("route", args.route)
          .eq("keyHash", args.keyHash)
      )
      .first();

    if (existing) {
      // Overwrite expired/stale rows in place — keeps the table at one row
      // per triple without needing a cleanup cron.
      await ctx.db.patch(existing._id, {
        status: args.status,
        body: args.body,
        createdAt: Date.now(),
      });
      return { stored: true, overwrote: true };
    }

    await ctx.db.insert("idempotencyKeys", {
      subject: args.subject,
      route: args.route,
      keyHash: args.keyHash,
      status: args.status,
      body: args.body,
      createdAt: Date.now(),
    });
    return { stored: true, overwrote: false };
  },
});
