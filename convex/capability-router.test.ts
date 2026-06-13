/**
 * Parity tests for convex/lib/capability-router.ts.
 *
 * Loads the shared fixture at convex/__fixtures__/capability-router-cases.json
 * and asserts that the Convex resolver produces the expected output for every case.
 *
 * An identical test suite runs against cli/src/lib/capability-router.ts in the
 * CLI test runner — both must pass against the same fixture JSON.
 *
 * P18 (2026-06-12)
 */

import { describe, expect, it } from "vitest";
import { resolveCapability } from "./lib/capability-router";
import cases from "./__fixtures__/capability-router-cases.json";

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

describe("capability-router (Convex) — fixture parity", () => {
  for (const tc of cases as FixtureCase[]) {
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
