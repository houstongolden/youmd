import { NextRequest, NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

/**
 * GET /[username]/you.txt — Plain text (markdown) endpoint for agent access.
 *
 * Returns the you.md markdown identity context without requiring JS execution.
 * Preserves the upstream Convex ETag and Link header so AI agent clients can
 * do conditional requests and discover the schema.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    // Forward If-None-Match so upstream can respond with 304
    const upstreamHeaders: Record<string, string> = {
      Accept: "text/plain",
    };
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) upstreamHeaders["If-None-Match"] = ifNoneMatch;

    const res = await fetch(
      `${CONVEX_SITE_URL}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      {
        headers: upstreamHeaders,
        signal: AbortSignal.timeout(10_000),
      }
    );

    // 304 Not Modified — pass through with no body
    if (res.status === 304) {
      const passthroughHeaders: Record<string, string> = {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      };
      const upstreamEtag = res.headers.get("etag");
      if (upstreamEtag) passthroughHeaders.ETag = upstreamEtag;
      const upstreamLink = res.headers.get("link");
      if (upstreamLink) passthroughHeaders.Link = upstreamLink;
      return new NextResponse(null, { status: 304, headers: passthroughHeaders });
    }

    if (!res.ok) {
      return new NextResponse(`Profile not found: ${username}`, {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const body = await res.text();
    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    };
    const upstreamEtag = res.headers.get("etag");
    if (upstreamEtag) responseHeaders.ETag = upstreamEtag;
    const upstreamLink = res.headers.get("link");
    if (upstreamLink) responseHeaders.Link = upstreamLink;

    return new NextResponse(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse("Failed to fetch profile", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}
