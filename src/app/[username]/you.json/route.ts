import { NextRequest, NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

/**
 * GET /[username]/you.json — Direct JSON endpoint for agent access.
 *
 * Returns the full you.json identity context without requiring JS execution.
 * Preserves the upstream Convex you-md/v1 content-type, ETag, and Link header
 * so AI agent clients can do conditional requests and discover the schema.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    // Forward If-None-Match so upstream can respond with 304
    const upstreamHeaders: Record<string, string> = {
      Accept: "application/vnd.you-md.v1+json, application/json",
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
      return NextResponse.json(
        { error: "Profile not found", username },
        {
          status: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    // Read body and forward upstream metadata headers
    const body = await res.text();
    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/vnd.you-md.v1+json",
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
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
