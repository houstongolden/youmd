import { describe, expect, it } from "vitest";
import {
  DEFAULT_AGENT_STACK_INVENTORY_INTERVAL_SECONDS,
  DEFAULT_AGENT_STACK_REPAIR_INTERVAL_SECONDS,
  buildRealtimeSyncStatusFile,
  describeRealtimeSecretVault,
  findAgentStackDriftRepairTarget,
  realtimeSyncHeadSignature,
  resolveAgentStackInventoryDir,
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
        trustedDeviceCount: 2,
        keyEnvelopeCount: 2,
        latestSnapshotEnvelopeCount: 2,
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
          trustedDeviceCount: 2,
          latestSnapshotEnvelopeCount: 2,
          sourceHost: "source-mac",
          sha256: "1234567890abcdef12345678",
          secretValuesExposed: false,
        },
      }),
    ).toContain("Secret Vault ready: 17 projects / 120 vars from source-mac / 2/2 device envelopes");
  });

  it("describes account-backed Secret Vault states without values", () => {
    const ready = describeRealtimeSecretVault({
      encryptedEnvVault: {
        status: "ready",
        available: true,
        snapshotCount: 2,
        trustedDeviceCount: 2,
        keyEnvelopeCount: 3,
        latestSnapshotEnvelopeCount: 2,
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
    expect(ready.summary).toContain("2/2 device envelopes");
    expect(JSON.stringify(ready)).not.toContain(".env.local=");
    expect(ready.deviceRegisterCommand).toContain("device-register");
    expect(ready.shareCommand).toContain("vault share");
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

  it("uses a bounded default cadence for resident agent stack inventory", () => {
    expect(DEFAULT_AGENT_STACK_INVENTORY_INTERVAL_SECONDS).toBe(1800);
  });

  it("uses a bounded default cadence for resident agent stack repair", () => {
    expect(DEFAULT_AGENT_STACK_REPAIR_INTERVAL_SECONDS).toBe(1800);
  });

  it("targets only the local drift row for resident agent stack repair", () => {
    const drift = {
      summary: { driftCount: 1, staleCount: 0, unsafeCount: 0 },
      machines: [
        {
          hostName: "source-mac",
          status: "baseline",
          stale: false,
          issues: [],
          repairCommands: [],
          secretValuesExposed: false,
        },
        {
          hostName: "Houstons-Mac-Mini.lan",
          status: "drift",
          stale: false,
          issues: ["418 fewer skill names than baseline"],
          repairCommands: ["youmd stack sync", "youmd skill sync"],
          secretValuesExposed: false,
        },
      ],
      secretValuesExposed: false as const,
    };

    expect(findAgentStackDriftRepairTarget(drift, "houstons-mac-mini")).toMatchObject({
      hostName: "Houstons-Mac-Mini.lan",
      status: "drift",
    });
    expect(findAgentStackDriftRepairTarget(drift, "source-mac")).toBeNull();
  });

  it("repairs stale local baseline rows without treating healthy ahead rows as broken", () => {
    expect(
      findAgentStackDriftRepairTarget(
        {
          machines: [{ hostName: "source-mac", status: "baseline", stale: true, issues: ["inventory proof is stale"], secretValuesExposed: false }],
          secretValuesExposed: false,
        },
        "source-mac",
      ),
    ).toMatchObject({ status: "baseline", stale: true });

    expect(
      findAgentStackDriftRepairTarget(
        {
          machines: [{ hostName: "source-mac", status: "ahead", stale: false, issues: [], secretValuesExposed: false }],
          secretValuesExposed: false,
        },
        "source-mac",
      ),
    ).toBeNull();
  });

  it("resolves the resident agent stack inventory directory safely", () => {
    expect(resolveAgentStackInventoryDir({}, "/Users/houston")).toBe(
      "/Users/houston/.you/agent-stack-inventory",
    );
    expect(
      resolveAgentStackInventoryDir(
        { YOUMD_AGENT_STACK_INVENTORY_DIR: "~/custom-agent-stack" },
        "/Users/houston",
      ),
    ).toBe("/Users/houston/custom-agent-stack");
    expect(
      resolveAgentStackInventoryDir(
        { YOUMD_AGENT_STACK_INVENTORY_DIR: "/tmp/mesh" },
        "/Users/houston",
      ),
    ).toBe("/tmp/mesh");
  });
});
