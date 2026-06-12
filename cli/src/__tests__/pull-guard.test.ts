import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock the API layer — pull tests never hit the network.
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getPublicProfile: vi.fn(),
    getMe: vi.fn(),
    getPrivateContext: vi.fn(),
  };
});

// All modules that capture ~/.youmd paths at import time are imported
// dynamically AFTER we point HOME at a temp directory, so these tests can
// never touch the real ~/.youmd.
let tmpHome: string;
let api: typeof import("../lib/api");
let pull: typeof import("../commands/pull");
let configLib: typeof import("../lib/config");
let compiler: typeof import("../lib/compiler");
let hash: typeof import("../lib/hash");

const REMOTE_YOU_JSON = {
  schema: "you-md/v1",
  identity: { name: "Remote Person", headline: "pulled from you.md" },
};
const REMOTE_YOU_MD = "# Remote Person\n\npulled from you.md\n";
const DRAFT_HASH = "draft-hash-not-what-we-wrote";

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-pull-guard-home-"));
  process.env.HOME = tmpHome;

  api = await import("../lib/api");
  pull = await import("../commands/pull");
  configLib = await import("../lib/config");
  compiler = await import("../lib/compiler");
  hash = await import("../lib/hash");
});

function globalConfigPath(): string {
  return path.join(tmpHome, ".youmd", "config.json");
}

function writeGlobalConfigRaw(data: unknown): void {
  fs.mkdirSync(path.join(tmpHome, ".youmd"), { recursive: true });
  fs.writeFileSync(globalConfigPath(), JSON.stringify(data, null, 2) + "\n");
}

