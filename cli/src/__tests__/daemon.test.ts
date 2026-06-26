import { describe, expect, it } from "vitest";
import { YOUMD_DAEMONS } from "../lib/daemon";

describe("daemon definitions", () => {
  it("runs canonical you commands while preserving legacy labels for cleanup", () => {
    expect(YOUMD_DAEMONS.map((daemon) => daemon.command)).toEqual([
      "you sync --live --daemon",
      "you stack sync",
      "you sync --daemon",
      "you stack context-sync",
      "you orchestrate watch --once",
    ]);
    expect(YOUMD_DAEMONS.map((daemon) => daemon.label)).toEqual([
      "com.you.realtime-sync",
      "com.you.skillstack-sync",
      "com.you.identity-sync",
      "com.you.context-sync",
      "com.you.orchestrator-watch",
    ]);
    expect(YOUMD_DAEMONS.map((daemon) => daemon.legacyLabel)).toEqual([
      "com.youmd.realtime-sync",
      "com.youmd.skillstack-sync",
      "com.youmd.identity-sync",
      "com.youmd.context-sync",
      undefined,
    ]);
  });

  it("every daemon maps to a systemd --user unit for the Linux backend", () => {
    expect(YOUMD_DAEMONS.map((daemon) => daemon.linuxUnit)).toEqual([
      "you-realtime-sync.service",
      "you-skillstack-sync.timer",
      "you-identity-sync.timer",
      "you-context-sync.timer",
      "you-orchestrator-watch.timer",
    ]);
  });
});
