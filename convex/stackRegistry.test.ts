/**
 * P9 — public stack registry internal query tests.
 *
 * The httpAction route at GET /api/v1/stacks/registry/{user}/{slug} is not
 * exercised here (convex-test does not run httpRouter with env secrets).
 * These tests cover the underlying data layer via t.run:
 *   - internalGetMirrorByUserId: happy path + missing user/mirror
 *   - deriveStacks: slug derivation from mirror files
 *   - stack file filtering by stacks/<slug>/ prefix
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { deriveStacks } from "./github";

// ── Helpers ────────────────────────────────────────────────────────────────

async function seedUser(
  t: ReturnType<typeof convexTest>,
  username = "alice"
): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `clerk_${username}`,
      username,
      email: `${username}@example.com`,
      plan: "pro",
      createdAt: Date.now(),
    });
  });
}

const MANIFEST_CONTENT = JSON.stringify({
  schemaVersion: "youstack/v1",
  kind: "youstack",
  slug: "coding",
  name: "coding stack",
  version: "1.0.0",
  visibility: "public-open",
});

const STACK_FILES = [
  { path: "stacks/coding/youstack.json", content: MANIFEST_CONTENT, size: MANIFEST_CONTENT.length },
  { path: "stacks/coding/SKILL.md", content: "# Coding skill", size: 14 },
  { path: "you.md", content: "# Alice", size: 7 },
];

async function seedMirror(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  files = STACK_FILES
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("repoMirror", {
      userId,
      repoFullName: "alice/youmd",
      commitSha: "abc123",
      files,
      fileCount: files.length,
      totalBytes: files.reduce((n, f) => n + f.size, 0),
      truncated: false,
      syncedAt: Date.now(),
    });
  });
}

// ── deriveStacks (pure function) ──────────────────────────────────────────

describe("deriveStacks", () => {
  it("returns empty array for no stacks/ files", () => {
    const result = deriveStacks([{ path: "you.md" }, { path: "you.json" }]);
    expect(result).toEqual([]);
  });

  it("derives one stack with hasManifest=true when youstack.json present", () => {
    const result = deriveStacks([
      { path: "stacks/coding/youstack.json" },
      { path: "stacks/coding/SKILL.md" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("coding");
    expect(result[0].fileCount).toBe(2);
    expect(result[0].hasManifest).toBe(true);
  });

  it("hasManifest=false when only non-manifest files present", () => {
    const result = deriveStacks([
      { path: "stacks/coding/SKILL.md" },
      { path: "stacks/coding/README.md" },
    ]);
    expect(result[0].hasManifest).toBe(false);
  });

  it("derives multiple stacks from mixed files", () => {
    const files = [
      { path: "stacks/coding/youstack.json" },
      { path: "stacks/research/manifest.json" },
      { path: "you.md" },
    ];
    const result = deriveStacks(files);
    expect(result).toHaveLength(2);
    const slugs = result.map((s) => s.slug).sort();
    expect(slugs).toEqual(["coding", "research"]);
  });
});

// ── internalGetMirrorByUserId ─────────────────────────────────────────────

describe("internalGetMirrorByUserId — happy path", () => {
  it("returns mirror with stale=false when no githubConnection present", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "alice");
    await seedMirror(t, userId);

    const mirror = await t.run(async (ctx) =>
      ctx.runQuery(internal.github.internalGetMirrorByUserId, { userId })
    );

    expect(mirror).not.toBeNull();
    expect(mirror!.repoFullName).toBe("alice/youmd");
    expect(mirror!.files).toHaveLength(STACK_FILES.length);
    // No githubConnection → isMirrorStale returns false
    expect(mirror!.stale).toBe(false);
  });

  it("filters stacks/<slug>/ files correctly from mirror.files", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "bob");
    await seedMirror(t, userId);

    const mirror = await t.run(async (ctx) =>
      ctx.runQuery(internal.github.internalGetMirrorByUserId, { userId })
    );

    const stackFiles = mirror!.files.filter(
      (f: { path: string }) => f.path.startsWith("stacks/coding/")
    );
    expect(stackFiles).toHaveLength(2);
    const paths = stackFiles.map((f: { path: string }) => f.path).sort();
    expect(paths).toEqual(["stacks/coding/SKILL.md", "stacks/coding/youstack.json"]);
  });
});

describe("internalGetMirrorByUserId — not found", () => {
  it("returns null when no mirror exists for the user", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "carol");
    // No mirror seeded.
    const mirror = await t.run(async (ctx) =>
      ctx.runQuery(internal.github.internalGetMirrorByUserId, { userId })
    );
    expect(mirror).toBeNull();
  });
});

// ── users.getByUsername — used by the HTTP route to resolve userId ─────────

describe("users.getByUsername", () => {
  it("resolves a seeded user by username", async () => {
    const t = convexTest(schema);
    await seedUser(t, "diana");

    const user = await t.run(async (ctx) =>
      ctx.runQuery(internal.users.getByUsername, { username: "diana" })
    );
    expect(user).not.toBeNull();
    expect(user!.username).toBe("diana");
  });

  it("returns null for an unknown username", async () => {
    const t = convexTest(schema);
    const user = await t.run(async (ctx) =>
      ctx.runQuery(internal.users.getByUsername, { username: "nobody" })
    );
    expect(user).toBeNull();
  });
});
