import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock the API layer — sync tests never hit the network.
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getPublicProfile: vi.fn(),
    getMe: vi.fn(),
    getPrivateContext: vi.fn(),
    uploadBundle: vi.fn(),
    publishLatest: vi.fn(),
    updatePrivateContext: vi.fn(),
    savePortrait: vi.fn(),
  };
});

// Modules that capture ~/.youmd paths at import time are imported dynamically
// AFTER HOME points at a temp directory (same pattern as pull-guard.test.ts).
let tmpHome: string;
let api: typeof import("../lib/api");
let sync: typeof import("../commands/sync");
let pull: typeof import("../commands/pull");
let compiler: typeof import("../lib/compiler");

const OLD_REMOTE_HASH = "old-remote-hash-from-last-pull";
const NEW_REMOTE_HASH = "new-remote-hash-after-someone-pushed";

beforeAll(async () => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-sync-merge-home-"));
  process.env.HOME = tmpHome;

  api = await import("../lib/api");
  sync = await import("../commands/sync");
  pull = await import("../commands/pull");
  compiler = await import("../lib/compiler");
});

function writeGlobalConfigRaw(data: unknown): void {
  fs.mkdirSync(path.join(tmpHome, ".youmd"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpHome, ".youmd", "config.json"),
    JSON.stringify(data, null, 2) + "\n"
  );
}

