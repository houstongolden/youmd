/**
 * Auth helpers for Convex queries and mutations.
 *
 * Background: most mutations in this codebase historically take a
 * `clerkId: v.string()` argument and use it to look up the user in the DB.
 * This is INSECURE on its own — anyone can pass any clerkId and read or
 * modify another user's data. The Convex runtime validates the Clerk JWT
 * (via auth.config.ts) but the functions never USED the verified identity.
 *
 * `requireOwner()` fixes this by:
 *   1. Reading the verified Clerk identity from `ctx.auth.getUserIdentity()`
 *   2. Verifying it matches the provided `clerkId` argument
 *   3. Throwing if there's a mismatch
 *
 * Admin context (CLI `npx convex run`, internal calls) is allowed because
 * `ctx.auth.getUserIdentity()` returns null in those contexts. This keeps
 * data-cleanup tooling working without weakening end-user authentication.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Verify that the caller is authorized to act on behalf of the given clerkId.
 *
 * - End-user calls (with verified Clerk JWT): `identity.subject` must equal
 *   the provided `clerkId`. Throws on mismatch.
 * - Admin/internal calls (no JWT, e.g. `npx convex run`): allowed.
 *
 * Returns the verified clerkId (the same value, but you should use the
 * return value instead of `args.clerkId` going forward to make the chain
 * of trust explicit at the call site).
 */
export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
  clerkId: string
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  // Admin context: identity is null, allow the call
  if (!identity) return clerkId;
  // End-user context: subject must match the provided clerkId
  if (identity.subject !== clerkId) {
    throw new Error(
      "not authorized: clerkId argument does not match authenticated user"
    );
  }
  return clerkId;
}
