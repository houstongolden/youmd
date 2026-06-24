/**
 * Cross-machine remote command bus convention (CROSS-MACHINE-AGENTS.md §3).
 *
 * Phase 1 is bus-only: commands and results travel as ordinary agent-bus
 * messages distinguished by `channel` + `kind` + `metadata`. This module owns
 * the envelope schema, the daemon-side handler, and a shared dispatch/poll
 * helper so the CLI and MCP tool do not duplicate the wire format.
 */

import * as os from "os";
import {
  sendAgentBusMessage,
  listAgentBusMessages,
  recordBrainActivity,
  dispatchRemoteCommandDurable,
  updateRemoteCommandStatus,
  getRemoteCommand,
  type AgentBusMessage,
} from "./api";
import { generateRequestId } from "./request-id";
import {
  executeRemoteAction,
  isAllowedRemoteAction,
  ACTION_SPECS,
  type RemoteExecResult,
} from "./remote-executor";

export const REMOTE_COMMAND_CHANNEL = "remote-command";
export const REMOTE_RESULT_CHANNEL = "remote-command-result";

/** Default validity window for a dispatched command (ms). */
export const DEFAULT_COMMAND_TTL_MS = 5 * 60 * 1000;

export interface RemoteCommandMetadata {
  requestId: string;
  action: string;
  args?: Record<string, unknown>;
  issuedBy?: string;
  issuedAt: number;
  expiresAt: number;
  secretValuesExposed: false;
}

export interface RemoteResultMetadata {
  requestId: string;
  ok: boolean;
  action: string;
  exitCode: number | null;
  output: string;
  gitState?: unknown;
  status: "ok" | "rejected" | "error";
  error?: string;
  completedAt: number;
  secretValuesExposed: false;
}

function asMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ─── Dispatch (issuer side) ────────────────────────────────────────────────────

export interface DispatchOptions {
  machine: string;
  action: string;
  args?: Record<string, unknown>;
  message?: string;
  ttlMs?: number;
  sourceAgent?: string;
}

export interface DispatchedCommand {
  requestId: string;
  expiresAt: number;
  targetHost: string;
}

/** Build the command metadata (pure — for tests + dispatch). */
export function buildCommandMetadata(
  opts: { action: string; args?: Record<string, unknown>; ttlMs?: number; issuedBy?: string },
  now = Date.now()
): RemoteCommandMetadata {
  const ttl = opts.ttlMs && opts.ttlMs > 0 ? opts.ttlMs : DEFAULT_COMMAND_TTL_MS;
  return {
    requestId: generateRequestId(),
    action: opts.action,
    args: opts.args,
    issuedBy: opts.issuedBy ?? os.userInfo().username,
    issuedAt: now,
    expiresAt: now + ttl,
    secretValuesExposed: false,
  };
}

/**
 * Dispatch a whitelisted command to a target machine.
 *
 * Phase 2: prefer the durable `/me/remote-commands/dispatch` endpoint, which
 * writes a queued row AND posts the Phase 1 bus message server-side in one
 * call. If that endpoint is unavailable (older deployment → 404, or any
 * error), fall back to posting the bus message directly so Phase 1 behavior is
 * preserved. Either way the requestId is the correlation key.
 */
