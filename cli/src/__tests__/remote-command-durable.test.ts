/**
 * Phase 2 durable-tracking behavior for cross-machine remote commands
 * (CROSS-MACHINE-AGENTS.md §4). These tests pin the backward-compatible
 * preference order:
 *   - dispatch prefers the durable endpoint, falls back to bus-only on 404
 *   - dispatch surfaces a 403 (missing remote:command scope) instead of
 *     silently falling back
 *   - the daemon handler best-effort PATCHes status acked→running→done and
 *     keeps working when the status route is absent
 *   - the issuer poll prefers the durable status row, falls back to the bus
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── api mock ────────────────────────────────────────────────────────────────
const sendAgentBusMessage = vi.fn();
const listAgentBusMessages = vi.fn();
const recordBrainActivity = vi.fn(async () => ({ ok: true, status: 200, data: {} }));
const dispatchRemoteCommandDurable = vi.fn();
const updateRemoteCommandStatus = vi.fn();
const getRemoteCommand = vi.fn();
const listRemoteCommands = vi.fn();

vi.mock("../lib/api", () => ({
  sendAgentBusMessage: (...a: unknown[]) => sendAgentBusMessage(...a),
  listAgentBusMessages: (...a: unknown[]) => listAgentBusMessages(...a),
  recordBrainActivity: (...a: unknown[]) => recordBrainActivity(...a),
  dispatchRemoteCommandDurable: (...a: unknown[]) => dispatchRemoteCommandDurable(...a),
  updateRemoteCommandStatus: (...a: unknown[]) => updateRemoteCommandStatus(...a),
  getRemoteCommand: (...a: unknown[]) => getRemoteCommand(...a),
  listRemoteCommands: (...a: unknown[]) => listRemoteCommands(...a),
}));

// ─── executor mock (so handleRemoteCommand doesn't run real git) ─────────────
const executeRemoteAction = vi.fn();
vi.mock("../lib/remote-executor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/remote-executor")>();
  return {
    ...actual,
    executeRemoteAction: (...a: unknown[]) => executeRemoteAction(...a),
  };
});

import * as os from "os";
import {
  dispatchRemoteCommand,
  pollForResult,
  handleRemoteCommand,
  handleQueuedDurableRemoteCommands,
  SeenRequestSet,
  REMOTE_COMMAND_CHANNEL,
  targetMatchesHost,
} from "../lib/remote-command";
import type { AgentBusMessage } from "../lib/api";

const OK = { ok: true, status: 201, data: { success: true } } as const;

beforeEach(() => {
  vi.clearAllMocks();
  sendAgentBusMessage.mockResolvedValue({ ok: true, status: 201, data: { success: true, message: {} } });
  listAgentBusMessages.mockResolvedValue({ ok: true, status: 200, data: { messages: [] } });
  updateRemoteCommandStatus.mockResolvedValue({ ok: true, status: 200, data: { command: {} } });
  listRemoteCommands.mockResolvedValue({ ok: true, status: 200, data: { success: true, commands: [], count: 0 } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dispatchRemoteCommand — durable preference + fallback", () => {
  it("prefers the durable endpoint and does NOT post the bus message directly", async () => {
    dispatchRemoteCommandDurable.mockResolvedValue({
      ...OK,
      data: { success: true, command: {}, message: {} },
    });

    const res = await dispatchRemoteCommand({ machine: "mini", action: "git.status", args: { project: "youmd" } });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.durable).toBe(true);
    expect(dispatchRemoteCommandDurable).toHaveBeenCalledTimes(1);
    // durable path posts the bus message server-side — CLI must not double-post
    expect(sendAgentBusMessage).not.toHaveBeenCalled();
  });

  it("falls back to bus-only when the durable route 404s", async () => {
    dispatchRemoteCommandDurable.mockResolvedValue({ ok: false, status: 404, data: {} });

    const res = await dispatchRemoteCommand({ machine: "mini", action: "git.status" });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.durable).toBe(false);
    expect(sendAgentBusMessage).toHaveBeenCalledTimes(1);
  });

  it("falls back to bus-only when the durable call throws (offline)", async () => {
    dispatchRemoteCommandDurable.mockRejectedValue(new Error("offline"));

    const res = await dispatchRemoteCommand({ machine: "mini", action: "git.status" });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.durable).toBe(false);
    expect(sendAgentBusMessage).toHaveBeenCalledTimes(1);
  });

  it("surfaces a 403 scope error without falling back to the bus", async () => {
    dispatchRemoteCommandDurable.mockResolvedValue({
      ok: false,
      status: 403,
      data: { error: { message: "missing remote:command scope" } },
    });

    const res = await dispatchRemoteCommand({ machine: "mini", action: "git.status" });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scope/);
    expect(sendAgentBusMessage).not.toHaveBeenCalled();
  });

  it("rejects non-whitelisted actions before any network call", async () => {
    const res = await dispatchRemoteCommand({ machine: "mini", action: "rm.rf" });
    expect(res.ok).toBe(false);
    expect(dispatchRemoteCommandDurable).not.toHaveBeenCalled();
    expect(sendAgentBusMessage).not.toHaveBeenCalled();
  });
});

describe("pollForResult — durable status preferred, bus fallback", () => {
  it("returns the durable row when it reaches a terminal status", async () => {
    getRemoteCommand.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        success: true,
        command: {
          requestId: "rc_1",
          action: "git.status",
          ok: true,
          output: "clean",
          exitCode: 0,
          gitState: { branch: "main" },
          status: "done",
          completedAt: 123,
        },
      },
    });

    const result = await pollForResult({ requestId: "rc_1", intervalMs: 1, timeoutMs: 50 });

    expect(result).not.toBeNull();
    expect(result?.ok).toBe(true);
    expect(result?.action).toBe("git.status");
    // durable hit means we never need the bus
    expect(getRemoteCommand).toHaveBeenCalled();
  });

  it("falls back to the bus result when the durable route is unavailable", async () => {
    getRemoteCommand.mockResolvedValue({ ok: false, status: 500, data: {} });
    listAgentBusMessages.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        messages: [
          { metadata: { requestId: "rc_2", ok: true, action: "git.status", status: "ok" } },
        ],
      },
    });

    const result = await pollForResult({ requestId: "rc_2", intervalMs: 1, timeoutMs: 50 });

    expect(result?.requestId).toBe("rc_2");
    expect(listAgentBusMessages).toHaveBeenCalled();
  });
});

describe("handleRemoteCommand — best-effort durable status transitions", () => {
  it("PATCHes acked→running→done and keeps idempotency", async () => {
    executeRemoteAction.mockResolvedValue({
      ok: true,
      action: "git.status",
      exitCode: 0,
      output: "clean",
      gitState: { branch: "main" },
      status: "ok",
      secretValuesExposed: false,
    });

    const seen = new SeenRequestSet();
    const message = {
      channel: REMOTE_COMMAND_CHANNEL,
      kind: "command",
      body: "git status",
      sourceHost: "macbook",
      sourceAgent: "cli",
      targetHost: os.hostname(),
      metadata: {
        requestId: "rc_handle_1",
        action: "git.status",
        args: { project: "youmd" },
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        secretValuesExposed: false,
      },
    } as unknown as AgentBusMessage;

    await handleRemoteCommand(message, seen);

    const statuses = updateRemoteCommandStatus.mock.calls.map((c) => (c[0] as { status: string }).status);
    expect(statuses).toEqual(["acked", "running", "done"]);
    expect(sendAgentBusMessage).toHaveBeenCalled(); // result still posted (bus)
    expect(seen.has("rc_handle_1")).toBe(true);

    // Replay is a no-op — no second execution.
    updateRemoteCommandStatus.mockClear();
    executeRemoteAction.mockClear();
    await handleRemoteCommand(message, seen);
    expect(executeRemoteAction).not.toHaveBeenCalled();
  });

  it("still completes when the durable status route is missing (404)", async () => {
    updateRemoteCommandStatus.mockResolvedValue({ ok: false, status: 404, data: { command: null } });
    executeRemoteAction.mockResolvedValue({
      ok: false,
      action: "git.pull",
      exitCode: 1,
      output: "conflict",
      status: "error",
      error: "git pull failed",
      secretValuesExposed: false,
    });

    const seen = new SeenRequestSet();
    const message = {
      channel: REMOTE_COMMAND_CHANNEL,
      kind: "command",
      body: "git pull",
      sourceHost: "macbook",
      sourceAgent: "cli",
      targetHost: os.hostname(),
      metadata: {
        requestId: "rc_handle_2",
        action: "git.pull",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        secretValuesExposed: false,
      },
    } as unknown as AgentBusMessage;

    // Must not throw despite the 404 status route.
    await expect(handleRemoteCommand(message, seen)).resolves.toBeUndefined();
    const statuses = updateRemoteCommandStatus.mock.calls.map((c) => (c[0] as { status: string }).status);
    expect(statuses).toContain("error");
    expect(sendAgentBusMessage).toHaveBeenCalled();
  });
});

describe("durable queued command pull", () => {
  it("processes queued durable commands even when the realtime bus head is empty", async () => {
    executeRemoteAction.mockResolvedValue({
      ok: true,
      action: "agent.status",
      exitCode: 0,
      output: "ready",
      status: "ok",
      secretValuesExposed: false,
    });
    listRemoteCommands.mockImplementation(async ({ targetHost }: { targetHost: string }) => ({
      ok: true,
      status: 200,
      data: {
        success: true,
        count: targetHost === "houstons-mini.lan" ? 1 : 0,
        commands: targetHost === "houstons-mini.lan"
          ? [
              {
                id: "row_1",
                requestId: "rc_queued_1",
                targetHost: "Houstons-Mini.lan",
                sourceHost: "MacBookPro.lan",
                sourceAgent: "youmd remote cli",
                action: "agent.status",
                args: {},
                status: "queued",
                ok: null,
                output: null,
                exitCode: null,
                gitState: null,
                issuedAt: Date.now(),
                expiresAt: Date.now() + 60_000,
                completedAt: null,
                secretValuesExposed: false,
              },
            ]
          : [],
      },
    }));

    const seen = new SeenRequestSet();
    const processed = await handleQueuedDurableRemoteCommands(seen, undefined, "Houstons-Mini.lan");

    expect(processed).toBe(1);
    expect(seen.has("rc_queued_1")).toBe(true);
    expect(executeRemoteAction).toHaveBeenCalledWith({ action: "agent.status", args: {} });
    const statuses = updateRemoteCommandStatus.mock.calls.map((c) => (c[0] as { status: string }).status);
    expect(statuses).toEqual(["acked", "running", "done"]);
  });

  it("matches short host aliases without widening beyond the same hostname", () => {
    expect(targetMatchesHost("Houstons-Mini", "Houstons-Mini.lan")).toBe(true);
    expect(targetMatchesHost("Houstons-Mini.lan", "Houstons-Mini")).toBe(true);
    expect(targetMatchesHost("Other-Mini", "Houstons-Mini.lan")).toBe(false);
  });
});
