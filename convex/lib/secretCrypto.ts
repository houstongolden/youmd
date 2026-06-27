/**
 * Shared AES-GCM secret encryption for values we must be able to read back
 * later (unlike password/code hashes, which are one-way). Currently used to
 * protect GitHub OAuth access tokens at rest so we can create/read/write the
 * user's repo and clone it server-side for the agentic/API/MCP surfaces.
 *
 * Uses the same secret as the API key encryption path so deployments only need
 * one configured secret (`API_KEY_ENCRYPTION_SECRET`, falling back to
 * `TRUSTED_INTERNAL_AUTH_TOKEN`).
 */

function getEncryptionSecret(): string {
  const secret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.TRUSTED_INTERNAL_AUTH_TOKEN;
  if (!secret || secret.length < 32) {
    throw new Error("Secret encryption key is not configured");
  }
  return secret;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(getEncryptionSecret());
  const digest = await crypto.subtle.digest("SHA-256", secretBytes);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return buffer;
}

// Optional AES-GCM additional authenticated data (AAD) for domain separation. When provided, a
// ciphertext can only be decrypted with the SAME `aad` — so blobs from one secret class (e.g.
// folder.md keys) can never be cross-decrypted as another (e.g. GitHub tokens), even though both
// share the deployment encryption secret. Omit it for byte-identical legacy behavior.

export async function encryptSecret(
  plaintext: string,
  aad?: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = aad ? encoder.encode(aad) : undefined;
  const encrypted = await crypto.subtle.encrypt(
    additionalData ? { name: "AES-GCM", iv, additionalData } : { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptSecret(
  ciphertext: string,
  iv: string,
  aad?: string
): Promise<string> {
  const key = await getCryptoKey();
  const ivBytes = new Uint8Array(base64ToArrayBuffer(iv));
  const additionalData = aad ? new TextEncoder().encode(aad) : undefined;
  const decrypted = await crypto.subtle.decrypt(
    additionalData ? { name: "AES-GCM", iv: ivBytes, additionalData } : { name: "AES-GCM", iv: ivBytes },
    key,
    base64ToArrayBuffer(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}
