/**
 * P20 — documented precedence model + shadowing warnings + status active
 * roots (PRODUCT-AUDIT #22 / ROADMAP 3.15).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  ActiveRoots,
  PRECEDENCE,
  buildActiveRootsLines,
  detectShadowing,
  getActiveRoots,
  renderPrecedence,
} from "../lib/projectContext";
import { loadYouStackManifest, runYouStackDoctor } from "../lib/youstack";

const MANIFEST = {
  schemaVersion: "youstack/v1",
  kind: "youstack",
  slug: "demo",
  name: "Demo Stack",
  version: "0.1.0",
  visibility: "private",
};

describe("PRECEDENCE table (P20)", () => {
  it("documents the full precedence model the CLI implements", () => {
    expect(PRECEDENCE.map((rule) => rule.domain)).toEqual([
      "config",
      "project context",
      "stack layout",
    ]);

    const config = PRECEDENCE[0];
    expect(config.order[0]).toContain("env vars");
    expect(config.order[1]).toContain("local project config");
    expect(config.order[2]).toContain("global config");

    const project = PRECEDENCE[1];
    expect(project.order[0]).toContain("repo project-context/");
    expect(project.order[1]).toContain("global overlay");
    expect(project.note).toContain("repo wins");

    const stack = PRECEDENCE[2];
    expect(stack.order[0]).toContain("canonical stacks/<slug>/youstack.json");
    expect(stack.order[1]).toContain("legacy");
  });

  it("renders as plain lines for help text and docs", () => {
    const lines = renderPrecedence();
    expect(lines).toHaveLength(PRECEDENCE.length);
    for (const line of lines) {
      expect(line).toContain(" > ");
      expect(line).toContain(" — ");
    }
    expect(lines[0]).toContain("YOU_API_KEY");
    expect(lines[0]).toContain("legacy YOUMD_*");
  });
});

describe("shadowing detection (P20)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-precedence-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("warns when YOU_API_KEY env overrides a logged-in session", () => {
    const warnings = detectShadowing({
      cwd: tmpDir,
      env: { apiKey: "sk-env" },
      globalConfig: { token: "session-token" },
    });
    const configWarnings = warnings.filter((warning) => warning.domain === "config");
    expect(configWarnings).toHaveLength(1);
    expect(configWarnings[0].message).toContain("YOU_API_KEY");
    expect(configWarnings[0].message).toContain("YOUMD_API_KEY remains a legacy alias");
    expect(configWarnings[0].message).toContain("session token");
  });

  it("stays quiet when no shadowing is actually active", () => {
    const warnings = detectShadowing({
      cwd: tmpDir,
      env: {},
      globalConfig: {},
    });
    expect(warnings.filter((warning) => warning.domain === "config")).toHaveLength(0);

    // env key with no stored session is not shadowing anything
    const envOnly = detectShadowing({
      cwd: tmpDir,
      env: { apiKey: "sk-env" },
      globalConfig: {},
    });
    expect(envOnly.filter((warning) => warning.domain === "config")).toHaveLength(0);
  });

  it("warns when a canonical stack manifest shadows a legacy location", () => {
    fs.mkdirSync(path.join(tmpDir, "stacks", "demo"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "stacks", "demo", "youstack.json"),
      JSON.stringify(MANIFEST),
    );
    fs.writeFileSync(path.join(tmpDir, "youstack.json"), JSON.stringify(MANIFEST));

    const warnings = detectShadowing({ cwd: tmpDir, env: {}, globalConfig: {} });
    const stackWarnings = warnings.filter((warning) => warning.domain === "stack");
    expect(stackWarnings).toHaveLength(1);
    expect(stackWarnings[0].message).toContain("legacy stack manifest");
    expect(stackWarnings[0].message).toContain("shadowed by canonical");
  });

  it("collapses repo-over-global project-context shadowing into one line", () => {
    const repo = path.join(tmpDir, "myproj");
    fs.mkdirSync(path.join(repo, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(repo, "project-context", "TODO.md"), "repo\n");
    const managed = path.join(tmpDir, ".youmd", "projects", "myproj", "context");
    fs.mkdirSync(managed, { recursive: true });
    fs.writeFileSync(path.join(managed, "todo.md"), "global\n");

    const warnings = detectShadowing({ cwd: repo, env: {}, globalConfig: {} });
    const projectWarnings = warnings.filter((warning) => warning.domain === "project-context");
    expect(projectWarnings).toHaveLength(1);
    expect(projectWarnings[0].message).toContain("TODO.md");
    expect(projectWarnings[0].message).toContain("repo wins");
  });

  it("youmd stack doctor warns about legacy manifests shadowed by canonical", () => {
    fs.mkdirSync(path.join(tmpDir, "stacks", "demo"), { recursive: true });
    const canonicalPath = path.join(tmpDir, "stacks", "demo", "youstack.json");
    fs.writeFileSync(canonicalPath, JSON.stringify(MANIFEST));
    fs.writeFileSync(path.join(tmpDir, "youstack.json"), JSON.stringify(MANIFEST));

    const loaded = loadYouStackManifest(canonicalPath);
    const result = runYouStackDoctor(loaded);
    expect(
      result.warnings.some((warning) =>
        warning.includes("shadowed by the canonical layout"),
      ),
    ).toBe(true);
  });
});

describe("status active roots (P20)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-active-roots-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reports the config, project-context, and stack roots in effect for the cwd", () => {
    const repo = path.join(tmpDir, "myproj");
    fs.mkdirSync(path.join(repo, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(repo, "project-context", "TODO.md"), "x\n");
    const managed = path.join(tmpDir, ".youmd", "projects", "myproj");
    fs.mkdirSync(path.join(managed, "context"), { recursive: true });
    fs.mkdirSync(path.join(repo, "stacks", "demo"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, "stacks", "demo", "youstack.json"),
      JSON.stringify(MANIFEST),
    );

    const roots = getActiveRoots(repo);
    expect(roots.configPath).toContain(".you");
    expect(roots.repoContextDir).toBe(path.join(repo, "project-context"));
    expect(roots.globalOverlayDir).toBe(managed);
    expect(roots.stackManifest).toBe(path.join(repo, "stacks", "demo", "youstack.json"));
    expect(roots.stackLayout).toBe("canonical");
  });

  it("renders active roots lines for youmd status", () => {
    const roots: ActiveRoots = {
      configPath: path.join(os.homedir(), ".you", "config.json"),
      envOverrides: ["YOU_API_KEY"],
      localBundleDir: null,
      repoContextDir: "/repo/project-context",
      globalOverlayDir: path.join(os.homedir(), ".youmd", "projects", "myproj"),
      stackManifest: "/repo/stacks/demo/youstack.json",
      stackLayout: "canonical",
    };

    const lines = buildActiveRootsLines(roots);
    const byLabel = Object.fromEntries(lines.map((line) => [line.label, line.value]));

    expect(byLabel.config).toContain("~/.you/config.json");
    expect(byLabel.config).toContain("env: YOU_API_KEY");
    expect(byLabel.project).toContain("/repo/project-context (repo)");
    expect(byLabel.project).toContain("~/.youmd/projects/myproj (overlay)");
    expect(byLabel.stack).toContain("stacks/demo/youstack.json (canonical)");
  });

  it("falls back to none detected when nothing resolves from the cwd", () => {
    const bare = path.join(tmpDir, "bare");
    fs.mkdirSync(bare, { recursive: true });
    const lines = buildActiveRootsLines(getActiveRoots(bare));
    const byLabel = Object.fromEntries(lines.map((line) => [line.label, line.value]));
    expect(byLabel.project).toBe("none detected");
  });
});
