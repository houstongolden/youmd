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

  const json = await upstream.json();

  return NextResponse.json(json, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyDiscovery(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
