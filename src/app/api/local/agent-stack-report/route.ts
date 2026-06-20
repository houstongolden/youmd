import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionTokenFromCookies, hashOpaqueToken } from "@/lib/auth-session";
import { getConvexHttpClient, api } from "@/lib/convex-http";

export const runtime = "nodejs";

const maxReportBytes = 5 * 1024 * 1024;
const reportPattern = /^local-agent-stack-inventory-.+\.html$/;

type LocalReport = {
  absolutePath: string;
  displayPath: string;
  size: number;
  mtimeMs: number;
};

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const clean = host.toLowerCase();
  if (clean === "::1" || clean.startsWith("[::1]")) return true;
  const hostname = clean.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function toDisplayPath(absolutePath: string) {
  const home = os.homedir();
  return absolutePath.startsWith(home) ? `~${absolutePath.slice(home.length)}` : absolutePath;
}

function findLatestReport(): LocalReport | null {
  const roots = [
    path.join(os.homedir(), ".you", "agent-stack-inventory"),
    path.join(os.homedir(), ".youmd", "agent-stack-inventory"),
  ];
  const reports: LocalReport[] = [];

  for (const root of roots) {
    let names: string[];
    try {
      names = fs.readdirSync(root);
    } catch {
      continue;
    }

    for (const name of names) {
      if (!reportPattern.test(name)) continue;
      const absolutePath = path.join(root, name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(absolutePath);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size > maxReportBytes) continue;
      reports.push({
        absolutePath,
        displayPath: toDisplayPath(absolutePath),
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      });
    }
  }

  return reports.sort((a, b) => b.mtimeMs - a.mtimeMs)[0] ?? null;
}

export async function GET(request: NextRequest) {
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
        error: "agent stack HTML reports are only served from a localhost You.md server",
        localOnly: true,
      },
      { status: 403 }
    );
  }

  const report = findLatestReport();
  if (!report) {
    return NextResponse.json(
      {
        error: "no local agent stack HTML report found",
        command: "you skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync",
      },
      { status: 404 }
    );
  }

  const html = fs.readFileSync(report.absolutePath, "utf8");
  return new NextResponse(html, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-You-Agent-Stack-Report-Path": report.displayPath,
      "X-You-Agent-Stack-Report-Bytes": String(report.size),
    },
  });
}