export async function dispatchRemoteCommand(
  opts: DispatchOptions
): Promise<{ ok: true; data: DispatchedCommand & { durable: boolean } } | { ok: false; error: string }> {
  if (!isAllowedRemoteAction(opts.action)) {
    return { ok: false, error: `action not in whitelist: ${opts.action}` };
  }
  const meta = buildCommandMetadata({
    action: opts.action,
    args: opts.args,
    ttlMs: opts.ttlMs,
  });
  const body =
    opts.message?.trim() ||
    `${opts.action}${opts.args?.project ? ` ${opts.args.project}` : ""}`;

  // 1. Preferred path — durable dispatch (queued row + bus message).
  try {
    const durable = await dispatchRemoteCommandDurable({
      requestId: meta.requestId,
      action: opts.action,
      args: opts.args,
      targetHost: opts.machine,
      sourceHost: os.hostname(),
      sourceAgent: opts.sourceAgent ?? "youmd remote",
      body,
      issuedAt: meta.issuedAt,
      expiresAt: meta.expiresAt,
    });
    if (durable.ok) {
      return {
        ok: true,
        data: {
          requestId: meta.requestId,
          expiresAt: meta.expiresAt,
          targetHost: opts.machine,
          durable: true,
        },
      };
    }
    // A scope/403 is a real authorization error, not a "route missing" — surface
    // it instead of silently falling back (the bus path would 403 too).
    if (durable.status === 403) {
      const errBody = durable.data as unknown as { error?: { message?: string } } | undefined;
      return { ok: false, error: errBody?.error?.message || "missing remote:command scope" };
    }
    // 404 / other → fall through to bus-only.
  } catch {
    // network/parse error → fall through to bus-only.
  }

  // 2. Fallback path — Phase 1 bus-only dispatch.
  const res = await sendAgentBusMessage({
    channel: REMOTE_COMMAND_CHANNEL,
    kind: "command",
    body,
    sourceHost: os.hostname(),
    sourceAgent: opts.sourceAgent ?? "youmd remote",
    sourceRuntime: process.version,
    targetHost: opts.machine,
    metadata: meta,
  });

  if (!res.ok) {
    const errBody = res.data as unknown as { error?: { message?: string } } | undefined;
    const message = errBody?.error?.message || `dispatch failed (HTTP ${res.status})`;
    return { ok: false, error: message };
  }

  return {
    ok: true,
    data: {
      requestId: meta.requestId,
      expiresAt: meta.expiresAt,
      targetHost: opts.machine,
      durable: false,
    },
  };
}

// ─── Poll for result (issuer side) ──────────────────────────────────────────────

export interface PollOptions {
  requestId: string;
  intervalMs?: number;
  timeoutMs?: number;
}

/** Terminal statuses on a durable remote-command row. */
const TERMINAL_STATUSES = new Set(["done", "error", "expired", "rejected"]);

/** Map a durable remoteCommands row → the bus-style result metadata shape. */
function durableRowToResult(row: {
  requestId: string;
  action: string;
  ok: boolean | null;
  output: string | null;
  exitCode: number | null;
  gitState: unknown;
  status: string;
  completedAt: number | null;
}): RemoteResultMetadata {
  const status: RemoteResultMetadata["status"] =
    row.status === "rejected" ? "rejected" : row.ok ? "ok" : "error";
  return {
    requestId: row.requestId,
    ok: Boolean(row.ok),
    action: row.action,
    exitCode: row.exitCode,
    output: row.output ?? "",
    gitState: row.gitState,
    status,
    error: row.ok ? undefined : `command ${row.status}`,
    completedAt: row.completedAt ?? Date.now(),
    secretValuesExposed: false,
  };
}

/**
 * Bounded poll for a command result.
 *
 * Phase 2: prefer the durable status endpoint (`GET /me/remote-commands?
 * requestId=`) — a single authoritative row, no message-stream scan. If that
 * endpoint is unavailable (404/error) on a given tick, fall back to scanning
 * the Phase 1 result bus channel for the matching requestId. Returns on the
 * first terminal status from either source.
 */
