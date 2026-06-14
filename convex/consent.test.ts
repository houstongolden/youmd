/**
 * L26 — brainScope consent gating tests.
 *
 * 1. Default consent is granted for all scopes (no row → DEFAULT_CONSENT).
 * 2. setConsent / getConsent roundtrip.
 * 3. Per-user isolation: revoking A does not affect B.
 * 4. consolidateUser skips when "consolidate" revoked (consent_skipped=1).
 * 5. Fleet aggregates exclude revoked users (20 consenting + 1 revoking = 20-user bucket).
 * 6. mineStackJournals skips when "journal_mine" revoked (consent_skipped=1).
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { BRAIN_SCOPES } from "./lib/brainScopes";

async function seedUser(t: ReturnType<typeof convexTest>, u: string): Promise<Id<"users">> {
  return t.run((ctx) => ctx.db.insert("users", { clerkId: `ck_${u}`, username: u, email: `${u}@x.com`, plan: "pro", createdAt: Date.now() }));
}

describe("consent — default grant", () => {
  it("all brainScopes default to true when no row exists", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "alice");
    for (const scope of BRAIN_SCOPES) {
      expect(await t.query(internal.consent.getConsent, { userId, scope })).toBe(true);
    }
  });
});

describe("consent — setConsent / getConsent roundtrip", () => {
  it("revoke returns false; re-grant returns true", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "bob");
    await t.mutation(internal.consent.setConsent, { userId, scope: "consolidate", granted: false });
    expect(await t.query(internal.consent.getConsent, { userId, scope: "consolidate" })).toBe(false);
    await t.mutation(internal.consent.setConsent, { userId, scope: "consolidate", granted: true });
    expect(await t.query(internal.consent.getConsent, { userId, scope: "consolidate" })).toBe(true);
  });
});

describe("consent — per-user isolation", () => {
  it("revoking userA does not affect userB", async () => {
    const t = convexTest(schema);
    const userA = await seedUser(t, "userA");
    const userB = await seedUser(t, "userB");
    await t.mutation(internal.consent.setConsent, { userId: userA, scope: "consolidate", granted: false });
    expect(await t.query(internal.consent.getConsent, { userId: userA, scope: "consolidate" })).toBe(false);
    expect(await t.query(internal.consent.getConsent, { userId: userB, scope: "consolidate" })).toBe(true);
  });
});

describe("consent — consolidateUser skips on revoked consolidate", () => {
  it("returns consent_skipped=1 and writes no consolidationRuns row", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "carol");
    await t.mutation(internal.consent.setConsent, { userId, scope: "consolidate", granted: false });
    const result = await t.mutation(internal.consolidation.consolidateUser, { userId });
    expect(result).toMatchObject({ skipped: true, reason: "consent_revoked", consent_skipped: 1 });
    expect(await t.run((ctx) => ctx.db.query("consolidationRuns").collect())).toHaveLength(0);
  });
});

describe("consent — fleet aggregate excludes revoked users", () => {
  it("20 consenting + 1 revoking → 20-user fact bucket", async () => {
    const t = convexTest(schema);
    for (let i = 0; i < 20; i++) {
      const uid = await seedUser(t, `f${i}`);
      await t.run((ctx) => ctx.db.insert("memories", { userId: uid, category: "fact", content: `f${i}`, source: "cli", isArchived: false, createdAt: Date.now() }));
    }
    const revoker = await seedUser(t, "revoker");
    await t.run((ctx) => ctx.db.insert("memories", { userId: revoker, category: "fact", content: "rvk", source: "cli", isArchived: false, createdAt: Date.now() }));
    await t.mutation(internal.consent.setConsent, { userId: revoker, scope: "fleet_aggregate", granted: false });

    const excluded: string[] = await t.query(internal.fleet._getRevokedFleetUserIds, {});
    expect(excluded).toHaveLength(1);

    const raw = await t.run((ctx) => ctx.runQuery(internal.fleet._categoryDistribution, { excludeUserIds: excluded })) as Array<{ category: string; perUserCounts: number[] }>;
    const factBucket = raw.find((r) => r.category === "fact");
    expect(factBucket?.perUserCounts).toHaveLength(20);
  });
});

describe("consent — listMyConsents defaults", () => {
  it("returns all scopes with granted=true and explicit=false when no rows exist", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "listdefault");
    const consents = await t.query(internal.consent.listMyConsents, { userId });
    expect(consents).toHaveLength(BRAIN_SCOPES.length);
    for (const c of consents) {
      expect(c.granted).toBe(true);
      expect(c.explicit).toBe(false);
    }
    expect(consents.map((c) => c.scope).sort()).toEqual([...BRAIN_SCOPES].sort());
  });
});

describe("consent — listMyConsents reflects explicit revoke", () => {
  it("revoked scope shows granted=false and explicit=true; others unchanged", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "listrevoke");
    await t.mutation(internal.consent.setConsent, { userId, scope: "journal_mine", granted: false });
    const consents = await t.query(internal.consent.listMyConsents, { userId });
    const jm = consents.find((c) => c.scope === "journal_mine");
    expect(jm?.granted).toBe(false);
    expect(jm?.explicit).toBe(true);
    // Other scopes must still be default-true / not-explicit
    for (const c of consents) {
      if (c.scope !== "journal_mine") {
        expect(c.granted).toBe(true);
        expect(c.explicit).toBe(false);
      }
    }
  });
});

describe("consent — mineStackJournals skips on revoked journal_mine", () => {
  it("returns consent_skipped=1 and writes no proposals", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "dave");
    await t.run((ctx) => ctx.db.insert("repoMirror", {
      userId, repoFullName: "dave/you-md",
      files: [
        { path: "stacks/s/journal/j1.md", content: "FAILURE: some-skill", size: 19 },
        { path: "stacks/s/journal/j2.md", content: "FAILURE: some-skill", size: 19 },
        { path: "stacks/s/journal/j3.md", content: "FAILURE: some-skill", size: 19 },
      ],
      fileCount: 3, totalBytes: 57, truncated: false, syncedAt: Date.now(),
    }));
    await t.mutation(internal.consent.setConsent, { userId, scope: "journal_mine", granted: false });
    const result = await t.action(internal.maintainer.mineStackJournals, { userId });
    expect(result.consent_skipped).toBe(1);
    expect(result.proposalsWritten).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("maintainerProposals").withIndex("by_userId", (q) => q.eq("userId", userId)).collect())).toHaveLength(0);
  });
});
