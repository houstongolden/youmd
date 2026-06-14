import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildStackOkfFiles,
  collectStackSourceFiles,
  exportYouStackToOkf,
  StackSourceFile,
} from "../lib/okf-stack";
import { loadYouStackManifest, YouStackManifest } from "../lib/youstack";
import { validateOkfBundle, parseOkfFile } from "../lib/okf";

const EXAMPLE_STACK = path.resolve(__dirname, "../../examples/youstack-personal");

const MANIFEST: YouStackManifest = {
  schemaVersion: "youstack/v1",
  kind: "youstack",
  slug: "demo-stack",
  name: "Demo Stack",
  version: "0.1.0",
  description: "A demo stack for tests.",
  visibility: "public-open",
  tags: ["coding", "demo"],
  capabilities: [{ id: "startup", intent: "Kick off a session.", localOnly: true }],
  improvement: { mode: "propose" },
};

const SOURCE_FILES: StackSourceFile[] = [
  {
    path: "skills/demo/SKILL.md",
    declaredType: "skill",
    content: "---\nname: demo\ndescription: Demo skill.\n---\n\n# Demo\n\nDo the demo.",
  },
  {
    path: "workflows/startup.md",
    declaredType: "workflow",
    content: "# Startup\n\nLoad context, then act.",
  },
  {
    path: "docs/quickstart.md",
    declaredType: "docs",
    content: "# Quickstart\n\nInstall and go.",
  },
];

describe("buildStackOkfFiles", () => {
  it("produces a conformant OKF bundle with a manifest concept", () => {
    const result = buildStackOkfFiles(MANIFEST, SOURCE_FILES, {
      timestamp: "2026-06-13T00:00:00Z",
    });
    expect(result.validation.ok).toBe(true);

    const paths = result.files.map((f) => f.path);
    expect(paths).toContain("index.md");
    expect(paths).toContain("log.md");
    expect(paths).toContain("youstack.md");
    expect(paths).toContain("skills/demo/SKILL.md");

    const manifestConcept = result.files.find((f) => f.path === "youstack.md")!;
    const { frontmatter } = parseOkfFile(manifestConcept.content);
    expect(frontmatter.type).toBe("YouStack");
    expect(frontmatter.stack_slug).toBe("demo-stack");
    expect(frontmatter.stack_visibility).toBe("public-open");
  });

  it("maps declared file types to OKF concept types", () => {
    const result = buildStackOkfFiles(MANIFEST, SOURCE_FILES);
    const typeByPath = new Map(
      result.files
        .filter((f) => f.path.endsWith(".md") && f.path !== "index.md" && f.path !== "log.md")
        .map((f) => [f.path, parseOkfFile(f.content).frontmatter.type]),
    );
    expect(typeByPath.get("skills/demo/SKILL.md")).toBe("Skill");
    expect(typeByPath.get("workflows/startup.md")).toBe("Workflow");
    expect(typeByPath.get("docs/quickstart.md")).toBe("Documentation");
  });

  it("lists every concept in the root index grouped by heading", () => {
    const result = buildStackOkfFiles(MANIFEST, SOURCE_FILES);
    const index = result.files.find((f) => f.path === "index.md")!;
    expect(index.content).toContain('okf_version: "0.1"');
    expect(index.content).toContain("## Overview");
    expect(index.content).toContain("## Skills");
    expect(index.content).toContain("## Workflows");
    expect(index.content).toContain("[Demo Stack](/youstack.md)");
  });
});

describe("stack provenance", () => {
  it("stamps default author and preserves per-file provenance", () => {
    const { files } = buildStackOkfFiles(
      MANIFEST,
      [
        { path: "workflows/startup.md", declaredType: "workflow", content: "# Startup\n\nGo." },
        {
          path: "skills/demo/SKILL.md",
          declaredType: "skill",
          content: "---\nname: demo\nlast_updated_by: agent\nconfidence: medium\n---\n\n# Demo",
        },
      ],
      { defaultAuthor: "houston" },
    );
    const wf = parseOkfFile(files.find((f) => f.path === "workflows/startup.md")!.content);
    const skill = parseOkfFile(files.find((f) => f.path === "skills/demo/SKILL.md")!.content);
    const manifest = parseOkfFile(files.find((f) => f.path === "youstack.md")!.content);
    expect(wf.frontmatter.last_updated_by).toBe("houston"); // stamped default
    expect(skill.frontmatter.last_updated_by).toBe("agent"); // preserved
    expect(skill.frontmatter.confidence).toBe("medium");
    expect(manifest.frontmatter.last_updated_by).toBe("houston");
  });

  it("links every stack concept to the manifest hub", () => {
    const { files } = buildStackOkfFiles(MANIFEST, SOURCE_FILES);
    const wf = parseOkfFile(files.find((f) => f.path === "workflows/startup.md")!.content);
    const skill = parseOkfFile(files.find((f) => f.path === "skills/demo/SKILL.md")!.content);
    expect(wf.frontmatter.related).toEqual(["youstack"]);
    expect(skill.frontmatter.related).toEqual(["youstack"]);
  });
});

describe("real example stack export", () => {
  let tmp: string;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "okf-stack-"));
  });
  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("loads and exports youstack-personal as a conformant OKF bundle", () => {
    expect(fs.existsSync(path.join(EXAMPLE_STACK, "youstack.json"))).toBe(true);
    const loaded = loadYouStackManifest(EXAMPLE_STACK);

    const sourceFiles = collectStackSourceFiles(EXAMPLE_STACK, loaded.manifest);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const outDir = path.join(tmp, "stack-okf");
    const result = exportYouStackToOkf(loaded.manifest, EXAMPLE_STACK, outDir);
    expect(result.validation.ok).toBe(true);
    expect(result.conceptCount).toBeGreaterThan(1);

    // Re-validate the written bundle from disk, marking the root index.
    const written = result.written.filter((p) => p.endsWith(".md"));
    const files = written.map((p) => ({
      path: p,
      content: fs.readFileSync(path.join(outDir, p), "utf-8"),
    }));
    expect(validateOkfBundle(files).ok).toBe(true);

    // The canonical manifest is carried alongside for installability.
    expect(fs.existsSync(path.join(outDir, "youstack.json"))).toBe(true);
  });
});
