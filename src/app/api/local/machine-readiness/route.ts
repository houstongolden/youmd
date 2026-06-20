import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionTokenFromCookies, hashOpaqueToken } from "@/lib/auth-session";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  buildLocalMachineReadiness,
  type LocalMachineReadiness,
  resolveMachineReadinessRoot,
} from "@/lib/local-machine-readiness.server";

export const runtime = "nodejs";

type ReadinessCacheEntry = {
  value?: LocalMachineReadiness;
  cachedAt?: number;
  inFlight?: Promise<LocalMachineReadiness>;
};

const readinessCache = new Map<string, ReadinessCacheEntry>();
const freshCacheMs = 30_000;
const staleCacheMs = 5 * 60_000;

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

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const { report, cacheStatus } = await getCachedReadiness(root.rootDir, forceRefresh);

  return NextResponse.json(report, {
    headers: {
      "x-you-readiness-cache": cacheStatus,
    },
  });
}

async function getCachedReadiness(
  rootDir: string,
  forceRefresh: boolean
): Promise<{ report: LocalMachineReadiness; cacheStatus: "fresh" | "stale" | "miss" | "deduped" }> {
  const key = rootDir;
  const now = Date.now();
  const entry = readinessCache.get(key);
  if (!forceRefresh && entry?.value && entry.cachedAt && now - entry.cachedAt < freshCacheMs) {
    return { report: entry.value, cacheStatus: "fresh" };
  }
  if (!forceRefresh && entry?.value && entry.cachedAt && now - entry.cachedAt < staleCacheMs) {
    if (!entry.inFlight) {
      entry.inFlight = Promise.resolve()
        .then(() => buildLocalMachineReadiness(rootDir))
        .then((report) => {
          readinessCache.set(key, { value: report, cachedAt: Date.now() });
          return report;
        })
        .catch(() => entry.value as LocalMachineReadiness)
        .finally(() => {
          const next = readinessCache.get(key);
          if (next && next.inFlight === entry.inFlight) {
            readinessCache.set(key, { value: next.value, cachedAt: next.cachedAt });
          }
        });
      readinessCache.set(key, entry);
    }
    return { report: entry.value, cacheStatus: "stale" };
  }
  if (!forceRefresh && entry?.inFlight) {
    return { report: await entry.inFlight, cacheStatus: "deduped" };
  }

  const inFlight = Promise.resolve()
    .then(() => buildLocalMachineReadiness(rootDir))
    .then((report) => {
      readinessCache.set(key, { value: report, cachedAt: Date.now() });
      return report;
    })
    .catch((error) => {
      const current = readinessCache.get(key);
      readinessCache.set(key, { value: current?.value, cachedAt: current?.cachedAt });
      throw error;
    });
  readinessCache.set(key, { value: entry?.value, cachedAt: entry?.cachedAt, inFlight });
  return { report: await inFlight, cacheStatus: "miss" };
}
