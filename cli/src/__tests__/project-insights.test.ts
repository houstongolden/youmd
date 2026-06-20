import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("project insights", () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalCwd: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-project-insights-"));
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    process.env.HOME = tmpHome;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    process.chdir(originalCwd);
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeProject(root: string, slug: string, name: string): void {
    const dir = path.join(root, slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "project.json"),
      JSON.stringify({ name, description: `${name} project`, updated_at: "2026-06-20T00:00:00.000Z" }),
    );
  }

  it("prefers canonical ~/.you/projects over legacy ~/.youmd/projects", async () => {
    const canonicalRoot = path.join(tmpHome, ".you", "projects");
    const legacyRoot = path.join(tmpHome, ".youmd", "projects");
    writeProject(canonicalRoot, "canonical-app", "Canonical App");
    writeProject(legacyRoot, "legacy-app", "Legacy App");

    const workDir = path.join(tmpHome, "workspace");
    fs.mkdirSync(workDir);
    process.chdir(workDir);

    const { getRecentProjectInsights } = await import("../lib/project");
    const insights = getRecentProjectInsights(workDir, 5);

    expect(insights.map((insight) => insight.name)).toContain("Canonical App");
    expect(insights.map((insight) => insight.name)).not.toContain("Legacy App");
    expect(insights[0].suggestedCommand).toBe('you project show "Canonical App"');
  });

  it("falls back to legacy ~/.youmd/projects when canonical projects are absent", async () => {
    const legacyRoot = path.join(tmpHome, ".youmd", "projects");
    writeProject(legacyRoot, "legacy-app", "Legacy App");

    const workDir = path.join(tmpHome, "workspace");
    fs.mkdirSync(workDir);
    process.chdir(workDir);

    const { getRecentProjectInsights } = await import("../lib/project");
    const insights = getRecentProjectInsights(workDir, 5);

    expect(insights.map((insight) => insight.name)).toContain("Legacy App");
    expect(insights[0].suggestedCommand).toBe('you project show "Legacy App"');
  });
});
