import { describe, it, expect } from "vitest";
import {
  computeRawSourceHash,
  isContentChanged,
  shouldRecordVersion,
  buildProvenanceMap,
  buildSourcesUsed,
  assertNoInPlaceOverwrite,
} from "./sourceHashing";

describe("computeRawSourceHash", () => {
  it("is deterministic and content-addressed", async () => {
    const a = await computeRawSourceHash("hello world");
    const b = await computeRawSourceHash("hello world");
    const c = await computeRawSourceHash("hello world!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes string and equivalent bytes identically", async () => {
    const str = "abc";
    const bytes = new TextEncoder().encode(str).buffer;
    expect(await computeRawSourceHash(str)).toBe(await computeRawSourceHash(bytes));
  });
});

describe("change detection", () => {
  it("isContentChanged", () => {
    expect(isContentChanged(undefined, "x")).toBe(true);
    expect(isContentChanged("x", "y")).toBe(true);
    expect(isContentChanged("x", "x")).toBe(false);
    expect(isContentChanged("x", "")).toBe(false);
  });

  it("shouldRecordVersion: first fetch or changed content only", () => {
    expect(shouldRecordVersion(undefined, "x")).toBe(true); // first fetch
    expect(shouldRecordVersion("x", "y")).toBe(true); // changed
    expect(shouldRecordVersion("x", "x")).toBe(false); // identical — no new version
    expect(shouldRecordVersion(undefined, "")).toBe(false); // nothing fetched
  });
});

describe("provenance", () => {
  const sources = [
    { sourceType: "website", sourceUrl: "https://a.com", lastRawContentHash: "h1", latestVersionId: "v1", lastFetched: 100, status: "extracted" },
    { sourceType: "linkedin", sourceUrl: "https://linkedin.com/in/x", lastRawContentHash: "h2", lastFetched: 200, status: "extracted" },
    { sourceType: "pending", sourceUrl: "https://p.com", status: "pending" },
    { sourceType: "nourl", sourceUrl: "", status: "extracted" },
  ];

  it("buildProvenanceMap includes only extracted sources with URLs", () => {
    const map = buildProvenanceMap(sources);
    expect(Object.keys(map).sort()).toEqual(["linkedin", "website"]);
    expect(map.website).toMatchObject({ url: "https://a.com", content_hash: "h1", version_id: "v1" });
  });

  it("buildSourcesUsed returns a sorted flat list with real URLs", () => {
    const used = buildSourcesUsed(sources);
    expect(used.map((u) => u.type)).toEqual(["linkedin", "website"]);
    expect(used.every((u) => u.url.startsWith("https://"))).toBe(true);
  });
});

describe("assertNoInPlaceOverwrite", () => {
  it("throws when content changed (forces versioning)", () => {
    expect(() => assertNoInPlaceOverwrite("h1", "h2")).toThrow(/immutable-source violation/);
  });
  it("allows first fetch and identical content", () => {
    expect(() => assertNoInPlaceOverwrite(undefined, "h1")).not.toThrow();
    expect(() => assertNoInPlaceOverwrite("h1", "h1")).not.toThrow();
  });
});
