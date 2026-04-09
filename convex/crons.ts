/**
 * Convex cron schedules.
 *
 * Created cycle 50. Currently runs:
 *   - hourly: rateLimits table cleanup (delete rows older than 1 hour)
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
// the 60-second sliding window used by the rate-limit checks).
crons.hourly(
  "cleanup stale rate limit rows",
  { minuteUTC: 17 }, // arbitrary minute offset to avoid the top-of-hour spike
  internal.lib.rateLimit.cleanupOldRateLimits,
  { maxAgeMs: 60 * 60 * 1000 } // 1 hour
);

export default crons;
