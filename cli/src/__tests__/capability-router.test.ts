/**
 * Parity tests for cli/src/lib/capability-router.ts.
 *
 * Loads the shared fixture at convex/__fixtures__/capability-router-cases.json
 * and asserts that the CLI resolver produces the expected output for every case.
 *
 * An identical test suite runs against convex/lib/capabilityRouter.ts in the
 * convex test runner — both must pass against the same fixture JSON.
 *
 * P18 (2026-06-12)
 */

import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { resolveCapability } from "../lib/capability-router";

// The fixture lives next to the convex tests so both runners can import it
// via relative paths without any shared module boundary.
const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../../convex/__fixtures__/capability-router-cases.json",
);

type FixtureCase = {
  description: string;
  input: {
    manifest: { capabilities?: unknown[] };
    request: { capability: string; args?: unknown };
  };
  expected: {
    matched: boolean;
    capability: string | null;
    transports: { http: boolean; mcp: boolean };
  };
};

const cases: FixtureCase[] = JSON.parse(
  fs.readFileSync(FIXTURE_PATH, "utf-8"),
) as FixtureCase[];

describe("capability-router (CLI) — fixture parity", () => {
  for (const tc of cases) {
    it(tc.description, () => {
      const result = resolveCapability(
        tc.input.manifest as Parameters<typeof resolveCapability>[0],
        tc.input.request,
      );

      expect(result.matched).toBe(tc.expected.matched);
      expect(result.capability).toBe(tc.expected.capability);
      expect(result.transports).toEqual(tc.expected.transports);
    });
  }
});
