import { describe, expect, it } from "vitest";
import {
  buildRealtimeSyncStatusFile,
  describeRealtimeSecretVault,
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
        status: "ready",
        snapshotCount: 1,
        id: "snap_1",
        fileName: "env-vault.tar.enc",
        createdAt: 90,
        sha256: "vault",
        manifestSha256: "manifest",
        projectCount: 2,
        variableCount: 10,
        sourceHost: "source-mac",
        sourceRoot: "/Users/houston/Desktop/CODE_2025",
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
        encryptedEnvVault: {
          status: "ready",
          available: true,
          projectCount: 17,
          variableCount: 120,
          sourceHost: "source-mac",
          sha256: "1234567890abcdef12345678",
          secretValuesExposed: false,
        },
      }),
    ).toContain("Secret Vault ready: 17 projects / 120 vars from source-mac");
  });

  it("describes account-backed Secret Vault states without values", () => {
    const ready = describeRealtimeSecretVault({
      encryptedEnvVault: {
        status: "ready",
        available: true,
        snapshotCount: 2,
        fileName: "env-vault-2026.tar.enc",
        projectCount: 17,
        variableCount: 120,
        sha256: "abcdef1234567890abcdef1234567890",
        encryptionTool: "gpg",
        sourceHost: "source-mac",
        sourceRoot: "/Users/houston/Desktop/CODE_2025",
        secretValuesExposed: false,
      },
    });

    expect(ready.state).toBe("ready");
    expect(ready.available).toBe(true);
    expect(ready.summary).toContain("17 projects / 120 vars");
    expect(JSON.stringify(ready)).not.toContain(".env.local=");
    expect(ready.restoreCommand).toContain("--skip-agent-auth");
  });

  it("builds a daemon status file with a Secret Vault section", () => {
    const status = buildRealtimeSyncStatusFile({
      identity: { latestVersion: 12 },
      skills: { installedCount: 10 },
      encryptedEnvVault: {
        status: "missing",
        available: false,
        snapshotCount: 0,
        secretValuesExposed: false,
      },
    });

    expect(status.schemaVersion).toBe("you-md/realtime-sync-daemon-status/v1");
    expect(status.secretVault.state).toBe("missing");
    expect(status.secretVault.secretValuesExposed).toBe(false);
  });

  it("gates bounded sync runs by interval", () => {
    expect(shouldRunBoundedSync(0, 1000, 5000)).toBe(true);
    expect(shouldRunBoundedSync(1000, 4000, 5000)).toBe(false);
    expect(shouldRunBoundedSync(1000, 7000, 5000)).toBe(true);
  });
});
