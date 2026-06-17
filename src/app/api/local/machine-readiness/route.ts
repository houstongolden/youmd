import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionTokenFromCookies, hashOpaqueToken } from "@/lib/auth-session";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  buildLocalMachineReadiness,
  resolveMachineReadinessRoot,
} from "@/lib/local-machine-readiness.server";

export const runtime = "nodejs";

function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const clean = host.toLowerCase();
  if (clean === "::1" || clean.startsWith("[::1]")) return true;
  const hostname = clean.split(":")[0];
  return hostname === "localhost" || hostname === "127.0.0.1";
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
        error: "local machine readiness is only available from a localhost You.md server",
        localOnly: true,
      },
      { status: 403 }
    );
  }

  const root = resolveMachineReadinessRoot(request.nextUrl.searchParams.get("root"));
  if (!root.allowed) {
    return NextResponse.json({ error: root.reason }, { status: 400 });
  }

  return NextResponse.json(buildLocalMachineReadiness(root.rootDir));
}
