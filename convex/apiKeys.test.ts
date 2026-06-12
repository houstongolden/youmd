/**
 * API key creation + classification tests via convex-test (T3).
 *
 * Pins the key-shape contract ("ym_" + 40 base62 = 43 chars), free-plan
 * restrictions, and the getByHash scope classification that convex/http.ts
 * authenticateRequest/requireScope consume (legacy grandfathered keys come
 * back with scopes: null; modern keys keep their declared scopes).
 *
 * NOTE: the httpAction Bearer-token flow itself is not run here (convex-test
 * does not execute the http router with production env secrets); these tests
 * cover the mutations/queries beneath it via t.withIdentity.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";
import { generateApiKey, hashKey } from "./apiKeys";
import { OWNER_SESSION_SCOPES, SCOPE_ENFORCEMENT_EPOCH } from "./lib/scopes";

const PRO_CLERK = "clerk_pro";
const FREE_CLERK = "clerk_free";

beforeAll(() => {
  // createKey encrypts the plaintext for later reveal; the secret must be
  // >= 32 chars (see getApiKeyEncryptionSecret in convex/apiKeys.ts).
  process.env.API_KEY_ENCRYPTION_SECRET = "test-secret-".padEnd(48, "x");
});

async function seedUsers(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const proId = await ctx.db.insert("users", {
      clerkId: PRO_CLERK,
      username: "pro-user",
      email: "pro@example.com",
      plan: "pro",
      createdAt: Date.now(),
    });
    const freeId = await ctx.db.insert("users", {
      clerkId: FREE_CLERK,
      username: "free-user",
      email: "free@example.com",
      plan: "free",
      createdAt: Date.now(),
    });
    return { proId, freeId };
  });
}

describe("generateApiKey (pure)", () => {
  it('produces "ym_" + 40 base62 chars (43 total)', () => {
    for (let i = 0; i < 20; i++) {
      const key = generateApiKey();
      expect(key).toMatch(/^ym_[A-Za-z0-9]{40}$/);
      expect(key).toHaveLength(43);
    }
  });
});

describe("hashKey (pure)", () => {
  it("is deterministic SHA-256 hex", async () => {
    // Known SHA-256("abc") vector.
    expect(await hashKey("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    expect(await hashKey("abc")).toBe(await hashKey("abc"));
    expect(await hashKey("abc")).not.toBe(await hashKey("abd"));
  });
});

describe("apiKeys.createKey", () => {
  it("returns a ym_-prefixed 43-char plaintext key with the requested scopes", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asPro = t.withIdentity({ subject: PRO_CLERK });

    const created = await asPro.mutation(api.apiKeys.createKey, {
      clerkId: PRO_CLERK,
      label: "agent key",
      scopes: ["read:private", "write:memories"],
    });

    expect(created.key).toMatch(/^ym_[A-Za-z0-9]{40}$/);
    expect(created.key).toHaveLength(43);
    expect(created.scopes).toEqual(["read:private", "write:memories"]);
    expect(created.label).toBe("agent key");
    // Default lifetime: 365 days from now.
    expect(created.expiresAt).toBeGreaterThan(Date.now() + 360 * 86400000);
    expect(created.expiresAt).toBeLessThanOrEqual(Date.now() + 365 * 86400000);
  });

  it("stores only the hash plus an encrypted copy — never the plaintext", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asPro = t.withIdentity({ subject: PRO_CLERK });

    const created = await asPro.mutation(api.apiKeys.createKey, {
      clerkId: PRO_CLERK,
      scopes: ["read:public"],
    });

    const rows = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(await hashKey(created.key));
    expect(rows[0].keyHash).not.toBe(created.key);
    expect(rows[0].encryptedKey).toBeDefined();
    expect(rows[0].encryptedKey).not.toContain(created.key);
  });

  it("rejects unauthenticated key creation", async () => {
    const t = convexTest(schema);
    await seedUsers(t);

    await expect(
      t.mutation(api.apiKeys.createKey, {
        clerkId: PRO_CLERK,
        scopes: ["read:public"],
      })
    ).rejects.toThrow(/authentication required/);
  });

  it("free plan: only one active key", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asFree = t.withIdentity({ subject: FREE_CLERK });

    await asFree.mutation(api.apiKeys.createKey, {
      clerkId: FREE_CLERK,
      scopes: ["read:public"],
    });
    await expect(
      asFree.mutation(api.apiKeys.createKey, {
        clerkId: FREE_CLERK,
        scopes: ["read:public"],
      })
    ).rejects.toThrow(/Free plan allows 1 API key/);
  });

  it("free plan: revokeExisting replaces the active key", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asFree = t.withIdentity({ subject: FREE_CLERK });

    await asFree.mutation(api.apiKeys.createKey, {
      clerkId: FREE_CLERK,
      scopes: ["read:public"],
    });
    const replacement = await asFree.mutation(api.apiKeys.createKey, {
      clerkId: FREE_CLERK,
      scopes: ["read:public"],
      revokeExisting: true,
    });
    expect(replacement.key).toMatch(/^ym_/);

    const rows = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    expect(rows).toHaveLength(2);
    expect(rows.filter((k) => !k.revokedAt)).toHaveLength(1);
  });

  it("free plan: scopes beyond read:public are rejected", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asFree = t.withIdentity({ subject: FREE_CLERK });

    await expect(
      asFree.mutation(api.apiKeys.createKey, {
        clerkId: FREE_CLERK,
        scopes: ["read:private"],
      })
    ).rejects.toThrow(/Free plan only supports read:public/);
  });

  it("P36: rejects empty scopes (would classify as legacy full-access)", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asPro = t.withIdentity({ subject: PRO_CLERK });

    await expect(
      asPro.mutation(api.apiKeys.createKey, {
        clerkId: PRO_CLERK,
        scopes: [],
      })
    ).rejects.toThrow(/At least one scope is required/);
  });

  it("P36: rejects unknown scope strings", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asPro = t.withIdentity({ subject: PRO_CLERK });

    await expect(
      asPro.mutation(api.apiKeys.createKey, {
        clerkId: PRO_CLERK,
        scopes: ["read:public", "admin"],
      })
    ).rejects.toThrow(/Unknown scope\(s\): admin/);
  });
});

describe("auth login flow — cli-auth key scope issuance (P36)", () => {
  async function seedLoginChallenge(
    t: ReturnType<typeof convexTest>,
    email: string,
    codeHash: string
  ) {
    await t.run(async (ctx) => {
      await ctx.db.insert("authChallenges", {
        email,
        type: "login",
        codeHash,
        tokenHash: `token-${codeHash}`,
        expiresAt: Date.now() + 60_000,
        attempts: 0,
        createdAt: Date.now(),
      });
    });
  }

  it("issues full owner scopes on the cli-auth key, enforced (not grandfathered)", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    await seedLoginChallenge(t, "pro@example.com", "code-pro");

    const result = await t.mutation(api.auth.completeEmailAuthWithCode, {
      email: "pro@example.com",
      codeHash: "code-pro",
      issueApiKey: true,
    });
    expect(result.apiKey).toMatch(/^ym_/);

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(result.apiKey!),
    });
    // Post-epoch cli-auth key: real scopes, no grandfathering. A
    // requireScope-style check for write paths passes via declared scopes.
    expect(found!.scopes).toEqual([...OWNER_SESSION_SCOPES]);
    for (const scope of ["write:bundle", "write:memories", "vault"]) {
      expect(found!.scopes).toContain(scope);
    }

    const rows = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    const cliKey = rows.find((k) => k.label === "cli-auth");
    expect(cliKey?.scopes).toEqual([...OWNER_SESSION_SCOPES]);
  });

  it("free-plan logins also get full owner scopes (owner session bypasses the plan ceiling)", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    await seedLoginChallenge(t, "free@example.com", "code-free");

    const result = await t.mutation(api.auth.completeEmailAuthWithCode, {
      email: "free@example.com",
      codeHash: "code-free",
      issueApiKey: true,
    });
    expect(result.apiKey).toMatch(/^ym_/);

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(result.apiKey!),
    });
    expect(found!.scopes).toEqual([...OWNER_SESSION_SCOPES]);
  });

  it("login with issueApiKey revokes existing keys (free plan single-key invariant)", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asFree = t.withIdentity({ subject: FREE_CLERK });
    await asFree.mutation(api.apiKeys.createKey, {
      clerkId: FREE_CLERK,
      scopes: ["read:public"],
    });

    await seedLoginChallenge(t, "free@example.com", "code-free-2");
    await t.mutation(api.auth.completeEmailAuthWithCode, {
      email: "free@example.com",
      codeHash: "code-free-2",
      issueApiKey: true,
    });

    const rows = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    const active = rows.filter((k) => !k.revokedAt);
    expect(active).toHaveLength(1);
    expect(active[0].label).toBe("cli-auth");
  });
});

describe("apiKeys.getByHash — scope classification for http auth", () => {
  it("returns declared scopes for a modern post-epoch key", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    const asPro = t.withIdentity({ subject: PRO_CLERK });

    const created = await asPro.mutation(api.apiKeys.createKey, {
      clerkId: PRO_CLERK,
      label: "scoped agent key",
      scopes: ["read:private"],
    });

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(created.key),
    });
    expect(found).not.toBeNull();
    expect(found!.userId).toBe(PRO_CLERK);
    expect(found!.username).toBe("pro-user");
    // NOT grandfathered: scopes survive for requireScope enforcement.
    expect(found!.scopes).toEqual(["read:private"]);
    expect(found!.declaredScopes).toEqual(["read:private"]);
  });

  it("returns scopes: null (grandfathered) for a pre-epoch key", async () => {
    const t = convexTest(schema);
    const { proId } = await seedUsers(t);

    const plaintext = generateApiKey();
    await t.run(async (ctx) => {
      await ctx.db.insert("apiKeys", {
        userId: proId,
        keyHash: await hashKey(plaintext),
        label: "old settings-ui key",
        scopes: ["read:public"],
        createdAt: SCOPE_ENFORCEMENT_EPOCH - 1,
      });
    });

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(plaintext),
    });
    expect(found!.scopes).toBeNull();
    expect(found!.declaredScopes).toEqual(["read:public"]);
  });

  it('P36: a post-epoch "cli-auth" key is NOT grandfathered — declared scopes are enforced', async () => {
    const t = convexTest(schema);
    const { proId } = await seedUsers(t);

    const plaintext = generateApiKey();
    await t.run(async (ctx) => {
      await ctx.db.insert("apiKeys", {
        userId: proId,
        keyHash: await hashKey(plaintext),
        label: "cli-auth",
        scopes: ["read:public"],
        createdAt: SCOPE_ENFORCEMENT_EPOCH + 1,
      });
    });

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(plaintext),
    });
    // Carve-out removed: scopes survive for requireScope enforcement.
    expect(found!.scopes).toEqual(["read:public"]);
    expect(found!.declaredScopes).toEqual(["read:public"]);
  });

  it('pre-epoch "cli-auth" keys stay grandfathered (scopes: null) — old sessions keep working', async () => {
    const t = convexTest(schema);
    const { proId } = await seedUsers(t);

    const plaintext = generateApiKey();
    await t.run(async (ctx) => {
      await ctx.db.insert("apiKeys", {
        userId: proId,
        keyHash: await hashKey(plaintext),
        label: "cli-auth",
        scopes: ["read:public"],
        createdAt: SCOPE_ENFORCEMENT_EPOCH - 1,
      });
    });

    const found = await t.query(api.apiKeys.getByHash, {
      keyHash: await hashKey(plaintext),
    });
    expect(found!.scopes).toBeNull();
    expect(found!.declaredScopes).toEqual(["read:public"]);
  });

  it("returns null for an unknown hash", async () => {
    const t = convexTest(schema);
    await seedUsers(t);
    expect(
      await t.query(api.apiKeys.getByHash, { keyHash: "no-such-hash" })
    ).toBeNull();
  });
});
