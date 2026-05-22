import { NextResponse } from "next/server";
import { openApiSpec } from "@/generated/openapi";

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
