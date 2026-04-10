import { NextRequest, NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

/**
 * Context link handler — proxies /ctx/{username}/{token} to Convex.
 *
 * Supports:
 *   GET /ctx/{username}/{token} — resolve a context link
 *   Returns JSON (you.json) or markdown depending on Accept header
 *
 * Forwards upstream ETag, Link header, and supports If-None-Match → 304
 * passthrough for efficient agent client caching.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Extract token — it's the last segment
  // URL format: /ctx/{username}/{token}
  const token = path.length >= 2 ? path[path.length - 1] : path[0];

  if (!token) {
    return NextResponse.json(
      { error: "Token required" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  try {
    // Forward If-None-Match so upstream can respond with 304
    const upstreamHeaders: Record<string, string> = {
      Accept: request.headers.get("Accept") || "application/vnd.you-md.v1+json",
    };
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) upstreamHeaders["If-None-Match"] = ifNoneMatch;

    const convexRes = await fetch(`${CONVEX_SITE_URL}/ctx?token=${encodeURIComponent(token)}`, {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(15_000),
    });

    // 304 Not Modified — pass through with no body
    if (convexRes.status === 304) {
      const passthroughHeaders: Record<string, string> = {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      };
      const upstreamEtag = convexRes.headers.get("etag");
      if (upstreamEtag) passthroughHeaders.ETag = upstreamEtag;
      const upstreamLink = convexRes.headers.get("link");
      if (upstreamLink) passthroughHeaders.Link = upstreamLink;
      return new NextResponse(null, { status: 304, headers: passthroughHeaders });
    }

    const contentType = convexRes.headers.get("Content-Type") || "application/vnd.you-md.v1+json";
    const body = await convexRes.text();

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    };
    const upstreamEtag = convexRes.headers.get("etag");
    if (upstreamEtag) responseHeaders.ETag = upstreamEtag;
    const upstreamLink = convexRes.headers.get("link");
    if (upstreamLink) responseHeaders.Link = upstreamLink;

    return new NextResponse(body, {
      status: convexRes.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve context link" },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}
