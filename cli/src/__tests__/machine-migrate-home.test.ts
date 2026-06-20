import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("machine migrate-home", () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalYouHome: string | undefined;
  let originalYoumdHome: string | undefined;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-machine-migrate-"));
    originalHome = process.env.HOME;
    originalYouHome = process.env.YOU_HOME;
    originalYoumdHome = process.env.YOUMD_HOME;
    process.env.HOME = tmpHome;
    delete process.env.YOU_HOME;
    delete process.env.YOUMD_HOME;
    vi.resetModules();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.HOME = originalHome;
    process.env.YOU_HOME = originalYouHome;
    process.env.YOUMD_HOME = originalYoumdHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("dry-runs without creating canonical home", async () => {
    fs.mkdirSync(path.join(tmpHome, ".youmd", "profile"), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, ".youmd", "profile", "about.md"), "# Legacy\n");

    const { machineCommand } = await import("../commands/machine");
    await machineCommand("migrate-home", {});

    expect(fs.existsSync(path.join(tmpHome, ".you"))).toBe(false);
    expect(fs.existsSync(path.join(tmpHome, ".youmd", "profile", "about.md"))).toBe(true);
  });

  it("copies missing legacy files, preserves canonical conflicts, and writes a hash proof", async () => {
    fs.mkdirSync(path.join(tmpHome, ".youmd", "profile"), { recursive: true });
    fs.mkdirSync(path.join(tmpHome, ".you"), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, ".youmd", "profile", "about.md"), "# Legacy About\n");
    fs.writeFileSync(path.join(tmpHome, ".youmd", "config.json"), JSON.stringify({ username: "legacy" }) + "\n");
    fs.writeFileSync(path.join(tmpHome, ".you", "config.json"), JSON.stringify({ username: "canonical" }) + "\n");

    const { machineCommand } = await import("../commands/machine");
    await machineCommand("migrate-home", { yes: true });

    expect(fs.readFileSync(path.join(tmpHome, ".you", "profile", "about.md"), "utf-8")).toBe("# Legacy About\n");
    expect(JSON.parse(fs.readFileSync(path.join(tmpHome, ".you", "config.json"), "utf-8")).username).toBe("canonical");
    expect(fs.existsSync(path.join(tmpHome, ".youmd", "config.json"))).toBe(true);

    const reportDir = path.join(tmpHome, ".you", "migration-reports");
    const reports = fs.readdirSync(reportDir).filter((name) => name.endsWith(".json"));
    expect(reports).toHaveLength(1);
    const report = JSON.parse(fs.readFileSync(path.join(reportDir, reports[0]), "utf-8"));
    expect(report).toMatchObject({
      schemaVersion: "you-md/home-migration/v1",
      copied: 1,
      preserved: 0,
      conflicted: 1,
      legacyPreserved: true,
      secretValuesExposed: false,
    });
    expect(report.conflicts[0].relativePath).toBe("config.json");
    expect(report.files.some((file: { relativePath: string; action: string; sha256: string }) =>
      file.relativePath === path.join("profile", "about.md") &&
      file.action === "copied" &&
      /^[a-f0-9]{64}$/.test(file.sha256)
    )).toBe(true);
  });
});
