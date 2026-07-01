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
import {
  spawnWorker,
  refreshWorkers,
  getWorkerOutput,
  stopWorker,
  WorkerHarness,
} from "./orchestrator/supervisor";
import { readGlobalConfig } from "./config";

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
  "skill.inventory",
  "machine.verify",
  "agent.status",
  // ── Cross-machine orchestration (the You agent conductor driving a remote host) ──
  // agent.spawn / agent.stop launch/stop a WORKER harness on the target — a real
  // privilege escalation beyond the git whitelist, so they require the target host to
  // opt in via YOU_REMOTE_AGENT_HOST=1 (see remoteAgentHostEnabled). list/output are
  // read-only and need no extra opt-in.
  "agent.spawn",
  "agent.list",
  "agent.output",
  "agent.stop",
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
  "skill.inventory": {
    needsProject: false,
    mutating: "reversible",
    timeoutMs: 180_000,
    description: "refresh Skill Mesh inventory, hydrate the You.md catalog, and sync the proof (opt-in host)",
  },
  "machine.verify": {
    needsProject: false,
    mutating: "reversible",
    timeoutMs: 120_000,
    description: "write and sync a machine verification report for a named safe root (opt-in host)",
  },
  "agent.status": {
    needsProject: false,
    mutating: "no",
    timeoutMs: 15_000,
    description: "report host/runtime + last agent-bus heartbeat hint",
  },
  "agent.spawn": {
    // needsProject is false here so the host opt-in gate is checked FIRST (inside the case);
    // the project dir is resolved + contained inside the case, after the gate.
    needsProject: false,
    mutating: "reversible",
    timeoutMs: 15_000,
    description: "launch a worker harness (claude|codex|cursor) on a task in a project (opt-in host)",
  },
  "agent.list": {
    needsProject: false,
    mutating: "no",
    timeoutMs: 10_000,
    description: "list worker agents and their status on this host",
  },
  "agent.output": {
    needsProject: false,
    mutating: "no",
    timeoutMs: 10_000,
    description: "tail a worker agent's captured output",
  },
  "agent.stop": {
    needsProject: false,
    mutating: "reversible",
    timeoutMs: 10_000,
    description: "stop a running worker agent (opt-in host)",
  },
};

/**
 * Whether THIS host accepts remote requests to launch/stop autonomous worker agents.
 * Off by default: a host enrolled in the brain is remotely observable (git/status/agent.list)
 * but will NOT run a remotely-triggered coding agent unless its owner explicitly opts in. The
 * y.computer / VPS provision flow sets this deliberately when standing up a worker host.
 */
export function remoteAgentHostEnabled(): boolean {
  const v = (process.env.YOU_REMOTE_AGENT_HOST || process.env.YOUMD_REMOTE_AGENT_HOST || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false; // explicit env override wins
  // Persisted opt-in: the resident daemon's process env carries no shell exports, so the
  // durable flag in config is the real enablement path (set via `you orchestrate host on`).
  try {
    return readGlobalConfig().remoteAgentHost === true;
  } catch {
    return false;
  }
}

/** Worker harnesses a REMOTE issuer may request. `custom` (arbitrary argv) is intentionally excluded. */
const REMOTE_SPAWNABLE_HARNESSES = ["claude", "codex", "cursor"] as const;

/**
 * Build a secret-minimized environment for a REMOTELY-triggered worker so it does not inherit the
 * resident daemon's own credentials (you.md token, OpenRouter, folder.md, vault) — a remote issuer
 * should not be able to launch an agent that can read those off process.env. Defense-in-depth, not
 * a full sandbox: the worker harness keeps its own auth (e.g. ANTHROPIC_API_KEY) so it still runs.
 */
export function remoteWorkerEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  const explicitDrop = [
    "YOU_API_KEY", "YOUMD_API_KEY",
    "OPENROUTER_API_KEY",
    "FOLDER_API_KEY", "FOLDERMD_API_KEY",
    "YOU_REMOTE_AGENT_HOST", "YOUMD_REMOTE_AGENT_HOST",
  ];
  for (const k of explicitDrop) delete env[k];
  // Drop obvious secret-shaped vars (tokens/secrets/passwords/private keys). Keeps *_API_KEY
  // like ANTHROPIC_API_KEY so the harness can authenticate.
  for (const k of Object.keys(env)) {
    if (/(_SECRET$|^SECRET|_TOKEN$|TOKEN$|PASSWORD|PASSWD|PRIVATE_KEY)/i.test(k)) delete env[k];
  }
  return env;
}

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
  // JWTs (header.payload.signature)
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // PEM private key blocks
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
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

