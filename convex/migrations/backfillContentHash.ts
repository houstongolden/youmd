/**
 * Backfill migration: Compute contentHash for all existing bundles
 * and reconstruct parentHash ancestry chains.
 *
 * Run once after deploying the schema changes:
 *   npx convex run --prod migrations/backfillContentHash:backfill
 */

import { internalMutation } from "../_generated/server";
import { computeContentHash } from "../lib/hash";

export const backfill = internalMutation({
  handler: async (ctx) => {
    const bundles = await ctx.db.query("bundles").collect();
    let hashesComputed = 0;
    let parentLinksSet = 0;

    // Group bundles by userId for ancestry reconstruction
    const byUser: Record<string, typeof bundles> = {};
    for (const b of bundles) {
      const userId = b.userId as string;
      if (!byUser[userId]) byUser[userId] = [];
      byUser[userId].push(b);
    }

    for (const userId of Object.keys(byUser)) {
      const userBundles = byUser[userId];
      // Sort by version ascending for ancestry chain
      const sorted = [...userBundles].sort((a, b) => a.version - b.version);

      let prevHash: string | undefined;

      for (const bundle of sorted) {
        // Compute contentHash if missing
        if (!bundle.contentHash && bundle.youJson && bundle.youMd) {
          const hash = await computeContentHash(bundle.youJson, bundle.youMd);
          const updates: Record<string, unknown> = { contentHash: hash };

          // Set parentHash to previous version's hash (ancestry chain)
          if (prevHash && !bundle.parentHash) {
            updates.parentHash = prevHash;
            parentLinksSet++;
          }

          await ctx.db.patch(bundle._id, updates);
          prevHash = hash;
          hashesComputed++;
        } else if (bundle.contentHash) {
          // Already has a hash — use it as parent for the next
          prevHash = bundle.contentHash;
        }
      }
    }

    return {
      totalBundles: bundles.length,
      totalUsers: Object.keys(byUser).length,
      hashesComputed,
      parentLinksSet,
    };
  },
});
