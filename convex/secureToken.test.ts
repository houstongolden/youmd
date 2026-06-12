/**
 * Secure token generation contract tests (T3).
 *
 * convex/lib/secureToken.ts backs API keys ("ym_" + 40 base62), context-link
 * tokens, and auth session tokens. These tests pin length, alphabet
 * membership, hex encoding, and the rejection-sampling guarantees.
 */
import { describe, expect, it } from "vitest";

import {
  BASE62_ALPHABET,
  LOWERCASE_BASE36_ALPHABET,
  generateSecureToken,
  secureRandomString,
} from "./lib/secureToken";

describe("secureRandomString", () => {
  it("returns exactly the requested length", () => {
    for (const length of [1, 8, 40, 64, 129]) {
      expect(secureRandomString(length)).toHaveLength(length);
    }
  });

  it("returns empty string for zero/negative length", () => {
    expect(secureRandomString(0)).toBe("");
    expect(secureRandomString(-5)).toBe("");
  });

  it("throws on degenerate alphabets (<2 or >256 chars)", () => {
    expect(() => secureRandomString(10, "")).toThrow();
    expect(() => secureRandomString(10, "a")).toThrow();
    expect(() => secureRandomString(10, "x".repeat(257))).toThrow();
  });

  it("only emits characters from the default base62 alphabet over many draws", () => {
    const allowed = new Set(BASE62_ALPHABET);
    for (let i = 0; i < 200; i++) {
      const token = secureRandomString(64);
      for (const ch of token) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("only emits characters from a custom alphabet", () => {
    const allowed = new Set(LOWERCASE_BASE36_ALPHABET);
    for (let i = 0; i < 100; i++) {
      const token = secureRandomString(32, LOWERCASE_BASE36_ALPHABET);
      for (const ch of token) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("rejection sampling produces broad coverage of the alphabet (sanity)", () => {
    // 200 draws x 64 chars = 12800 samples over 62 symbols; expecting every
    // symbol with overwhelming probability. Require >55 distinct to stay
    // flake-free while still catching a biased/broken sampler.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      for (const ch of secureRandomString(64)) seen.add(ch);
    }
    expect(seen.size).toBeGreaterThan(55);
  });

  it("produces distinct values across calls (CSPRNG smoke check)", () => {
    const a = secureRandomString(40);
    const b = secureRandomString(40);
    expect(a).not.toBe(b);
  });

  it("pins the canonical alphabets", () => {
    expect(BASE62_ALPHABET).toHaveLength(62);
    expect(new Set(BASE62_ALPHABET).size).toBe(62);
    expect(LOWERCASE_BASE36_ALPHABET).toHaveLength(36);
    expect(new Set(LOWERCASE_BASE36_ALPHABET).size).toBe(36);
  });
});

describe("generateSecureToken", () => {
  it("returns bytes*2 lowercase hex characters", () => {
    expect(generateSecureToken()).toMatch(/^[0-9a-f]{64}$/); // default 32 bytes
    expect(generateSecureToken(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSecureToken(1)).toMatch(/^[0-9a-f]{2}$/);
  });

  it("throws on zero/negative byte counts", () => {
    expect(() => generateSecureToken(0)).toThrow();
    expect(() => generateSecureToken(-1)).toThrow();
  });

  it("produces distinct tokens across calls", () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken());
  });
});
