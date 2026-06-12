import { NextRequest, NextResponse } from "next/server";

import { CONVEX_SITE_URL } from "@/lib/constants";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
    signal: AbortSignal.timeout(15_000),
  });

  // Guard against non-JSON upstream responses (HTML error pages, gateway
  // timeouts, etc.) — surface a JSON-RPC error instead of an unhandled 500.
  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: "upstream returned a non-JSON response" },
      },
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
      // JSON-RPC responses are per-request — never cacheable.
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyMcp(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyMcp(request);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
