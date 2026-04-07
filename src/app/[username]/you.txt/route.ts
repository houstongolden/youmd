import { NextRequest, NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

/**
 * GET /[username]/you.txt — Plain text endpoint for agent access.
 * Returns the you.md markdown identity context without requiring JS execution.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  try {
    const res = await fetch(
      `${CONVEX_SITE_URL}/api/v1/profiles?username=${encodeURIComponent(username)}`,
      {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      return new NextResponse(`Profile not found: ${username}`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const body = await res.text();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch profile", {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
