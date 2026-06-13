/**
 * L24 — Scheduled maintainer agent mining stack journals.
 * L25 — Cross-stack registry candidates query.
 *
 * L24 mines journal entries stored under stacks/<slug>/journal/ in the
 * user's repo mirror and detects a "failure_pattern": 3+ journal entries for
 * the same stack that each contain the same skill-name token and the word
 * "failure". When evidenceCount >= 5, the proposal is also flagged as a
 * cross-stack registry candidate (L25).
 *
 * L25 exposes listPendingRegistryCandidates to surface proposals that have
 * crossed the cross-stack signal threshold and are awaiting human review.
 *
 * Pattern detection: plain string matching, no LLM.
 *
 * Runs weekly (Mondays 10:30 UTC) via convex/crons.ts.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum failure-mention count in a single stack's journals to emit a
 * maintainerProposal for that skill.
 */
const FAILURE_PATTERN_THRESHOLD = 3;

/**
 * Minimum evidenceCount at which a proposal is flagged proposedForRegistry=true
 * (cross-stack signal threshold, L25).
 */
const REGISTRY_CANDIDATE_THRESHOLD = 5;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all word-like tokens from a Markdown body that could be skill names.
 * We treat any token of the shape [a-z][a-z0-9-]+ (2-40 chars, kebab-case) as
 * a potential skill name — the same convention used by YouStack manifests.
 */
function extractSkillNameTokens(body: string): string[] {
  const matches = body.match(/\b[a-z][a-z0-9-]{1,39}\b/g);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Return true when a journal entry body mentions "failure" (case-insensitive).
 */
function mentionsFailure(body: string): boolean {
  return /failure/i.test(body);
}

// ── L24 — listJournalEntries ─────────────────────────────────────────────────

/**
 * Read stacks/<slug>/journal/ Markdown files from the user's repo mirror.
 * Returns a flat list of { stackSlug, entryPath, body } for every file whose
 * path matches stacks/<slug>/journal/*.md.
 */
export const listJournalEntries = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const mirror = await ctx.db
      .query("repoMirror")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!mirror) return [];

    const results: { stackSlug: string; entryPath: string; body: string }[] = [];

    for (const file of mirror.files) {
      const m = file.path.match(/^stacks\/([^/]+)\/journal\/(.+\.md)$/);
      if (!m) continue;
      results.push({
        stackSlug: m[1],
        entryPath: file.path,
        body: file.content,
      });
    }

    return results;
  },
});

// ── L24 — writeProposal (internal mutation) ──────────────────────────────────

/**
 * Upsert a maintainerProposal row. If an open proposal for the same
 * (userId, stackSlug, skillName, patternType) already exists, update its
 * evidenceCount and proposedForRegistry flag. Otherwise insert a new row.
 */
export const _writeProposal = internalMutation({
  args: {
    userId: v.id("users"),
    stackSlug: v.string(),
    skillName: v.string(),
    evidenceCount: v.number(),
    proposedForRegistry: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("maintainerProposals")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("stackSlug"), args.stackSlug),
          q.eq(q.field("skillName"), args.skillName),
          q.eq(q.field("patternType"), "failure_pattern"),
          q.eq(q.field("status"), "open")
        )
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        evidenceCount: args.evidenceCount,
        proposedForRegistry: args.proposedForRegistry,
      });
      return existing._id;
    }

    return await ctx.db.insert("maintainerProposals", {
      userId: args.userId,
      stackSlug: args.stackSlug,
      skillName: args.skillName,
      patternType: "failure_pattern",
      evidenceCount: args.evidenceCount,
      status: "open",
      proposedForRegistry: args.proposedForRegistry,
      humanApprovalState: "pending",
      createdAt: Date.now(),
    });
  },
});

// ── L24 — mineStackJournals ──────────────────────────────────────────────────

