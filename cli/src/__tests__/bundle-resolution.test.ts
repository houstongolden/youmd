/**
 * T7 — home-first bundle resolution for identity sync (TECH-STACK-AUDIT).
 *
 * pull/push/sync must default to the home brain (~/.youmd/) ALWAYS. A
 * project-local .youmd/ is only used with the explicit --local flag or the
 * deliberate .youmd/youmd.local.json marker (written by init / --local
 * runs). When a project-local bundle exists but is not targeted, a single
 * dim notice explains which root is in use and how to target the other.
 *
 * Also covers the auto-gitignore guarantee: writing a project-local .youmd/
 * ensures the repo's .gitignore covers it (append when missing, create when
 * the repo has none, never duplicate) so identity data is never silently
 * committed.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Modules that capture ~/.youmd paths at import time are imported dynamically
// AFTER HOME points at a temp directory (same pattern as pull-guard.test.ts).
let tmpHome: string;
let config: typeof import("../lib/config");

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-bundle-res-home-"));
  process.env.HOME = tmpHome;
  config = await import("../lib/config");
});

describe("resolveSyncBundleDir (T7 home-first)", () => {
  let tmpCwd: string;
  let originalCwd: string;
  let localDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-bundle-res-cwd-"));
    process.chdir(tmpCwd);
    localDir = path.join(fs.realpathSync(tmpCwd), ".youmd");
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpCwd, { recursive: true, force: true });
  });

  function initializeLocalBundle(): void {
    fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(path.join(localDir, "you.json"), "{}");
  }

  it("defaults to ~/.youmd even when no local bundle exists", () => {
    const res = config.resolveSyncBundleDir();
    expect(res.dir).toBe(config.getHomeBundleDir());
    expect(res.scope).toBe("home");
    expect(res.reason).toBe("default");
    expect(res.localBundlePresent).toBe(false);
    // Nothing ambiguous — no notice
    expect(config.bundleResolutionNotice(res)).toBeNull();
  });

  it("defaults to ~/.youmd even when an unmarked project-local bundle exists", () => {
    initializeLocalBundle();

    const res = config.resolveSyncBundleDir();
    expect(res.dir).toBe(config.getHomeBundleDir());
    expect(res.scope).toBe("home");
    expect(res.localBundlePresent).toBe(true);

    // The dim notice says which root is used and how to target the other
    const notice = config.bundleResolutionNotice(res);
    expect(notice).toContain(config.getHomeBundleDir());
    expect(notice).toContain("--local");
  });

  it("--local targets the project-local .youmd/", () => {
    initializeLocalBundle();

    const res = config.resolveSyncBundleDir({ local: true });
    expect(res.dir).toBe(localDir);
    expect(res.scope).toBe("local");
    expect(res.reason).toBe("flag");

    const notice = config.bundleResolutionNotice(res);
    expect(notice).toContain(localDir);
    expect(notice).toContain("--local");
  });

  it("the youmd.local.json marker targets the project-local bundle without a flag", () => {
    initializeLocalBundle();
    config.markLocalBundle(localDir);

    const res = config.resolveSyncBundleDir();
    expect(res.dir).toBe(localDir);
    expect(res.scope).toBe("local");
    expect(res.reason).toBe("marker");

    const notice = config.bundleResolutionNotice(res);
    expect(notice).toContain("youmd.local.json");
  });

  it("resolves to home when cwd IS the home directory", () => {
    process.chdir(tmpHome);
    const res = config.resolveSyncBundleDir();
    expect(res.dir).toBe(config.getHomeBundleDir());
    expect(res.scope).toBe("home");
    expect(res.reason).toBe("home-is-cwd");
    expect(config.bundleResolutionNotice(res)).toBeNull();
  });

  it("markLocalBundle is idempotent and never marks the home bundle", () => {
    config.markLocalBundle(localDir);
    const markerPath = config.getLocalBundleMarkerPath(localDir);
    expect(fs.existsSync(markerPath)).toBe(true);
    const before = fs.readFileSync(markerPath, "utf-8");
    config.markLocalBundle(localDir);
    expect(fs.readFileSync(markerPath, "utf-8")).toBe(before);

    config.markLocalBundle(config.getHomeBundleDir());
    expect(
      fs.existsSync(config.getLocalBundleMarkerPath(config.getHomeBundleDir()))
    ).toBe(false);
  });
});

describe("ensureYoumdGitignored (T7 auto-gitignore)", () => {
  let tmpRepo: string;
  let bundleDir: string;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-gitignore-"));
    tmpRepo = fs.realpathSync(tmpRepo);
    bundleDir = path.join(tmpRepo, ".youmd");
    fs.mkdirSync(bundleDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  function gitignorePath(): string {
    return path.join(tmpRepo, ".gitignore");
  }

  it("creates a .gitignore at the git root when the repo has none", () => {
    fs.mkdirSync(path.join(tmpRepo, ".git"));

    expect(config.ensureYoumdGitignored(bundleDir)).toBe("created");
    const content = fs.readFileSync(gitignorePath(), "utf-8");
    expect(content).toContain(".youmd/");
  });

  it("appends .youmd/ when a .gitignore exists without coverage", () => {
    fs.mkdirSync(path.join(tmpRepo, ".git"));
    fs.writeFileSync(gitignorePath(), "node_modules/\ndist/\n");

    expect(config.ensureYoumdGitignored(bundleDir)).toBe("appended");
    const content = fs.readFileSync(gitignorePath(), "utf-8");
    expect(content).toContain("node_modules/");
    expect(content).toContain(".youmd/");
  });

  it("does not duplicate an existing .youmd entry (any common form)", () => {
    fs.mkdirSync(path.join(tmpRepo, ".git"));
    for (const existing of [".youmd/", ".youmd", "/.youmd/", "**/.youmd/"]) {
      fs.writeFileSync(gitignorePath(), `dist/\n${existing}\n`);
      expect(config.ensureYoumdGitignored(bundleDir)).toBe("covered");
      const lines = fs
        .readFileSync(gitignorePath(), "utf-8")
        .split("\n")
        .filter((l) => l.trim().includes(".youmd"));
      expect(lines).toHaveLength(1);
    }
  });

  it("finds the git root above a nested directory", () => {
    fs.mkdirSync(path.join(tmpRepo, ".git"));
    const nested = path.join(tmpRepo, "packages", "app");
    const nestedBundle = path.join(nested, ".youmd");
    fs.mkdirSync(nestedBundle, { recursive: true });

    expect(config.ensureYoumdGitignored(nestedBundle)).toBe("created");
    expect(fs.existsSync(gitignorePath())).toBe(true);
  });

  it("no-ops outside a git repo and for the home bundle dir", () => {
    expect(config.ensureYoumdGitignored(bundleDir)).toBe("no-repo");
    expect(fs.existsSync(gitignorePath())).toBe(false);
    expect(config.ensureYoumdGitignored(config.getHomeBundleDir())).toBe("no-repo");
  });
});
