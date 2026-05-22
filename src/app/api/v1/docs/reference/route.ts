import { NextResponse } from "next/server";
import { docsReference } from "@/generated/docs-reference";

export async function GET() {
  return NextResponse.json(docsReference, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
