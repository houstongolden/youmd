/**
 * Convex cron schedules.
 *
 * Created cycle 50. Currently runs:
 *   - hourly: rateLimits table cleanup (delete rows older than 1 hour)
 *   - monthly: unclaimed public profile portrait/avatar QA
 *   - daily: due public-profile source metadata refresh
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

export default crons;
