import { describe, expect, it } from "vitest";
import {
  buildAutoRestoreArgs,
  resolveAutoRestoreRoot,
  shouldAutoRestoreVault,
} from "../lib/vault-autorestore";

describe("shouldAutoRestoreVault", () => {
  const base = {
    state: "ready",
    latestSnapshotEnvelopeCount: 1,
    snapshotSha: "abc123def456ghi",
    lastRestoredSha: null,
    enabled: true,
  };

  it("restores when ready, an envelope exists, and nothing restored yet", () => {
    const d = shouldAutoRestoreVault(base);
    expect(d.restore).toBe(true);
    expect(d.reason).toContain("restoring snapshot abc123def456");
  });

  it("does not restore when disabled (opt-out)", () => {
    const d = shouldAutoRestoreVault({ ...base, enabled: false });
    expect(d.restore).toBe(false);
    expect(d.reason).toContain("disabled");
  });

  it("does not restore when the vault is not ready", () => {
    for (const state of ["missing", "scope-missing", "unknown"]) {
      const d = shouldAutoRestoreVault({ ...base, state });
      expect(d.restore).toBe(false);
      expect(d.reason).toContain(state);
    }
  });

  it("waits when no device envelope has been shared to this host yet", () => {
    const d = shouldAutoRestoreVault({ ...base, latestSnapshotEnvelopeCount: 0 });
    expect(d.restore).toBe(false);
    expect(d.reason).toContain("no device envelope");
  });

  it("does not re-restore the same snapshot twice in a session", () => {
    const d = shouldAutoRestoreVault({ ...base, lastRestoredSha: base.snapshotSha });
    expect(d.restore).toBe(false);
    expect(d.reason).toContain("already restored");
  });

  it("restores again when the snapshot sha changes (new vault push)", () => {
    const d = shouldAutoRestoreVault({ ...base, lastRestoredSha: "oldsha000000", snapshotSha: "newsha111111" });
    expect(d.restore).toBe(true);
  });

  it("still restores when sha is unknown (can't dedupe, so it converges)", () => {
    const d = shouldAutoRestoreVault({ ...base, snapshotSha: null, lastRestoredSha: "whatever" });
    expect(d.restore).toBe(true);
    expect(d.reason).toContain("latest snapshot");
  });
});

describe("buildAutoRestoreArgs", () => {
  it("always uses the safe conservative flags", () => {
    const args = buildAutoRestoreArgs(null);
    expect(args).toEqual(["env", "vault", "pull", "--restore", "--map-existing", "--existing-only", "--skip-agent-auth"]);
  });

  it("appends --root only when an override is provided", () => {
    expect(buildAutoRestoreArgs("/srv/code")).toContain("--root");
    expect(buildAutoRestoreArgs("/srv/code")).toContain("/srv/code");
    expect(buildAutoRestoreArgs("  ")).not.toContain("--root");
    expect(buildAutoRestoreArgs(undefined)).not.toContain("--root");
  });
});

describe("resolveAutoRestoreRoot", () => {
  it("prefers the explicit vault-restore override, then sync-root fallbacks", () => {
    expect(resolveAutoRestoreRoot({ YOU_VAULT_RESTORE_ROOT: "/a", YOU_SYNC_ROOT: "/b" } as NodeJS.ProcessEnv)).toBe("/a");
    expect(resolveAutoRestoreRoot({ YOUMD_SYNC_ROOT: "/c" } as NodeJS.ProcessEnv)).toBe("/c");
    expect(resolveAutoRestoreRoot({} as NodeJS.ProcessEnv)).toBeNull();
  });
});
