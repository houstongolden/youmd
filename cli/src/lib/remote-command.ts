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

/** Dispatch a whitelisted command to a target machine over the agent bus. */
export async function dispatchRemoteCommand(
  opts: DispatchOptions
): Promise<{ ok: true; data: DispatchedCommand } | { ok: false; error: string }> {
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
    data: { requestId: meta.requestId, expiresAt: meta.expiresAt, targetHost: opts.machine },
  };
}

// ─── Poll for result (issuer side) ──────────────────────────────────────────────

export interface PollOptions {
  requestId: string;
  intervalMs?: number;
  timeoutMs?: number;
}

/** Bounded poll of the result channel for a matching requestId. */
export async function pollForResult(
  opts: PollOptions
): Promise<RemoteResultMetadata | null> {
  const interval = opts.intervalMs ?? 2000;
  const timeout = opts.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const res = await listAgentBusMessages({
      channel: REMOTE_RESULT_CHANNEL,
      limit: 50,
    });
    if (res.ok) {
      const match = (res.data?.messages || []).find((m) => {
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