function currentYouInvocation(): { file: string; argsPrefix: string[] } {
  const script = process.argv[1];
  if (script && fs.existsSync(script)) {
    return { file: process.execPath, argsPrefix: [script] };
  }
  const configured = process.env.YOUMD_CLI_BIN || process.env.YOU_CLI_BIN;
  return { file: configured || "you", argsPrefix: [] };
}

async function youmd(
  args: string[],
  timeoutMs: number,
  cwd?: string
): Promise<RunResult> {
  const invocation = currentYouInvocation();
  return runProcess(invocation.file, [...invocation.argsPrefix, ...args], cwd, timeoutMs);
}

export function resolveMachineVerifyRoot(
  root: unknown,
  opts: { startDir?: string; homeDir?: string } = {}
): { ok: true; dir: string; token: string } | { ok: false; reason: string } {
  const raw = typeof root === "string" && root.trim().length > 0 ? root.trim() : "current";
  if (/[\\/]/.test(raw) || raw.includes("..") || raw.startsWith("~") || raw.startsWith(".")) {
    return { ok: false, reason: `invalid machine root token: ${raw}` };
  }

  const normalized = raw.toLowerCase().replace(/[-\s]+/g, "_");
  const home = opts.homeDir || os.homedir();
  const candidates: Record<string, string> = {
    current: opts.startDir || process.cwd(),
    cwd: opts.startDir || process.cwd(),
    code_2025: path.join(home, "Desktop", "CODE_2025"),
    desktop_code_2025: path.join(home, "Desktop", "CODE_2025"),
    code_you: path.join(home, "Desktop", "CODE_YOU"),
    desktop_code_you: path.join(home, "Desktop", "CODE_YOU"),
  };
  const candidate = candidates[normalized];
  if (!candidate) {
    return {
      ok: false,
      reason: "machine.verify root must be one of: current, CODE_2025, CODE_YOU",
    };
  }

  try {
    const stat = fs.statSync(candidate);
    if (!stat.isDirectory()) {
      return { ok: false, reason: `machine.verify root is not a directory: ${raw}` };
    }
    return { ok: true, dir: fs.realpathSync.native(candidate), token: raw };
  } catch {
    return { ok: false, reason: `machine.verify root does not exist on this host: ${raw}` };
  }
}