export async function pollForResult(
  opts: PollOptions
): Promise<RemoteResultMetadata | null> {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeout;
  let durableAvailable = true;

  while (Date.now() < deadline) {
    // 1. Preferred — durable status row.
    if (durableAvailable) {
      try {
        const res = await getRemoteCommand(opts.requestId);
        if (res.ok && res.data?.command) {
          const row = res.data.command;
          if (TERMINAL_STATUSES.has(row.status)) {
            return durableRowToResult(row);
          }
        } else if (res.status === 404 || res.status === 0) {
          // Row not found yet — keep trying durable; the dispatch may not have
          // used the durable path. We still also check the bus below.
        } else if (res.status >= 400 && res.status !== 404) {
          // Route genuinely unavailable on this deployment → stop hitting it.
          durableAvailable = false;
        }
      } catch {
        durableAvailable = false;
      }
    }

    // 2. Fallback — Phase 1 result bus channel.
    const busRes = await listAgentBusMessages({
      channel: REMOTE_RESULT_CHANNEL,
      limit: 50,
    });
    if (busRes.ok) {
      const match = (busRes.data?.messages || []).find((m) => {
        const meta = asMetadata(m.metadata);
        return meta.requestId === opts.requestId;
      });
      if (match) {
        const meta = asMetadata(match.metadata);
        return meta as unknown as RemoteResultMetadata;
      }
    }

    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}

// ─── Daemon handler (target side) ──────────────────────────────────────────────

/** Local idempotency set so a replayed command is a no-op. Daemon-process scoped. */
export class SeenRequestSet {
  private seen = new Set<string>();
  has(id: string): boolean {
    return this.seen.has(id);
  }
  add(id: string): void {
    this.seen.add(id);
    // Bound memory: keep the most recent ~1000 ids.
    if (this.seen.size > 1000) {
      const first = this.seen.values().next().value;
      if (first !== undefined) this.seen.delete(first);
    }
  }
}

export interface HandleDecision {
  /** Whether this message should be processed by THIS host. */
  process: boolean;
  reason?: string;
}

/**
 * Pure decision: should the daemon act on this message? Filters channel,
 * targetHost, idempotency, and expiry. No side effects — testable.
 */
export function shouldHandleCommand(
  message: Pick<AgentBusMessage, "channel" | "targetHost" | "metadata">,
  seen: SeenRequestSet,
  hostname = os.hostname(),
  now = Date.now()
): HandleDecision {
  if (message.channel !== REMOTE_COMMAND_CHANNEL) {
    return { process: false, reason: "not a remote-command" };
  }
  const target = String(message.targetHost || "").toLowerCase();
  if (!target || target !== hostname.toLowerCase()) {
    return { process: false, reason: "not addressed to this host" };
  }
  const meta = asMetadata(message.metadata);
  const requestId = typeof meta.requestId === "string" ? meta.requestId : "";
  if (!requestId) {
    return { process: false, reason: "missing requestId" };
  }
  if (seen.has(requestId)) {
    return { process: false, reason: "already processed" };
  }
  const expiresAt = Number(meta.expiresAt);
  if (Number.isFinite(expiresAt) && now > expiresAt) {
    return { process: false, reason: "command expired" };
  }
  return { process: true };
}

/**
 * Best-effort durable status transition for a command row (Phase 2). NEVER
 * throws and never blocks — if the `remoteCommands` route/table isn't deployed
 * (404), or the row was a bus-only command (server returns command: null), or
 * the network fails, we log at debug level and continue. This is what keeps the
 * daemon backward-compatible with Phase 1.
 */
async function patchRemoteStatus(
  requestId: string,
  status: "acked" | "running" | "done" | "error" | "rejected" | "expired",
  log?: (line: string) => void,
  extra?: {
    ok?: boolean;
    output?: string;
    exitCode?: number | null;
    gitState?: unknown;
    completedAt?: number;
  }
): Promise<void> {
  try {
    const res = await updateRemoteCommandStatus({
      requestId,
      status,
      ok: extra?.ok,
      output: extra?.output,
      exitCode: extra?.exitCode,
      gitState: extra?.gitState,
      completedAt: extra?.completedAt,
    });
    if (!res.ok && res.status && res.status !== 404) {
      log?.(`remote-command status patch (${status}) returned HTTP ${res.status}`);
    }
  } catch (err) {
    log?.(
      `remote-command status patch (${status}) failed: ${err instanceof Error ? err.message : err}`
    );
  }
}

/**
 * Process one inbound command message end-to-end: validate, execute via the
 * whitelisted executor, post a result message, and write a brainActivity audit
 * row. Marks the requestId seen BEFORE execution so a concurrent replay is a
 * no-op. Never throws.
 */
export async function handleRemoteCommand(
  message: AgentBusMessage,
  seen: SeenRequestSet,
  log?: (line: string) => void
): Promise<void> {
  const decision = shouldHandleCommand(message, seen);
  if (!decision.process) return;

  const meta = asMetadata(message.metadata);
  const requestId = String(meta.requestId);
  const action = typeof meta.action === "string" ? meta.action : "(unknown)";
  const args =
    meta.args && typeof meta.args === "object" && !Array.isArray(meta.args)
      ? (meta.args as Record<string, unknown>)
      : undefined;
  const issuerHost = message.sourceHost || undefined;

  // Mark seen up-front for idempotency (a replay won't re-execute).
  seen.add(requestId);

  log?.(`remote-command ${action} (${requestId}) from ${issuerHost ?? "?"}`);

  // Best-effort durable status transitions (Phase 2). Each call is wrapped so a
  // missing table/route or any network error never blocks execution — the
  // daemon stays fully backward-compatible with bus-only Phase 1.
  await patchRemoteStatus(requestId, "acked", log);
  await patchRemoteStatus(requestId, "running", log);

  let result: RemoteExecResult;
  try {
    result = await executeRemoteAction({ action, args });
  } catch (err) {
    result = {
      ok: false,
      action,
      exitCode: null,
      output: "",
      error: err instanceof Error ? err.message : String(err),
      status: "error",
      secretValuesExposed: false,
    };
  }

  const resultMeta: RemoteResultMetadata = {
    requestId,
    ok: result.ok,
    action: result.action,
    exitCode: result.exitCode,
    output: result.output,
    gitState: result.gitState,
    status: result.status,
    error: result.error,
    completedAt: Date.now(),
    secretValuesExposed: false,
  };

  const summary = result.ok
    ? `${result.action} ok`
    : `${result.action} ${result.status}: ${result.error ?? "failed"}`;

  // Best-effort durable terminal status (Phase 2). "rejected" maps to the
  // rejected status; any other failure is "error"; success is "done".
  const terminalStatus =
    result.status === "rejected" ? "rejected" : result.ok ? "done" : "error";
  await patchRemoteStatus(requestId, terminalStatus, log, {
    ok: result.ok,
    output: result.output,
    exitCode: result.exitCode,
    gitState: result.gitState,
    completedAt: resultMeta.completedAt,
  });

  // Post the result back to the issuer.
  try {
    await sendAgentBusMessage({
      channel: REMOTE_RESULT_CHANNEL,
      kind: "result",
      body: summary,
      sourceHost: os.hostname(),
      sourceAgent: "youmd remote daemon",
      sourceRuntime: process.version,
      targetHost: issuerHost,
      metadata: resultMeta as unknown as Record<string, unknown>,
    });
  } catch (err) {
    log?.(`failed to post remote-command-result: ${err instanceof Error ? err.message : err}`);
  }

  // Audit row — every dispatch outcome is recorded.
  try {
    await recordBrainActivity({
      activityId: `remote-command:${requestId}`,
      source: "daemon",
      channel: REMOTE_RESULT_CHANNEL,
      kind: "result",
      status: result.ok ? "ok" : result.status === "rejected" ? "warn" : "error",
      title: `remote command ${result.action}`,
      detail: summary,
      sourceHost: os.hostname(),
      sourceAgent: "youmd remote daemon",
      sourceRuntime: process.version,
      metadata: {
        requestId,
        action: result.action,
        ok: result.ok,
        status: result.status,
        exitCode: result.exitCode,
        issuerHost: issuerHost ?? null,
        project: args?.project ?? null,
        secretValuesExposed: false,
      },
    });
  } catch (err) {
    log?.(`failed to write remote-command audit: ${err instanceof Error ? err.message : err}`);
  }

  log?.(summary);
}

/** Human-readable list of whitelisted actions for help/usage text. */
export function describeWhitelist(): string[] {
  return Object.entries(ACTION_SPECS).map(
    ([id, spec]) => `${id} — ${spec.description}${spec.mutating === "reversible" ? " (mutating, reversible)" : ""}`
  );
}
