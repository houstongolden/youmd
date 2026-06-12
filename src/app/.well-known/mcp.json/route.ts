import { NextRequest, NextResponse } from "next/server";

import { CONVEX_SITE_URL } from "@/lib/constants";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function proxyDiscovery(request: NextRequest): Promise<NextResponse> {
  const upstream = await fetch(`${CONVEX_SITE_URL}/.well-known/mcp.json`, {
    method: request.method,
    headers: {
      Accept: request.headers.get("accept") || "application/json",
    },
    cache: "no-store",
  });

  // Guard against non-JSON upstream responses (HTML error pages, gateway
  // timeouts, etc.) — never let upstream.json() throw an unhandled 500.
  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: "upstream returned a non-JSON response" },
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
      }
    );
  }

  return NextResponse.json(json, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      // Only cache successful discovery payloads — error responses must not
      // be pinned in shared caches for an hour.
      "Cache-Control": upstream.status === 200 ? "public, max-age=3600" : "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyDiscovery(request);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
