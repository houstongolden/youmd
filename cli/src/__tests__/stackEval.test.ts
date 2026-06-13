import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildInitGoldenFile,
  goldenFilePath,
  evalResultsFilePath,
  readGoldenFile,
  runEval,
  writeEvalResults,
  writeGoldenFile,
  type GoldenFile,
} from "../lib/stackEval";
import type { YouStackManifest } from "../lib/youstack";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-stackeval-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeManifest(extra: Partial<YouStackManifest> = {}): YouStackManifest {
  return {
    schemaVersion: "youstack/v1",
    kind: "youstack",
    slug: "eval-test-stack",
    name: "Eval Test Stack",
    version: "0.1.0",
    visibility: "private",
    capabilities: [
      {
        id: "startup",
        intent: "Load project context and start the agent safely.",
        workflow: "workflows/startup.md",
        localOnly: true,
        mutationPolicy: "read_only",
      },
      {
        id: "search-memories",
        intent: "Search protected memories through You.md MCP.",
        mcpTool: "search_memories",
        mutationPolicy: "read_only",
      },
      {
        id: "write-memory",
        intent: "Save a new memory to the brain.",
        mcpTool: "save_memory",
        mutationPolicy: "write_protected",
      },
    ],
    ...extra,
  } as YouStackManifest;
}

// ---------------------------------------------------------------------------
// goldenFilePath / evalResultsFilePath
// ---------------------------------------------------------------------------

describe("path helpers", () => {
  it("returns tests/golden.json inside the stack root", () => {
    expect(goldenFilePath("/home/user/stacks/my-stack")).toBe(
      "/home/user/stacks/my-stack/tests/golden.json"
    );
  });

  it("returns tests/eval-results.json inside the stack root", () => {
    expect(evalResultsFilePath("/home/user/stacks/my-stack")).toBe(
      "/home/user/stacks/my-stack/tests/eval-results.json"
    );
  });
});

// ---------------------------------------------------------------------------
// writeGoldenFile / readGoldenFile
// ---------------------------------------------------------------------------

describe("writeGoldenFile / readGoldenFile", () => {
  it("round-trips a golden file", () => {
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "test entry",
          prompt: "inspect the stack",
          expect: { routesTo: "manifest.inspect", contains: ["inspect"] },
        },
      ],
    };
    writeGoldenFile(tmpDir, golden);
    const loaded = readGoldenFile(tmpDir);
    expect(loaded.version).toBe("golden/v1");
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].label).toBe("test entry");
  });

  it("creates the tests/ directory if absent", () => {
    const golden: GoldenFile = { version: "golden/v1", entries: [] };
    writeGoldenFile(tmpDir, golden);
    expect(fs.existsSync(path.join(tmpDir, "tests", "golden.json"))).toBe(true);
  });

  it("throws on missing golden.json with --init hint", () => {
    expect(() => readGoldenFile(tmpDir)).toThrow(/--init/);
  });

  it("throws on invalid JSON", () => {
    fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "tests", "golden.json"), "{broken");
    expect(() => readGoldenFile(tmpDir)).toThrow(/not valid JSON/);
  });

  it("throws on wrong version", () => {
    fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "tests", "golden.json"),
      JSON.stringify({ version: "golden/v0", entries: [] })
    );
    expect(() => readGoldenFile(tmpDir)).toThrow(/golden\/v1/);
  });
});

// ---------------------------------------------------------------------------
// buildInitGoldenFile
// ---------------------------------------------------------------------------

describe("buildInitGoldenFile", () => {
  it("produces 3 entries for a manifest with capabilities", () => {
    const file = buildInitGoldenFile(makeManifest());
    expect(file.version).toBe("golden/v1");
    expect(file.entries).toHaveLength(3);
  });

  it("all entries have non-empty label, prompt, and expect", () => {
    const file = buildInitGoldenFile(makeManifest());
    for (const entry of file.entries) {
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.prompt.length).toBeGreaterThan(0);
      expect(entry.expect).toBeDefined();
    }
  });

  it("first entry routes to manifest.inspect", () => {
    const file = buildInitGoldenFile(makeManifest());
    expect(file.entries[0].expect.routesTo).toBe("manifest.inspect");
  });

  it("second entry routes to manifest.smoke", () => {
    const file = buildInitGoldenFile(makeManifest());
    expect(file.entries[1].expect.routesTo).toBe("manifest.smoke");
  });
});