function requireRemoteHostOptIn(action: RemoteAction, label: string): RemoteExecResult | null {
  if (remoteAgentHostEnabled()) return null;
  return reject(
    action,
    `this host does not accept remote ${label} (run \`you orchestrate host on\` or set YOU_REMOTE_AGENT_HOST=1 to enable)`
  );
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

      case "skill.inventory": {
        const gate = requireRemoteHostOptIn(action, "Skill Mesh repairs");
        if (gate) return gate;

        const outDir = path.join(os.homedir(), ".you", "agent-stack-inventory");
        const res = await youmd(
          ["skill", "inventory", "--out-dir", outDir, "--register-catalog", "--sync"],
          spec.timeoutMs
        );
        const ok = res.exitCode === 0;
        return {
          ok,
          action,
          exitCode: res.exitCode,
          output: cleanOutput(res.stdout, res.stderr),
          status: ok ? "ok" : "error",
          ...(ok ? {} : { error: res.timedOut ? "skill inventory timed out" : "skill inventory failed" }),
          secretValuesExposed: false,
        };
      }

      case "machine.verify": {
        const gate = requireRemoteHostOptIn(action, "machine verification repairs");
        if (gate) return gate;

        const root = resolveMachineVerifyRoot(args.root, { startDir: opts.startDir });
        if (!root.ok) return reject(action, root.reason);

        const res = await youmd(
          ["machine", "verify", "--root", root.dir, "--write-report", "--sync-report"],
          spec.timeoutMs
        );
        const ok = res.exitCode === 0;
        return {
          ok,
          action,
          exitCode: res.exitCode,
          output: cleanOutput(res.stdout, res.stderr),
          status: ok ? "ok" : "error",
          ...(ok ? {} : { error: res.timedOut ? "machine verify timed out" : "machine verify failed" }),
          secretValuesExposed: false,
        };
      }

      case "agent.status": {
        const summary = [
          `host: ${os.hostname()}`,
          `runtime: node ${process.version}`,
          `pid: ${process.pid}`,
          `remote-agent-host: ${remoteAgentHostEnabled() ? "enabled" : "disabled"}`,
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

      case "agent.spawn": {
        // Higher-privilege: requires explicit host opt-in (this launches an autonomous worker).
        if (!remoteAgentHostEnabled()) {
          return reject(
            action,
            "this host does not accept remote agent spawns (set YOU_REMOTE_AGENT_HOST=1 to enable)"
          );
        }
        const harness = String(args.harness ?? "claude") as WorkerHarness;
        if (!(REMOTE_SPAWNABLE_HARNESSES as readonly string[]).includes(harness)) {
          return reject(action, `harness not allowed for remote spawn: ${harness}`);
        }
        const goal = typeof args.goal === "string" ? args.goal.trim() : "";
        if (!goal) {
          return reject(action, "agent.spawn requires a non-empty goal");
        }
        // Resolve + contain the project dir AFTER the opt-in/harness/goal gates.
        const resolvedSpawn = resolveProjectDir(args.project, { startDir: opts.startDir });
        if (!resolvedSpawn.ok) {
          return reject(action, resolvedSpawn.reason);
        }
        const res = spawnWorker({
          harness,
          goal,
          cwd: resolvedSpawn.dir,
          project: typeof args.project === "string" ? args.project : undefined,
          host: os.hostname(),
          env: remoteWorkerEnv(), // strip the daemon's own secrets from the remote worker
        });
        if (!res.ok || !res.worker) {
          return {
            ok: false,
            action,
            exitCode: null,
            output: cleanOutput("", res.error ?? "spawn failed"),
            error: res.error ?? "spawn failed",
            status: "error",
            secretValuesExposed: false,
          };
        }
        return {
          ok: true,
          action,
          exitCode: 0,
          output: cleanOutput(
            `launched ${harness} worker ${res.worker.id} (pid ${res.worker.pid}) in ${resolvedSpawn.dir}`,
            ""
          ),
          status: "ok",
          secretValuesExposed: false,
        };
      }

      case "agent.list": {
        // Worker logs/goals can contain sensitive output; do not expose them remotely unless the
        // host owner opted in (same gate as spawn/stop). agent.status is the unauthenticated probe.
        if (!remoteAgentHostEnabled()) {
          return reject(
            action,
            "this host does not expose worker agents remotely (set YOU_REMOTE_AGENT_HOST=1 to enable)"
          );
        }
        const workers = refreshWorkers();
        const summary =
          workers.length === 0
            ? "no workers"
            : workers
                .map((w) => `${w.id} [${w.status}] ${w.harness} ${w.project ?? "-"} :: ${w.goal.slice(0, 60)}`)
                .join("\n");
        return {
          ok: true,
          action,
          exitCode: 0,
          output: cleanOutput(summary, ""),
          status: "ok",
          secretValuesExposed: false,
        };
      }

      case "agent.output": {
        if (!remoteAgentHostEnabled()) {
          return reject(
            action,
            "this host does not expose worker output remotely (set YOU_REMOTE_AGENT_HOST=1 to enable)"
          );
        }
        const id = typeof args.id === "string" ? args.id.trim() : "";
        if (!id) return reject(action, "agent.output requires a worker id");
        const lines = Number(args.lines) > 0 ? Number(args.lines) : 40;
        const res = getWorkerOutput(id, lines);
        return {
          ok: res.ok,
          action,
          exitCode: res.ok ? 0 : null,
          output: cleanOutput(res.ok ? res.output ?? "" : "", res.ok ? "" : res.error ?? ""),
          status: res.ok ? "ok" : "error",
          ...(res.ok ? {} : { error: res.error }),
          secretValuesExposed: false,
        };
      }

      case "agent.stop": {
        if (!remoteAgentHostEnabled()) {
          return reject(
            action,
            "this host does not accept remote agent control (set YOU_REMOTE_AGENT_HOST=1 to enable)"
          );
        }
        const id = typeof args.id === "string" ? args.id.trim() : "";
        if (!id) return reject(action, "agent.stop requires a worker id");
        const res = stopWorker(id);
        return {
          ok: res.ok,
          action,
          exitCode: res.ok ? 0 : null,
          output: cleanOutput(res.ok ? `stopped ${id}` : "", res.ok ? "" : res.error ?? ""),
          status: res.ok ? "ok" : "error",
          ...(res.ok ? {} : { error: res.error }),
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
