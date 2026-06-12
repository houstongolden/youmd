/**
 * P17 (PRODUCT-AUDIT #19) — pure helpers for the debounced GitHub auto-push
 * and the mirror ancestry/staleness check.
 *
 * Kept dependency-free (no convex imports) so they are trivially unit-testable
 * and shareable between the mutation layer (convex/github.ts) and the push
 * action (convex/githubAutoPush.ts).
 */

/** Saves within this window after a scheduled push do not schedule another. */
export const GITHUB_PUSH_DEBOUNCE_MS = 60_000;

/** Backoff before the single retry after a failed auto-push. */
export const AUTO_PUSH_RETRY_DELAY_MS = 30_000;

/** Max retries after the initial attempt (attempt 0 → one retry at attempt 1). */
export const AUTO_PUSH_MAX_RETRIES = 1;

/**
 * Debounce gate: a push is already scheduled and has not run yet, so a new
 * save must NOT schedule another one. Self-healing: once the pending run time
 * passes (push ran, or crashed without clearing the marker), saves schedule
 * again — no permanently wedged connections.
 */
export function shouldDebounceAutoPush(
  pendingPushAt: number | undefined | null,
  now: number
): boolean {
  return typeof pendingPushAt === "number" && pendingPushAt > now;
}

/**
 * Ancestry check: the mirror/repo head moved past the commit we last pushed
 * (manual user pushes count). Only meaningful when both shas are known —
 * a connection that never pushed has no ancestry anchor to diverge from.
 */
export function hasMirrorDiverged(
  lastPushedCommitSha: string | undefined | null,
  headSha: string | undefined | null
): boolean {
  return !!lastPushedCommitSha && !!headSha && lastPushedCommitSha !== headSha;
}

/**
 * Read-time staleness: the connection is flagged stale, or the mirrored head
 * sha diverged from the push-time ancestry anchor.
 */
export function isMirrorStale(
  conn:
    | { mirrorStale?: boolean; lastPushedCommitSha?: string | null }
    | null
    | undefined,
  mirrorHeadSha: string | undefined | null
): boolean {
  if (!conn) return false;
  return (
    conn.mirrorStale === true ||
    hasMirrorDiverged(conn.lastPushedCommitSha, mirrorHeadSha)
  );
}
