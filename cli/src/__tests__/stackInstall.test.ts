/**
 * P9 — stackInstall unit tests.
 *
 * Covers: happy path install, 404 not_found, conflict (existing dir without
 * --force), --force overwrite, invalid_manifest, network error.
 *
 * All network calls and fs writes are mocked so these run fully offline and
 * without touching the real filesystem.
 */

import * as os from "os";
import * as path from "path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";

// ── Mock config so getConvexSiteUrl returns a fixed URL ───────────────────
vi.mock("../lib/config", () => ({
  getConvexSiteUrl: () => "https://test.convex.site",
}));

// ── Mock the host-link engine (linkYouStackAdapters) ─────────────────────
vi.mock("../lib/youstack", async (importActual) => {
  const actual = await importActual<typeof import("../lib/youstack")>();
  return {
    ...actual,
    linkYouStackAdapters: vi.fn(() => [
      { host: "claude-code", targetPath: "/fake/.claude/skills/test/SKILL.md", wrote: true, content: "# test" },
    ]),
  };
});

import { fetchRegistryEntry, installStack } from "../lib/stackInstall";

// ── Global fetch mock ─────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const VALID_MANIFEST = {
  schemaVersion: "youstack/v1" as const,
  kind: "youstack" as const,
  slug: "test-stack",
  name: "test stack",
  version: "1.0.0",
  visibility: "public-open" as const,
};

const MANIFEST_CONTENT = JSON.stringify(VALID_MANIFEST);

const REGISTRY_RESPONSE = {
  user: "alice",
  slug: "test-stack",
  manifest: VALID_MANIFEST,
  files: [
    { path: "stacks/test-stack/youstack.json", content: MANIFEST_CONTENT, size: MANIFEST_CONTENT.length },
    { path: "stacks/test-stack/SKILL.md", content: "# test skill", size: 13 },
  ],
  fileCount: 2,
  truncated: false,
  syncedAt: Date.now(),
  stale: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── fetchRegistryEntry ────────────────────────────────────────────────────

describe("fetchRegistryEntry", () => {
  it("returns registry response on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => REGISTRY_RESPONSE,
    });

    const result = await fetchRegistryEntry("alice", "test-stack");
    expect(result.user).toBe("alice");
    expect(result.slug).toBe("test-stack");
    expect(result.files).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.convex.site/api/v1/stacks/registry/alice/test-stack",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("throws with code=not_found on 404", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "not_found", message: "Stack not found" } }),
    });

    await expect(fetchRegistryEntry("nobody", "missing")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(fetchRegistryEntry("alice", "test-stack")).rejects.toThrow();
  });
});

// ── installStack ──────────────────────────────────────────────────────────

describe("installStack — happy path", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-install-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes files and returns correct result", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => REGISTRY_RESPONSE,
    });

    const result = await installStack("alice", "test-stack", { dir: tmpDir });
    expect(result.slug).toBe("test-stack");
    expect(result.targetDir).toBe(path.join(tmpDir, "stacks", "test-stack"));
    expect(result.filesWritten).toHaveLength(2);
    // Verify the files exist on disk.
    const manifestPath = path.join(tmpDir, "stacks", "test-stack", "youstack.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(manifestPath, "utf8")).slug).toBe("test-stack");
  });

  it("calls linkYouStackAdapters and returns hostLinks", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => REGISTRY_RESPONSE,
    });

    const result = await installStack("alice", "test-stack", { dir: tmpDir });
    expect(result.hostLinks).toContain("/fake/.claude/skills/test/SKILL.md");
  });
});

describe("installStack — conflict", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-conflict-test-"));
    // Pre-create the target dir to trigger conflict.
    fs.mkdirSync(path.join(tmpDir, "stacks", "test-stack"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws conflict when dir exists and --force not set", async () => {
    await expect(
      installStack("alice", "test-stack", { dir: tmpDir })
    ).rejects.toMatchObject({ code: "conflict" });
    // Fetch should NOT have been called.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("overwrites when --force is set", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => REGISTRY_RESPONSE,
    });

    const result = await installStack("alice", "test-stack", {
      dir: tmpDir,
      force: true,
    });
    expect(result.filesWritten).toHaveLength(2);
  });
});

describe("installStack — invalid manifest", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-badmanifest-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws invalid_manifest when registry returns broken manifest", async () => {
    const badResponse = {
      ...REGISTRY_RESPONSE,
      manifest: { slug: "ok" }, // missing required fields
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => badResponse,
    });

    await expect(
      installStack("alice", "bad-stack", { dir: tmpDir })
    ).rejects.toMatchObject({ code: "invalid_manifest" });
  });
});
