import { CONVEX_SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match",
};

function proxyHeaders(upstream: Response): Headers {
  const headers = new Headers(CORS_HEADERS);
  for (const key of ["content-type", "etag", "link", "cache-control"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  return headers;
}

export async function GET(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const upstreamUrl = new URL(`${CONVEX_SITE_URL}/api/v1/skills`);
  upstreamUrl.search = incoming.search;

  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    "User-Agent": request.headers.get("user-agent") ?? "you.md-web-proxy",
  });
  const etag = request.headers.get("if-none-match");
  if (etag) headers.set("If-None-Match", etag);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "upstream_unavailable",
          message: "skills registry upstream unavailable",
        },
      },
      {
        status: 504,
        headers: CORS_HEADERS,
      }
    );
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: proxyHeaders(upstream),
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
