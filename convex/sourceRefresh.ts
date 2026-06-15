import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const REFRESH_INTERVAL_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

function nextRefreshAt(policy: string | undefined, from: number): number | undefined {
  if (!policy || policy === "manual") return undefined;
  const interval = REFRESH_INTERVAL_MS[policy];
  return interval ? from + interval : undefined;
}

export const markDueSourcesPending = internalMutation({
  args: {
    now: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    const due = await ctx.db
      .query("sources")
      .withIndex("by_nextRefreshAt", (q) => q.lte("nextRefreshAt", now))
      .take(limit);

    let marked = 0;
    let skipped = 0;

    for (const source of due) {
      if (!source.nextRefreshAt || source.nextRefreshAt > now) {
        skipped += 1;
        continue;
      }
      if (source.refreshPolicy === "manual") {
        skipped += 1;
        continue;
      }
      if (source.status === "fetching" || source.status === "extracting") {
        skipped += 1;
        continue;
      }

      const next = nextRefreshAt(source.refreshPolicy, now);
      await ctx.db.patch(source._id, {
        status: "pending",
        nextRefreshAt: next,
      });
      marked += 1;
    }

    return { marked, skipped, checked: due.length };
  },
});
