import { describe, expect, it } from "vitest";
import {
  realtimeSyncHeadSignature,
  shouldRunBoundedSync,
  summarizeRealtimeSyncHead,
} from "../lib/realtime-sync";

describe("realtime sync helpers", () => {
  it("ignores volatile server/session timestamps in the sync signature", () => {
    const base = {
      schemaVersion: "you-md/realtime-sync-head/v1",
      serverNow: 100,
      sessionExpiresAt: 200,
      identity: { latestVersion: 7, latestHash: "abc" },
      skills: { installedCount: 2, latestInstalledAt: 50, names: ["a", "b"] },
      portfolio: { updatedAt: 70, projects: 3, tasks: 4 },
      encryptedEnvVault: {
        available: true,
        createdAt: 90,
        sha256: "vault",
        projectCount: 2,
        variableCount: 10,
        secretValuesExposed: false as const,
      },
    };

    expect(realtimeSyncHeadSignature(base)).toEqual(
      realtimeSyncHeadSignature({ ...base, serverNow: 999, sessionExpiresAt: 1000 }),
    );
  });

  it("includes material sync fields in the sync signature", () => {
    const one = realtimeSyncHeadSignature({
      identity: { latestVersion: 7, latestHash: "abc" },
      skills: { installedCount: 2, names: ["a", "b"] },
    });
    const two = realtimeSyncHeadSignature({
      identity: { latestVersion: 8, latestHash: "def" },
      skills: { installedCount: 2, names: ["a", "b"] },
    });

    expect(one).not.toEqual(two);
  });

  it("summarizes without exposing secrets", () => {
    expect(
      summarizeRealtimeSyncHead({
        identity: { latestVersion: 12 },
        skills: { installedCount: 10 },
        portfolio: { projects: 61, tasks: 8 },
        encryptedEnvVault: { available: true, secretValuesExposed: false },
      }),
    ).toContain("vault metadata ready");
  });

  it("gates bounded sync runs by interval", () => {
    expect(shouldRunBoundedSync(0, 1000, 5000)).toBe(true);
    expect(shouldRunBoundedSync(1000, 4000, 5000)).toBe(false);
    expect(shouldRunBoundedSync(1000, 7000, 5000)).toBe(true);
  });
});
