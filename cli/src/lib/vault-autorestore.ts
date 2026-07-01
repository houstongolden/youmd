// vault-autorestore.ts — the receiving-side half of the zero-homework Secret Vault handshake.
//
// The source device already auto-SHARES the vault to any newly-registered trusted device
// (see `sync.ts` — the `vaultShareEnabled` block mints an envelope for each new device). And a
// fresh host already registers itself as a trusted device at enroll (`you env vault
// device-register`, wired into `you machine full-sync`). The one missing link was the
// RECEIVING side: once an envelope exists for this device, nothing applied it — the daemon just
// printed a manual `you env vault pull --restore ...` command (user homework, which PRINCIPLES.md
// forbids).
//
// This module is the pure decision for "should the daemon auto-restore now?". It is deliberately
// side-effect-free so it can be unit-tested without a Keychain, a live vault, or a network. The
// daemon calls `you env vault pull --restore --map-existing --existing-only --skip-agent-auth`
// when this returns `{ restore: true }`. `--existing-only` is the safety belt: auto-restore can
// only write `.env.local` into projects that ALREADY exist on this host, so it converges local
// secrets to the latest vault snapshot and can never scatter files into the wrong place.
//
// Applying an envelope that an authorized trusted device already minted for THIS device is not a
// privilege escalation — it is exactly the "no user homework" the vault was built to enable.

export interface AutoRestoreVaultInput {
  /** Vault state from `describeRealtimeSecretVault(head).state`. */
  state: string;
  /** Envelopes on the latest snapshot — >0 means a trusted device has shared to us. */
  latestSnapshotEnvelopeCount: number;
  /** sha256 of the latest snapshot (from `latestSnapshot.sha256`). */
  snapshotSha: string | null | undefined;
  /** sha256 of the snapshot we last restored this process, so we don't re-write every cycle. */
  lastRestoredSha: string | null;
  /** Master opt-out (daemon-only; defaults on to stay homework-free). */
  enabled: boolean;
}

export interface AutoRestoreVaultDecision {
  restore: boolean;
  reason: string;
}

/**
 * Decide whether the resident daemon should auto-restore the Secret Vault to local `.env.local`
 * files right now. Pure — no I/O. See module header for the safety argument.
 */
export function shouldAutoRestoreVault(input: AutoRestoreVaultInput): AutoRestoreVaultDecision {
  if (!input.enabled) {
    return { restore: false, reason: "auto-restore disabled (YOUMD_LIVE_SYNC_VAULT_RESTORE=0)" };
  }
  if (input.state !== "ready") {
    return { restore: false, reason: `vault not ready (state: ${input.state})` };
  }
  if (!(input.latestSnapshotEnvelopeCount > 0)) {
    return {
      restore: false,
      reason: "no device envelope yet — waiting for a trusted device to share to this host",
    };
  }
  const sha = input.snapshotSha ?? null;
  if (sha && input.lastRestoredSha && sha === input.lastRestoredSha) {
    return { restore: false, reason: "already restored the current snapshot this session" };
  }
  return {
    restore: true,
    reason: sha
      ? `envelope available — restoring snapshot ${sha.slice(0, 12)}`
      : "envelope available — restoring latest snapshot",
  };
}

/**
 * Build the argv for the daemon's auto-restore invocation. `--root` is resolved from an explicit
 * override (`YOU_VAULT_RESTORE_ROOT`/`YOUMD_VAULT_RESTORE_ROOT`) or a configured sync root; when
 * none is known the arg is omitted and `--existing-only` keeps the restore a safe no-op instead of
 * writing into an unknown location. Exported for testing.
 */
export function buildAutoRestoreArgs(rootOverride?: string | null): string[] {
  const args = ["env", "vault", "pull", "--restore", "--map-existing", "--existing-only", "--skip-agent-auth"];
  const root = (rootOverride ?? "").trim();
  if (root) {
    args.push("--root", root);
  }
  return args;
}

/** Resolve a restore root from the environment, if the operator pinned one. */
export function resolveAutoRestoreRoot(env: NodeJS.ProcessEnv = process.env): string | null {
  return (
    env.YOU_VAULT_RESTORE_ROOT ||
    env.YOUMD_VAULT_RESTORE_ROOT ||
    env.YOU_SYNC_ROOT ||
    env.YOUMD_SYNC_ROOT ||
    null
  );
}
