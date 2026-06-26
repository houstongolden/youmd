import * as child_process from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { getWritableHomeBundleDir } from "./config";
import { readRealtimeSyncStatusFile } from "./realtime-sync";

export interface YoumdDaemon {
  label: string;
  legacyLabel?: string;
  name: string;
  command: string;
  intervalSeconds: number;
  stdoutLog: string;
  stderrLog: string;
  combinedLog?: string;
  /**
   * systemd --user unit whose `is-active` state mirrors this daemon on Linux.
   * Live daemons map to a `.service`; interval daemons map to their `.timer`.
   */
  linuxUnit: string;
}

export interface YoumdDaemonHealth extends YoumdDaemon {
  loaded: boolean;
  legacyLoaded?: boolean;
  lastLogLine?: string;
  lastErrorLine?: string;
  lastActivityAt?: string;
  warning?: string;
  statusSummary?: string;
  secretVaultState?: string;
  secretVaultSummary?: string;
}

function runtimeLogPath(file: string): string {
  return path.join(getWritableHomeBundleDir(), "logs", file);
}

export const YOUMD_DAEMONS: YoumdDaemon[] = [
  {
    label: "com.you.realtime-sync",
    legacyLabel: "com.youmd.realtime-sync",
    name: "realtime brain",
    command: "you sync --live --daemon",
    intervalSeconds: 0,
    stdoutLog: runtimeLogPath("realtime-sync.out.log"),
    stderrLog: runtimeLogPath("realtime-sync.err.log"),
    linuxUnit: "you-realtime-sync.service",
  },
  {
    label: "com.you.skillstack-sync",
    legacyLabel: "com.youmd.skillstack-sync",
    name: "skills/stacks",
    command: "you stack sync",
    intervalSeconds: 300,
    stdoutLog: runtimeLogPath("skillstack-sync.out.log"),
    stderrLog: runtimeLogPath("skillstack-sync.err.log"),
    combinedLog: runtimeLogPath("skillstack-sync.log"),
    linuxUnit: "you-skillstack-sync.timer",
  },
  {
    label: "com.you.identity-sync",
    legacyLabel: "com.youmd.identity-sync",
    name: "identity/API",
    command: "you sync --daemon",
    intervalSeconds: 300,
    stdoutLog: runtimeLogPath("identity-sync.out.log"),
    stderrLog: runtimeLogPath("identity-sync.err.log"),
    linuxUnit: "you-identity-sync.timer",
  },
  {
    label: "com.you.context-sync",
    legacyLabel: "com.youmd.context-sync",
    name: "project context",
    command: "you stack context-sync",
    intervalSeconds: 900,
    stdoutLog: runtimeLogPath("context-sync.out.log"),
    stderrLog: runtimeLogPath("context-sync.err.log"),
    combinedLog: runtimeLogPath("context-sync.log"),
    linuxUnit: "you-context-sync.timer",
  },
];

/** Daemon supervisor backends we know how to install/inspect. */
export type DaemonBackend = "launchd" | "systemd" | "unsupported";

/**
 * Which resident-daemon supervisor this host uses.
 * - macOS → launchd (LaunchAgents), the original path.
 * - Linux with a reachable `systemctl --user` → systemd user units (VPS path).
 * - anything else → unsupported (sync still works on an interval via cron/manual).
 */
export function detectDaemonBackend(): DaemonBackend {
  if (process.platform === "darwin") return "launchd";
  if (process.platform === "linux" && hasUserSystemd()) return "systemd";
  return "unsupported";
}

let cachedUserSystemd: boolean | undefined;
export function hasUserSystemd(): boolean {
  if (cachedUserSystemd !== undefined) return cachedUserSystemd;
  if (process.platform !== "linux") {
    cachedUserSystemd = false;
    return cachedUserSystemd;
  }
  const result = child_process.spawnSync("systemctl", ["--user", "--version"], {
    encoding: "utf-8",
  });
  cachedUserSystemd = !result.error && result.status === 0;
  return cachedUserSystemd;
}

