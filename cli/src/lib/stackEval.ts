/**
 * stackEval.ts — deterministic golden-prompt eval runner for YouStack.
 *
 * From SELF-IMPROVING-SYSTEM-DESIGN.md §4 (Tier 4 enhancements):
 *   "youmd stack eval executes prompts/*.md against route_stack_request +
 *    rendered skills, diffs expected capability/route/output assertions,
 *    writes tests/eval-results.json with timestamps. Deterministic routing
 *    assertions are a lake (routeYouStackRequest is already deterministic);
 *    LLM-judged evals are the ocean — defer."
 *
 * Golden file format:
 *   stacks/<slug>/tests/golden.json
 *   { version: "golden/v1", entries: GoldenEntry[] }
 *
 * Results file:
 *   stacks/<slug>/tests/eval-results.json
 *   { ranAt, total, passed, failures }
 */

import * as fs from "fs";
import * as path from "path";
import type { YouStackManifest } from "./youstack";
import { routeYouStackRequest } from "./youstack";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoldenExpect {
  /**
   * The routed capability id must exactly match this value.
   * Use this to assert that a given prompt hits a specific capability.
   */
  routesTo?: string;
  /**
   * Strings that must appear in the matched capability's text representation
   * (id + intent + workflow + skill + mcpTool + apiEndpoint joined).
   */
  contains?: string[];
  /**
   * Strings that must NOT appear in the matched capability's text representation.
   */
  notContains?: string[];
}

export interface GoldenEntry {
  /** Human-readable label for this test case. */
  label: string;
  /** The prompt to route. */
  prompt: string;
  /** Assertions to check against the routing result. */
  expect: GoldenExpect;
}

export interface GoldenFile {
  version: "golden/v1";
  entries: GoldenEntry[];
}

export interface EvalFailure {
  label: string;
  prompt: string;
  /** What was expected. */
  expected: GoldenExpect;
  /** What the router actually returned. */
  actual: {
    routedTo: string;
    capabilityText: string;
  };
  /** Human-readable diff lines. */
  diff: string[];
}

export interface EvalResults {
  ranAt: string;
  total: number;
  passed: number;
  failures: EvalFailure[];
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export function goldenFilePath(stackRootDir: string): string {
  return path.join(stackRootDir, "tests", "golden.json");
}

export function evalResultsFilePath(stackRootDir: string): string {
  return path.join(stackRootDir, "tests", "eval-results.json");
}

// ---------------------------------------------------------------------------
// Golden file I/O
// ---------------------------------------------------------------------------

/**
 * Read and parse a golden.json file. Throws on missing or invalid file.
 */
export function readGoldenFile(stackRootDir: string): GoldenFile {
  const filePath = goldenFilePath(stackRootDir);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `golden.json not found at ${filePath}. Run \`youmd stack eval --init\` to create it.`
    );
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`golden.json is not valid JSON: ${filePath}`);
  }
  if (!isRecord(parsed) || parsed["version"] !== "golden/v1") {
    throw new Error(
      `golden.json must have version: "golden/v1". Got: ${JSON.stringify((parsed as Record<string, unknown>)["version"])}`
    );
  }
  if (!Array.isArray(parsed["entries"])) {
    throw new Error(`golden.json must have an "entries" array`);
  }
  return parsed as unknown as GoldenFile;
}

/**
 * Write a golden.json file. Creates the tests/ directory if needed.
 */
export function writeGoldenFile(stackRootDir: string, file: GoldenFile): string {
  const filePath = goldenFilePath(stackRootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(file, null, 2) + "\n");
  return filePath;
}

/**
 * Write eval-results.json. Creates the tests/ directory if needed.
 */
export function writeEvalResults(stackRootDir: string, results: EvalResults): string {
  const filePath = evalResultsFilePath(stackRootDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2) + "\n");
  return filePath;
}

// ---------------------------------------------------------------------------
// Example golden entries for --init
// ---------------------------------------------------------------------------

export function buildInitGoldenFile(manifest: YouStackManifest): GoldenFile {
  const slug = manifest.slug;
  const name = manifest.name;

  // Pull actual capability IDs from the manifest (user-declared only, not built-ins)
  const firstUserCapId = manifest.capabilities?.[0]?.id ?? "manifest.inspect";
  const readCapId = manifest.capabilities?.find(
    (c) => c.mutationPolicy === "read_only" || c.localOnly
  )?.id ?? "manifest.inspect";

  return {
    version: "golden/v1",
    entries: [
      {
        label: `inspect ${slug}`,
        prompt: `inspect the ${name} stack`,
        expect: {
          routesTo: "manifest.inspect",
          contains: ["inspect"],
        },
      },
      {
        label: `smoke check ${slug}`,
        prompt: `run smoke validation on ${name}`,
        expect: {
          routesTo: "manifest.smoke",
          contains: ["smoke"],
        },
      },
      {
        label: `first declared capability`,
        prompt: `use ${firstUserCapId} for ${slug}`,
        expect: {
          routesTo: firstUserCapId !== readCapId ? firstUserCapId : readCapId,
          contains: [firstUserCapId.split(".")[0]],
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function capabilityText(
  routeResult: ReturnType<typeof routeYouStackRequest>
): string {
  const cap = routeResult.capability;
  return [
    cap.id,
    cap.intent,
    cap.workflow,
    cap.skill,
    cap.mcpTool,
    cap.apiEndpoint,
    ...(cap.requiredScopes || []),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Run all entries in a golden file against the deterministic router.
 * No LLM calls — pure routing + string presence checks.
 */
export function runEval(
  manifest: YouStackManifest,
  goldenFile: GoldenFile
): EvalResults {
  const ranAt = new Date().toISOString();
  const failures: EvalFailure[] = [];
  let passed = 0;

  for (const entry of goldenFile.entries) {
    const result = routeYouStackRequest(manifest, entry.prompt);
    const text = capabilityText(result);
    const textLower = text.toLowerCase();
    const diff: string[] = [];

    // Check routesTo
    if (
      entry.expect.routesTo !== undefined &&
      result.capability.id !== entry.expect.routesTo
    ) {
      diff.push(
        `routesTo: expected "${entry.expect.routesTo}", got "${result.capability.id}"`
      );
    }

    // Check contains
    for (const needle of entry.expect.contains || []) {
      if (!textLower.includes(needle.toLowerCase())) {
        diff.push(`contains "${needle}": not found in capability text`);
      }
    }

    // Check notContains
    for (const needle of entry.expect.notContains || []) {
      if (textLower.includes(needle.toLowerCase())) {
        diff.push(`notContains "${needle}": unexpectedly found in capability text`);
      }
    }

    if (diff.length > 0) {
      failures.push({
        label: entry.label,
        prompt: entry.prompt,
        expected: entry.expect,
        actual: {
          routedTo: result.capability.id,
          capabilityText: text,
        },
        diff,
      });
    } else {
      passed++;
    }
  }

  return {
    ranAt,
    total: goldenFile.entries.length,
    passed,
    failures,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
