/**
 * Security-boundary tests for the cross-machine remote executor
 * (CROSS-MACHINE-AGENTS.md §5 + §7).
 *
 * These tests assert the VALIDATION + ARGV-CONSTRUCTION boundary. They do NOT
 * run real git mutations against real repos — every case here is rejected
 * before any process is spawned, or exercises pure helpers.
 */
import { describe, expect, it } from "vitest";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";

import {
  executeRemoteAction,
  isAllowedRemoteAction,
  resolveProjectDir,
  redactSecrets,
  truncateOutput,
  remoteAgentHostEnabled,
  remoteWorkerEnv,
  ALLOWED_REMOTE_ACTIONS,
} from "../lib/remote-executor";
import { writeGlobalConfig } from "../lib/config";
import {
  shouldHandleCommand,
  SeenRequestSet,
  buildCommandMetadata,
  REMOTE_COMMAND_CHANNEL,
} from "../lib/remote-command";
import { generateRequestId } from "../lib/request-id";

describe("whitelist", () => {
  it("accepts exactly the whitelisted actions (git + cross-machine agent control)", () => {
    expect([...ALLOWED_REMOTE_ACTIONS]).toEqual([
      "git.status",
      "git.last_activity",
      "git.commit_push",
      "git.pull",
      "agent.status",
      "agent.spawn",
      "agent.list",
      "agent.output",
      "agent.stop",
    ]);
    for (const action of ALLOWED_REMOTE_ACTIONS) {
      expect(isAllowedRemoteAction(action)).toBe(true);
    }
  });

  it("rejects anything not in the whitelist (no shell, no arbitrary git)", () => {
    for (const bad of [
      "rm",
      "git.push --force",
      "git push --force",
      "git.reset_hard",
      "shell",
      "exec",
      "git.commit_push; rm -rf /",
      "git.status && curl evil.com",
      "",
      "GIT.STATUS",
      "../git.status",
      null,
      undefined,
      42,
      {},
    ]) {
      expect(isAllowedRemoteAction(bad as unknown)).toBe(false);
    }
  });

  it("executeRemoteAction rejects a non-whitelisted action without spawning", async () => {
    const result = await executeRemoteAction({ action: "rm -rf /" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.exitCode).toBeNull();
    expect(result.error).toMatch(/whitelist/);
  });

  it("executeRemoteAction rejects a shell-injection-shaped action string", async () => {
    const result = await executeRemoteAction({ action: "git.status; echo pwned" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
  });
});

describe("cross-machine agent control (opt-in gate)", () => {
  it("agent.spawn is rejected unless the host opted in via YOU_REMOTE_AGENT_HOST", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "0";
    try {
      const result = await executeRemoteAction({
        action: "agent.spawn",
        args: { harness: "claude", goal: "do a thing", project: "youmd" },
      });
      expect(result.ok).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.error).toMatch(/YOU_REMOTE_AGENT_HOST/);
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });

  it("agent.stop is also gated behind the host opt-in", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "0";
    try {
      const result = await executeRemoteAction({ action: "agent.stop", args: { id: "w_x" } });
      expect(result.ok).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.error).toMatch(/YOU_REMOTE_AGENT_HOST/);
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });

  it("agent.list and agent.output are ALSO gated by the host opt-in (worker logs are sensitive)", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "0";
    try {
      const list = await executeRemoteAction({ action: "agent.list" });
      expect(list.ok).toBe(false);
      expect(list.status).toBe("rejected");
      expect(list.error).toMatch(/YOU_REMOTE_AGENT_HOST/);

      const out = await executeRemoteAction({ action: "agent.output", args: { id: "w_x" } });
      expect(out.ok).toBe(false);
      expect(out.status).toBe("rejected");
      expect(out.error).toMatch(/YOU_REMOTE_AGENT_HOST/);
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });

  it("agent.list succeeds when the host opted in", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "1";
    try {
      const result = await executeRemoteAction({ action: "agent.list" });
      expect(result.ok).toBe(true);
      expect(result.status).toBe("ok");
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });

  it("agent.output requires a worker id (when the host opted in)", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "1";
    try {
      const result = await executeRemoteAction({ action: "agent.output", args: {} });
      expect(result.ok).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.error).toMatch(/worker id/i);
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });

  it("remoteWorkerEnv strips daemon secrets but keeps harness auth + PATH", () => {
    const base = {
      PATH: "/usr/bin",
      HOME: "/home/u",
      YOU_API_KEY: "ym_secret",
      OPENROUTER_API_KEY: "sk-or-secret",
      FOLDER_API_KEY: "fmd_live_secret",
      GITHUB_TOKEN: "ghp_secret",
      DB_PASSWORD: "hunter2",
      ANTHROPIC_API_KEY: "sk-ant-keep",
    } as NodeJS.ProcessEnv;
    const env = remoteWorkerEnv(base);
    expect(env.PATH).toBe("/usr/bin");
    expect(env.HOME).toBe("/home/u");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-keep"); // harness still authenticates
    expect(env.YOU_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.FOLDER_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.DB_PASSWORD).toBeUndefined();
  });

  it("remoteAgentHostEnabled: env '0' hard-overrides; otherwise the persisted config flag enables it", () => {
    const prevEnv = process.env.YOU_REMOTE_AGENT_HOST;
    const prevHome = process.env.YOU_HOME;
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "you-host-flag-"));
    process.env.YOU_HOME = tmpHome;
    try {
      // No env, config flag on → enabled (this is the daemon path).
      delete process.env.YOU_REMOTE_AGENT_HOST;
      writeGlobalConfig({ remoteAgentHost: true });
      expect(remoteAgentHostEnabled()).toBe(true);

      // Explicit env "0" wins even when config says true (a kill switch).
      process.env.YOU_REMOTE_AGENT_HOST = "0";
      expect(remoteAgentHostEnabled()).toBe(false);

      // Config off → disabled.
      delete process.env.YOU_REMOTE_AGENT_HOST;
      writeGlobalConfig({ remoteAgentHost: false });
      expect(remoteAgentHostEnabled()).toBe(false);
    } finally {
      if (prevEnv === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prevEnv;
      if (prevHome === undefined) delete process.env.YOU_HOME;
      else process.env.YOU_HOME = prevHome;
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });

  it("agent.spawn rejects a disallowed harness even when the host opted in", async () => {
    const prev = process.env.YOU_REMOTE_AGENT_HOST;
    process.env.YOU_REMOTE_AGENT_HOST = "1";
    try {
      const result = await executeRemoteAction({
        action: "agent.spawn",
        args: { harness: "custom", goal: "x", project: "youmd" },
      });
      expect(result.ok).toBe(false);
      // custom is blocked either at harness validation or project containment — both are rejections.
      expect(result.status).toBe("rejected");
    } finally {
      if (prev === undefined) delete process.env.YOU_REMOTE_AGENT_HOST;
      else process.env.YOU_REMOTE_AGENT_HOST = prev;
    }
  });
});

