import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import schema from "./schema";

const CLERK = "clerk_secret_vault_owner";

async function seedUser(t: ReturnType<typeof convexTest>) {
  return await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: CLERK,
      username: "secret-vault-owner",
      email: "vault@example.com",
      plan: "pro",
      createdAt: Date.now(),
    })
  );
}

describe("secret vault activity", () => {
  it("records trusted-device registration in the canonical brain activity stream", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(api.secretVault.registerDevice, {
      clerkId: CLERK,
      deviceId: "svd_testDevice123456",
      deviceName: "Houston Mac Mini",
      hostName: "Houstons-Mini.lan",
      platform: "darwin arm64",
      publicKeyPem: "-----BEGIN PUBLIC KEY-----\nTEST_PUBLIC_KEY_ONLY\n-----END PUBLIC KEY-----",
      keyAlgorithm: "rsa-oaep-sha256",
    });

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "vault",
      limit: 10,
    });

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      activityId: "secret-vault:device:svd_testDevice123456",
      source: "vault",
      channel: "secret-vault",
      kind: "registered",
      status: "ok",
      title: "Secret Vault trusted device registered: Houston Mac Mini",
      detail: "Houstons-Mini.lan · darwin arm64",
      entityType: "secretVaultDevice",
      entityId: "svd_testDevice123456",
      sourceHost: "Houstons-Mini.lan",
      sourceAgent: "youmd-secret-vault",
      secretValuesExposed: false,
    });
    expect(activities[0].metadata).toMatchObject({
      deviceId: "svd_testDevice123456",
      deviceName: "Houston Mac Mini",
      hostName: "Houstons-Mini.lan",
      platform: "darwin arm64",
      keyAlgorithm: "rsa-oaep-sha256",
      trusted: true,
      revoked: false,
      secretValuesExposed: false,
    });
    expect(JSON.stringify(activities[0])).not.toContain("TEST_PUBLIC_KEY_ONLY");
  });
});