export function expandHome(input: string): string {
  if (input === "~") return os.homedir();
  if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function tailUsefulLine(filePath: string, maxBytes = 8192): string | undefined {
  const resolved = expandHome(filePath);
  if (!fs.existsSync(resolved)) return undefined;
  try {
    const stat = fs.statSync(resolved);
    const start = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(resolved, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      return buf
        .toString("utf-8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .reverse()
        .find((line) => !line.includes("watching for changes"));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

export function newestMtimeIso(paths: string[]): string | undefined {
  let newest = 0;
  for (const p of paths.map(expandHome)) {
    if (!fs.existsSync(p)) continue;
    try {
      newest = Math.max(newest, fs.statSync(p).mtimeMs);
    } catch {
      // ignore unreadable log files
    }
  }
  return newest > 0 ? new Date(newest).toISOString() : undefined;
}

function mtimeMs(filePath: string): number {
  const resolved = expandHome(filePath);
  if (!fs.existsSync(resolved)) return 0;
  try {
    return fs.statSync(resolved).mtimeMs;
  } catch {
    return 0;
  }
}

export function isLaunchAgentLoaded(label: string): boolean {
  if (process.platform !== "darwin") return false;
  const result = child_process.spawnSync("launchctl", ["list", label], {
    encoding: "utf-8",
  });
  return result.status === 0 && !!result.stdout.trim();
}

/** True if the given systemd --user unit is active (running service or armed timer). */
export function isSystemdUnitActive(unit: string): boolean {
  if (!hasUserSystemd()) return false;
  const result = child_process.spawnSync("systemctl", ["--user", "is-active", unit], {
    encoding: "utf-8",
  });
  // `is-active` prints "active" / "activating" and exits 0 when up; non-zero otherwise.
  const state = (result.stdout || "").trim();
  return result.status === 0 && (state === "active" || state === "activating");
}

/** Platform-aware "is this daemon loaded?" for a YoumdDaemon, across launchd + systemd. */
export function isDaemonLoaded(daemon: YoumdDaemon): boolean {
  switch (detectDaemonBackend()) {
    case "launchd":
      return isLaunchAgentLoaded(daemon.label);
    case "systemd":
      return isSystemdUnitActive(daemon.linuxUnit);
    default:
      return false;
  }
}

export function getDaemonHealth(): YoumdDaemonHealth[] {
  return YOUMD_DAEMONS.map((daemon) => {
    const logs = [
      daemon.stdoutLog,
      daemon.stderrLog,
      ...(daemon.combinedLog ? [daemon.combinedLog] : []),
    ];
    const lastErrorLine = tailUsefulLine(daemon.stderrLog);
    const stderrMtime = mtimeMs(daemon.stderrLog);
    const healthyMtime = Math.max(mtimeMs(daemon.stdoutLog), daemon.combinedLog ? mtimeMs(daemon.combinedLog) : 0);
    const warning =
      lastErrorLine &&
      stderrMtime >= healthyMtime &&
      /(error|warn|conflict|refus|failed|smaller|blocked|unknown option)/i.test(lastErrorLine)
        ? lastErrorLine
        : undefined;
    return {
      ...daemon,
      loaded: isDaemonLoaded(daemon),
      legacyLoaded: daemon.legacyLabel ? isLaunchAgentLoaded(daemon.legacyLabel) : false,
      lastLogLine: tailUsefulLine(daemon.combinedLog ?? daemon.stdoutLog) ?? tailUsefulLine(daemon.stdoutLog),
      lastErrorLine,
      lastActivityAt: newestMtimeIso(logs),
      warning,
      ...(daemon.label === "com.you.realtime-sync"
        ? (() => {
            const status = readRealtimeSyncStatusFile();
            return status
              ? {
                  statusSummary: status.summary,
                  secretVaultState: status.secretVault.state,
                  secretVaultSummary: status.secretVault.summary,
                }
              : {};
          })()
        : {}),
    };
  });
}