describe("pull dirty-check guard", () => {
  let tmpCwd: string;
  let bundleDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-pull-guard-cwd-"));
    process.chdir(tmpCwd);
    bundleDir = path.join(fs.realpathSync(tmpCwd), ".youmd");

    writeGlobalConfigRaw({ token: "test-token", username: "tester" });

    vi.mocked(api.getPublicProfile).mockResolvedValue({
      youJson: REMOTE_YOU_JSON,
      youMd: REMOTE_YOU_MD,
      username: "tester",
    });
    vi.mocked(api.getMe).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        latestBundle: {
          version: 3,
          isPublished: false,
          createdAt: 0,
          contentHash: DRAFT_HASH,
          youJson: REMOTE_YOU_JSON,
          youMd: REMOTE_YOU_MD,
        },
        publishedBundle: { version: 2 },
        bundleCount: 3,
      },
    });
    vi.mocked(api.getPrivateContext).mockResolvedValue({
      ok: false,
      status: 404,
      data: null,
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = 0; // pull sets exitCode=1 on refusal — don't fail the test run
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  /** Scaffold a local bundle and record its compiled stable hash as the pulled baseline. */
  function setupCleanLocalBundle(): string {
    fs.mkdirSync(path.join(bundleDir, "profile"), { recursive: true });
    fs.writeFileSync(
      path.join(bundleDir, "profile", "about.md"),
      "---\ntitle: About\n---\n# Local Person\n\n**Tagline:** local content\n"
    );
    fs.writeFileSync(
      path.join(bundleDir, "you.json"),
      JSON.stringify({ schema: "you-md/v1", identity: { name: "Local Person" } }, null, 2)
    );
    const compiled = compiler.compileBundle(bundleDir);
    const baseHash = pull.stableContentHash(compiled.youJson, compiled.markdown);
    fs.writeFileSync(
      path.join(bundleDir, "config.json"),
      JSON.stringify(
        { version: 1, sources: [], lastPulledStableHash: baseHash },
        null,
        2
      ) + "\n"
    );
    return baseHash;
  }

  it("refuses to overwrite unpushed local edits (exit code 1)", async () => {
    setupCleanLocalBundle();
    // Make a local edit that has not been pushed
    const aboutPath = path.join(bundleDir, "profile", "about.md");
    fs.appendFileSync(aboutPath, "\nan unpushed local edit\n");
    const editedContent = fs.readFileSync(aboutPath, "utf-8");

    const result = await pull.pullCommand({});

    expect(result).toBe("dirty");
    expect(process.exitCode).toBe(1);
    // Nothing was overwritten
    expect(fs.readFileSync(aboutPath, "utf-8")).toBe(editedContent);
    const youJson = JSON.parse(fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8"));
    expect(youJson.identity.name).toBe("Local Person");
  });

  it("--force overrides the dirty check and overwrites local files", async () => {
    setupCleanLocalBundle();
    fs.appendFileSync(path.join(bundleDir, "profile", "about.md"), "\nan unpushed local edit\n");

    const result = await pull.pullCommand({ force: true });

    expect(result).toBe("ok");
    const youJson = JSON.parse(fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8"));
    expect(youJson.identity.name).toBe("Remote Person");
  });

  it("pulls when local bundle is clean", async () => {
    setupCleanLocalBundle();

    const result = await pull.pullCommand({});

    expect(result).toBe("ok");
    const youJson = JSON.parse(fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8"));
    expect(youJson.identity.name).toBe("Remote Person");
  });

  it("pulls when no ancestor hash has ever been recorded", async () => {
    // Fresh bundle with local files but no config.json baselines
    fs.mkdirSync(path.join(bundleDir, "profile"), { recursive: true });
    fs.writeFileSync(path.join(bundleDir, "profile", "about.md"), "# Local Person\n");
    fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify({ schema: "you-md/v1" }));

    const result = await pull.pullCommand({});
    expect(result).toBe("ok");
  });

  it("records the hash of what was written, not the newest draft hash (T15)", async () => {
    setupCleanLocalBundle();

    const result = await pull.pullCommand({});
    expect(result).toBe("ok");

    const lc = JSON.parse(fs.readFileSync(path.join(bundleDir, "config.json"), "utf-8"));
    const writtenHash = hash.computeContentHash(REMOTE_YOU_JSON, REMOTE_YOU_MD);
    expect(lc.lastPulledHash).toBe(writtenHash);
    expect(lc.lastPulledHash).not.toBe(DRAFT_HASH);
  });

  it("a pull immediately after a pull is considered clean", async () => {
    setupCleanLocalBundle();

    expect(await pull.pullCommand({})).toBe("ok");
    // No edits in between — second pull must not be flagged dirty
    expect(await pull.pullCommand({})).toBe("ok");
  });

  it("proceeds when local edits were already pushed (local equals remote)", async () => {
    setupCleanLocalBundle();
    // Edit locally, then simulate a completed push: remote now serves the
    // compiled local content, but the stale baseline still says "dirty".
    fs.appendFileSync(path.join(bundleDir, "profile", "about.md"), "\npushed edit\n");
    const compiled = compiler.compileBundle(bundleDir);
    vi.mocked(api.getPublicProfile).mockResolvedValue({
      youJson: compiled.youJson,
      youMd: compiled.markdown,
      username: "tester",
    });

    const result = await pull.pullCommand({});
    expect(result).toBe("ok");
  });

  it("detectLocalDirtyState reports dirty only when compiled stable hash diverges", async () => {
    const baseHash = setupCleanLocalBundle();

    let state = pull.detectLocalDirtyState(bundleDir);
    expect(state.dirty).toBe(false);
    expect(state.hasBaseline).toBe(true);
    expect(state.localHash).toBe(baseHash);

    fs.appendFileSync(path.join(bundleDir, "profile", "about.md"), "\nedited\n");
    state = pull.detectLocalDirtyState(bundleDir);
    expect(state.dirty).toBe(true);
  });

  it("stableContentHash ignores generated_at but not real content", () => {
    const a = pull.stableContentHash(
      { schema: "you-md/v1", generated_at: "2026-01-01T00:00:00Z", identity: { name: "X" } },
      "---\ngenerated_at: 2026-01-01T00:00:00Z\n---\n# X\n"
    );
    const b = pull.stableContentHash(
      { schema: "you-md/v1", generated_at: "2026-06-11T12:34:56Z", identity: { name: "X" } },
      "---\ngenerated_at: 2026-06-11T12:34:56Z\n---\n# X\n"
    );
    const c = pull.stableContentHash(
      { schema: "you-md/v1", generated_at: "2026-01-01T00:00:00Z", identity: { name: "Y" } },
      "---\ngenerated_at: 2026-01-01T00:00:00Z\n---\n# Y\n"
    );
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("atomic config writes", () => {
  beforeEach(() => {
    fs.rmSync(path.join(tmpHome, ".youmd"), { recursive: true, force: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("readGlobalConfig backs up a corrupt config to .bak instead of silently losing it", () => {
    writeGlobalConfigRaw({ token: "x" });
    fs.writeFileSync(globalConfigPath(), "{ not valid json !!!");

    const config = configLib.readGlobalConfig();

    expect(config).toEqual({});
    const bakPath = globalConfigPath() + ".bak";
    expect(fs.existsSync(bakPath)).toBe(true);
    expect(fs.readFileSync(bakPath, "utf-8")).toBe("{ not valid json !!!");
  });

  it("writeGlobalConfig writes atomically with 0600 perms and leaves no tmp/lock files", () => {
    configLib.writeGlobalConfig({ token: "secret", username: "tester" });

    const file = globalConfigPath();
    expect(JSON.parse(fs.readFileSync(file, "utf-8"))).toEqual({
      token: "secret",
      username: "tester",
    });
    if (process.platform !== "win32") {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
    const leftovers = fs
      .readdirSync(path.dirname(file))
      .filter((f) => f.endsWith(".tmp") || f.endsWith(".lock"));
    expect(leftovers).toEqual([]);
  });

  it("readGlobalConfig fixes loose permissions on ~/.youmd and config.json", () => {
    if (process.platform === "win32") return;
    writeGlobalConfigRaw({ token: "x" });
    const dir = path.join(tmpHome, ".youmd");
    fs.chmodSync(dir, 0o755);
    fs.chmodSync(globalConfigPath(), 0o644);

    configLib.readGlobalConfig();

    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    expect(fs.statSync(globalConfigPath()).mode & 0o777).toBe(0o600);
  });

  it("writeJsonAtomic writes pretty JSON with a trailing newline", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-atomic-"));
    const file = path.join(dir, "data.json");

    configLib.writeJsonAtomic(file, { a: 1 });

    expect(fs.readFileSync(file, "utf-8")).toBe('{\n  "a": 1\n}\n');
    expect(fs.readdirSync(dir)).toEqual(["data.json"]);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writeGlobalConfig does not deadlock when a foreign lockfile is held", () => {
    fs.mkdirSync(path.join(tmpHome, ".youmd"), { recursive: true });
    const lockPath = globalConfigPath() + ".lock";
    fs.writeFileSync(lockPath, "12345"); // fresh lock held by "another" process

    // Retries ~5x then proceeds anyway — the atomic rename keeps the file safe
    configLib.writeGlobalConfig({ token: "y" });

    expect(JSON.parse(fs.readFileSync(globalConfigPath(), "utf-8"))).toEqual({ token: "y" });
    fs.rmSync(lockPath, { force: true });
  });

  it("writeGlobalConfig clears a stale lockfile", () => {
    fs.mkdirSync(path.join(tmpHome, ".youmd"), { recursive: true });
    const lockPath = globalConfigPath() + ".lock";
    fs.writeFileSync(lockPath, "999");
    const old = new Date(Date.now() - 60_000);
    fs.utimesSync(lockPath, old, old);

    configLib.writeGlobalConfig({ token: "z" });

    expect(JSON.parse(fs.readFileSync(globalConfigPath(), "utf-8"))).toEqual({ token: "z" });
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});
