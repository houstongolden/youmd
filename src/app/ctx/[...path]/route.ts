import { NextRequest, NextResponse } from "next/server";
import { CONVEX_SITE_URL } from "@/lib/constants";

/**
 * Context link handler — proxies /ctx/{username}/{token} to Convex.
 *
 * Supports:
 *   GET /ctx/{username}/{token} — resolve a context link
 *   Returns JSON (you.json) or markdown depending on Accept header
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
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    // Forward to Convex HTTP endpoint
    const convexRes = await fetch(`${CONVEX_SITE_URL}/ctx?token=${encodeURIComponent(token)}`, {
      headers: {
        Accept: request.headers.get("Accept") || "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    const contentType = convexRes.headers.get("Content-Type") || "application/json";
    const body = await convexRes.text();

    return new NextResponse(body, {
      status: convexRes.status,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve context link" },
      { status: 502 }
    );
  }
}
