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

async function proxyMcp(request: NextRequest): Promise<NextResponse> {
  const upstreamUrl = `${CONVEX_SITE_URL}/api/v1/mcp`;
  const body =
    request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
      ? undefined
      : await request.text();

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: {
      Accept: request.headers.get("accept") || "application/json",
      "Content-Type": request.headers.get("content-type") || "application/json",
      ...(request.headers.get("authorization")
        ? { Authorization: request.headers.get("authorization") as string }
        : {}),
    },
    body,
    cache: "no-store",
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyHeaders(upstream.headers),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyMcp(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyMcp(request);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return proxyMcp(request);
}
