import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionTokenFromCookies, hashOpaqueToken } from "@/lib/auth-session";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import { resolveMachineReadinessRoot } from "@/lib/local-machine-readiness.server";

export const runtime = "nodejs";

type RepairAction = "sync-now" | "verify" | "inventory";

const actionTimeoutMs: Record<RepairAction, number> = {
  "sync-now": 10 * 60_000,
  verify: 4 * 60_000,
  inventory: 4 * 60_000,
};

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const clean = host.toLowerCase();
  if (clean === "::1" || clean.startsWith("[::1]")) return true;
  const hostname = clean.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function normalizeHost(value: string | undefined | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.local$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function redactOutput(value: string) {
  return value
    .replace(/((?:API|AUTH|ACCESS|REFRESH|SECRET|TOKEN|PASSWORD|PASS|KEY)[A-Z0-9_]*=)[^\s'"`]+/gi, "$1[redacted]")
    .replace(/\b(?:sk|pk|ghp|gho|ghs|ghu|ghr|xox[baprs]|or|ym|ys)-[A-Za-z0-9_-]{12,}\b/g, "[redacted-token]")
    .replace(/\b[A-Za-z0-9_./+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[redacted-email]")
    .slice(-8000);
}

function commandForAction(action: RepairAction, rootDir: string) {
  if (action === "sync-now") {
    return ["machine", "sync-now", "--root", rootDir, "--max-projects", "80"];
  }
  if (action === "verify") {
    return ["machine", "verify", "--root", rootDir, "--write-report", "--sync-report"];
  }
  return [
    "skill",
    "inventory",
    "--out-dir",
    path.join(os.homedir(), ".you", "agent-stack-inventory"),
    "--workspace",
    rootDir,
    "--register-catalog",
    "--sync",
  ];
}

function displayCommand(args: string[]) {
  return `you ${args.map(shellQuote).join(" ")}`.replace(/'([a-z0-9-]+)'/gi, "$1");
}

function runYouCommand(args: string[], timeoutMs: number): Promise<{
  ok: boolean;
  code: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const command = [
    "export PATH=\"$HOME/.you/bin:$HOME/.you/npm-global/bin:$HOME/.youmd/bin:$HOME/.youmd/npm-global/bin:$PATH\"",
    "you",
    ...args.map(shellQuote),
  ].join(" ");

  return new Promise((resolve) => {
    const child = spawn("zsh", ["-lc", command], {
      cwd: os.homedir(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString("utf8")).slice(-12000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-12000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        stdout: redactOutput(stdout),
        stderr: redactOutput(stderr),
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        timedOut,
        stdout: "",
        stderr: redactOutput(error.message),
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

export async function POST(request: NextRequest) {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const client = getConvexHttpClient();
  const tokenHash = hashOpaqueToken(token);
  const session = await client.query(api.auth.validateSession, { tokenHash });
  if (!session) {
    await clearSessionCookie();
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  if (!isLocalHost(request.headers.get("host"))) {
    return NextResponse.json(
      {
        error: "local Skill Mesh repair is only available from a localhost You.md server",
        localOnly: true,
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action;
  if (action !== "sync-now" && action !== "verify" && action !== "inventory") {
    return NextResponse.json({ error: "action must be sync-now, verify, or inventory" }, { status: 400 });
  }

  const requestedHost = typeof body.hostName === "string" ? body.hostName : "";
  const localHost = os.hostname();
  if (requestedHost && normalizeHost(requestedHost) !== normalizeHost(localHost)) {
    return NextResponse.json(
      {
        error: `repair can only run on this local Mac (${localHost}); run the command on ${requestedHost} instead`,
        localHost,
        requestedHost,
        secretValuesExposed: false,
      },
      { status: 409 }
    );
  }

  const root = resolveMachineReadinessRoot(typeof body.rootDir === "string" ? body.rootDir : "current");
  if (!root.allowed) {
    return NextResponse.json({ error: root.reason, secretValuesExposed: false }, { status: 400 });
  }

  const args = commandForAction(action, root.rootDir);
  const result = await runYouCommand(args, actionTimeoutMs[action]);
  return NextResponse.json({
    success: result.ok,
    action,
    localHost,
    rootDir: root.rootDir,
    command: displayCommand(args),
    ...result,
    secretValuesExposed: false,
  }, { status: result.ok ? 200 : 500 });
}
