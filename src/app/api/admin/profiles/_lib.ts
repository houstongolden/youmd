import { CONVEX_SITE_URL } from "@/lib/constants";

const ADMIN_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function proxyHeaders(upstream: Response) {
  const headers = new Headers(ADMIN_HEADERS);
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

export async function proxyAdminProfilePost(request: Request, path: string) {
  const upstream = await fetch(`${CONVEX_SITE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
      Authorization: request.headers.get("authorization") ?? "",
      "User-Agent": request.headers.get("user-agent") ?? "you.md-admin-proxy",
    },
    body: await request.text(),
    cache: "no-store",
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: proxyHeaders(upstream),
  });
}

export function adminProfileOptions() {
  return new Response(null, {
    status: 204,
    headers: ADMIN_HEADERS,
  });
}
