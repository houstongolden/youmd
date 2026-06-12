/**
 * Scope-enforcement contract tests (T3 — convex-test backlog item).
 *
 * convex/http.ts `requireScope` trusts this module for two decisions:
 * which scope strings exist, and which keys are legacy grandfathered
 * (full access + scope_missing telemetry). These tests pin that contract
 * so apiKeys.ts and http.ts cannot silently drift.
 */
import { describe, expect, it } from "vitest";

import {
  API_SCOPES,
  SCOPE_ENFORCEMENT_EPOCH,
  isKnownScope,
  isLegacyGrandfatheredKey,
} from "./lib/scopes";

const POST_EPOCH = SCOPE_ENFORCEMENT_EPOCH + 1;
const PRE_EPOCH = SCOPE_ENFORCEMENT_EPOCH - 1;

describe("isKnownScope", () => {
  it("accepts every scope in the canonical vocabulary", () => {
    expect(API_SCOPES).toEqual([
      "read:public",
      "read:private",
      "write:bundle",
      "write:memories",
      "vault",
    ]);
    for (const scope of API_SCOPES) {
      expect(isKnownScope(scope)).toBe(true);
    }
  });

  it("rejects unknown, near-miss, and empty scope strings", () => {
    for (const bad of [
      "",
      "read",
      "read:Public",
      "READ:PUBLIC",
      "write:vault",
      "vault:read",
      "admin",
      "read:public ",
      "*",
    ]) {
      expect(isKnownScope(bad)).toBe(false);
    }
  });
});

describe("isLegacyGrandfatheredKey", () => {
  it("grandfathers keys with no scopes at all (pre-schema docs)", () => {
    expect(
      isLegacyGrandfatheredKey({ scopes: undefined, createdAt: POST_EPOCH })
    ).toBe(true);
    expect(
      isLegacyGrandfatheredKey({ scopes: null, createdAt: POST_EPOCH })
    ).toBe(true);
    expect(
      isLegacyGrandfatheredKey({ scopes: [], createdAt: POST_EPOCH })
    ).toBe(true);
  });

  it("grandfathers keys created before the enforcement epoch", () => {
    expect(
      isLegacyGrandfatheredKey({ scopes: ["read:public"], createdAt: PRE_EPOCH })
    ).toBe(true);
    // Ancient key, full scopes declared — still grandfathered by age.
    expect(
      isLegacyGrandfatheredKey({
        scopes: [...API_SCOPES],
        createdAt: 0,
        label: "old key",
      })
    ).toBe(true);
  });

  it("epoch boundary is strict: createdAt === epoch is NOT grandfathered", () => {
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: SCOPE_ENFORCEMENT_EPOCH,
      })
    ).toBe(false);
  });

  it('grandfathers "cli-auth" login session keys regardless of age/scopes', () => {
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: POST_EPOCH,
        label: "cli-auth",
      })
    ).toBe(true);
  });

  it("does NOT grandfather a post-epoch scoped key with a normal label", () => {
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: POST_EPOCH,
        label: "my agent key",
      })
    ).toBe(false);
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:private", "write:bundle"],
        createdAt: POST_EPOCH,
      })
    ).toBe(false);
  });

  it('label matching is exact — "cli-auth-2" or "CLI-AUTH" do not qualify', () => {
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: POST_EPOCH,
        label: "cli-auth-2",
      })
    ).toBe(false);
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: POST_EPOCH,
        label: "CLI-AUTH",
      })
    ).toBe(false);
  });

  it("pins the epoch itself (2026-06-12T00:00:00Z) so it cannot drift silently", () => {
    expect(SCOPE_ENFORCEMENT_EPOCH).toBe(Date.UTC(2026, 5, 12));
  });
});