describe("sync 3-way merge (both local and remote changed)", () => {
  let tmpCwd: string;
  let bundleDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpCwd = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-sync-merge-cwd-"));
    process.chdir(tmpCwd);
    bundleDir = path.join(fs.realpathSync(tmpCwd), ".youmd");

    // T7 — sync is home-first by default; these tests exercise a deliberate
    // project-local bundle, marked the way init / --local would mark it.
    fs.mkdirSync(bundleDir, { recursive: true });
    fs.writeFileSync(
      path.join(bundleDir, "youmd.local.json"),
      JSON.stringify({ localBundle: true }) + "\n"
    );

    writeGlobalConfigRaw({ token: "test-token", username: "tester" });

    vi.mocked(api.uploadBundle).mockResolvedValue({
      ok: true,
      status: 200,
      data: { version: 4 },
    });
    vi.mocked(api.publishLatest).mockResolvedValue({
      ok: true,
      status: 200,
      data: { version: 4, username: "tester" },
    });
    vi.mocked(api.getPrivateContext).mockResolvedValue({ ok: false, status: 404, data: null });
    vi.mocked(api.updatePrivateContext).mockResolvedValue({ ok: true, status: 200, data: { success: true } });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = 0; // conflict paths set exitCode=1 — don't fail the run
    fs.rmSync(tmpCwd, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  /**
   * Scaffold a local bundle whose compiled output is recorded as the merge
   * base (base.json) and pull baselines. Returns the base youJson.
   */
  function setupBundleWithBase(): Record<string, unknown> {
    fs.mkdirSync(path.join(bundleDir, "profile"), { recursive: true });
    fs.writeFileSync(
      path.join(bundleDir, "profile", "about.md"),
      "---\ntitle: About\n---\n# Local Person\n\nbuilds identity tools\n\nworks on the agent internet.\n"
    );
    fs.writeFileSync(
      path.join(bundleDir, "profile", "values.md"),
      "---\ntitle: Values\n---\n- honesty\n"
    );
    fs.writeFileSync(
      path.join(bundleDir, "you.json"),
      JSON.stringify({ schema: "you-md/v1", identity: { name: "Local Person" } }, null, 2)
    );
    // Compile twice so the skeleton (you.json) is self-consistent
    let compiled = compiler.compileBundle(bundleDir);
    fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(compiled.youJson, null, 2));
    compiled = compiler.compileBundle(bundleDir);
    fs.writeFileSync(path.join(bundleDir, "you.json"), JSON.stringify(compiled.youJson, null, 2));
    fs.writeFileSync(path.join(bundleDir, "base.json"), JSON.stringify(compiled.youJson, null, 2));

    fs.writeFileSync(
      path.join(bundleDir, "config.json"),
      JSON.stringify(
        {
          version: 1,
          sources: [],
          lastPulledStableHash: pull.stableContentHash(compiled.youJson, compiled.markdown),
          lastPulledHash: OLD_REMOTE_HASH,
        },
        null,
        2
      ) + "\n"
    );
    return compiled.youJson;
  }

  function mockRemote(remoteYouJson: Record<string, unknown>): void {
    vi.mocked(api.getMe).mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        latestBundle: {
          version: 3,
          isPublished: true,
          createdAt: 0,
          contentHash: NEW_REMOTE_HASH,
          youJson: remoteYouJson,
          youMd: "# remote\n",
        },
        publishedBundle: { version: 3, contentHash: NEW_REMOTE_HASH },
        bundleCount: 3,
      },
    });
  }

  it("merges non-overlapping local + remote edits and pushes the result", async () => {
    const base = setupBundleWithBase();

    // Remote changed values only
    const remote = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    remote.values = ["remote value"];
    mockRemote(remote);

    // Local changed identity only (edit about.md → bio changes)
    fs.appendFileSync(path.join(bundleDir, "profile", "about.md"), "\nan unpushed local bio line\n");

    await sync.syncCommand({});

    // Push happened with the merged content
    expect(api.uploadBundle).toHaveBeenCalledTimes(1);
    const uploaded = vi.mocked(api.uploadBundle).mock.calls[0][0];
    // Ancestry: parentHash advanced to the remote hash we merged in
    expect(uploaded.parentHash).toBe(NEW_REMOTE_HASH);
    const uploadedJson = uploaded.youJson as Record<string, unknown>;
    // Remote-only edit taken
    expect(uploadedJson.values).toEqual(["remote value"]);
    // Local-only edit kept
    const bio = ((uploadedJson.identity as Record<string, unknown>).bio as Record<string, string>);
    expect(bio.long).toContain("an unpushed local bio line");

    // Disk reflects the merge
    const youJson = JSON.parse(fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8"));
    expect(youJson.values).toEqual(["remote value"]);
    expect(fs.readFileSync(path.join(bundleDir, "profile", "values.md"), "utf-8")).toContain("remote value");
    expect(fs.readFileSync(path.join(bundleDir, "profile", "about.md"), "utf-8")).toContain("an unpushed local bio line");

    // base.json advanced to the merged result
    const baseJson = JSON.parse(fs.readFileSync(path.join(bundleDir, "base.json"), "utf-8"));
    expect(baseJson.values).toEqual(["remote value"]);
    expect(((baseJson.identity as Record<string, unknown>).bio as Record<string, string>).long).toContain(
      "an unpushed local bio line"
    );

    expect(process.exitCode).not.toBe(1);
  });

  it("stops atomically on a true section conflict — nothing written, no push", async () => {
    const base = setupBundleWithBase();

    // Remote changed values
    const remote = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    remote.values = ["remote value"];
    mockRemote(remote);

    // Local ALSO changed values, differently
    fs.writeFileSync(
      path.join(bundleDir, "profile", "values.md"),
      "---\ntitle: Values\n---\n- local value\n"
    );
    const valuesOnDisk = fs.readFileSync(path.join(bundleDir, "profile", "values.md"), "utf-8");
    const youJsonOnDisk = fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8");
    const baseOnDisk = fs.readFileSync(path.join(bundleDir, "base.json"), "utf-8");

    await sync.syncCommand({});

    // No push, exit code 1, zero writes
    expect(api.uploadBundle).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(fs.readFileSync(path.join(bundleDir, "profile", "values.md"), "utf-8")).toBe(valuesOnDisk);
    expect(fs.readFileSync(path.join(bundleDir, "you.json"), "utf-8")).toBe(youJsonOnDisk);
    expect(fs.readFileSync(path.join(bundleDir, "base.json"), "utf-8")).toBe(baseOnDisk);
  });

  it("falls back to guard-and-refuse when no base.json exists", async () => {
    const base = setupBundleWithBase();
    fs.rmSync(path.join(bundleDir, "base.json"));

    const remote = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    remote.values = ["remote value"];
    mockRemote(remote);

    fs.appendFileSync(path.join(bundleDir, "profile", "about.md"), "\nlocal edit\n");

    await sync.syncCommand({});

    expect(api.uploadBundle).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
