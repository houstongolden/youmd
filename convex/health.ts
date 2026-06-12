/**
 * T13 — health endpoint dependency probe (TECH-STACK-AUDIT).
 *
 * The cheapest possible database read: first row (or none) of the users
 * table via the default index. GET /api/v1/health (convex/http.ts) runs
 * this; if it throws, the endpoint reports 503 so the scheduled smoke
 * workflow alerts on a broken database path, not just a dead deployment.
 */
import { internalQuery } from "./_generated/server";

export const probe = internalQuery({
  args: {},
  handler: async (ctx) => {
    await ctx.db.query("users").first();
    return { ok: true };
  },
});
