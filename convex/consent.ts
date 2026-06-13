/**
 * L26 — brainScope server-cron consent primitives.
 *
 * getConsent / setConsent / hasConsent are the three-function surface that
 * crons import. The design is intentionally thin: a userConsents row is the
 * override; absence means default-grant (all true). This matches the opt-OUT
 * model described in the L26 readiness audit — existing users keep working
 * with zero migration.
 *
 * Do NOT import this module from public HTTP routes. These are internal-only
 * helpers for cron guards.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel } from "./_generated/dataModel";
import type { Id } from "./_generated/dataModel";
import { BRAIN_SCOPES, DEFAULT_CONSENT, isKnownBrainScope } from "./lib/brainScopes";
import type { BrainScope } from "./lib/brainScopes";

// Re-export so callers can import scope helpers from a single place.
export { BRAIN_SCOPES, DEFAULT_CONSENT, isKnownBrainScope };
export type { BrainScope };

// ── internalQuery: getConsent ─────────────────────────────────────────────────

/**
 * Returns the effective consent for (userId, scope).
 * If no userConsents row exists, falls back to DEFAULT_CONSENT[scope] (true).
 * Throws if scope is not a known brainScope.
 */
export const getConsent = internalQuery({
  args: { userId: v.id("users"), scope: v.string() },
  handler: async (ctx, { userId, scope }) => {
    if (!isKnownBrainScope(scope)) {
      throw new Error(`Unknown brainScope: ${scope}`);
    }
    const row = await ctx.db
      .query("userConsents")
      .withIndex("by_userId_scope", (q) =>
        q.eq("userId", userId).eq("scope", scope)
      )
      .first();
    return row !== null ? row.granted : DEFAULT_CONSENT[scope];
  },
});

// ── internalMutation: setConsent ──────────────────────────────────────────────

/**
 * Upserts a userConsents row for (userId, scope).
 * Throws if scope is not a known brainScope.
 */
export const setConsent = internalMutation({
  args: { userId: v.id("users"), scope: v.string(), granted: v.boolean() },
  handler: async (ctx, { userId, scope, granted }) => {
    if (!isKnownBrainScope(scope)) {
      throw new Error(`Unknown brainScope: ${scope}`);
    }
    const existing = await ctx.db
      .query("userConsents")
      .withIndex("by_userId_scope", (q) =>
        q.eq("userId", userId).eq("scope", scope)
      )
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { granted, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert("userConsents", { userId, scope, granted, updatedAt: now });
  },
});

// ── hasConsent helper (call-site convenience) ─────────────────────────────────

/**
 * Inline consent check suitable for use inside internalMutation / internalAction
 * handlers. Reads the userConsents table directly (no ctx.runQuery hop needed).
 *
 * Returns true when the user has granted (or has no row for) this scope.
 */
export async function hasConsent(
  ctx: GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>,
  userId: Id<"users">,
  scope: BrainScope
): Promise<boolean> {
  const row = await ctx.db
    .query("userConsents")
    .withIndex("by_userId_scope", (q) =>
      q.eq("userId", userId).eq("scope", scope)
    )
    .first();
  return row !== null ? row.granted : DEFAULT_CONSENT[scope];
}
