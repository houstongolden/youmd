import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  getYouStackReadiness,
  linkYouStackAdapters,
  loadYouStackManifest,
  routeYouStackRequest,
  runYouStackDoctor,
  runYouStackSmoke,
  validateYouStackManifest,
} from "../lib/youstack";

describe("youstack manifest", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-youstack-"));
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
