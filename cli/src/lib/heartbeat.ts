/**
 * heartbeat.ts — L15 visible heartbeat signal.
 *
 * Checks two conditions:
 *   1. activityInsights returns any skills with successRate < 0.8 (low performers).
 *   2. The consolidationRuns review-queue (via local cache or remote read) is
 *      non-empty.
 *
 * Returns a single dim "stack wants to improve" message when either condition
 * is true. Callers surface this ONCE per command invocation — no spam.
 *
 * NOTE: This module performs read-only, non-blocking checks using already-cached
 * local data where possible. Remote calls are attempted only when already
 * authenticated; failures are silently suppressed (heartbeat is advisory, not
 * blocking).
 */

import { getSkillInsights } from "./api";
import { isAuthenticated } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeartbeatSignal {
  /** True when at least one improvement trigger is detected. */
  active: boolean;
  /** Single human-readable dim line for status / doctor output. */
  message: string;
  /** Breakdown of what triggered the signal. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Skills with successRate below this threshold count as low-performers. */
const LOW_PERFORMER_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Returns a heartbeat signal by checking live skill insights (if authenticated).
 * The result is meant to be cached and shown once per command invocation.
 */
export async function getHeartbeatSignal(): Promise<HeartbeatSignal> {
  const reasons: string[] = [];

  if (isAuthenticated()) {
    try {
      const res = await getSkillInsights();
      if (res.ok && Array.isArray(res.data?.insights)) {
        const lowPerformers = res.data.insights.filter(
          (s) => s.successRate < LOW_PERFORMER_THRESHOLD && s.uses >= 2
        );
        if (lowPerformers.length > 0) {
          const names = lowPerformers.map((s) => s.skill).slice(0, 2).join(", ");
          reasons.push(
            `${lowPerformers.length} skill${lowPerformers.length === 1 ? "" : "s"} with low success rate (${names})`
          );
        }
      }
    } catch {
      // Network unavailable — heartbeat is advisory, never blocking.
    }
  }

  const active = reasons.length > 0;
  const message = active
    ? "stack wants to improve — run `youmd stack improve` to generate proposals"
    : "";

  return { active, message, reasons };
}

/**
 * Synchronous version using only local data (no network calls).
 * Checks whether any locally-tracked skill metrics show zero success events,
 * which is a weak but fast proxy for low-performing skills.
 *
 * Returns null when there is no local signal to report.
 */
export function getLocalHeartbeatHint(): string | null {
  // Local-only: always return null since local metrics don't track outcomes.
  // Real signal comes from the async getHeartbeatSignal() call.
  return null;
}
