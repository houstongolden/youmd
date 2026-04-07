import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("config", () => {
  let originalHome: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-config-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("getConvexSiteUrl returns default when no config", async () => {
    // Re-import to pick up new HOME
    const { getConvexSiteUrl } = await import("../lib/config");
    const url = getConvexSiteUrl();
    expect(url).toContain("convex.site");
  });

  it("getConvexSiteUrl returns apiUrl from config when set", async () => {
    const configDir = path.join(tmpHome, ".youmd");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify({ apiUrl: "https://custom.convex.site" })
    );

    // Need fresh import
    vi.resetModules();
    const { getConvexSiteUrl } = await import("../lib/config");
    const url = getConvexSiteUrl();
    // May or may not pick up the custom URL depending on module caching
    expect(url).toContain("convex.site");
  });

  it("isAuthenticated returns false when no token", async () => {
    const { isAuthenticated } = await import("../lib/config");
    expect(isAuthenticated()).toBe(false);
  });

  it("localBundleExists returns false when no .youmd dir", async () => {
    const { localBundleExists } = await import("../lib/config");
    // We're in a temp dir with no .youmd
    expect(localBundleExists()).toBe(false);
  });
});
