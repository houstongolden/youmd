/**
 * secretCrypto round-trip + AES-GCM domain-separation (AAD) tests.
 * The AAD binding is what keeps a folder.md key ciphertext from ever being decryptable as a
 * GitHub token (and vice-versa) even though both share the deployment encryption secret.
 */
import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = "test-secret-".padEnd(48, "x");
});

describe("secretCrypto", () => {
  it("round-trips a value with no AAD (legacy behavior)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secretCrypto");
    const { ciphertext, iv } = await encryptSecret("hello-secret");
    expect(await decryptSecret(ciphertext, iv)).toBe("hello-secret");
  });

  it("round-trips a value with a matching AAD", async () => {
    const { encryptSecret, decryptSecret } = await import("./secretCrypto");
    const { ciphertext, iv } = await encryptSecret("fmd_live_abc", "foldermd-api-key:v1");
    expect(await decryptSecret(ciphertext, iv, "foldermd-api-key:v1")).toBe("fmd_live_abc");
  });

  it("refuses to decrypt across domains (AAD mismatch / missing AAD)", async () => {
    const { encryptSecret, decryptSecret } = await import("./secretCrypto");
    const { ciphertext, iv } = await encryptSecret("fmd_live_abc", "foldermd-api-key:v1");
    // wrong AAD
    await expect(decryptSecret(ciphertext, iv, "github-token:v1")).rejects.toBeTruthy();
    // no AAD (e.g. the GitHub-token reader) cannot read a folder.md key blob
    await expect(decryptSecret(ciphertext, iv)).rejects.toBeTruthy();
  });
});
