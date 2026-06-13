/**
 * brainScopes — server-cron consent vocabulary (L26 readiness audit).
 *
 * These scopes are distinct from API_SCOPES (convex/lib/scopes.ts), which gate
 * HTTP/MCP access. brainScopes describe what server crons are allowed to do with
 * a user's data autonomously. Consent is stored in the userConsents table and
 * checked before each cron processes a user.
 *
 * Scope semantics:
 *   consolidate   — server can run nightly memory consolidation for this user (L19)
 *   fleet_aggregate — this user's data may contribute to k-anon fleet aggregates (L20)
 *   journal_mine  — server can mine this user's stack journals into proposals (L24)
 *
 * Default: GRANTED for all scopes (existing users are unaffected).
 * A user revokes via a future API; this module owns the vocabulary + defaults.
 */

export const BRAIN_SCOPES = [
  "consolidate",
  "fleet_aggregate",
  "journal_mine",
] as const;

export type BrainScope = (typeof BRAIN_SCOPES)[number];

/**
 * True when scope is a member of BRAIN_SCOPES.
 */
export function isKnownBrainScope(scope: string): scope is BrainScope {
  return (BRAIN_SCOPES as readonly string[]).includes(scope);
}

/**
 * Default consent state for all brainScopes.
 * All true: existing users retain current cron behavior with no migration needed.
 * A future revoke API writes a userConsents row with granted=false.
 */
export const DEFAULT_CONSENT: Record<BrainScope, boolean> = {
  consolidate: true,
  fleet_aggregate: true,
  journal_mine: true,
};
