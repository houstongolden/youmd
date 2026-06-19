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

  it("records Secret Vault pull/download events without ciphertext or passphrase material", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const asOwner = t.withIdentity({ subject: CLERK });

    await asOwner.mutation(api.secretVault.recordPullActivity, {
      clerkId: CLERK,
      kind: "snapshot-pulled",
      fileName: "env-vault-2026-06-19T1200Z.tar.enc",
      projectCount: 16,
      variableCount: 451,
      sizeBytes: 123456,
      sourceHost: "Houstons-MBP.lan",
      sha256: "abcdef1234567890abcdef1234567890",
    });
    await asOwner.mutation(api.secretVault.recordPullActivity, {
      clerkId: CLERK,
      kind: "envelope-pulled",
      deviceId: "svd_macMini123456",
      fileName: "env-vault-2026-06-19T1200Z.tar.enc",
      projectCount: 16,
      variableCount: 451,
      sizeBytes: 123456,
      sourceHost: "Houstons-MBP.lan",
      targetHost: "Houstons-Mini.lan",
      sha256: "abcdef1234567890abcdef1234567890",
    });

    const activities = await asOwner.query(api.brainActivity.listRecent, {
      clerkId: CLERK,
      source: "vault",
      limit: 10,
    });

    expect(activities).toHaveLength(2);
    expect(activities.map((activity) => activity.title)).toEqual([
      "Secret Vault encrypted snapshot downloaded",
      "Secret Vault device envelope pulled",
    ]);
    expect(activities[0]).toMatchObject({
      source: "vault",
      channel: "secret-vault",
      kind: "pulled",
      status: "ok",
      detail: "16 projects / 451 vars · env-vault-2026-06-19T1200Z.tar.enc",
      entityType: "secretVaultSnapshot",
      entityId: "latest",
      sourceHost: "Houstons-MBP.lan",
      secretValuesExposed: false,
    });
    expect(activities[1]).toMatchObject({
      source: "vault",
      channel: "secret-vault",
      kind: "pulled",
      status: "ok",
      detail: "trusted-device envelope pulled for svd_macMini123456",
      entityType: "secretVaultKeyEnvelope",
      entityId: "latest",
      sourceHost: "Houstons-MBP.lan",
      secretValuesExposed: false,
    });
    const serialized = JSON.stringify(activities);
    expect(serialized).not.toContain("wrappedPassphraseBase64");
    expect(serialized).not.toContain("encryptedArchiveBase64");
    expect(serialized).not.toContain("TEST_PUBLIC_KEY_ONLY");
    expect(serialized).not.toContain("abcdef1234567890abcdef1234567890");
    expect(serialized).toContain("abcdef123456");
  });
});
