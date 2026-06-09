import { CONVEX_SITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

function proxyHeaders(upstream: Response) {
  const headers = new Headers();
  for (const key of ["content-type", "etag", "link", "cache-control"]) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, If-None-Match");
  return headers;
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstreamUrl = new URL(`${CONVEX_SITE_URL}/api/v1/profiles`);
  upstreamUrl.search = incoming.search;
  const headers = new Headers({
    Accept: request.headers.get("accept") ?? "application/json",
    "User-Agent": request.headers.get("user-agent") ?? "you.md-web-proxy",
  });
  const etag = request.headers.get("if-none-match");
  if (etag) headers.set("If-None-Match", etag);

  const upstream = await fetch(upstreamUrl, {
    headers,
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: proxyHeaders(upstream),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, If-None-Match",
    },
  });
}
