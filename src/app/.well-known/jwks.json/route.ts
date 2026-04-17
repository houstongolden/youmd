import { NextResponse } from "next/server";
import { getJwksPayload } from "@/lib/auth-jwt";

export async function GET() {
  return NextResponse.json(getJwksPayload(), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
