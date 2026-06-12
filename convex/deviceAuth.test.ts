/**
 * Device-flow auth state machine tests (U7, RFC 8628-shaped).
 *
 * Pins the contract behind POST /api/v1/auth/device/start and
 * POST /api/v1/auth/device/poll plus the /device approval page mutations:
 *   - start stores only hashes; userCode comes from the unambiguous alphabet
 *   - pending → approved → consumed (key minted exactly once, single-use)
 *   - poll pacing (slow_down when polled faster than the interval)
 *   - expiry, deny, wrong-code attempts → per-user lockout
 *   - approval requires an authenticated web session
 *
 * NOTE: the HTTP routes themselves are not executed here (convex-test does
 * not run the http router with production env secrets); these tests cover
 * the internalMutations/mutations beneath them, mirroring apiKeys.test.ts.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api, internal } from "./_generated/api";
import schema from "./schema";
import { hashKey } from "./apiKeys";
import {
  DEVICE_USER_CODE_ALPHABET,
  normalizeUserCode,
} from "./auth";
import { OWNER_SESSION_SCOPES } from "./lib/scopes";

const CLERK_A = "clerk_device_a";
const CLERK_B = "clerk_device_b";

beforeAll(() => {
  // pollDeviceAuth mints a cli-auth key, which encrypts the plaintext for
  // later reveal; the secret must be >= 32 chars (see convex/apiKeys.ts).
  process.env.API_KEY_ENCRYPTION_SECRET = "test-secret-".padEnd(48, "x");
});

async function seedUser(
  t: ReturnType<typeof convexTest>,
  clerkId = CLERK_A,
  plan: "free" | "pro" = "pro"
) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId,
      username: `user-${clerkId}`,
      email: `${clerkId}@example.com`,
      plan,
      createdAt: Date.now(),
    });
  });
}

async function startFlow(t: ReturnType<typeof convexTest>) {
  return await t.mutation(internal.auth.startDeviceAuth, {
    clientName: "youmd CLI on darwin",
  });
}

describe("normalizeUserCode (pure)", () => {
  it("uppercases and strips separators", () => {
    expect(normalizeUserCode("abcd-efgh")).toBe("ABCDEFGH");
    expect(normalizeUserCode(" ab cd ef gh ")).toBe("ABCDEFGH");
    expect(normalizeUserCode("AB2D-EF3H")).toBe("AB2DEF3H");
  });
});

describe("startDeviceAuth", () => {
  it("returns a 64-hex deviceCode, an 8-char unambiguous userCode, 600s expiry, 5s interval", async () => {
    const t = convexTest(schema);
    const started = await startFlow(t);

    expect(started.deviceCode).toMatch(/^[0-9a-f]{64}$/);
    expect(started.userCode).toHaveLength(8);
    for (const ch of started.userCode) {
      expect(DEVICE_USER_CODE_ALPHABET).toContain(ch);
    }
    expect(started.expiresIn).toBe(600);
    expect(started.interval).toBe(5);
    expect(started.expiresAt).toBeGreaterThan(Date.now());
  });

  it("stores only hashes — never the plaintext codes", async () => {
    const t = convexTest(schema);
    const started = await startFlow(t);

    const rows = await t.run((ctx) =>
      ctx.db.query("deviceAuthRequests").collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].clientName).toBe("youmd CLI on darwin");
    expect(rows[0].deviceCodeHash).toBe(await hashKey(started.deviceCode));
    expect(rows[0].userCodeHash).toBe(
      await hashKey(normalizeUserCode(started.userCode))
    );
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain(started.deviceCode);
    expect(serialized).not.toContain(started.userCode);
  });
});

describe("pollDeviceAuth state machine", () => {
  it("pending on first poll, slow_down when re-polled faster than the interval", async () => {
    const t = convexTest(schema);
    const started = await startFlow(t);
    const deviceCodeHash = await hashKey(started.deviceCode);

    const first = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(first.status).toBe("pending");

    const second = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(second.status).toBe("slow_down");

    // slow_down must not bump the pacing clock — a compliant poll after the
    // interval passes again. Simulate by rewinding lastPolledAt.
    await t.run(async (ctx) => {
      const row = await ctx.db.query("deviceAuthRequests").first();
      await ctx.db.patch(row!._id, { lastPolledAt: Date.now() - 6000 });
    });
    const third = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(third.status).toBe("pending");
  });

  it("unknown deviceCode → invalid", async () => {
    const t = convexTest(schema);
    const result = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash: await hashKey("not-a-real-code"),
    });
    expect(result.status).toBe("invalid");
  });

  it("expired pending request → expired, then invalid (row cleaned up)", async () => {
    const t = convexTest(schema);
    const started = await startFlow(t);
    const deviceCodeHash = await hashKey(started.deviceCode);

    await t.run(async (ctx) => {
      const row = await ctx.db.query("deviceAuthRequests").first();
      await ctx.db.patch(row!._id, { expiresAt: Date.now() - 1 });
    });

    const expired = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(expired.status).toBe("expired");

    // Read-time cleanup deleted the row — subsequent polls are invalid.
    const again = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(again.status).toBe("invalid");
    const rows = await t.run((ctx) =>
      ctx.db.query("deviceAuthRequests").collect()
    );
    expect(rows).toHaveLength(0);
  });
});

describe("approve → poll → consume", () => {
  it("full happy path: approve binds the web user, poll mints the cli-auth owner key ONCE", async () => {
    const t = convexTest(schema);
    const userId = await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });

    const started = await startFlow(t);
    const deviceCodeHash = await hashKey(started.deviceCode);

    // Approval page: lookup shows the device info first.
    const lookup = await asUser.mutation(api.auth.lookupDeviceAuth, {
      userCode: started.userCode,
    });
    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      expect(lookup.device.clientName).toBe("youmd CLI on darwin");
    }

    // Approve — accepts the dash-formatted code the CLI displays.
    const formatted = `${started.userCode.slice(0, 4)}-${started.userCode.slice(4).toLowerCase()}`;
    const resolved = await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: formatted,
      approve: true,
    });
    expect(resolved).toEqual({ ok: true, status: "approved" });

    const row = await t.run((ctx) => ctx.db.query("deviceAuthRequests").first());
    expect(row!.status).toBe("approved");
    expect(row!.userId).toBe(userId);

    // CLI poll: key minted exactly once, full owner-session scopes.
    const polled = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(polled.status).toBe("approved");
    if (polled.status === "approved") {
      expect(polled.apiKey).toMatch(/^ym_[A-Za-z0-9]{40}$/);
      expect(polled.username).toBe(`user-${CLERK_A}`);
      expect(polled.email).toBe(`${CLERK_A}@example.com`);

      const keys = await t.run((ctx) => ctx.db.query("apiKeys").collect());
      expect(keys).toHaveLength(1);
      expect(keys[0].label).toBe("cli-auth");
      expect(keys[0].scopes).toEqual([...OWNER_SESSION_SCOPES]);
      expect(keys[0].keyHash).toBe(await hashKey(polled.apiKey));
    }

    // Single-use: the row is consumed — the key is never returned again.
    const replay = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(replay.status).toBe("invalid");
    const consumed = await t.run((ctx) =>
      ctx.db.query("deviceAuthRequests").first()
    );
    expect(consumed!.status).toBe("consumed");
  });

  it("free-plan users get the owner-session key too (ownerSession bypasses the scope ceiling)", async () => {
    const t = convexTest(schema);
    await seedUser(t, CLERK_B, "free");
    const asUser = t.withIdentity({ subject: CLERK_B });

    const started = await startFlow(t);
    await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: true,
    });
    const polled = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash: await hashKey(started.deviceCode),
    });
    expect(polled.status).toBe("approved");
  });

  it("an approved code cannot be approved or denied again (single-use)", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });

    const started = await startFlow(t);
    await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: true,
    });

    const again = await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: true,
    });
    expect(again).toEqual({ ok: false, reason: "invalid_code" });
  });
});

describe("deny path", () => {
  it("deny → poll returns denied once, then invalid (row deleted)", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });

    const started = await startFlow(t);
    const deviceCodeHash = await hashKey(started.deviceCode);

    const resolved = await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: false,
    });
    expect(resolved).toEqual({ ok: true, status: "denied" });

    const denied = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(denied.status).toBe("denied");

    const replay = await t.mutation(internal.auth.pollDeviceAuth, {
      deviceCodeHash,
    });
    expect(replay.status).toBe("invalid");

    // No key was ever minted.
    const keys = await t.run((ctx) => ctx.db.query("apiKeys").collect());
    expect(keys).toHaveLength(0);
  });
});

describe("approval security", () => {
  it("lookup and resolve require an authenticated web session", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const started = await startFlow(t);

    await expect(
      t.mutation(api.auth.lookupDeviceAuth, { userCode: started.userCode })
    ).rejects.toThrow(/authentication required/);
    await expect(
      t.mutation(api.auth.resolveDeviceAuth, {
        userCode: started.userCode,
        approve: true,
      })
    ).rejects.toThrow(/authentication required/);

    // The request is untouched — still pending.
    const row = await t.run((ctx) => ctx.db.query("deviceAuthRequests").first());
    expect(row!.status).toBe("pending");
  });

  it("wrong userCode → invalid_code; repeated failures → locked_out even for the right code", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });
    const started = await startFlow(t);

    // 10 failed attempts hit the per-user lockout window.
    for (let i = 0; i < 10; i++) {
      const res = await asUser.mutation(api.auth.lookupDeviceAuth, {
        userCode: "WRONGCDE",
      });
      expect(res).toEqual({ ok: false, reason: "invalid_code" });
    }

    const lockedLookup = await asUser.mutation(api.auth.lookupDeviceAuth, {
      userCode: started.userCode,
    });
    expect(lockedLookup).toEqual({ ok: false, reason: "locked_out" });

    const lockedResolve = await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: true,
    });
    expect(lockedResolve).toEqual({ ok: false, reason: "locked_out" });

    // Lockout never approved anything.
    const row = await t.run((ctx) => ctx.db.query("deviceAuthRequests").first());
    expect(row!.status).toBe("pending");
  });

  it("successful lookups do not count toward the lockout", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });
    const started = await startFlow(t);

    for (let i = 0; i < 12; i++) {
      const res = await asUser.mutation(api.auth.lookupDeviceAuth, {
        userCode: started.userCode,
      });
      expect(res.ok).toBe(true);
    }
  });

  it("expired codes cannot be approved (and are cleaned up at read time)", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asUser = t.withIdentity({ subject: CLERK_A });
    const started = await startFlow(t);

    await t.run(async (ctx) => {
      const row = await ctx.db.query("deviceAuthRequests").first();
      await ctx.db.patch(row!._id, { expiresAt: Date.now() - 1 });
    });

    const res = await asUser.mutation(api.auth.resolveDeviceAuth, {
      userCode: started.userCode,
      approve: true,
    });
    expect(res).toEqual({ ok: false, reason: "invalid_code" });
    const rows = await t.run((ctx) =>
      ctx.db.query("deviceAuthRequests").collect()
    );
    expect(rows).toHaveLength(0);
  });
});
