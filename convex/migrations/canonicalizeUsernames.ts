/**
 * Canonicalize usernames migration (P30 / PRODUCT-AUDIT #38, ROADMAP 3.13).
 *
 * Usernames were historically stored with mixed casing/whitespace, which
 * forced public profile lookups into a `.take(500)` case-insensitive
 * fallback scan. This migration rewrites every stored username in the
 * `users` and `profiles` tables to the canonical form (lowercase, trimmed —
 * `canonicalUsername`) so the `by_username` index alone resolves lookups.
 *
 * Collision safety: if canonicalizing a username would create a duplicate
 * (two accounts that differ only by case/whitespace), the OLDER account
 * keeps — or takes — the canonical form and every younger conflicting
 * account is left completely untouched: it stays reachable by its stored
 * casing until manually resolved. Nothing is merged, renamed sideways, or
 * deleted. All skipped conflicts are logged via console.warn and returned
 * in the migration report.
 *
 * Idempotent: re-running scans again, finds nothing non-canonical (except
 * still-unresolved conflicts, which are re-reported), and changes nothing.
 *
 * Run once after deploy:
 *   npx convex run --prod migrations/canonicalizeUsernames:canonicalize
 */

import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canonicalUsername } from "../lib/profileDirectory";

const BATCH_SIZE = 200;

type UsernameTable = "users" | "profiles";

interface DocRef {
  id: string;
  username: string;
  createdAt: number;
}

interface Conflict {
  table: UsernameTable;
  skippedId: string;
  skippedUsername: string;
  canonical: string;
  keptId: string;
  keptUsername: string;
  reason: string;
}

interface TableReport {
  scanned: number;
  canonicalized: number;
  conflicts: Conflict[];
}

async function canonicalizeTable(
  ctx: MutationCtx,
  table: UsernameTable
): Promise<TableReport> {
  // Pass 1: walk the whole table in batches. Track which canonical
  // usernames are already held exactly (oldest holder wins for conflict
  // attribution) and collect every doc whose stored username is not
  // canonical.
  const exactHolders = new Map<string, DocRef>();
  const candidates: Array<DocRef & { canonical: string }> = [];
  let scanned = 0;
  let cursor: string | null = null;

  for (;;) {
    const page = await ctx.db
      .query(table)
      .paginate({ cursor, numItems: BATCH_SIZE });

    for (const doc of page.page) {
      scanned++;
      const stored = String(doc.username ?? "");
      const canonical = canonicalUsername(stored);
      if (!canonical) continue;

      const createdAt =
        typeof doc.createdAt === "number" ? doc.createdAt : doc._creationTime;
      const ref: DocRef = { id: doc._id, username: stored, createdAt };

      if (stored === canonical) {
        const existing = exactHolders.get(canonical);
        if (!existing || createdAt < existing.createdAt) {
          exactHolders.set(canonical, ref);
        }
      } else {
        candidates.push({ ...ref, canonical });
      }
    }

    if (page.isDone) break;
    cursor = page.continueCursor;
  }

  // Pass 2: group non-canonical docs by their canonical form, then rewrite
  // the oldest in each group (if the canonical form is free) and report the
  // rest as conflicts without touching them.
  const byCanonical = new Map<string, Array<DocRef & { canonical: string }>>();
  for (const candidate of candidates) {
    const group = byCanonical.get(candidate.canonical) ?? [];
    group.push(candidate);
    byCanonical.set(candidate.canonical, group);
  }

  let canonicalized = 0;
  const conflicts: Conflict[] = [];

  for (const [canonical, group] of Array.from(byCanonical.entries())) {
    group.sort((a, b) => a.createdAt - b.createdAt);
    let kept = exactHolders.get(canonical) ?? null;

    for (const candidate of group) {
      if (!kept) {
        // Canonical form is free — the oldest variant claims it.
        if (table === "users") {
          await ctx.db.patch(candidate.id as Id<"users">, { username: canonical });
        } else {
          await ctx.db.patch(candidate.id as Id<"profiles">, { username: canonical });
        }
        canonicalized++;
        kept = { id: candidate.id, username: canonical, createdAt: candidate.createdAt };
        continue;
      }

      // Canonical form is taken — skip this account entirely (it stays
      // reachable by its stored casing) and report the conflict.
      const conflict: Conflict = {
        table,
        skippedId: candidate.id,
        skippedUsername: candidate.username,
        canonical,
        keptId: kept.id,
        keptUsername: kept.username,
        reason:
          candidate.createdAt < kept.createdAt
            ? "canonical form already held by an exact-match account; older variant left at stored casing"
            : "older account kept the canonical form; younger variant left at stored casing",
      };
      conflicts.push(conflict);
      console.warn(
        `[canonicalizeUsernames] collision in ${table}: ` +
          `"${candidate.username}" (${candidate.id}) lowers to "${canonical}" ` +
          `held by "${kept.username}" (${kept.id}) — skipped, not modified`
      );
    }
  }

  return { scanned, canonicalized, conflicts };
}

export const canonicalize = internalMutation({
  handler: async (ctx) => {
    const users = await canonicalizeTable(ctx, "users");
    const profiles = await canonicalizeTable(ctx, "profiles");

    return {
      users: { scanned: users.scanned, canonicalized: users.canonicalized },
      profiles: {
        scanned: profiles.scanned,
        canonicalized: profiles.canonicalized,
      },
      conflicts: [...users.conflicts, ...profiles.conflicts],
    };
  },
});
