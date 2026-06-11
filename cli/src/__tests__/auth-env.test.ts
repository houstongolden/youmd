import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

/**
 * P27 — headless auth: YOUMD_API_KEY / YOUMD_API_URL env vars override the
 * config file so agents and CI can run authenticated commands with zero
 * filesystem state.
 */
describe("env-var auth resolution", () => {
  let originalHome: string | undefined;
  let originalKey: string | undefined;
  let originalUrl: string | undefined;
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-auth-env-test-"));
    originalHome = process.env.HOME;
    originalKey = process.env.YOUMD_API_KEY;
    originalUrl = process.env.YOUMD_API_URL;
    process.env.HOME = tmpHome;
    delete process.env.YOUMD_API_KEY;
    delete process.env.YOUMD_API_URL;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (originalKey === undefined) delete process.env.YOUMD_API_KEY;
    else process.env.YOUMD_API_KEY = originalKey;
    if (originalUrl === undefined) delete process.env.YOUMD_API_URL;
    else process.env.YOUMD_API_URL = originalUrl;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeConfig(config: Record<string, unknown>): void {
    const configDir = path.join(tmpHome, ".youmd");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, "config.json"),
      JSON.stringify(config)
    );
  }

  it("getAuthToken returns YOUMD_API_KEY with no config file (clean container)", async () => {
    process.env.YOUMD_API_KEY = "ym_env_key_123";
    const { getAuthToken, isAuthenticated } = await import("../lib/config");
    expect(getAuthToken()).toBe("ym_env_key_123");
    expect(isAuthenticated()).toBe(true);
    // Zero filesystem writes: reading auth must not create ~/.youmd
    expect(fs.existsSync(path.join(tmpHome, ".youmd"))).toBe(false);
  });

  it("YOUMD_API_KEY wins over the config file token", async () => {
    writeConfig({ token: "ym_file_token" });
    process.env.YOUMD_API_KEY = "ym_env_wins";
    const { getAuthToken } = await import("../lib/config");
    expect(getAuthToken()).toBe("ym_env_wins");
  });

  it("falls back to the config file token when env is unset", async () => {
    writeConfig({ token: "ym_file_token" });
    const { getAuthToken, isAuthenticated } = await import("../lib/config");
    expect(getAuthToken()).toBe("ym_file_token");
    expect(isAuthenticated()).toBe(true);
  });

  it("isAuthenticated is false with neither env nor config", async () => {
    const { getAuthToken, isAuthenticated } = await import("../lib/config");
    expect(getAuthToken()).toBeUndefined();
    expect(isAuthenticated()).toBe(false);
  });

  it("YOUMD_API_URL overrides config apiUrl and the default", async () => {
    writeConfig({ apiUrl: "https://file-config.convex.site" });
    process.env.YOUMD_API_URL = "https://env-override.convex.site";
    const { getConvexSiteUrl } = await import("../lib/config");
    expect(getConvexSiteUrl()).toBe("https://env-override.convex.site");
  });

  it("config apiUrl still wins over the default when env URL is unset", async () => {
    writeConfig({ apiUrl: "https://file-config.convex.site" });
    const { getConvexSiteUrl } = await import("../lib/config");
    expect(getConvexSiteUrl()).toBe("https://file-config.convex.site");
  });

  it("blank env values are ignored", async () => {
    writeConfig({ token: "ym_file_token", apiUrl: "https://file-config.convex.site" });
    process.env.YOUMD_API_KEY = "   ";
    process.env.YOUMD_API_URL = "";
    const { getAuthToken, getConvexSiteUrl } = await import("../lib/config");
    expect(getAuthToken()).toBe("ym_file_token");
    expect(getConvexSiteUrl()).toBe("https://file-config.convex.site");
  });
});