// ---------------------------------------------------------------------------
// runEval — deterministic routing assertions
// ---------------------------------------------------------------------------

describe("runEval", () => {
  it("passes a golden suite where all entries match", () => {
    const manifest = makeManifest();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "inspect",
          prompt: "inspect the eval-test-stack stack",
          expect: { routesTo: "manifest.inspect", contains: ["inspect"] },
        },
        {
          label: "smoke",
          prompt: "run smoke validation on Eval Test Stack",
          expect: { routesTo: "manifest.smoke", contains: ["smoke"] },
        },
      ],
    };
    const results = runEval(manifest, golden);
    expect(results.total).toBe(2);
    expect(results.passed).toBe(2);
    expect(results.failures).toHaveLength(0);
  });

  it("fails when routesTo does not match", () => {
    const manifest = makeManifest();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "wrong route",
          prompt: "inspect the stack",
          expect: { routesTo: "write-memory" }, // wrong — inspect matches manifest.inspect
        },
      ],
    };
    const results = runEval(manifest, golden);
    expect(results.passed).toBe(0);
    expect(results.failures).toHaveLength(1);
    const failure = results.failures[0];
    expect(failure.label).toBe("wrong route");
    expect(failure.diff.some((d) => d.includes("routesTo"))).toBe(true);
  });

  it("fails when contains string is absent from capability text", () => {
    const manifest = makeManifest();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "missing contains",
          prompt: "inspect the stack",
          expect: { contains: ["nonexistent-term-xyz"] },
        },
      ],
    };
    const results = runEval(manifest, golden);
    expect(results.failures).toHaveLength(1);
    expect(results.failures[0].diff.some((d) => d.includes("nonexistent-term-xyz"))).toBe(true);
  });

  it("fails when notContains string is present in capability text", () => {
    const manifest = makeManifest();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "notContains check",
          prompt: "inspect the stack",
          expect: { notContains: ["inspect"] }, // "inspect" IS in the matched capability text
        },
      ],
    };
    const results = runEval(manifest, golden);
    expect(results.failures).toHaveLength(1);
    expect(results.failures[0].diff.some((d) => d.includes("notContains"))).toBe(true);
  });

  it("writes correct ranAt timestamp and correct total/passed counts", () => {
    const manifest = makeManifest();
    const before = Date.now();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "check",
          prompt: "smoke the stack",
          expect: { routesTo: "manifest.smoke" },
        },
      ],
    };
    const results = runEval(manifest, golden);
    const after = Date.now();
    const ranAt = new Date(results.ranAt).getTime();
    expect(ranAt).toBeGreaterThanOrEqual(before);
    expect(ranAt).toBeLessThanOrEqual(after);
    expect(results.total).toBe(1);
    expect(results.passed).toBe(1);
  });

  it("includes actual.routedTo in each failure", () => {
    const manifest = makeManifest();
    const golden: GoldenFile = {
      version: "golden/v1",
      entries: [
        {
          label: "bad route",
          prompt: "inspect the stack",
          expect: { routesTo: "definitely-wrong-id" },
        },
      ],
    };
    const results = runEval(manifest, golden);
    expect(results.failures[0].actual.routedTo).toBeDefined();
    expect(results.failures[0].actual.routedTo).not.toBe("");
  });
});

// ---------------------------------------------------------------------------
// writeEvalResults
// ---------------------------------------------------------------------------

describe("writeEvalResults", () => {
  it("writes eval-results.json and it parses back correctly", () => {
    const results = {
      ranAt: new Date().toISOString(),
      total: 2,
      passed: 2,
      failures: [],
    };
    const filePath = writeEvalResults(tmpDir, results);
    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(parsed.total).toBe(2);
    expect(parsed.passed).toBe(2);
    expect(parsed.failures).toHaveLength(0);
  });
});
