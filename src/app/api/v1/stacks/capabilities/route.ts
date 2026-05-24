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
