/**
 * P13 — cursor pagination contract tests (PRODUCT-AUDIT #15,
 * FEATURE-ROADMAP 2.9).
 *
 * Pins the paginated `*Page` query layer that the HTTP list endpoints
 * (sources, context-links, api-keys, memories, skills, history, activity)
 * call when `?cursor=` / `?limit=` is supplied:
 *   - cursor walk: page1 + page2 are disjoint, hasMore (isDone) flips,
 *     continueCursor stops advancing at the end
 *   - default-call shape unchanged: the legacy queries still return plain
 *     arrays with the same ordering as page 1 of the paginated variant
 *   - per-user isolation holds across pages
 *   - visibility filters survive pagination (archived memories, revoked
 *     context links, unpublished skills)
 *
 * NOTE: as with the other convex test suites, the httpAction layer itself
 * (Bearer auth, requireScope, parseListPagination) is not exercised here —
 * convex-test does not run httpRouter routes with production env secrets.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

const ALICE_CLERK = "clerk_alice";
const BOB_CLERK = "clerk_bob";

type PageResult<T> = { page: T[]; isDone: boolean; continueCursor: string };

async function seedUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      clerkId: ALICE_CLERK,
      username: "alice",
      email: "alice@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    const bobId = await ctx.db.insert("users", {
      clerkId: BOB_CLERK,
      username: "bob",
      email: "bob@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    return { aliceId, bobId };
  });
}

/** Walk a paginated query to exhaustion, collecting ids page by page. */
async function walk<T extends { _id?: unknown; id?: unknown }>(
  fetchPage: (cursor: string | null) => Promise<PageResult<T>>,
  numPagesMax = 10
): Promise<{ pages: T[][]; results: PageResult<T>[] }> {
  const pages: T[][] = [];
  const results: PageResult<T>[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < numPagesMax; i++) {
    const result = await fetchPage(cursor);
    pages.push(result.page);
    results.push(result);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return { pages, results };
}

describe("memories.listMemoriesPage", () => {
  it("walks pages: disjoint items, hasMore flips, archived excluded", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 5; i++) {
        await ctx.db.insert("memories", {
          userId: aliceId,
          category: "fact",
          content: `alice fact ${i}`,
          source: "cli",
          isArchived: false,
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("memories", {
        userId: aliceId,
        category: "fact",
        content: "archived alice fact",
        source: "cli",
        isArchived: true,
        createdAt: Date.now(),
      });
      await ctx.db.insert("memories", {
        userId: bobId,
        category: "fact",
        content: "bob fact",
        source: "cli",
        isArchived: false,
        createdAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.memories.listMemoriesPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        cursor,
        numItems: 2,
      })
    );

    // 5 active memories at 2/page → 3 pages (2, 2, 1)
    expect(pages.map((p) => p.length)).toEqual([2, 2, 1]);
    expect(results.map((r) => r.isDone)).toEqual([false, false, true]);

    // Pages are disjoint and collectively complete
    const ids = pages.flat().map((m) => m._id);
    expect(new Set(ids).size).toBe(5);

    const all = pages.flat();
    // newest-first ordering across the whole walk
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1]._creationTime).toBeGreaterThanOrEqual(all[i]._creationTime);
    }
    // isolation + visibility across every page
    expect(all.every((m) => m.userId === aliceId)).toBe(true);
    expect(all.every((m) => m.isArchived === false)).toBe(true);
  });

  it("paginates within a category filter", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("memories", {
          userId: aliceId,
          category: "preference",
          content: `pref ${i}`,
          source: "cli",
          isArchived: false,
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("memories", {
        userId: aliceId,
        category: "context",
        content: "other category",
        source: "cli",
        isArchived: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("memories", {
        userId: aliceId,
        category: "preference",
        content: "archived pref",
        source: "cli",
        isArchived: true,
        createdAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages } = await walk((cursor) =>
      asAlice.query(api.memories.listMemoriesPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        category: "preference",
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all).toHaveLength(3);
    expect(all.every((m) => m.category === "preference")).toBe(true);
    expect(all.every((m) => m.isArchived === false)).toBe(true);
  });

  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    await expect(
      t.query(api.memories.listMemoriesPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        numItems: 10,
      })
    ).rejects.toThrow();
  });
});

