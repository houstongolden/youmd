/**
 * Offline tests for the folder.md storage integration: key persistence + resolution precedence.
 * Network paths (push/pull/list against folder.md) need a live account and are not covered here.
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// One stable home for the whole suite — config resolves (and memoizes) the home dir on first
// use, so a single constant YOU_HOME is correct; we reset the config file between tests.
let tmpHome: string;
let prevHome: string | undefined;
let prevEnvKey: string | undefined;
let prevEnvKey2: string | undefined;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "you-storage-"));
  prevHome = process.env.YOU_HOME;
  prevEnvKey = process.env.FOLDER_API_KEY;
  prevEnvKey2 = process.env.FOLDERMD_API_KEY;
  process.env.YOU_HOME = tmpHome;
});

beforeEach(async () => {
  // Reset config + env to a clean slate for each test.
  delete process.env.FOLDER_API_KEY;
  delete process.env.FOLDERMD_API_KEY;
  const { writeGlobalConfig } = await import("../lib/config");
  writeGlobalConfig({});
});

afterAll(() => {
  if (prevHome === undefined) delete process.env.YOU_HOME;
  else process.env.YOU_HOME = prevHome;
  if (prevEnvKey === undefined) delete process.env.FOLDER_API_KEY;
  else process.env.FOLDER_API_KEY = prevEnvKey;
  if (prevEnvKey2 === undefined) delete process.env.FOLDERMD_API_KEY;
  else process.env.FOLDERMD_API_KEY = prevEnvKey2;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("you storage setup + key resolution", () => {
  it("setup persists the folder.md key to config and resolveFolderMdKey reads it", async () => {
    const { storageCommand } = await import("../commands/storage");
    const { resolveFolderMdKey } = await import("../lib/foldermd");
    const { readGlobalConfig } = await import("../lib/config");

    await storageCommand("setup", ["fmd_live_abc123"], {});
    expect(readGlobalConfig().folderMdKey).toBe("fmd_live_abc123");
    expect(resolveFolderMdKey()).toBe("fmd_live_abc123");
  });

  it("setup --folder persists the folder id too", async () => {
    const { storageCommand } = await import("../commands/storage");
    const { readGlobalConfig } = await import("../lib/config");
    await storageCommand("setup", ["fmd_live_x"], { folder: "fld_123" });
    expect(readGlobalConfig().folderMdFolderId).toBe("fld_123");
  });

  it("resolve precedence: explicit arg > config > env", async () => {
    const { resolveFolderMdKey } = await import("../lib/foldermd");
    const { writeGlobalConfig } = await import("../lib/config");

    // env only
    process.env.FOLDER_API_KEY = "fmd_live_env";
    expect(resolveFolderMdKey()).toBe("fmd_live_env");

    // config beats env
    writeGlobalConfig({ folderMdKey: "fmd_live_cfg" });
    expect(resolveFolderMdKey()).toBe("fmd_live_cfg");

    // explicit beats both
    expect(resolveFolderMdKey("fmd_live_explicit")).toBe("fmd_live_explicit");
  });
});