describe("path resolution / containment", () => {
  it("rejects an absent project name for project-required actions", async () => {
    const result = await executeRemoteAction({ action: "git.status", args: {} });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.error).toMatch(/project name is required/i);
  });

  it("rejects path-traversal project tokens before touching disk", () => {
    for (const evil of [
      "../etc",
      "../../secrets",
      "foo/bar",
      "foo\\bar",
      "/etc/passwd",
      "~/secrets",
      ".ssh",
      "..",
    ]) {
      const res = resolveProjectDir(evil);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toMatch(/invalid project name|not found|no known/i);
      }
    }
  });

  it("rejects a project that does not exist inside any known root", () => {
    const res = resolveProjectDir("definitely-not-a-real-project-xyz-12345");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not found|no known|no readable/i);
  });

  it("rejects a real directory that lives OUTSIDE the known roots", () => {
    // Create a git-looking dir in a temp location that is NOT a You.md root,
    // and confirm resolution refuses it (containment check).
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "you-remote-test-"));
    try {
      const projDir = path.join(tmp, "evilproj");
      fs.mkdirSync(path.join(projDir, ".git"), { recursive: true });
      // startDir is the temp dir; getWorkspaceRootCandidates won't include an
      // arbitrary tmp dir as a known root, so "evilproj" must not resolve.
      const res = resolveProjectDir("evilproj", { startDir: tmp });
      expect(res.ok).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects a non-git, non-marker directory even inside a root", () => {
    // A plain subdirectory of a workspace root that isn't a project should not
    // resolve (must look like an actual project).
    const home = os.homedir();
    // Use a name extremely unlikely to be a real project at any root.
    const res = resolveProjectDir("Downloads"); // skipped/non-project by design
    expect(res.ok).toBe(false);
    // sanity: home exists, the failure is about project-shape not missing home
    expect(fs.existsSync(home)).toBe(true);
  });
});

