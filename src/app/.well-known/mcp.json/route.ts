import { NextRequest, NextResponse } from "next/server";

import { CONVEX_SITE_URL } from "@/lib/constants";

function copyHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") return;
    headers.set(key, value);
  });
  return headers;
}

async function proxyDiscovery(request: NextRequest): Promise<NextResponse> {
  const upstream = await fetch(`${CONVEX_SITE_URL}/.well-known/mcp.json`, {
    method: request.method,
    headers: {
      Accept: request.headers.get("accept") || "application/json",
    },
    cache: "no-store",
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyHeaders(upstream.headers),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyDiscovery(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return proxyDiscovery(request);
}
