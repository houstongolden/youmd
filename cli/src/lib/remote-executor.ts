/**
 * Cross-machine remote command executor (CROSS-MACHINE-AGENTS.md §5 + §7).
 *
 * This is the HARD security boundary for Phase 1. A remote agent can only ever
 * trigger the fixed, typed action table below — never arbitrary shell, never an
 * interpolated command string, never a path outside a known You.md project root.
 *
 * Security guarantees implemented here:
 *   1. WHITELIST ONLY — `action` must be a key of ACTION_SPECS. Anything else is
 *      rejected before any process is spawned.
 *   2. NO SHELL, NO EVAL — every action runs `git`/process via execFile with an
 *      explicit argv ARRAY and `shell: false`. Arguments are never concatenated
 *      into a command string, so shell metacharacters in args are inert.
 *   3. PATH CONTAINMENT — the project directory is resolved ONLY against the
 *      caller's known You.md workspace/project roots (lib/project.ts). Any
 *      resolved path that escapes those roots (`..`, symlinks, absolute paths)
 *      is rejected.
 *   4. BOUNDED TIMEOUT — every spawn has a per-action timeout; runaway commands
 *      are killed.
 *   5. OUTPUT REDACTION + TRUNCATION — stdout/stderr are scrubbed of
 *      secret-looking tokens and truncated before they leave the machine.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import {
  findProjectsRoot,
  getProjectDir,
  getWorkspaceRootCandidates,
  getProjectMarkerSignals,
} from "./project";

// ─── Whitelist ──────────────────────────────────────────────────────────────

/** A remote action's mutating classification, for audit + result reporting. */
export type RemoteActionMutating = "no" | "reversible";

/** The exact set of actions a remote machine may trigger. The keys ARE the
 *  security boundary — extending it requires a code change + review. */
export const ALLOWED_REMOTE_ACTIONS = [
  "git.status",
  "git.last_activity",
  "git.commit_push",
  "git.pull",
  "agent.status",
] as const;

export type RemoteAction = (typeof ALLOWED_REMOTE_ACTIONS)[number];

export interface RemoteActionSpec {
  /** Whether the action requires a resolved project directory. */
  needsProject: boolean;
  mutating: RemoteActionMutating;
  /** Per-action wall-clock cap (ms). */
  timeoutMs: number;
  description: string;
}

export const ACTION_SPECS: Record<RemoteAction, RemoteActionSpec> = {
  "git.status": {
    needsProject: true,
    mutating: "no",
    timeoutMs: 20_000,
    description: "git status --porcelain + branch/ahead/behind/last-commit",
  },
  "git.last_activity": {
    needsProject: true,
    mutating: "no",
    timeoutMs: 20_000,
    description: "last commit metadata for the project",
  },
  "git.commit_push": {
    needsProject: true,
    mutating: "reversible",
    timeoutMs: 120_000,
    description: "git add -A && commit -m <msg> && push on the current branch",
  },
  "git.pull": {
    needsProject: true,
    mutating: "reversible",
    timeoutMs: 120_000,
    description: "git pull --ff-only",
  },
  "agent.status": {
    needsProject: false,
    mutating: "no",
    timeoutMs: 15_000,
    description: "report host/runtime + last agent-bus heartbeat hint",
  },
};

export function isAllowedRemoteAction(action: unknown): action is RemoteAction {
  return (
    typeof action === "string" &&
    (ALLOWED_REMOTE_ACTIONS as readonly string[]).includes(action)
  );
}

// ─── Result shape ─────────────────────────────────────────────────────────────

export interface RemoteGitState {
  branch: string | null;
  dirty: boolean;
  ahead: number;
  behind: number;
  lastCommit: string | null;
}

export interface RemoteExecResult {
  ok: boolean;
  action: string;
  /** null when the action never spawned a process (validation/rejection). */
  exitCode: number | null;
  /** Redacted + truncated combined output. */
  output: string;
  gitState?: RemoteGitState;
  /** Set when ok=false: machine-readable reason. */
  error?: string;
  /** "rejected" = failed validation/whitelist/path; "error" = ran but failed. */
  status: "ok" | "rejected" | "error";
  /** Always false — this executor never echoes secret values. */
  secretValuesExposed: false;
}

