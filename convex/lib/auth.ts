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
 * This means:
 *   - End-user clients (with Clerk JWT): work as expected
 *   - HTTP routes that call mutations from authenticated httpAction: BREAK
 *     unless they pass an identity. They should be refactored to use
 *     internalMutation/internalQuery wrappers, OR pass the JWT through.
 *   - `npx convex run`: BREAKS for these functions. Use the Convex Dashboard
 *     for ad-hoc data operations going forward.
 *
 * The trade-off (lose admin CLI for security-critical functions) is
 * acceptable because the alternative was a complete data leak/write
 * vulnerability.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Verify that the caller is authorized to act on behalf of the given clerkId.
 *
 * STRICT: throws if no identity is present. The previous "allow null"
 * behavior was exploitable by anonymous public callers.
 *
 * Returns the verified clerkId.
 */
export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<string> {
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
