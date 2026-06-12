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

/**
 * Full owner scopes, issued to keys that ARE the owner's own credential
 * (the "cli-auth" login session key minted by convex/auth.ts). The owner
 * never chose a narrowed grant for their own session, so these keys get
 * the complete vocabulary. Third-party/agent keys should request only the
 * scopes they need via createKey / POST /api/v1/me/api-keys.
 */
export const OWNER_SESSION_SCOPES: ApiScope[] = [...API_SCOPES];

/**
 * Default scope selection the settings UI offers when the owner creates a
 * key for themselves: everything except `vault` (vault access is sensitive
 * enough that it must be opted into explicitly).
 */
export const DEFAULT_OWNER_KEY_SCOPES: ApiScope[] = [
  "read:public",
  "read:private",
  "write:bundle",
  "write:memories",
];

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
 *  - it was created before enforcement shipped (see epoch above).
 *
 * P36: the old `label === "cli-auth"` carve-out is gone. convex/auth.ts now
 * issues OWNER_SESSION_SCOPES (full owner scopes) for login session keys, so
 * new logins carry real scopes and are enforced like any other key. Pre-epoch
 * cli-auth keys remain grandfathered via the epoch rule above — existing
 * logged-in CLI sessions keep working unchanged.
 */
export function isLegacyGrandfatheredKey(key: {
  scopes?: string[] | null;
  createdAt: number;
  label?: string | null;
}): boolean {
  if (!key.scopes || key.scopes.length === 0) return true;
  if (key.createdAt < SCOPE_ENFORCEMENT_EPOCH) return true;
  return false;
}
