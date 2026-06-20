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
    command: "youmd sync --live --daemon",
    intervalSeconds: 0,
    stdoutLog: runtimeLogPath("realtime-sync.out.log"),
    stderrLog: runtimeLogPath("realtime-sync.err.log"),
  },
  {
    label: "com.you.skillstack-sync",
    legacyLabel: "com.youmd.skillstack-sync",
    name: "skills/stacks",
    command: "youmd stack sync",
    intervalSeconds: 300,
    stdoutLog: runtimeLogPath("skillstack-sync.out.log"),
    stderrLog: runtimeLogPath("skillstack-sync.err.log"),
    combinedLog: runtimeLogPath("skillstack-sync.log"),
  },
  {
    label: "com.you.identity-sync",
    legacyLabel: "com.youmd.identity-sync",
    name: "identity/API",
    command: "youmd sync --daemon",
    intervalSeconds: 300,
    stdoutLog: runtimeLogPath("identity-sync.out.log"),
    stderrLog: runtimeLogPath("identity-sync.err.log"),
  },
  {
    label: "com.you.context-sync",
    legacyLabel: "com.youmd.context-sync",
    name: "project context",
    command: "youmd stack context-sync",
    intervalSeconds: 900,
    stdoutLog: runtimeLogPath("context-sync.out.log"),
    stderrLog: runtimeLogPath("context-sync.err.log"),
    combinedLog: runtimeLogPath("context-sync.log"),
  },
];

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
      loaded: isLaunchAgentLoaded(daemon.label),
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
