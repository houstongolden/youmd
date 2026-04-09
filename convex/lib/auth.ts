/**
 * Auth helpers for Convex queries and mutations.
 *
 * CRITICAL SECURITY HISTORY:
 *
 * Cycles 37/38 added a `requireOwner` helper that allowed null identity
 * through, treating it as "admin/internal context". The intent was to
 * preserve `npx convex run` data cleanup tooling.
 *
 * Cycle 42 discovered this was EXPLOITABLE: any unauthenticated curl call
 * to `https://kindly-cassowary-600.convex.cloud/api/query` (or /api/mutation)
 * could pass any clerkId and read or write that user's private data,
 * encrypted vault, context links, etc. The function had no way to
 * distinguish "admin CLI with deploy key" from "anonymous public caller" —
 * both look like null identity inside the function.
 *
 * Cycle 42 fix: `requireOwner` is now STRICT — throws on null identity.
 *
 * Cycle 43 follow-up: Closing the cycle 42 hole broke httpAction routes
 * that authenticate via API key Bearer token (CLI, MCP, 3rd-party agents).
 * Those httpActions have no Clerk JWT, so the inner mutation's
 * `ctx.auth.getUserIdentity()` returns null and the call is rejected.
 *
 * Cycle 43 fix: `requireOwner` accepts an optional `internalAuthToken` arg.
 * If it matches the `TRUSTED_INTERNAL_AUTH_TOKEN` Convex env var (256-bit
 * random secret, set server-side via `npx convex env set`, never sent to
 * clients), the auth check is bypassed. This is safe because:
 *   1. The secret is server-side only (Convex env var, never in client bundles)
 *   2. 256 bits of entropy = unguessable
 *   3. Public `/api/query` and `/api/mutation` callers can pass any string,
 *      but they don't know the value
 *   4. The token never appears in returned data or error messages
 *   5. If the env var is unset, the bypass branch is dead code (the check
 *      requires both arg AND env to be non-empty AND equal)
 *
 * The httpAction routes pass `process.env.TRUSTED_INTERNAL_AUTH_TOKEN`
 * as `_internalAuthToken` in their args. Public mutations/queries accept
 * `_internalAuthToken: v.optional(v.string())` and forward it to `requireOwner`.
 *
 * This restores CLI/MCP/API-key flows while keeping the data leak fix intact.
 * `npx convex run` for these functions still requires Convex Dashboard access.
 */

import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";

/**
 * Verify that the caller is authorized to act on behalf of the given clerkId.
 *
 * STRICT: throws if no identity is present, UNLESS a valid internal auth
 * token is provided (used by httpActions that already authenticated via
 * API key Bearer token, or actions called via the bypass token).
 *
 * Cycle 46: now also accepts ActionCtx (in addition to QueryCtx/MutationCtx)
 * so chat.* actions can require auth.
 *
 * Returns the verified clerkId.
 */
export async function requireOwner(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  clerkId: string,
  internalAuthToken?: string
): Promise<string> {
  // Path 1: trusted internal call (httpAction with API key auth)
  // Both arg and env var must be set, non-empty, and exactly equal.
  // The env var is server-side only — public callers cannot guess it.
  const trustedToken = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;
  if (
    internalAuthToken &&
    trustedToken &&
    internalAuthToken.length >= 32 &&
    internalAuthToken === trustedToken
  ) {
    return clerkId;
  }

  // Path 2: end-user with Clerk JWT
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error(
      "authentication required: no Clerk identity. " +
        "If you're running data tooling, use the Convex Dashboard instead."
    );
  }
  if (identity.subject !== clerkId) {
    throw new Error(
      "not authorized: clerkId argument does not match authenticated user"
    );
  }
  return clerkId;
}
