/**
 * L17 — stackUpdate unit tests.
 * Covers: version comparison, update detection, "none" fallback.
 * Network calls are mocked so these run offline.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkStackUpdate } from "../lib/stackUpdate";
import type { LoadedYouStack } from "../lib/youstack";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeLoaded(version: string, extra?: Partial<LoadedYouStack["manifest"]>): LoadedYouStack {
  return {
    manifest: {
      schemaVersion: "youstack/v1",
      kind: "youstack",
      slug: "test-stack",
      name: "test stack",
      version,
      visibility: "private",
      ...extra,
    },
    manifestPath: "/tmp/stacks/test-stack/youstack.json",
    rootDir: "/tmp/stacks/test-stack",
    validation: { ok: true, errors: [], warnings: [] },
  };
}

// Intercept global fetch for source-url tests.
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Unit tests ────────────────────────────────────────────────────────────

describe("checkStackUpdate — no upstream configured", () => {
  it("returns source=none when manifest has no update.source or owner.repo", async () => {
    const loaded = makeLoaded("1.0.0");
    const info = await checkStackUpdate(loaded);
    expect(info.source).toBe("none");
    expect(info.updateAvailable).toBe(false);
    expect(info.latestVersion).toBeNull();
    expect(info.message).toMatch(/no upstream/);
  });

  it("reports currentVersion from manifest", async () => {
    const loaded = makeLoaded("2.3.1");
    const info = await checkStackUpdate(loaded);
    expect(info.currentVersion).toBe("2.3.1");
  });
});

describe("checkStackUpdate — source-url path", () => {
  it("detects an update when upstream version is newer", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ schemaVersion: "youstack/v1", version: "2.0.0" }),
      })
      .mockResolvedValueOnce({ ok: false }); // changelog fetch

    const loaded = makeLoaded("1.5.0", {
      update: { source: "https://example.com/stacks/mystack/youstack.json" },
    });
    const info = await checkStackUpdate(loaded);
    expect(info.source).toBe("source-url");
    expect(info.updateAvailable).toBe(true);
    expect(info.currentVersion).toBe("1.5.0");
    expect(info.latestVersion).toBe("2.0.0");
    expect(info.message).toMatch(/update available/);
  });

  it("reports up-to-date when upstream matches local", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: "1.5.0" }),
      })
      .mockResolvedValueOnce({ ok: false });

    const loaded = makeLoaded("1.5.0", {
      update: { source: "https://example.com/stacks/mystack/youstack.json" },
    });
    const info = await checkStackUpdate(loaded);
    expect(info.updateAvailable).toBe(false);
    expect(info.message).toMatch(/up to date/);
  });

  it("captures changelog hint when CHANGELOG.md is beside the manifest", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: "3.0.0" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "# Changelog\n\nfixed routing bug\n",
      });

    const loaded = makeLoaded("2.9.0", {
      update: { source: "https://example.com/youstack.json" },
    });
    const info = await checkStackUpdate(loaded);
    expect(info.changelogHint).toBe("fixed routing bug");
  });

  it("handles fetch failure gracefully, falls through to none", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const loaded = makeLoaded("1.0.0", {
      update: { source: "https://example.com/youstack.json" },
    });
    const info = await checkStackUpdate(loaded);
    // fetch fails → no version from source-url → owner.repo not set → none
    expect(info.source).toBe("none");
    expect(info.updateAvailable).toBe(false);
  });
});

describe("checkStackUpdate — version comparison edge cases", () => {
  it("1.0.0 vs 1.0.1 → update available", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: "1.0.1" }) })
      .mockResolvedValueOnce({ ok: false });
    const loaded = makeLoaded("1.0.0", { update: { source: "https://x.com/youstack.json" } });
    const info = await checkStackUpdate(loaded);
    expect(info.updateAvailable).toBe(true);
  });

  it("2.0.0 vs 1.9.9 → NOT an update", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: "1.9.9" }) })
      .mockResolvedValueOnce({ ok: false });
    const loaded = makeLoaded("2.0.0", { update: { source: "https://x.com/youstack.json" } });
    const info = await checkStackUpdate(loaded);
    expect(info.updateAvailable).toBe(false);
  });

  it("same version → not an update", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ version: "1.2.3" }) })
      .mockResolvedValueOnce({ ok: false });
    const loaded = makeLoaded("1.2.3", { update: { source: "https://x.com/youstack.json" } });
    const info = await checkStackUpdate(loaded);
    expect(info.updateAvailable).toBe(false);
  });
});
