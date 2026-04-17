import { NextRequest, NextResponse } from "next/server";

import { CONVEX_SITE_URL } from "@/lib/constants";

export function copyProxyHeaders(source: Headers): Headers {
  const headers = new Headers();
  source.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") return;
    headers.set(key, value);
  });
  return headers;
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

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyProxyHeaders(upstream.headers),
  });
}