// ─── Redaction + truncation ────────────────────────────────────────────────────

const MAX_OUTPUT_CHARS = 4000;

/** Patterns that look like credentials; redact their values, not the whole line. */
const SECRET_PATTERNS: RegExp[] = [
  // You.md / common API keys
  /\bym_[A-Za-z0-9]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  // KEY=VALUE / TOKEN: value style assignments
  /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|APIKEY|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[:=]\s*\S+/gi,
  // bearer tokens
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi,
  // URLs with embedded credentials (https://user:pass@host)
  /(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, ...groups) => {
      // Assignment-style: keep the key name, redact the value.
      if (typeof groups[0] === "string" && /[:=]/.test(match)) {
        return `${groups[0]}=***redacted***`;
      }
      // URL credential style: keep scheme, drop user:pass.
      if (typeof groups[0] === "string" && /^https?:\/\/$/.test(groups[0])) {
        return `${groups[0]}***redacted***@`;
      }
      return "***redacted***";
    });
  }
  return out;
}

export function truncateOutput(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n…[truncated ${text.length - max} chars]`;
}

function cleanOutput(stdout: string, stderr: string): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  return truncateOutput(redactSecrets(combined));
}

// ─── Path resolution (containment) ─────────────────────────────────────────────

/**
 * Resolve `project` to an absolute directory that is GUARANTEED to live inside
 * one of the caller's known You.md workspace/project roots. Returns null on any
 * rejection (escape attempt, missing project, no roots). Never throws.
 *
 * Rules:
 *   - `project` must be a simple name token — no path separators, no `..`,
 *     no leading `~` or `/`. (We resolve names to dirs ourselves.)
 *   - The candidate must be a directory whose REAL path (symlinks resolved) is
 *     inside a known root's REAL path.
 *   - The candidate must look like a real project (git repo or project marker).
 */
export function resolveProjectDir(
  project: unknown,
  opts: { startDir?: string } = {}
): { ok: true; dir: string } | { ok: false; reason: string } {
  if (typeof project !== "string" || project.trim().length === 0) {
    return { ok: false, reason: "project name is required for this action" };
  }
  const name = project.trim();

  // Reject anything that is not a plain directory-name token. This is the first
  // line of defense against path traversal — we never accept caller-supplied
  // path fragments, only a name we map to a directory ourselves.
  if (/[\\/]/.test(name) || name.includes("..") || name.startsWith("~") || name.startsWith(".")) {
    return { ok: false, reason: `invalid project name: ${name}` };
  }

  const startDir = opts.startDir;
  const roots = new Set<string>();

  // Managed .you/projects root (walk-up) + workspace roots.
  const managedRoot = findProjectsRoot(startDir);
  if (managedRoot) roots.add(managedRoot);
  for (const wsRoot of getWorkspaceRootCandidates(startDir)) {
    roots.add(wsRoot);
  }

  if (roots.size === 0) {
    return { ok: false, reason: "no known You.md project roots on this machine" };
  }

  // Resolve each root to its real path once.
  const realRoots: string[] = [];
  for (const root of roots) {
    try {
      realRoots.push(fs.realpathSync.native(root));
    } catch {
      // unreadable root — skip
    }
  }
  if (realRoots.length === 0) {
    return { ok: false, reason: "no readable You.md project roots on this machine" };
  }

  // Candidate directories: <root>/<name> for each root, plus the managed
  // store's slugged dir.
  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(path.join(root, name));
  }
  if (managedRoot) candidates.push(getProjectDir(managedRoot, name));

  for (const candidate of candidates) {
    let real: string;
    try {
      const stat = fs.statSync(candidate);
      if (!stat.isDirectory()) continue;
      real = fs.realpathSync.native(candidate);
    } catch {
      continue;
    }

    // Containment check against REAL root paths — the resolved directory must
    // be inside (or equal to) a known root.
    const contained = realRoots.some(
      (root) => real === root || real.startsWith(root + path.sep)
    );
    if (!contained) continue;

    // Must look like an actual project (not just any subdir).
    const isGit = fs.existsSync(path.join(real, ".git"));
    const hasMarker = getProjectMarkerSignals(real).length > 0;
    if (!isGit && !hasMarker) continue;

    return { ok: true, dir: real };
  }

  return {
    ok: false,
    reason: `project "${name}" not found inside any known You.md project root`,
  };
}

// ─── Process runner (no shell, argv array, bounded) ────────────────────────────

interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/**
 * Run a binary with an explicit argv ARRAY and shell:false. There is no command
 * string anywhere in this path, so caller args cannot be interpreted by a shell.
 */
function runProcess(
  file: string,
  args: string[],
  cwd: string | undefined,
  timeoutMs: number
): Promise<RunResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      {
        cwd,
        timeout: timeoutMs,
        shell: false, // explicit: never go through a shell
        maxBuffer: 1024 * 1024 * 4,
        windowsHide: true,
        env: process.env,
      },
      (err, stdout, stderr) => {
        const e = err as
          | (NodeJS.ErrnoException & { code?: number | string; killed?: boolean; signal?: string })
          | null;
        const timedOut = Boolean(e && e.killed && e.signal === "SIGTERM");
        let exitCode: number | null = 0;
        if (e) {
          exitCode = typeof e.code === "number" ? e.code : null;
        }
        resolve({
          exitCode,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          timedOut,
        });
      }
    );
  });
}

async function git(
  args: string[],
  cwd: string,
  timeoutMs: number
): Promise<RunResult> {
  return runProcess("git", args, cwd, timeoutMs);
}

// ─── git state probe ───────────────────────────────────────────────────────────

async function readGitState(cwd: string, timeoutMs: number): Promise<RemoteGitState> {
  const state: RemoteGitState = {
    branch: null,
    dirty: false,
    ahead: 0,
    behind: 0,
    lastCommit: null,
  };

  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"], cwd, timeoutMs);
  if (branch.exitCode === 0) state.branch = branch.stdout.trim() || null;

  const status = await git(["status", "--porcelain"], cwd, timeoutMs);
  if (status.exitCode === 0) state.dirty = status.stdout.trim().length > 0;

  const counts = await git(
    ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    cwd,
    timeoutMs
  );
  if (counts.exitCode === 0) {
    const m = counts.stdout.trim().split(/\s+/);
    if (m.length === 2) {
      state.behind = Number(m[0]) || 0;
      state.ahead = Number(m[1]) || 0;
    }
  }

  const last = await git(["log", "-1", "--pretty=%h %s"], cwd, timeoutMs);
  if (last.exitCode === 0) state.lastCommit = last.stdout.trim() || null;

  return state;
}

// ─── Public entry point ─────────────────────────────────────────────────────────

export interface ExecuteRemoteOptions {
  action: unknown;
  args?: Record<string, unknown>;
  /** Override cwd used for project-root discovery (tests). */
  startDir?: string;
}

function reject(action: string, reason: string): RemoteExecResult {
  return {
    ok: false,
    action,
    exitCode: null,
    output: "",
    error: reason,
    status: "rejected",
    secretValuesExposed: false,
  };
}

/**
 * Validate + execute a single remote action. Always resolves (never throws) and
 * always returns a structured result, so the daemon can post a clean
 * remote-command-result for both success and every rejection path.
 */
export async function executeRemoteAction(
  opts: ExecuteRemoteOptions
): Promise<RemoteExecResult> {
  const actionStr = typeof opts.action === "string" ? opts.action : String(opts.action);

  // 1. Whitelist gate — the hard boundary.
  if (!isAllowedRemoteAction(opts.action)) {
    return reject(actionStr, `action not in whitelist: ${actionStr}`);
  }
  const action = opts.action;
  const spec = ACTION_SPECS[action];
  const args = opts.args && typeof opts.args === "object" ? opts.args : {};

  // 2. Resolve + contain the project dir when required.
  let cwd: string | undefined;
  if (spec.needsProject) {
    const resolved = resolveProjectDir(args.project, { startDir: opts.startDir });
    if (!resolved.ok) {
      return reject(action, resolved.reason);
    }
    cwd = resolved.dir;
  }

  try {
    switch (action) {
      case "git.status":
      case "git.last_activity": {
        const gitState = await readGitState(cwd as string, spec.timeoutMs);
        const summary =
          action === "git.last_activity"
            ? `last commit: ${gitState.lastCommit ?? "(none)"}`
            : `branch ${gitState.branch ?? "?"} — ${gitState.dirty ? "dirty" : "clean"}, ahead ${gitState.ahead}, behind ${gitState.behind}`;
        return {
          ok: true,
          action,
          exitCode: 0,
          output: cleanOutput(summary, ""),
          gitState,
          status: "ok",
          secretValuesExposed: false,
        };
      }

      case "git.pull": {
        const pull = await git(["pull", "--ff-only"], cwd as string, spec.timeoutMs);
        const gitState = await readGitState(cwd as string, spec.timeoutMs);
        const ok = pull.exitCode === 0;
        return {
          ok,
          action,
          exitCode: pull.exitCode,
          output: cleanOutput(pull.stdout, pull.stderr),
          gitState,
          status: ok ? "ok" : "error",
          ...(ok ? {} : { error: pull.timedOut ? "git pull timed out" : "git pull failed" }),
          secretValuesExposed: false,
        };
      }

      case "git.commit_push": {
        const message =
          typeof args.message === "string" && args.message.trim().length > 0
            ? args.message.trim()
            : "wip: remote agent commit";

        const outputs: string[] = [];

        const add = await git(["add", "-A"], cwd as string, spec.timeoutMs);
        outputs.push(add.stderr);
        if (add.exitCode !== 0) {
          return {
            ok: false,
            action,
            exitCode: add.exitCode,
            output: cleanOutput("", outputs.join("\n")),
            error: "git add failed",
            status: "error",
            secretValuesExposed: false,
          };
        }

        // commit (-m message passed as a discrete argv element, never a shell arg)
        const commit = await git(
          ["commit", "-m", message],
          cwd as string,
          spec.timeoutMs
        );
        outputs.push(commit.stdout, commit.stderr);
        // exit 1 with "nothing to commit" is not a failure — still try to push
        // (the branch may be ahead from a previous commit).
        const nothingToCommit =
          commit.exitCode !== 0 && /nothing to commit/i.test(commit.stdout + commit.stderr);

        const push = await git(["push"], cwd as string, spec.timeoutMs);
        outputs.push(push.stdout, push.stderr);
        const gitState = await readGitState(cwd as string, spec.timeoutMs);

        const ok = push.exitCode === 0;
        return {
          ok,
          action,
          exitCode: push.exitCode,
          output: cleanOutput(
            outputs.join("\n"),
            nothingToCommit ? "(working tree clean — pushed existing commits)" : ""
          ),
          gitState,
          status: ok ? "ok" : "error",
          ...(ok ? {} : { error: push.timedOut ? "git push timed out" : "git push failed" }),
          secretValuesExposed: false,
        };
      }

      case "agent.status": {
        const summary = [
          `host: ${os.hostname()}`,
          `runtime: node ${process.version}`,
          `pid: ${process.pid}`,
        ].join("\n");
        return {
          ok: true,
          action,
          exitCode: 0,
          output: cleanOutput(summary, ""),
          status: "ok",
          secretValuesExposed: false,
        };
      }
    }
  } catch (err) {
    return {
      ok: false,
      action,
      exitCode: null,
      output: cleanOutput("", err instanceof Error ? err.message : String(err)),
      error: "executor exception",
      status: "error",
      secretValuesExposed: false,
    };
  }

  // Unreachable (switch is exhaustive over the whitelist) — defensive reject.
  return reject(action, `unhandled action: ${action}`);
}
