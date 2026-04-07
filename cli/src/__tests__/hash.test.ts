import { describe, it, expect } from "vitest";
import { computeContentHash, shortHash } from "../lib/hash";

describe("hash", () => {
  describe("computeContentHash", () => {
    it("returns a 64-char hex string (SHA-256)", () => {
      const hash = computeContentHash({ test: true }, "# test");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic — same input produces same hash", () => {
      const a = computeContentHash({ x: 1, y: "hello" }, "markdown");
      const b = computeContentHash({ x: 1, y: "hello" }, "markdown");
      expect(a).toBe(b);
    });

    it("is order-independent for object keys", () => {
      const a = computeContentHash({ z: 1, a: 2 }, "md");
      const b = computeContentHash({ a: 2, z: 1 }, "md");
      expect(a).toBe(b);
    });

    it("is sensitive to JSON changes", () => {
      const a = computeContentHash({ x: 1 }, "same");
      const b = computeContentHash({ x: 2 }, "same");
      expect(a).not.toBe(b);
    });

    it("is sensitive to markdown changes", () => {
      const a = computeContentHash({ x: 1 }, "hello");
      const b = computeContentHash({ x: 1 }, "hello world");
      expect(a).not.toBe(b);
    });

    it("handles empty objects", () => {
      const hash = computeContentHash({}, "");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("shortHash", () => {
    it("returns first 12 characters", () => {
      const hash = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      expect(shortHash(hash)).toBe("abcdef123456");
      expect(shortHash(hash)).toHaveLength(12);
    });
  });
});
