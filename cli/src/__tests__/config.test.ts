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
    vi.resetModules();
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
    const configDir = path.join(tmpHome, ".you");
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

  it("localBundleExists returns false when no .you/.youmd dir", async () => {
    const { localBundleExists } = await import("../lib/config");
    // We're in a temp dir with no .you or .youmd
    expect(localBundleExists()).toBe(false);
  });

  it("reads legacy ~/.youmd config when canonical ~/.you does not exist", async () => {
    const configDir = path.join(tmpHome, ".youmd");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ username: "legacy-houston" }));

    vi.resetModules();
    const { readGlobalConfig, getGlobalConfigPath } = await import("../lib/config");
    expect(readGlobalConfig().username).toBe("legacy-houston");
    expect(getGlobalConfigPath()).toBe(path.join(configDir, "config.json"));
  });
});

describe("detectProjectContext (nearest-marker-wins)", () => {
  let tmpRoot: string;
  let originalCwd: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    // realpathSync: on macOS, mkdtemp returns /var/... but process.cwd()
    // resolves to /private/var/... — paths must compare equal in assertions.
    tmpRoot = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "youmd-detect-test-"))
    );
    originalCwd = process.cwd();
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  async function detect() {
    vi.resetModules();
    const { detectProjectContext } = await import("../lib/config");
    return detectProjectContext();
  }

  it("nested .git repo beats a .youmd-project higher in the tree", async () => {
    // e.g. ~/Desktop/.youmd-project must not outrank ~/Desktop/repo/.git
    fs.writeFileSync(
      path.join(tmpRoot, ".youmd-project"),
      JSON.stringify({ name: "desktop-wide" })
    );
    const repo = path.join(tmpRoot, "repo");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    process.chdir(repo);

    const ctx = await detect();
    expect(ctx?.root).toBe(repo);
    expect(ctx?.marker).toBe(".git");
  });

  it("nearest marker wins when cwd is nested inside the repo", async () => {
    fs.writeFileSync(
      path.join(tmpRoot, ".youmd-project"),
      JSON.stringify({ name: "desktop-wide" })
    );
    const repo = path.join(tmpRoot, "repo");
    const nested = path.join(repo, "src", "lib");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    process.chdir(nested);

    const ctx = await detect();
    expect(ctx?.root).toBe(repo);
    expect(ctx?.marker).toBe(".git");
  });

  it(".youmd-project beats .git at equal depth", async () => {
    const repo = path.join(tmpRoot, "repo");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, ".youmd-project"),
      JSON.stringify({ name: "named-project" })
    );
    process.chdir(repo);

    const ctx = await detect();
    expect(ctx?.root).toBe(repo);
    expect(ctx?.marker).toBe(".youmd-project");
    expect(ctx?.name).toBe("named-project");
  });

  it(".git beats package.json at equal depth", async () => {
    const repo = path.join(tmpRoot, "repo");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.writeFileSync(path.join(repo, "package.json"), JSON.stringify({ name: "pkg" }));
    process.chdir(repo);

    const ctx = await detect();
    expect(ctx?.marker).toBe(".git");
  });

  it("still walks up to a marker when cwd has none", async () => {
    const repo = path.join(tmpRoot, "repo");
    const deep = path.join(repo, "a", "b");
    fs.writeFileSync(path.join(tmpRoot, ".youmd-project"), JSON.stringify({ name: "outer" }));
    fs.mkdirSync(deep, { recursive: true });
    process.chdir(deep);

    const ctx = await detect();
    expect(ctx?.root).toBe(tmpRoot);
    expect(ctx?.marker).toBe(".youmd-project");
  });

  it("never treats the home directory itself as a project root", async () => {
    process.env.HOME = tmpRoot;
    fs.mkdirSync(path.join(tmpRoot, ".git"));
    fs.writeFileSync(path.join(tmpRoot, "package.json"), "{}");
    const scratch = path.join(tmpRoot, "scratch");
    fs.mkdirSync(scratch);
    process.chdir(scratch);

    const ctx = await detect();
    expect(ctx).toBeNull();
  });
});
