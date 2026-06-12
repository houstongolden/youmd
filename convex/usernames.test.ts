/**
 * Username canonicalization tests (P30 / PRODUCT-AUDIT #38).
 *
 * Pins the contract that replaced the old `.take(500)` case-insensitive
 * fallback scan in profiles.getPublicProfile:
 *   - all stored usernames are canonical (lowercase, trimmed)
 *   - lookups normalize input through canonicalUsername, so old mixed-case
 *     URLs still resolve via the by_username index alone
 *   - migrations/canonicalizeUsernames rewrites legacy mixed-case rows,
 *     keeps the OLDER account on collision, and reports (never destroys)
 *     the younger conflicting account
 *   - write paths store canonical form and case-variant duplicates are
 *     rejected as taken
 */
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";

function seedUser(
  t: ReturnType<typeof convexTest>,
  username: string,
  opts: { clerkId?: string; createdAt?: number } = {}
) {
  return t.run(async (ctx) =>
    ctx.db.insert("users", {
      clerkId: opts.clerkId ?? `clerk_${username.trim().toLowerCase()}`,
      username,
      email: `${username.trim().toLowerCase()}@example.com`,
      plan: "free",
      createdAt: opts.createdAt ?? Date.now(),
    })
  );
}

function seedProfile(
  t: ReturnType<typeof convexTest>,
  username: string,
  opts: { createdAt?: number } = {}
) {
  return t.run(async (ctx) =>
    ctx.db.insert("profiles", {
      username,
      name: username.trim(),
      isClaimed: false,
      sessionToken: `tok_${username.trim().toLowerCase()}`,
      createdAt: opts.createdAt ?? Date.now(),
    })
  );
}

describe("profiles.getPublicProfile — canonical indexed lookup", () => {
  it("resolves mixed-case and padded input against canonical storage", async () => {
    const t = convexTest(schema);
    await seedProfile(t, "alice");

    const result = await t.query(api.profiles.getPublicProfile, {
      username: " AlIcE ",
    });

    expect(result).not.toBeNull();
    expect(result?.username).toBe("alice");
  });

  it("returns null for unknown usernames (no full-table fallback hit)", async () => {
    const t = convexTest(schema);
    await seedProfile(t, "alice");

    const result = await t.query(api.profiles.getPublicProfile, {
      username: "nobody",
    });

    expect(result).toBeNull();
  });
});

describe("migrations/canonicalizeUsernames.canonicalize", () => {
  it("canonicalizes seeded mixed-case usernames in users and profiles", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t, "MixedCase");
    const profileId = await seedProfile(t, " Mixed-Profile ");

    const report = await t.action(
      internal.migrations.canonicalizeUsernames.canonicalize,
      {}
    );

    expect(report.users.canonicalized).toBe(1);
    expect(report.profiles.canonicalized).toBe(1);
    expect(report.conflicts).toEqual([]);

    const { user, profile } = await t.run(async (ctx) => ({
      user: await ctx.db.get(userId),
      profile: await ctx.db.get(profileId),
    }));
    expect(user?.username).toBe("mixedcase");
    expect(profile?.username).toBe("mixed-profile");

    // After migration, the indexed canonical lookup resolves directly.
    const found = await t.query(api.profiles.getPublicProfile, {
      username: "MIXED-PROFILE",
    });
    expect(found?.username).toBe("mixed-profile");
  });

  it("collision with an existing canonical holder: older kept, younger reported not destroyed", async () => {
    const t = convexTest(schema);
    const olderId = await seedUser(t, "alice", {
      clerkId: "clerk_alice_older",
      createdAt: 100,
    });
    const youngerId = await seedUser(t, "Alice", {
      clerkId: "clerk_alice_younger",
      createdAt: 200,
    });

    const report = await t.action(
      internal.migrations.canonicalizeUsernames.canonicalize,
      {}
    );

    expect(report.users.canonicalized).toBe(0);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({
      table: "users",
      skippedId: youngerId,
      skippedUsername: "Alice",
      canonical: "alice",
      keptId: olderId,
    });

    const { older, younger } = await t.run(async (ctx) => ({
      older: await ctx.db.get(olderId),
      younger: await ctx.db.get(youngerId),
    }));
    // Older account untouched at the canonical name.
    expect(older?.username).toBe("alice");
    // Younger account NOT deleted, NOT renamed — reachable by stored casing.
    expect(younger).not.toBeNull();
    expect(younger?.username).toBe("Alice");
  });

  it("collision between two non-canonical variants: oldest claims canonical, younger reported", async () => {
    const t = convexTest(schema);
    const olderId = await seedUser(t, "BOB", {
      clerkId: "clerk_bob_older",
      createdAt: 100,
    });
    const youngerId = await seedUser(t, "Bob", {
      clerkId: "clerk_bob_younger",
      createdAt: 200,
    });

    const report = await t.action(
      internal.migrations.canonicalizeUsernames.canonicalize,
      {}
    );

    expect(report.users.canonicalized).toBe(1);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]).toMatchObject({
      table: "users",
      skippedId: youngerId,
      keptId: olderId,
      canonical: "bob",
    });

    const { older, younger } = await t.run(async (ctx) => ({
      older: await ctx.db.get(olderId),
      younger: await ctx.db.get(youngerId),
    }));
    expect(older?.username).toBe("bob");
    expect(younger?.username).toBe("Bob");
  });

  it("is idempotent: a second run changes nothing new", async () => {
    const t = convexTest(schema);
    await seedUser(t, "MixedCase");

    const first = await t.action(
      internal.migrations.canonicalizeUsernames.canonicalize,
      {}
    );
    expect(first.users.canonicalized).toBe(1);

    const second = await t.action(
      internal.migrations.canonicalizeUsernames.canonicalize,
      {}
    );
    expect(second.users.canonicalized).toBe(0);
    expect(second.conflicts).toEqual([]);
  });
});

describe("username write paths store canonical form", () => {
  it("createProfile stores the lowercase trimmed username", async () => {
    const t = convexTest(schema);

    const created = await t.mutation(api.profiles.createProfile, {
      username: " NewUser ",
      name: "New User",
    });
    expect(created.username).toBe("newuser");

    const stored = await t.run(async (ctx) =>
      ctx.db
        .query("profiles")
        .withIndex("by_username", (q) => q.eq("username", "newuser"))
        .first()
    );
    expect(stored?.username).toBe("newuser");
  });

  it("checkUsername treats case variants of an existing name as taken", async () => {
    const t = convexTest(schema);
    await seedProfile(t, "alice");

    const profilesCheck = await t.query(api.profiles.checkUsername, {
      username: "Alice",
    });
    expect(profilesCheck.available).toBe(false);

    const usersCheck = await t.query(api.users.checkUsername, {
      username: "ALICE",
    });
    expect(usersCheck.available).toBe(false);
  });
});
