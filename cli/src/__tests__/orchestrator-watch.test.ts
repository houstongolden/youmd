/**
 * Tests for the orchestrator watch primitive: terminal-status classification and
 * report-once completion collection. Uses a temp YOU_HOME so the real registry is untouched
 * and no worker processes are spawned.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

let tmpHome: string;

beforeAll(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "you-orch-watch-"));
  process.env.YOU_HOME = tmpHome;
});

afterAll(() => {
  delete process.env.YOU_HOME;
  try {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

async function load() {
  return await import("../lib/orchestrator/supervisor");
}

function writeRegistry(workers: unknown[]): void {
  const dir = path.join(tmpHome, "orchestrator");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "workers.json"), JSON.stringify(workers, null, 2));
}

describe("terminal status classification", () => {
  it("treats exited/stopped/failed as terminal, running/unknown as not", async () => {
    const { isTerminalWorkerStatus } = await load();
    expect(isTerminalWorkerStatus("exited")).toBe(true);
    expect(isTerminalWorkerStatus("stopped")).toBe(true);
    expect(isTerminalWorkerStatus("failed")).toBe(true);
    expect(isTerminalWorkerStatus("running")).toBe(false);
    expect(isTerminalWorkerStatus("unknown")).toBe(false);
  });
});

describe("collectUnreportedCompletions (report-once)", () => {
  it("returns terminal+unreported workers; markReported flips them so they aren't returned again; keeps live ones", async () => {
    const { collectUnreportedCompletions, markReported } = await load();

    writeRegistry([
      {
        id: "w_done",
        harness: "custom",
        cwd: tmpHome,
        goal: "finished task",
        pid: 999999, // not our process → treated dead, but status is already terminal
        status: "exited",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        logFile: path.join(tmpHome, "x.log"),
        host: "test",
      },
      {
        id: "w_live",
        harness: "custom",
        cwd: tmpHome,
        goal: "still running",
        pid: process.pid, // alive → stays running
        status: "running",
        startedAt: new Date().toISOString(),
        logFile: path.join(tmpHome, "y.log"),
        host: "test",
      },
    ]);

    const first = collectUnreportedCompletions();
    expect(first.map((w) => w.id)).toEqual(["w_done"]);
    // collect does NOT mark reported (the caller marks only after a successful post).
    expect(first[0].reported).toBeFalsy();

    // Not yet marked → still returned (so a failed post is retried, not dropped).
    expect(collectUnreportedCompletions().map((w) => w.id)).toEqual(["w_done"]);

    // After marking, it is no longer returned; the live worker is never returned.
    markReported(["w_done"]);
    expect(collectUnreportedCompletions()).toEqual([]);
  });
});
