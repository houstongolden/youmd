import { NextRequest, NextResponse } from "next/server";

import { CONVEX_SITE_URL } from "@/lib/constants";

const DEFAULT_CHAT_PROXY_TIMEOUT_MS = 30_000;
const STREAM_CHAT_PROXY_TIMEOUT_MS = 240_000;

export function copyProxyHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "content-length" ||
      lower === "content-encoding" ||
      lower === "transfer-encoding" ||
      lower === "connection"
    ) {
      return;
    }
    headers.set(key, value);
  });
  return headers;
}

function isStreamPath(path: string): boolean {
  return path.endsWith("/stream");
}

function proxyErrorResponse(path: string, error: unknown): NextResponse {
  const message =
    error instanceof Error && error.name === "TimeoutError"
      ? "chat upstream timed out"
      : "chat upstream unavailable";

  if (isStreamPath(path)) {
    return new NextResponse(
      `data: ${JSON.stringify({ error: message })}\n\ndata: [DONE]\n\n`,
      {
        status: 504,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "upstream_unavailable",
        message,
      },
      message,
    },
    { status: 504 }
  );
}

export async function proxyChatRequest(
  request: NextRequest,
  path: string
): Promise<NextResponse> {
  const upstreamUrl = `${CONVEX_SITE_URL}${path}`;
  const body =
    request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS"
      ? undefined
      : await request.text();

  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId) headers.set("Last-Event-ID", lastEventId);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(
        isStreamPath(path) ? STREAM_CHAT_PROXY_TIMEOUT_MS : DEFAULT_CHAT_PROXY_TIMEOUT_MS
      ),
    });
  } catch (error) {
    return proxyErrorResponse(path, error);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyProxyHeaders(upstream.headers),
  });
}