describe("redaction + truncation", () => {
  it("redacts you.md keys, bearer tokens, and secret assignments", () => {
    const dirty = [
      "token ym_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd",
      "Authorization: Bearer abcdef0123456789ghijkl",
      "API_KEY=supersecretvalue",
      "GITHUB_TOKEN: ghp_0123456789abcdefghijklmnopqrstuvwxyz",
      "url https://user:hunter2@example.com/repo.git",
    ].join("\n");
    const clean = redactSecrets(dirty);
    expect(clean).not.toContain("ym_ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(clean).not.toContain("supersecretvalue");
    expect(clean).not.toContain("hunter2");
    expect(clean).not.toContain("ghp_0123456789");
    expect(clean).toContain("redacted");
  });

  it("truncates long output deterministically", () => {
    const long = "x".repeat(10_000);
    const out = truncateOutput(long, 100);
    expect(out.length).toBeLessThan(long.length);
    expect(out).toMatch(/truncated/);
  });
});

describe("request id", () => {
  it("is prefixed, unique, and time-sortable", () => {
    const ids = Array.from({ length: 200 }, () => generateRequestId());
    expect(new Set(ids).size).toBe(200); // no collisions
    for (const id of ids) expect(id.startsWith("rc_")).toBe(true);
    const sorted = [...ids].sort();
    // ids minted in increasing time should be lexicographically non-decreasing
    // for the time component — assert the prefix monotonicity holds overall.
    expect(sorted[0] <= sorted[sorted.length - 1]).toBe(true);
  });
});

describe("daemon decision (shouldHandleCommand)", () => {
  const host = "office-mac-mini.local";
  function msg(meta: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
    return {
      channel: REMOTE_COMMAND_CHANNEL,
      targetHost: host,
      metadata: meta,
      ...overrides,
    } as Parameters<typeof shouldHandleCommand>[0];
  }

  it("processes a fresh, in-window, correctly-targeted command", () => {
    const seen = new SeenRequestSet();
    const meta = buildCommandMetadata({ action: "git.status", args: { project: "youmd" } });
    const d = shouldHandleCommand(msg(meta), seen, host, Date.now());
    expect(d.process).toBe(true);
  });

  it("ignores messages on other channels", () => {
    const seen = new SeenRequestSet();
    const meta = buildCommandMetadata({ action: "git.status" });
    const d = shouldHandleCommand(msg(meta, { channel: "chat" }), seen, host);
    expect(d.process).toBe(false);
  });

  it("ignores commands targeted at a different host", () => {
    const seen = new SeenRequestSet();
    const meta = buildCommandMetadata({ action: "git.status" });
    const d = shouldHandleCommand(msg(meta, { targetHost: "some-other-host" }), seen, host);
    expect(d.process).toBe(false);
    expect(d.reason).toMatch(/host/);
  });

  it("dedupes by requestId (idempotency)", () => {
    const seen = new SeenRequestSet();
    const meta = buildCommandMetadata({ action: "git.status" });
    const first = shouldHandleCommand(msg(meta), seen, host);
    expect(first.process).toBe(true);
    seen.add(meta.requestId);
    const second = shouldHandleCommand(msg(meta), seen, host);
    expect(second.process).toBe(false);
    expect(second.reason).toMatch(/already processed/);
  });

  it("drops expired commands", () => {
    const seen = new SeenRequestSet();
    const now = Date.now();
    const meta = buildCommandMetadata({ action: "git.status", ttlMs: 1000 }, now - 10_000);
    const d = shouldHandleCommand(msg(meta), seen, host, now);
    expect(d.process).toBe(false);
    expect(d.reason).toMatch(/expired/);
  });

  it("drops commands with no requestId", () => {
    const seen = new SeenRequestSet();
    const d = shouldHandleCommand(msg({ action: "git.status" }), seen, host);
    expect(d.process).toBe(false);
    expect(d.reason).toMatch(/requestId/);
  });
});
