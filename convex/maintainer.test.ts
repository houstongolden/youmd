/**
 * L24/L25 — Maintainer agent mining tests.
 *
 * Tests mineStackJournals (failure-pattern detection) and
 * listPendingRegistryCandidates (L25 registry surface) via convex-test.
 *
 * Fixture note: journal entry bodies use uppercase "FAILURE:" so that
 * mentionsFailure(/failure/i) triggers but the token extractor
 * (\b[a-z][a-z0-9-]{1,39}\b) does NOT match "FAILURE" — ensuring only the
 * target skill-name token accumulates hits.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";

function jf(slug: string, name: string, body: string) {
  return { path: `stacks/${slug}/journal/${name}.md`, content: body, size: body.length };
}

async function seedWithMirror(t: ReturnType<typeof convexTest>, username: string, files: ReturnType<typeof jf>[]) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { clerkId: `clerk_${username}`, username, email: `${username}@example.com`, plan: "free", createdAt: Date.now() });
    await ctx.db.insert("repoMirror", { userId, repoFullName: `${username}/you-md`, files, fileCount: files.length, totalBytes: files.reduce((s, f) => s + f.size, 0), truncated: false, syncedAt: Date.now() });
    return userId;
  });
}

describe("maintainer.mineStackJournals", () => {
  it("3 failure entries → 1 proposal, evidenceCount=3, proposedForRegistry=false", async () => {
    const t = convexTest(schema);
    const userId = await seedWithMirror(t, "alice", [
      jf("s", "j1", "FAILURE: deploy-skill"), jf("s", "j2", "FAILURE: deploy-skill"), jf("s", "j3", "FAILURE: deploy-skill"),
    ]);
    const r1 = await t.action(internal.maintainer.mineStackJournals, { userId });
    expect(r1.proposalsWritten).toBe(1);
    const [p] = await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
    expect(p.skillName).toBe("deploy-skill");
    expect(p.evidenceCount).toBe(3);
    expect(p.proposedForRegistry).toBe(false);
    expect(p.humanApprovalState).toBe("pending");
  });

  it("5 failure entries → 1 proposal, evidenceCount=5, proposedForRegistry=true", async () => {
    const t = convexTest(schema);
    const userId = await seedWithMirror(t, "bob", [
      jf("s", "j1", "FAILURE: lint-skill"), jf("s", "j2", "FAILURE: lint-skill"), jf("s", "j3", "FAILURE: lint-skill"),
      jf("s", "j4", "FAILURE: lint-skill"), jf("s", "j5", "FAILURE: lint-skill"),
    ]);
    const r2 = await t.action(internal.maintainer.mineStackJournals, { userId });
    expect(r2.proposalsWritten).toBe(1);
    const [p] = await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
    expect(p.skillName).toBe("lint-skill");
    expect(p.evidenceCount).toBe(5);
    expect(p.proposedForRegistry).toBe(true);
  });

  it("0 journal entries → 0 proposals", async () => {
    const t = convexTest(schema);
    const userId = await seedWithMirror(t, "carol", []);
    const r3 = await t.action(internal.maintainer.mineStackJournals, { userId });
    expect(r3.proposalsWritten).toBe(0);
    const rows = await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userId)).collect());
    expect(rows).toHaveLength(0);
  });

  it("2 failure entries (below threshold) → 0 proposals", async () => {
    const t = convexTest(schema);
    const userId = await seedWithMirror(t, "dave", [
      jf("s", "j1", "FAILURE: quick-fix"), jf("s", "j2", "FAILURE: quick-fix"),
    ]);
    const r4 = await t.action(internal.maintainer.mineStackJournals, { userId });
    expect(r4.proposalsWritten).toBe(0);
  });
});

describe("maintainer.listPendingRegistryCandidates", () => {
  it("returns only open+proposedForRegistry=true+humanApprovalState=pending rows", async () => {
    const t = convexTest(schema);
    const userId = await t.run((ctx) => ctx.db.insert("users", { clerkId: "ck", username: "admin", email: "a@example.com", plan: "pro", createdAt: Date.now() }));
    await t.run(async (ctx) => {
      await ctx.db.insert("maintainerProposals", { userId, stackSlug: "s", skillName: "my-skill", patternType: "failure_pattern", evidenceCount: 5, status: "open", proposedForRegistry: true, humanApprovalState: "pending", createdAt: Date.now() });
      await ctx.db.insert("maintainerProposals", { userId, stackSlug: "s", skillName: "no-registry", patternType: "failure_pattern", evidenceCount: 3, status: "open", proposedForRegistry: false, humanApprovalState: "pending", createdAt: Date.now() });
      await ctx.db.insert("maintainerProposals", { userId, stackSlug: "s", skillName: "approved-skill", patternType: "failure_pattern", evidenceCount: 6, status: "open", proposedForRegistry: true, humanApprovalState: "approved", createdAt: Date.now() });
    });
    const candidates = await t.query(internal.maintainer.listPendingRegistryCandidates, {});
    expect(candidates).toHaveLength(1);
    expect(candidates[0].skillName).toBe("my-skill");
    expect(candidates[0].evidenceCount).toBe(5);
  });

  it("per-user isolation: mineStackJournals for userA never writes userB proposals; listPendingRegistryCandidates returns both after both are mined", async () => {
    const t = convexTest(schema);
    const userAId = await seedWithMirror(t, "userA", [
      jf("sA", "j1", "FAILURE: shared-skill"), jf("sA", "j2", "FAILURE: shared-skill"), jf("sA", "j3", "FAILURE: shared-skill"),
      jf("sA", "j4", "FAILURE: shared-skill"), jf("sA", "j5", "FAILURE: shared-skill"),
    ]);
    const userBId = await seedWithMirror(t, "userB", [
      jf("sB", "j1", "FAILURE: other-skill"), jf("sB", "j2", "FAILURE: other-skill"), jf("sB", "j3", "FAILURE: other-skill"),
      jf("sB", "j4", "FAILURE: other-skill"), jf("sB", "j5", "FAILURE: other-skill"),
    ]);

    // Mine only userA — userB must have zero proposals.
    await t.action(internal.maintainer.mineStackJournals, { userId: userAId });
    expect(await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userAId)).collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userBId)).collect())).toHaveLength(0);

    // Mine userB — both users now have proposals; listPendingRegistryCandidates surfaces both.
    await t.action(internal.maintainer.mineStackJournals, { userId: userBId });
    const all = await t.query(internal.maintainer.listPendingRegistryCandidates, {});
    expect(all.map((c) => c.skillName).sort()).toEqual(["other-skill", "shared-skill"]);
    // userB's proposals are exclusively for userB.
    const bRows = await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userBId)).collect());
    expect(bRows).toHaveLength(1);
    expect(bRows[0].userId).toBe(userBId);
  });
});
