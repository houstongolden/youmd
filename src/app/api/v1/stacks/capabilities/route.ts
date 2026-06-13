// GET /api/v1/stacks/capabilities — YouStack capability contract with per-capability
// transport tags ({ http, mcp }). Each capability in defaultCapabilities carries a
// truthful `transports` field: http=true when a /api/v1/* route exposes it;
// mcp=true when its mcpTool name appears in tools/list. P10 (2026-06-12).
import { NextResponse } from "next/server";
import { getYouStackCapabilityContract } from "@/lib/youstack-routing";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function GET() {
  return NextResponse.json(getYouStackCapabilityContract(), {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
