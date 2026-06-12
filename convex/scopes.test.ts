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
  DEFAULT_OWNER_KEY_SCOPES,
  OWNER_SESSION_SCOPES,
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

  it('P36: post-epoch "cli-auth" keys are NOT grandfathered (carve-out removed)', () => {
    // auth.ts now issues real owner scopes for new logins, so the label no
    // longer grants a bypass — these keys are enforced like any other.
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: POST_EPOCH,
        label: "cli-auth",
      })
    ).toBe(false);
    expect(
      isLegacyGrandfatheredKey({
        scopes: [...OWNER_SESSION_SCOPES],
        createdAt: POST_EPOCH,
        label: "cli-auth",
      })
    ).toBe(false);
  });

  it('pre-epoch "cli-auth" keys stay grandfathered via the epoch rule (old sessions keep working)', () => {
    expect(
      isLegacyGrandfatheredKey({
        scopes: ["read:public"],
        createdAt: PRE_EPOCH,
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

  it("P36: a post-epoch cli-auth key with full owner scopes passes requireScope-style write checks", () => {
    const key = {
      scopes: [...OWNER_SESSION_SCOPES],
      createdAt: POST_EPOCH,
      label: "cli-auth",
    };
    // Not grandfathered → http.ts requireScope checks `scopes.includes(scope)`.
    expect(isLegacyGrandfatheredKey(key)).toBe(false);
    for (const scope of ["write:bundle", "write:memories", "vault"] as const) {
      expect(key.scopes.includes(scope)).toBe(true);
    }
  });

  it("pins the epoch itself (2026-06-12T00:00:00Z) so it cannot drift silently", () => {
    expect(SCOPE_ENFORCEMENT_EPOCH).toBe(Date.UTC(2026, 5, 12));
  });
});

describe("scope defaults (P36)", () => {
  it("OWNER_SESSION_SCOPES is the full vocabulary (login keys are the owner's credential)", () => {
    expect(OWNER_SESSION_SCOPES).toEqual([...API_SCOPES]);
  });

  it("DEFAULT_OWNER_KEY_SCOPES is everything except vault (vault is opt-in)", () => {
    expect(DEFAULT_OWNER_KEY_SCOPES).toEqual([
      "read:public",
      "read:private",
      "write:bundle",
      "write:memories",
    ]);
    expect(DEFAULT_OWNER_KEY_SCOPES).not.toContain("vault");
  });
});
