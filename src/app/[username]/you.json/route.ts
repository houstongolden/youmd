import { NextRequest, NextResponse } from "next/server";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".cloud", ".site") ||
  "https://kindly-cassowary-600.convex.site";

/**
 * GET /[username]/you.json — Direct JSON endpoint for agent access.
 * Returns the full you.json identity context without requiring JS execution.
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
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Profile not found", username },
        { status: 404 }
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 502 }
    );
  }
}
