/**
 * Device-flow polling loop tests (U7).
 *
 * pollDeviceApproval takes injectable poll/sleep/now, so the loop logic
 * (pacing, slow_down backoff, terminal outcomes, network retry budget,
 * deadline) is pinned without a server or real timers.
 */
import { describe, expect, it, vi } from "vitest";
import { pollDeviceApproval } from "../commands/login";
import type { ApiResponse, DevicePollData } from "../lib/api";

const DEVICE_CODE = "a".repeat(64);

function response(
  ok: boolean,
  status: number,
  data: unknown
): ApiResponse<DevicePollData> {
  return { ok, status, data: data as DevicePollData };
}

const approvedBody = {
  status: "approved",
  apiKey: "ym_" + "x".repeat(40),
  username: "houston",
  user: { id: "clerk_1", username: "houston", email: "h@example.com" },
};

/** Fake clock: starts at 0; sleep advances it. */
function fakeClock() {
  let nowMs = 0;
  const sleeps: number[] = [];
  return {
    now: () => nowMs,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      nowMs += ms;
    },
    sleeps,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe("pollDeviceApproval", () => {
  it("polls until approved and returns the key payload", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValueOnce(response(true, 200, { status: "pending", interval: 5 }))
      .mockResolvedValueOnce(response(true, 200, { status: "pending", interval: 5 }))
      .mockResolvedValueOnce(response(true, 200, approvedBody));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.outcome).toBe("approved");
    if (result.outcome === "approved") {
      expect(result.data.apiKey).toBe(approvedBody.apiKey);
      expect(result.data.username).toBe("houston");
    }
    expect(poll).toHaveBeenCalledTimes(3);
    expect(poll).toHaveBeenCalledWith(DEVICE_CODE);
    // Two pending responses → two interval sleeps, no backoff.
    expect(clock.sleeps).toEqual([5000, 5000]);
  });

  it("backs off +5s on slow_down (and on 429), per RFC 8628", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValueOnce(response(true, 200, { status: "slow_down", interval: 5 }))
      .mockResolvedValueOnce(response(false, 429, { status: "slow_down" }))
      .mockResolvedValueOnce(response(true, 200, approvedBody));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.outcome).toBe("approved");
    // 5s base → slow_down bumps to 10s → 429 bumps to 15s.
    expect(clock.sleeps).toEqual([10_000, 15_000]);
  });

  it("returns denied immediately on a denied response", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValue(response(false, 403, { status: "denied", message: "denied" }));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result).toEqual({ outcome: "denied" });
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("returns expired on a server expired response", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValue(response(false, 410, { status: "expired" }));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result).toEqual({ outcome: "expired" });
  });

  it("returns expired when the deadline passes while still pending", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockResolvedValue(response(true, 200, { status: "pending", interval: 5 }));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 12_000, // room for ~2 polls
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result).toEqual({ outcome: "expired" });
    expect(poll.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("retries transient network errors, then gives up honestly after 3 in a row", async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockRejectedValue(new Error("can't reach you.md"));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result).toEqual({ outcome: "error", message: "can't reach you.md" });
    expect(poll).toHaveBeenCalledTimes(3);
  });

  it("a successful poll resets the network failure budget", async () => {
    const clock = fakeClock();
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(response(true, 200, { status: "pending", interval: 5 }))
      .mockRejectedValueOnce(new Error("blip"))
      .mockRejectedValueOnce(new Error("blip"))
      .mockResolvedValueOnce(response(true, 200, approvedBody));

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.outcome).toBe("approved");
    expect(poll).toHaveBeenCalledTimes(6);
  });

  it("surfaces unexpected server errors with the envelope message", async () => {
    const clock = fakeClock();
    const poll = vi.fn().mockResolvedValue(
      response(false, 500, {
        error: { code: "server_error", message: "something broke" },
        message: "something broke",
      })
    );

    const result = await pollDeviceApproval({
      deviceCode: DEVICE_CODE,
      intervalMs: 5000,
      deadlineMs: 600_000,
      poll,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result).toEqual({ outcome: "error", message: "something broke" });
  });
});