describe("memories.searchMemoriesPage", () => {
  it("paginates search results with real cursors and excludes archived rows", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("memories", {
          userId: aliceId,
          category: "fact",
          content: `convex insight number ${i}`,
          source: "cli",
          isArchived: false,
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("memories", {
        userId: aliceId,
        category: "fact",
        content: "archived convex insight",
        source: "cli",
        isArchived: true,
        createdAt: Date.now(),
      });
      await ctx.db.insert("memories", {
        userId: bobId,
        category: "fact",
        content: "bob convex insight",
        source: "cli",
        isArchived: false,
        createdAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.memories.searchMemoriesPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        searchText: "convex",
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all).toHaveLength(3);
    expect(new Set(all.map((m) => m._id)).size).toBe(3);
    expect(results[results.length - 1].isDone).toBe(true);
    expect(all.every((m) => m.userId === aliceId)).toBe(true);
    expect(all.every((m) => m.isArchived === false)).toBe(true);
  });

  it("returns an empty done page for blank search text", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const result = await asAlice.query(api.memories.searchMemoriesPage, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
      searchText: "   ",
      numItems: 10,
    });
    expect(result.page).toEqual([]);
    expect(result.isDone).toBe(true);
  });
});

describe("me.getSourcesPage", () => {
  it("pages match the legacy getSources array ordering and isolate users", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("sources", {
          userId: aliceId,
          sourceType: "website",
          sourceUrl: `https://alice.example/${i}`,
          status: "pending",
        });
      }
      await ctx.db.insert("sources", {
        userId: bobId,
        sourceType: "website",
        sourceUrl: "https://bob.example",
        status: "pending",
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });

    // Default-call shape unchanged: legacy query returns a plain array
    const legacy = await asAlice.query(api.me.getSources, { clerkId: ALICE_CLERK });
    expect(Array.isArray(legacy)).toBe(true);
    expect(legacy).toHaveLength(3);

    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.me.getSourcesPage, {
        clerkId: ALICE_CLERK,
        cursor,
        numItems: 2,
      })
    );
    const all = pages.flat();
    expect(pages.map((p) => p.length)).toEqual([2, 1]);
    expect(results.map((r) => r.isDone)).toEqual([false, true]);
    // Paginated walk reproduces the legacy ordering exactly
    expect(all.map((s) => s._id)).toEqual(legacy.map((s) => s._id));
    expect(all.every((s) => s.userId === aliceId)).toBe(true);
  });
});

