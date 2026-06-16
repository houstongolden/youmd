/**
 * Convex cron schedules.
 *
 * Created cycle 50. Currently runs:
 *   - hourly: rateLimits table cleanup (delete rows older than 1 hour)
 *   - monthly: unclaimed public profile portrait/avatar QA
 *   - daily: due public-profile source metadata refresh
 *   - hourly: due owner-connected source refresh marking
 *
 * Add new crons here as needed. Each entry runs in the Convex scheduler
 * — there's no separate cron daemon to manage.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cycle 50: cleanup stale rateLimits rows.
//
// The rateLimits table (cycle 46) inserts one row per call to a rate-limited
// endpoint and queries them within a sliding 60-second window. Rows older
// than the window are dead weight. Without cleanup the table grows
// unboundedly — at 30 calls/min sustained from one IP that's ~43k rows/day,
// across many IPs it grows fast.
//
// This cron runs every hour and deletes rows older than 1 hour (well outside
// the 60-second sliding window used by the rate-limit checks). The mutation
// deletes in bounded take(1000) batches via the by_timestamp index and
// self-reschedules until the backlog is drained (audit 2026-06-11 P0 #8).
crons.hourly(
  "cleanup stale rate limit rows",
  { minuteUTC: 17 }, // arbitrary minute offset to avoid the top-of-hour spike
  internal.lib.rateLimit.cleanupOldRateLimits,
  { maxAgeMs: 60 * 60 * 1000 } // 1 hour
);

// Public profile directory guardrail.
//
// The action resolves durable avatar URLs and fills missing ASCII portraits for
// unclaimed seeded profiles. It skips existing portraits unless the resolved
// avatar changed, so the monthly cron is cheap in steady state.
crons.monthly(
  "refresh unclaimed profile portraits",
  { day: 9, hourUTC: 10, minuteUTC: 41 },
  internal.seed.enrichAndQaAllProfiles,
  { dryRun: false, forceRegenerate: false }
);

crons.daily(
  "refresh due public profile sources",
  { hourUTC: 10, minuteUTC: 55 },
  internal.profileIndexing.fetchDueProfileSources,
  { dryRun: false, limit: 50 }
);

// Personal connector refresh marker.
//
// Cheap by design: this does not run browser automation, Firecrawl, Apify, or
// LLM extraction by itself. It only marks due owner-connected sources as
// `pending` and advances their nextRefreshAt. The existing pipeline runner or
// a future approval-aware crawler worker performs the expensive work.
crons.hourly(
  "mark due personal sources pending",
  { minuteUTC: 47 },
  internal.sourceRefresh.markDueSourcesPending,
  { limit: 100 }
);

// Loop Reports foundation.
//
// Runs due owner-approved report definitions. The first implementation is a
// deterministic daily briefing from You.md-owned data; expensive external
// providers (Perplexity, Google, BAMF, Bad.app, weather/surf/school crawlers)
// remain adapter-gated follow-ups.
crons.hourly(
  "run due loop reports",
  { minuteUTC: 53 },
  internal.loopReports.runDueLoopReports,
  { limit: 25 }
);

// L19 — Nightly dreaming loop (deterministic v1, no LLM).
//
// Pages through all users in batches and runs a deterministic consolidation
// pass for each: exact-duplicate hash-collision sweep (sets supersededBy),
// and stale-ephemeral demotion (sets isArchived) for non-durable categories
// only.  Pinned memories, durable categories (preference/decision/goal/fact),
// and corrections are NEVER touched.  Each user run is idempotent per
// (userId, UTC date) — a second run on the same day is a no-op.
// 09:00 UTC = 2am PT (summer) / 1am PT (winter).
crons.daily(
  "nightly memory consolidation",
  { hourUTC: 9, minuteUTC: 0 },
  internal.consolidation.nightlyConsolidation,
  {}
);

// L20 — Weekly fleet aggregation (k-anon ≥ 20).
//
// Runs all fleet aggregate queries (category distribution, skill install
// counts, avg memories per active user) and writes a single fleetReports
// row.  Every aggregate is gated by kAnonBucket — results from fewer than
// 20 distinct contributing users are suppressed (null).  No usernames,
// userId strings, or content strings are stored in the written row.
crons.weekly(
  "weekly fleet aggregation",
  { dayOfWeek: "sunday", hourUTC: 10, minuteUTC: 0 },
  internal.fleet.weeklyFleetAggregation,
  {}
);

// L24 — Weekly maintainer agent mining stack journals.
//
// Pages every user, reads their repo mirror's stacks/<slug>/journal/ files,
// counts skill-name tokens that appear in failure-mentioning entries, and
// writes one maintainerProposals row per (stack, skill) pattern when the
// failure threshold is met (and flags proposedForRegistry above the
// cross-stack threshold).
crons.weekly(
  "weekly maintainer journal mining",
  { dayOfWeek: "monday", hourUTC: 10, minuteUTC: 30 },
  internal.maintainer.weeklyMaintainerMine,
  {}
);

export default crons;
