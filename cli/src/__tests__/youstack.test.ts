import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  findYouStackManifestCandidates,
  getYouStackReadiness,
  isCanonicalYouStackManifestPath,
  linkYouStackAdapters,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackDoctor,
  runYouStackSmoke,
  validateYouStackManifest,
  verifyYouStackClaudeDiscovery,
} from "../lib/youstack";

describe("youstack manifest", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-youstack-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStackAt(baseDir: string, manifest: Record<string, unknown>): string {
    fs.mkdirSync(path.join(baseDir, "skills", "start"), { recursive: true });
    fs.mkdirSync(path.join(baseDir, "workflows"), { recursive: true });
    fs.writeFileSync(path.join(baseDir, "skills", "start", "SKILL.md"), "# Start\n");
    fs.writeFileSync(path.join(baseDir, "workflows", "startup.md"), "# Startup\n");
    fs.writeFileSync(path.join(baseDir, "youstack.json"), JSON.stringify(manifest, null, 2));
    return baseDir;
  }

  function writeStack(manifest: Record<string, unknown>): string {
    return writeStackAt(tmpDir, manifest);
  }

  function validManifest(extra: Record<string, unknown> = {}) {
    return {
      schemaVersion: "youstack/v1",
      kind: "youstack",
      slug: "test-stack",
      name: "Test Stack",
      domain: "test-domain",
      aliases: ["test"],
      tags: ["coding", "qa"],
      version: "0.1.0",
      visibility: "private",
      accessPolicy: {
        protectedByDefault: true,
      },
      files: [
        {
          path: "skills/start/SKILL.md",
          type: "skill",
          required: true,
        },
        {
          path: "workflows/startup.md",
          type: "workflow",
          required: true,
        },
      ],
      capabilities: [
        {
          id: "startup",
          intent: "Load project context and start the agent safely.",
          workflow: "workflows/startup.md",
          skill: "start",
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
      improvement: {
        mode: "propose",
        cadence: "after failures or user corrections",
        signals: ["usage", "failures", "user corrections"],
        evals: ["youmd stack smoke"],
        appliesTo: ["skills", "workflows", "docs"],
        approvalRequiredFor: ["brain.write", "remote_repo.write"],
      },
      update: {
        channel: "manual",
        check: "youmd stack smoke",
        source: "local",
        autoApply: false,
      },
      ...extra,
    };
  }

  it("validates a minimal local-first manifest", () => {
    const result = validateYouStackManifest(validManifest());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("keeps stack names, domains, and improvement/update policy explicit", () => {
    const result = validateYouStackManifest(validManifest());

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("warns when a stack omits self-improvement or update policy", () => {
    const manifest = validManifest();
    delete (manifest as Record<string, unknown>).improvement;
    delete (manifest as Record<string, unknown>).update;

    const result = validateYouStackManifest(manifest);

    expect(result.ok).toBe(true);
    expect(result.warnings.join("\n")).toContain("improvement policy is missing");
    expect(result.warnings.join("\n")).toContain("update policy is missing");
  });

  it("rejects unsafe paths and duplicate capability ids", () => {
    const result = validateYouStackManifest(
      validManifest({
        files: [{ path: "../secret.md", type: "skill", required: true }],
        capabilities: [{ id: "same" }, { id: "same" }],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("safe relative path");
    expect(result.errors.join("\n")).toContain("duplicate capability id");
  });

  it("rejects shell-unsafe stack slugs and capability ids", () => {
    const result = validateYouStackManifest(
      validManifest({
        slug: "bad slug",
        capabilities: [{ id: "needs spaces" }],
      })
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("slug must use only shell-safe identifier characters");
    expect(result.errors.join("\n")).toContain("capabilities[0].id must use only shell-safe identifier characters");
  });

  it("warns when stack metadata is not single-line", () => {
    const result = validateYouStackManifest(
      validManifest({
        domain: "research\nlab",
        aliases: ["good", "two\nlines"],
        tags: ["qa", "ship\tfast"],
      })
    );

    expect(result.ok).toBe(true);
    expect(result.warnings.join("\n")).toContain("domain should stay single-line");
    expect(result.warnings.join("\n")).toContain("aliases[1] should stay single-line");
    expect(result.warnings.join("\n")).toContain("tags[1] should stay single-line");
  });

  it("runs read-only smoke checks over required files", () => {
    writeStack(validManifest());
    const loaded = loadYouStackManifest(tmpDir);
    const smoke = runYouStackSmoke(loaded);

    expect(smoke.ok).toBe(true);
    expect(smoke.checks).toContain("stack: Test Stack (test-stack)");
    expect(smoke.checks).toContain("domain: test-domain");
    expect(smoke.checks).toContain("improvement policy: propose");
    expect(smoke.checks).toContain("update policy: manual");
    expect(smoke.checks).toContain("file exists: skills/start/SKILL.md");
    expect(smoke.checks).toContain("file exists: workflows/startup.md");
  });

  it("reports explicit readiness states", () => {
    const missing = getYouStackReadiness(null);
    expect(missing.ready).toBe(false);
    expect(missing.status).toBe("not_found");

    writeStack(validManifest({ slug: "bad slug" }));
    const invalid = getYouStackReadiness(loadYouStackManifest(tmpDir));
    expect(invalid.ready).toBe(false);
    expect(invalid.status).toBe("invalid");

    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-youstack-"));
    writeStack(validManifest());
    const ready = getYouStackReadiness(loadYouStackManifest(tmpDir));
    expect(ready.ready).toBe(true);
    expect(ready.status).toBe("ready");
  });

  it("discovers stacks in the canonical stacks/<slug>/youstack.json layout", () => {
    const stackDir = path.join(tmpDir, "stacks", "test-stack");
    writeStackAt(stackDir, validManifest());

    const candidates = findYouStackManifestCandidates(tmpDir);
    const canonicalManifest = path.join(stackDir, "youstack.json");

    expect(candidates).toContain(canonicalManifest);
    expect(isCanonicalYouStackManifestPath(canonicalManifest)).toBe(true);

    const loaded = loadYouStackManifest(stackDir);
    expect(loaded.validation.ok).toBe(true);
    expect(loaded.manifest.slug).toBe("test-stack");
  });

  it("prefers canonical-layout manifests over legacy candidates", () => {
    const legacyDir = path.join(tmpDir, "youstacks", "a-legacy-stack");
    writeStackAt(legacyDir, validManifest({ slug: "a-legacy-stack" }));
    const dotYouDir = path.join(tmpDir, ".you");
    fs.mkdirSync(dotYouDir, { recursive: true });
    fs.writeFileSync(
      path.join(dotYouDir, "youstack.json"),
      JSON.stringify(validManifest({ slug: "dot-you-stack" }), null, 2)
    );
    const canonicalDir = path.join(tmpDir, "stacks", "test-stack");
    writeStackAt(canonicalDir, validManifest());

    const candidates = findYouStackManifestCandidates(tmpDir);

    expect(candidates[0]).toBe(path.join(canonicalDir, "youstack.json"));
    expect(candidates).toContain(path.join(legacyDir, "youstack.json"));
    expect(candidates).toContain(path.join(dotYouDir, "youstack.json"));
  });

  it("still discovers legacy manifest locations by walking up", () => {
    writeStack(validManifest());
    const nested = path.join(tmpDir, "deep", "nested");
    fs.mkdirSync(nested, { recursive: true });

    const candidates = findYouStackManifestCandidates(nested);

    expect(candidates).toContain(path.join(tmpDir, "youstack.json"));
    expect(isCanonicalYouStackManifestPath(path.join(tmpDir, "youstack.json"))).toBe(false);
  });

  it("doctor warns when the manifest is outside the canonical layout", () => {
    writeStack(validManifest());
    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.ok).toBe(true);
    expect(doctor.diagnostics.join("\n")).toContain("layout: legacy");
    expect(doctor.warnings.join("\n")).toContain(
      "stack manifest found outside the canonical layout; move it to stacks/test-stack/youstack.json"
    );
  });

  it("doctor accepts the canonical layout without a layout warning", () => {
    const stackDir = path.join(tmpDir, "stacks", "test-stack");
    writeStackAt(stackDir, validManifest());
    const doctor = runYouStackDoctor(loadYouStackManifest(stackDir));

    expect(doctor.ok).toBe(true);
    expect(doctor.diagnostics.join("\n")).toContain("layout: canonical (stacks/<slug>/youstack.json)");
    expect(doctor.warnings.join("\n")).not.toContain("outside the canonical layout");
  });

  it("doctor warns when the canonical stack folder does not match the slug", () => {
    const stackDir = path.join(tmpDir, "stacks", "wrong-folder");
    writeStackAt(stackDir, validManifest());
    const doctor = runYouStackDoctor(loadYouStackManifest(stackDir));

    expect(doctor.warnings.join("\n")).toContain(
      'stack folder name "wrong-folder" does not match manifest slug "test-stack"; rename the folder to stacks/test-stack/'
    );
  });

  it("doctor reports invalid manifests with an actionable hint", () => {
    const manifest = validManifest();
    delete (manifest as Record<string, unknown>).name;
    delete (manifest as Record<string, unknown>).version;
    writeStack(manifest);

    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.ok).toBe(false);
    expect(doctor.errors.join("\n")).toContain("missing required field: name");
    expect(doctor.errors.join("\n")).toContain("missing required field: version");
    expect(doctor.warnings.join("\n")).toContain(
      "manifest is invalid (2 errors); fix the missing or invalid fields reported above, then rerun you stack doctor"
    );
  });

  it("runs read-only doctor diagnostics for stack health", () => {
    writeStack(validManifest());
    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.ok).toBe(true);
    expect(doctor.diagnostics.join("\n")).toContain("capabilities:");
    expect(doctor.diagnostics.join("\n")).toContain("file types:");
    expect(doctor.recommendations.join("\n")).toContain("Add host adapters");
  });

  it("fails smoke checks for missing required files", () => {
    writeStack(
      validManifest({
        files: [{ path: "missing/SKILL.md", type: "skill", required: true }],
      })
    );
    const smoke = runYouStackSmoke(loadYouStackManifest(tmpDir));

    expect(smoke.ok).toBe(false);
    expect(smoke.errors).toContain("missing stack file: missing/SKILL.md");
  });

  it("checks sha256 file checksums when present", () => {
    const filePath = path.join(tmpDir, "skills", "start", "SKILL.md");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "# Start\n");
    const checksum = crypto.createHash("sha256").update("# Start\n").digest("hex");
    fs.writeFileSync(
      path.join(tmpDir, "youstack.json"),
      JSON.stringify(
        validManifest({
          files: [{ path: "skills/start/SKILL.md", type: "skill", required: true, checksum: `sha256:${checksum}` }],
        }),
        null,
        2
      )
    );

    const smoke = runYouStackSmoke(loadYouStackManifest(tmpDir));
    expect(smoke.ok).toBe(true);
    expect(smoke.checks).toContain("checksum ok: skills/start/SKILL.md");
  });

  it("routes fuzzy requests to the best local capability", () => {
    const route = routeYouStackRequest(
      validManifest(),
      "please search my protected memories before starting"
    );

    expect(route.capability.id).toBe("protected-memory-search");
    expect(route.score).toBeGreaterThan(0);
  });

  it("routes improvement requests to the built-in improvement capability", () => {
    const route = routeYouStackRequest(
      validManifest(),
      "improve this stack from failures and user corrections"
    );

    expect(route.capability.id).toBe("stack.improve");
    expect(route.score).toBeGreaterThan(0);
  });

  it("routes diagnostic requests to the built-in doctor capability", () => {
    const route = routeYouStackRequest(
      validManifest(),
      "diagnose stack health for route drift and manifest bloat"
    );

    expect(route.capability.id).toBe("stack.diagnose");
    expect(route.score).toBeGreaterThan(0);
  });

  it("generates host adapter files from the manifest", () => {
    writeStack(validManifest({
      adapters: {
        codex: {
          files: [".codex/skills/youstacks/test-stack/SKILL.md"],
        },
      },
    }));
    const targetDir = path.join(tmpDir, "project");
    const results = linkYouStackAdapters(loadYouStackManifest(tmpDir), {
      hosts: ["codex"],
      targetDir,
    });
    const adapterPath = path.join(targetDir, ".codex", "skills", "youstacks", "test-stack", "SKILL.md");

    expect(results).toHaveLength(1);
    expect(results[0].wrote).toBe(true);
    expect(fs.existsSync(adapterPath)).toBe(true);
    expect(fs.readFileSync(adapterPath, "utf-8")).toContain("Test Stack YouStack");
    expect(fs.readFileSync(adapterPath, "utf-8")).toContain("protected-memory-search");
    expect(fs.readFileSync(adapterPath, "utf-8")).toContain("Protected reads may return readiness states");
  });

  it("links claude-code adapters into the .claude/skills/<slug>/SKILL.md discovery layout", () => {
    writeStack(validManifest({ description: "Test stack description." }));
    const targetDir = path.join(tmpDir, "project");
    const results = linkYouStackAdapters(loadYouStackManifest(tmpDir), {
      hosts: ["claude-code"],
      targetDir,
    });
    const skillPath = path.join(targetDir, ".claude", "skills", "test-stack", "SKILL.md");

    expect(results).toHaveLength(1);
    expect(results[0].targetPath).toBe(skillPath);
    expect(fs.existsSync(skillPath)).toBe(true);
    const content = fs.readFileSync(skillPath, "utf-8");
    expect(content.startsWith("---\nname: test-stack\ndescription: Test stack description.\n---\n\n")).toBe(true);
    expect(content).toContain("# Test Stack YouStack");
  });

  it("verifyYouStackClaudeDiscovery passes for a valid stack and fails for broken declared paths", () => {
    writeStack(validManifest());
    const ok = verifyYouStackClaudeDiscovery(loadYouStackManifest(tmpDir));
    expect(ok.ok).toBe(true);
    expect(ok.checks).toHaveLength(1);
    expect(ok.checks[0].name).toBe("test-stack");

    // A declared claude adapter path outside the discovery layout breaks the
    // name-matches-directory contract.
    fs.writeFileSync(
      path.join(tmpDir, "youstack.json"),
      JSON.stringify(
        validManifest({
          adapters: {
            "claude-code": { files: [".claude/skills/wrong-dir/SKILL.md"] },
          },
        }),
        null,
        2
      )
    );
    const bad = verifyYouStackClaudeDiscovery(loadYouStackManifest(tmpDir));
    expect(bad.ok).toBe(false);
    expect(bad.checks[0].problems.join("\n")).toContain('does not match its directory "wrong-dir"');
  });

  it("doctor runs the claude discovery gate with per-skill results", () => {
    writeStack(validManifest());
    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.ok).toBe(true);
    expect(doctor.discovery).toHaveLength(1);
    expect(doctor.discovery[0].ok).toBe(true);
    expect(doctor.checks.join("\n")).toContain("claude discovery ok:");
  });

  it("doctor fails when the stack's claude SKILL.md would not be discoverable", () => {
    writeStack(
      validManifest({
        adapters: {
          "claude-code": { files: [".claude/skills/wrong-dir/SKILL.md"] },
        },
      })
    );
    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.ok).toBe(false);
    expect(doctor.discovery[0].ok).toBe(false);
    expect(doctor.errors.join("\n")).toContain("claude discovery failed for");
  });

  it("doctor skips the discovery gate for invalid manifests", () => {
    const manifest = validManifest();
    delete (manifest as Record<string, unknown>).name;
    writeStack(manifest);
    const doctor = runYouStackDoctor(loadYouStackManifest(tmpDir));

    expect(doctor.discovery).toEqual([]);
    expect(doctor.diagnostics.join("\n")).toContain("claude discovery: skipped (manifest invalid)");
  });

  it("supports dry-run adapter generation without writing files", () => {
    writeStack(validManifest());
    const targetDir = path.join(tmpDir, "project");
    const results = linkYouStackAdapters(loadYouStackManifest(tmpDir), {
      hosts: ["cursor"],
      targetDir,
      dryRun: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0].wrote).toBe(false);
    expect(results[0].targetPath).toContain(".cursor");
    expect(fs.existsSync(results[0].targetPath)).toBe(false);
  });
});

// ── L18: YouStack manifest workflows array ────────────────────────────────────

describe("youstack manifest — workflows (L18)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-youstack-wf-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStack(manifest: Record<string, unknown>): string {
    fs.mkdirSync(path.join(tmpDir, "skills", "start"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "workflows"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "skills", "start", "SKILL.md"), "# Start\n");
    fs.writeFileSync(path.join(tmpDir, "workflows", "startup.md"), "# Startup\n");
    fs.writeFileSync(path.join(tmpDir, "youstack.json"), JSON.stringify(manifest, null, 2));
    return tmpDir;
  }

  function baseManifest(extra: Record<string, unknown> = {}) {
    return {
      schemaVersion: "youstack/v1",
      kind: "youstack",
      slug: "wf-test-stack",
      name: "WF Test Stack",
      version: "0.1.0",
      visibility: "private",
      accessPolicy: { protectedByDefault: true },
      files: [
        { path: "skills/start/SKILL.md", type: "skill" },
        { path: "workflows/startup.md", type: "workflow" },
      ],
      improvement: { mode: "observe", evals: ["youmd stack smoke"] },
      update: { channel: "local" },
      ...extra,
    };
  }

  it("parses a manifest with valid workflows — no warnings", () => {
    writeStack(
      baseManifest({
        workflows: [
          { id: "weekly-report", schedule: "0 9 * * 1", action: "report_skill_outcome" },
          { id: "daily-run", schedule: "0 8 * * *", action: "run_skill", params: { skill: "hello" } },
        ],
      })
    );

    const loaded = loadYouStackManifest(tmpDir);
    expect(loaded.manifest.workflows).toHaveLength(2);
    expect(loaded.manifest.workflows![0].id).toBe("weekly-report");
    expect(loaded.manifest.workflows![1].params).toEqual({ skill: "hello" });

    const doctor = runYouStackDoctor(loaded);
    // No workflow-action warnings for known actions
    const wfWarnings = doctor.warnings.filter((w) => w.includes("unknown action type"));
    expect(wfWarnings).toHaveLength(0);
  });

  it("doctor emits a warning for an unknown workflow action type", () => {
    writeStack(
      baseManifest({
        workflows: [
          { id: "bad-action", schedule: "0 9 * * 1", action: "teleport_somewhere" },
        ],
      })
    );

    const loaded = loadYouStackManifest(tmpDir);
    const doctor = runYouStackDoctor(loaded);

    const wfWarning = doctor.warnings.find((w) => w.includes("unknown action type"));
    expect(wfWarning).toBeDefined();
    expect(wfWarning).toContain("bad-action");
    expect(wfWarning).toContain("teleport_somewhere");
    expect(wfWarning).toContain("run_skill");
    expect(wfWarning).toContain("report_skill_outcome");
  });

  it("doctor warns about workflows missing id or schedule", () => {
    writeStack(
      baseManifest({
        workflows: [
          { id: "", schedule: "", action: "run_skill" },
        ],
      })
    );

    const loaded = loadYouStackManifest(tmpDir);
    const doctor = runYouStackDoctor(loaded);

    const allWarnings = doctor.warnings.join("\n");
    expect(allWarnings).toContain("missing an id field");
  });

  it("manifest without workflows parses cleanly — workflows field is optional", () => {
    writeStack(baseManifest());
    const loaded = loadYouStackManifest(tmpDir);
    expect(loaded.manifest.workflows).toBeUndefined();
    expect(loaded.validation.ok).toBe(true);
  });
});

// P19 — requiresScopes doctor validation
describe("YouStack requiresScopes doctor (P19)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youstack-scopes-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeStack(manifest: unknown) {
    fs.writeFileSync(path.join(tmpDir, "youstack.json"), JSON.stringify(manifest, null, 2));
  }

  function baseManifest(overrides: Record<string, unknown> = {}) {
    return {
      schemaVersion: "youstack/v1",
      kind: "youstack",
      slug: "test-scopes",
      name: "Test Scopes",
      version: "1.0.0",
      visibility: "private",
      ...overrides,
    };
  }

  it("accepts all known scopes without warnings", () => {
    writeStack(baseManifest({ requiresScopes: ["read:public", "read:private", "write:bundle", "write:memories", "vault"] }));
    const loaded = loadYouStackManifest(tmpDir);
    const doctor = runYouStackDoctor(loaded);
    const warnings = doctor.warnings.join("\n");
    expect(warnings).not.toContain("requiresScopes");
  });

  it("warns on unknown scope name", () => {
    writeStack(baseManifest({ requiresScopes: ["read:public", "magic:sauce"] }));
    const loaded = loadYouStackManifest(tmpDir);
    const doctor = runYouStackDoctor(loaded);
    const warnings = doctor.warnings.join("\n");
    expect(warnings).toContain("magic:sauce");
    expect(warnings).toContain("not a known API scope");
  });

  it("emits requires scopes diagnostic line when populated", () => {
    writeStack(baseManifest({ requiresScopes: ["read:private", "write:memories"] }));
    const loaded = loadYouStackManifest(tmpDir);
    const doctor = runYouStackDoctor(loaded);
    const diagnostics = doctor.diagnostics.join("\n");
    expect(diagnostics).toContain("requires scopes: read:private, write:memories");
  });

  it("requiresScopes is optional — no warning when absent", () => {
    writeStack(baseManifest());
    const loaded = loadYouStackManifest(tmpDir);
    expect(loaded.manifest.requiresScopes).toBeUndefined();
    const doctor = runYouStackDoctor(loaded);
    const warnings = doctor.warnings.join("\n");
    expect(warnings).not.toContain("requiresScopes");
  });
});
