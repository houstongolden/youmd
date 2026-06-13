/**
 * L23 — Per-stack MCP namespace resolution tests.
 *
 * GAP: convex-test does not support httpRouter routes. t.fetch() is not
 * available; even if it were, httpActions require env secrets
 * (TRUSTED_INTERNAL_AUTH_TOKEN) that are unavailable in the test sandbox.
 * Same constraint documented in memories.test.ts. The two resolution
 * primitives that the HTTP handler delegates to are tested instead.
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "./_generated/api";
import schema from "./schema";

async function seedUser(t: ReturnType<typeof convexTest>, username: string) {
  return t.run((ctx) =>
    ctx.db.insert("users", { clerkId: `clerk_${username}`, username, email: `${username}@example.com`, plan: "free", createdAt: Date.now() })
  );
}

describe("L23 per-stack MCP — users.getByUsername", () => {
  it("returns null for unknown username (covers 404 path 1)", async () => {
    const t = convexTest(schema);
    const r = await t.run((ctx) => ctx.runQuery(internal.users.getByUsername, { username: "no-such-user" }));
    expect(r).toBeNull();
  });

  it("returns user doc for existing username", async () => {
    const t = convexTest(schema);
    await seedUser(t, "alice");
    const r = await t.run((ctx) => ctx.runQuery(internal.users.getByUsername, { username: "alice" }));
    expect(r?.username).toBe("alice");
  });
});

describe("L23 per-stack MCP — github.internalGetMirrorByUserId", () => {
  it("returns null when no repoMirror row exists (covers 404 path 2: known-user-unknown-stack)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "bob");
    const r = await t.run((ctx) => ctx.runQuery(internal.github.internalGetMirrorByUserId, { userId }));
    expect(r).toBeNull();
  });

  it("returns mirror when repoMirror row exists (happy path resolution)", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "carol");
    await t.run((ctx) => ctx.db.insert("repoMirror", {
      userId, repoFullName: "carol/you-md", commitSha: "abc123",
      files: [{ path: "stacks/mystack/youstack.json", content: '{"name":"mystack"}', size: 18 }],
      fileCount: 1, totalBytes: 18, truncated: false, syncedAt: Date.now(),
    }));
    const r = await t.run((ctx) => ctx.runQuery(internal.github.internalGetMirrorByUserId, { userId }));
    expect(r?.repoFullName).toBe("carol/you-md");
    expect(r?.files).toHaveLength(1);
  });
});