/**
 * For each stack in the user's repo mirror:
 *   1. Collect all journal entries that mention "failure".
 *   2. For each skill-name token that appears in 3+ of those entries,
 *      emit a maintainerProposal (failure_pattern).
 *   3. Set proposedForRegistry=true when evidenceCount >= 5 (L25 gate).
 *
 * Pattern detection is plain string matching — no LLM.
 * Returns the count of proposals written (inserts + updates).
 */
export const mineStackJournals = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ proposalsWritten: number; consent_skipped?: number }> => {
    // L26 brainScope consent gate: skip if the user has revoked "journal_mine".
    // Default-grant means existing users are unaffected (no userConsents row → granted=true).
    const consentGranted: boolean = await ctx.runQuery(
      internal.consent.getConsent,
      { userId, scope: "journal_mine" }
    );
    if (!consentGranted) {
      return { proposalsWritten: 0, consent_skipped: 1 };
    }

    const entries: { stackSlug: string; entryPath: string; body: string }[] =
      await ctx.runQuery(internal.maintainer.listJournalEntries, { userId });

    if (entries.length === 0) return { proposalsWritten: 0 };

    // Group entries by stackSlug, keep only those mentioning "failure".
    const bySlug = new Map<string, string[]>();
    for (const e of entries) {
      if (!mentionsFailure(e.body)) continue;
      const existing = bySlug.get(e.stackSlug) ?? [];
      existing.push(e.body);
      bySlug.set(e.stackSlug, existing);
    }

    let proposalsWritten = 0;

    for (const [stackSlug, failureBodies] of Array.from(bySlug.entries())) {
      // Count how many failure entries contain each skill-name token.
      const tokenCounts = new Map<string, number>();
      for (const body of failureBodies) {
        const tokens = extractSkillNameTokens(body);
        for (const token of tokens) {
          tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
        }
      }

      // Emit a proposal for each token that meets the failure threshold.
      for (const [skillName, count] of Array.from(tokenCounts.entries())) {
        if (count < FAILURE_PATTERN_THRESHOLD) continue;

        const proposedForRegistry = count >= REGISTRY_CANDIDATE_THRESHOLD;
        await ctx.runMutation(internal.maintainer._writeProposal, {
          userId,
          stackSlug,
          skillName,
          evidenceCount: count,
          proposedForRegistry,
        });
        proposalsWritten++;
      }
    }

    return { proposalsWritten };
  },
});

// ── Weekly orchestrator (cron entry point) ──────────────────────────────────

const PAGE_SIZE = 50;

/**
 * Pages through every user and runs mineStackJournals per user. Weekly cron
 * entry point — keep the per-user step cheap (read mirror + write proposals).
 */
export const weeklyMaintainerMine = internalAction({
  args: {},
  handler: async (ctx) => {
    let skip = 0;
    let usersProcessed = 0;
    let proposalsWritten = 0;
    for (;;) {
      const userIds: Id<"users">[] = await ctx.runQuery(
        internal.consolidation._listUserIds,
        { pageSize: PAGE_SIZE, skip }
      );
      if (userIds.length === 0) break;
      for (const userId of userIds) {
        const result: { proposalsWritten: number; consent_skipped?: number } = await ctx.runAction(
          internal.maintainer.mineStackJournals,
          { userId }
        );
        proposalsWritten += result.proposalsWritten;
        usersProcessed += 1;
      }
      if (userIds.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;
    }
    return { usersProcessed, proposalsWritten };
  },
});

// ── L25 — listPendingRegistryCandidates ─────────────────────────────────────

/**
 * Return all maintainerProposals that are proposed for the cross-stack registry
 * and are still awaiting human approval. Admin surface only — no HTTP route.
 */
export const listPendingRegistryCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("maintainerProposals")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .filter((q) =>
        q.and(
          q.eq(q.field("proposedForRegistry"), true),
          q.eq(q.field("humanApprovalState"), "pending")
        )
      )
      .collect();

    return rows.map((r) => ({
      proposalId: r._id,
      userId: r.userId,
      stackSlug: r.stackSlug,
      skillName: r.skillName,
      evidenceCount: r.evidenceCount,
    }));
  },
});
