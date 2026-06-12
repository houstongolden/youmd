/**
 * Host-link snapshot parity tests (P11 / PRODUCT-AUDIT #13).
 *
 * These snapshots were captured against the PRE-refactor per-host link
 * implementations (youstack.ts linkYouStackAdapters + skills.ts linkToAgent)
 * and prove that the consolidated host-link engine emits byte-identical
 * outputs for every host EXCEPT the documented Claude Code layout fix:
 *
 *   - stacks:  .claude/skills/youstacks/<slug>/SKILL.md -> .claude/skills/<slug>/SKILL.md
 *   - skills:  .claude/skills/youmd/<name>.md           -> .claude/skills/<name>/SKILL.md
 *
 * Codex, Cursor, and unknown-host outputs (paths AND content) must not change.
 * Claude CONTENT for stacks must not change either — only the path moves.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "js-yaml";
import { linkYouStackAdapters, loadYouStackManifest } from "../lib/youstack";
import { linkToAgent } from "../lib/skills";

const mocks = vi.hoisted(() => ({ skillsDir: "" }));

vi.mock("../lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/config")>();
  const nodePath = await import("path");
  const nodeFs = await import("fs");
  return {
    ...actual,
    getSkillsDir: () => mocks.skillsDir,
    getSkillCatalogPath: () => nodePath.join(mocks.skillsDir, "youmd-skills.yaml"),
    getSkillMetricsPath: () => nodePath.join(mocks.skillsDir, "skill-metrics.json"),
    ensureSkillsDir: () => {
      nodeFs.mkdirSync(mocks.skillsDir, { recursive: true });
      return mocks.skillsDir;
    },
    isAuthenticated: () => false,
    resolveActiveBundleDir: () => null,
    detectProjectContext: () => null,
    readGlobalConfig: () => ({}),
  };
});

function stackManifest(): Record<string, unknown> {
  return {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "parity-stack",
    name: "Parity Stack",
    domain: "parity-domain",
    tags: ["coding"],
    version: "0.1.0",
    description: "A fixed stack used for host-link snapshot parity.",
    visibility: "private",
    accessPolicy: { protectedByDefault: true },
    capabilities: [
      {
        id: "startup",
        intent: "Load project context and start the agent safely.",
        localOnly: true,
        mutationPolicy: "read_only",
      },
      {
        id: "protected-memory-search",
        intent: "Search protected memories through You.md MCP.",
        mcpTool: "you.search_memories",
        requiredScopes: ["memories.search"],
        mutationPolicy: "read_only",
      },
    ],
    brainScopes: [
      { scope: "memories.search", required: true, reason: "Protected recall." },
    ],
    improvement: {
      mode: "propose",
      cadence: "after failures",
      signals: ["usage"],
      evals: ["youmd stack smoke"],
      appliesTo: ["skills"],
      approvalRequiredFor: ["brain.write"],
    },
    update: {
      channel: "manual",
      check: "youmd stack smoke",
      source: "local",
      autoApply: false,
    },
  };
}

const SKILL_FIXTURES: Array<{ name: string; description: string; rendered: string }> = [
  {
    name: "alpha-skill",
    description: "First parity fixture skill",
    rendered: [
      "---",
      "name: alpha-skill",
      "version: 1.0.0",
      "scope: shared",
      'description: "First parity fixture skill"',
      "---",
      "",
      "# alpha-skill",
      "",
      "Alpha body content with **markdown**.",
      "",
    ].join("\n"),
  },
  {
    name: "beta-skill",
    description: "Second parity fixture skill",
    rendered: [
      "---",
      "name: beta-skill",
      "version: 1.0.0",
      "scope: shared",
      'description: "Second parity fixture skill"',
      "---",
      "",
      "# beta-skill",
      "",
      "Beta body content.",
      "",
    ].join("\n"),
  },
];

describe("host-link output parity", () => {
  let tmpDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-host-link-"));
    projectDir = path.join(tmpDir, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    mocks.skillsDir = path.join(tmpDir, "youmd-home", "skills");
    fs.mkdirSync(mocks.skillsDir, { recursive: true });
    originalCwd = process.cwd();

    // Seed an installed-skill catalog + rendered skill files.
    const catalog = {
      version: 1,
      owner: "parity",
      skills: SKILL_FIXTURES.map((fixture) => ({
        name: fixture.name,
        description: fixture.description,
        version: "1.0.0",
        source: `local:/nonexistent/${fixture.name}.md`,
        scope: "shared",
        identity_fields: [],
        requires: [],
        installed: true,
      })),
    };
    fs.writeFileSync(path.join(mocks.skillsDir, "youmd-skills.yaml"), yaml.dump(catalog));
    for (const fixture of SKILL_FIXTURES) {
      const dir = path.join(mocks.skillsDir, fixture.name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "SKILL.md"), fixture.rendered);
      fs.writeFileSync(path.join(dir, "RENDERED.md"), fixture.rendered);
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStack(): void {
    fs.writeFileSync(
      path.join(tmpDir, "youstack.json"),
      JSON.stringify(stackManifest(), null, 2)
    );
  }

  function stackLink(host: string): Array<{ relativePath: string; content: string }> {
    writeStack();
    const results = linkYouStackAdapters(loadYouStackManifest(tmpDir), {
      hosts: [host],
      targetDir: projectDir,
      dryRun: true,
    });
    return results.map((result) => ({
      relativePath: path.relative(projectDir, result.targetPath),
      content: result.content,
    }));
  }

  it("stack link: codex output is stable", () => {
    expect(stackLink("codex")).toMatchSnapshot();
  });

  it("stack link: cursor output is stable", () => {
    expect(stackLink("cursor")).toMatchSnapshot();
  });

  it("stack link: unknown host output is stable", () => {
    expect(stackLink("windsurf")).toMatchSnapshot();
  });

  it("stack link: claude-code content is stable (path is the documented P11 fix)", () => {
    const entries = stackLink("claude-code");
    expect(entries).toHaveLength(1);
    // Content parity only — the path intentionally moves to
    // .claude/skills/<slug>/SKILL.md as part of P11.
    expect(entries[0].content).toMatchSnapshot();
  });

  function readTree(root: string): Record<string, string> {
    const out: Record<string, string> = {};
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else out[path.relative(root, full)] = fs.readFileSync(full, "utf-8");
      }
    };
    if (fs.existsSync(root)) walk(root);
    return out;
  }

  it("skill link: codex output is stable", () => {
    process.chdir(projectDir);
    const result = linkToAgent("codex");
    expect(result.ok).toBe(true);
    expect(readTree(path.join(projectDir, ".codex"))).toMatchSnapshot();
  });

  it("skill link: cursor output is stable", () => {
    process.chdir(projectDir);
    const result = linkToAgent("cursor");
    expect(result.ok).toBe(true);
    expect(readTree(path.join(projectDir, ".cursor"))).toMatchSnapshot();
  });

  it("skill link: claude emits the .claude/skills/<name>/SKILL.md discovery layout (P11 fix)", () => {
    process.chdir(projectDir);
    const result = linkToAgent("claude");
    expect(result.ok).toBe(true);
    const tree = readTree(path.join(projectDir, ".claude"));
    expect(Object.keys(tree).sort()).toEqual([
      path.join("skills", "alpha-skill", "SKILL.md"),
      path.join("skills", "beta-skill", "SKILL.md"),
    ]);
  });

  it("skill link: claude rendered content is stable per skill", () => {
    process.chdir(projectDir);
    const result = linkToAgent("claude");
    expect(result.ok).toBe(true);
    const tree = readTree(path.join(projectDir, ".claude"));
    // Path layout intentionally changes in P11; the rendered content of each
    // linked skill must stay byte-identical.
    const contents = Object.values(tree).sort();
    expect(contents).toMatchSnapshot();
  });
});