describe("contextLinks.listLinksPage", () => {
  it("excludes revoked links across pages and keeps the listLinks view shape", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("contextLinks", {
          userId: aliceId,
          token: `tok_active_${i}`,
          scope: "public",
          useCount: 0,
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("contextLinks", {
        userId: aliceId,
        token: "tok_revoked",
        scope: "public",
        useCount: 0,
        createdAt: Date.now(),
        revokedAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages } = await walk((cursor) =>
      asAlice.query(api.contextLinks.listLinksPage, {
        clerkId: ALICE_CLERK,
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all).toHaveLength(3);
    expect(all.every((l) => l.token.startsWith("tok_active_"))).toBe(true);
    // Same mapped view as legacy listLinks (url embeds the username)
    expect(all[0].url).toContain("/ctx/alice/");
    expect(all[0].maxUses).toBe("unlimited");

    const legacy = await asAlice.query(api.contextLinks.listLinks, { clerkId: ALICE_CLERK });
    expect(legacy.map((l) => l.id)).toEqual(all.map((l) => l.id));
  });
});

describe("apiKeys.listKeysPage", () => {
  it("walks pages with the same metadata shape as listKeys (revoked included)", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 2; i++) {
        await ctx.db.insert("apiKeys", {
          userId: aliceId,
          keyHash: `hash_${i}`,
          label: `key ${i}`,
          scopes: ["read:public"],
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("apiKeys", {
        userId: aliceId,
        keyHash: "hash_revoked",
        label: "revoked key",
        scopes: ["read:public"],
        createdAt: Date.now(),
        revokedAt: Date.now(),
      });
      await ctx.db.insert("apiKeys", {
        userId: bobId,
        keyHash: "hash_bob",
        scopes: ["read:public"],
        createdAt: Date.now(),
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.apiKeys.listKeysPage, {
        clerkId: ALICE_CLERK,
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all).toHaveLength(3); // revoked keys included, like listKeys
    expect(results[results.length - 1].isDone).toBe(true);
    // Hash never leaks; prefix is masked
    expect(all.every((k) => k.keyPrefix === "ym_****")).toBe(true);
    expect(all.some((k) => k.isRevoked)).toBe(true);
    expect(all.every((k) => !("keyHash" in k))).toBe(true);

    const legacy = await asAlice.query(api.apiKeys.listKeys, { clerkId: ALICE_CLERK });
    expect(legacy.map((k) => k.id)).toEqual(all.map((k) => k.id));
  });
});

describe("bundles.getHistoryPage", () => {
  it("pages in version-desc order matching legacy getHistory", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let version = 1; version <= 5; version++) {
        await ctx.db.insert("bundles", {
          userId: aliceId,
          version,
          schemaVersion: "1",
          manifest: {},
          youJson: {},
          youMd: `# v${version}`,
          isPublished: false,
          createdAt: Date.now(),
        });
      }
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.bundles.getHistoryPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all.map((b) => b.version)).toEqual([5, 4, 3, 2, 1]);
    expect(results.map((r) => r.isDone)).toEqual([false, false, true]);

    const legacy = await asAlice.query(api.bundles.getHistory, {
      clerkId: ALICE_CLERK,
      userId: aliceId,
    });
    expect(legacy.map((b) => b._id)).toEqual(all.map((b) => b._id));
  });
});

describe("skills.listPublishedPage", () => {
  it("pages the registry in downloads-desc order and hides unpublished skills", async () => {
    const t = convexTest(schema);
    const { aliceId } = await seedUsers(t);
    await t.run(async (ctx) => {
      const downloads = [7, 3, 11, 5];
      for (let i = 0; i < downloads.length; i++) {
        await ctx.db.insert("skills", {
          authorId: aliceId,
          name: `skill-${i}`,
          description: "test skill",
          version: "1.0.0",
          scope: "shared",
          identityFields: [],
          content: "# skill",
          isPublished: true,
          downloads: downloads[i],
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("skills", {
        authorId: aliceId,
        name: "unpublished-skill",
        description: "draft",
        version: "1.0.0",
        scope: "shared",
        identityFields: [],
        content: "# draft",
        isPublished: false,
        downloads: 999,
        createdAt: Date.now(),
      });
    });

    const { pages, results } = await walk((cursor) =>
      t.query(api.skills.listPublishedPage, { cursor, numItems: 2 })
    );

    const all = pages.flat();
    expect(all.map((s) => s.downloads)).toEqual([11, 7, 5, 3]);
    expect(all.every((s) => s.name !== "unpublished-skill")).toBe(true);
    expect(results.map((r) => r.isDone)).toEqual([false, true]);
    // Registry shape excludes skill content
    expect(all.every((s) => !("content" in s))).toBe(true);
  });
});

describe("skills.listInstallsPage", () => {
  it("pages installs in installedAt-desc order with per-user isolation", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 3; i++) {
        await ctx.db.insert("skillInstalls", {
          userId: aliceId,
          skillName: `skill-${i}`,
          source: "registry",
          scope: "shared",
          identityFields: [],
          installedAt: 1000 * i,
          useCount: 0,
        });
      }
      await ctx.db.insert("skillInstalls", {
        userId: bobId,
        skillName: "bob-skill",
        source: "registry",
        scope: "shared",
        identityFields: [],
        installedAt: 9999,
        useCount: 0,
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages, results } = await walk((cursor) =>
      asAlice.query(api.skills.listInstallsPage, {
        clerkId: ALICE_CLERK,
        userId: aliceId,
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all.map((s) => s.installedAt)).toEqual([3000, 2000, 1000]);
    expect(all.every((s) => s.userId === aliceId)).toBe(true);
    expect(results.map((r) => r.isDone)).toEqual([false, true]);
  });
});

describe("activity.listActivityPage", () => {
  it("pages newest-first with native agentName filtering and trust computed", async () => {
    const t = convexTest(schema);
    const { aliceId, bobId } = await seedUsers(t);
    await t.run(async (ctx) => {
      for (let i = 1; i <= 4; i++) {
        await ctx.db.insert("agentActivity", {
          userId: aliceId,
          agentName: i % 2 === 0 ? "Claude Code" : "Cursor",
          agentSource: "api-key",
          action: "read",
          status: "success",
          createdAt: 1000 * i,
        });
      }
      await ctx.db.insert("agentActivity", {
        userId: bobId,
        agentName: "Claude Code",
        agentSource: "api-key",
        action: "read",
        status: "success",
        createdAt: 99999,
      });
    });

    const asAlice = t.withIdentity({ subject: ALICE_CLERK });
    const { pages } = await walk((cursor) =>
      asAlice.query(api.activity.listActivityPage, {
        clerkId: ALICE_CLERK,
        agentName: "Claude Code",
        cursor,
        numItems: 2,
      })
    );

    const all = pages.flat();
    expect(all).toHaveLength(2); // alice's two Claude Code events only
    expect(all.every((a) => a.agentName === "Claude Code")).toBe(true);
    expect(all.every((a) => a.userId === aliceId)).toBe(true);
    expect(all.every((a) => a.trust === "self-attributed")).toBe(true);
  });
});
