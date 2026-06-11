/**
 * API-key scope vocabulary + legacy-key classification.
 *
 * Cycle 57 (audit 2026-06-11 finding #1): scopes were stored on apiKeys but
 * never enforced — any key, regardless of scopes, could read private context
 * and write the bundle. Enforcement lives in convex/http.ts (`requireScope`);
 * this module owns the vocabulary and the "which keys are grandfathered"
 * decision so apiKeys.ts and http.ts agree.
 *
 * Scope semantics:
 *   read:public    — read public profiles/bundles (public endpoints need no
 *                    key at all; this is the minimum scope a key can hold)
 *   read:private   — read the owner's private surfaces (/me, /me/private,
 *                    memories, history, activity, repo mirror, MCP my-identity)
 *   write:bundle   — mutate owned identity content (bundle save/publish/
 *                    rollback, portrait, sources, pipeline build, private
 *                    context writes, skill installs)
 *   write:memories — append/save memories
 *   vault          — read/write the encrypted vault
 */
export const API_SCOPES = [
  "read:public",
  "read:private",
  "write:bundle",
  "write:memories",
  "vault",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isKnownScope(scope: string): scope is ApiScope {
  return (API_SCOPES as readonly string[]).includes(scope);
}

/**
 * When scope enforcement shipped. Keys created before this moment were issued
 * while scopes were decorative — every creation path (CLI login "cli-auth"
 * keys, the settings UI, POST /api/v1/me/api-keys default) hardcoded
 * ["read:public"] yet the keys were used for full read/write. Enforcing
 * retroactively would brick every existing CLI session, so pre-epoch keys are
 * grandfathered to full access with a logged `scope_missing` activity event
 * (so usage can be measured before tightening — see FEATURE-ROADMAP §1).
 */
export const SCOPE_ENFORCEMENT_EPOCH = Date.UTC(2026, 5, 12); // 2026-06-12T00:00:00Z

/**
 * A key is "legacy grandfathered" (treated as scope-less full access, with
 * scope_missing telemetry) when:
 *  - it has no scopes at all (defensive: pre-schema docs), or
 *  - it was created before enforcement shipped (see epoch above), or
 *  - it is a "cli-auth" login session key. convex/auth.ts still hardcodes
 *    scopes: ["read:public"] for these even though they are the owner's own
 *    session credential (the user never chose read-only). Until the login
 *    flow issues real owner scopes, enforcing would break `youmd push` for
 *    every new login. Remove this carve-out once auth.ts issues full scopes.
 */
export function isLegacyGrandfatheredKey(key: {
  scopes?: string[] | null;
  createdAt: number;
  label?: string | null;
}): boolean {
  if (!key.scopes || key.scopes.length === 0) return true;
  if (key.createdAt < SCOPE_ENFORCEMENT_EPOCH) return true;
  if (key.label === "cli-auth") return true;
  return false;
}
