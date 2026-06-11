/**
 * Cryptographically secure token generation (P4 / roadmap 0.1).
 *
 * Uses Web Crypto's crypto.getRandomValues — available in the Convex runtime.
 * Do NOT import node:crypto here; Convex functions run on the Convex JS
 * runtime, not Node.
 */

export const BASE62_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const LOWERCASE_BASE36_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a cryptographically secure random string of `length` characters
 * drawn uniformly from `alphabet` (rejection sampling — no modulo bias).
 */
export function secureRandomString(
  length: number,
  alphabet: string = BASE62_ALPHABET,
): string {
  if (length <= 0) return "";
  if (alphabet.length < 2 || alphabet.length > 256) {
    throw new Error("secureRandomString: alphabet must have 2-256 characters");
  }
  // Largest multiple of alphabet.length that fits in a byte; bytes at or
  // above this are rejected so every character is uniformly likely.
  const maxValid = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const byte = buf[i];
      if (byte < maxValid) {
        out += alphabet[byte % alphabet.length];
      }
    }
  }
  return out;
}

/**
 * Generate a secure random token from `bytes` of entropy, hex-encoded
 * (returns `bytes * 2` characters).
 */
export function generateSecureToken(bytes = 32): string {
  if (bytes <= 0) throw new Error("generateSecureToken: bytes must be > 0");
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
