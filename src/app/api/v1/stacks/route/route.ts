import { NextRequest, NextResponse } from "next/server";
import {
  normalizeYouStackCapabilities,
  routeYouStackCapability,
} from "@/lib/youstack-routing";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
  }

  if (typeof body.request !== "string" || !body.request.trim()) {
    return NextResponse.json({ error: "request is required" }, { status: 400, headers: CORS_HEADERS });
  }

  const stack = body.stack && typeof body.stack === "object"
    ? body.stack as Record<string, unknown>
    : {};
  const capabilities = normalizeYouStackCapabilities(body.capabilities ?? stack.capabilities);

  return NextResponse.json({
    schemaVersion: "youstack-route/v1",
    stack: {
      slug: typeof stack.slug === "string" ? stack.slug.slice(0, 120) : null,
      name: typeof stack.name === "string" ? stack.name.slice(0, 200) : null,
      domain: typeof stack.domain === "string" ? stack.domain.slice(0, 160) : null,
      tags: Array.isArray(stack.tags)
        ? stack.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 20)
        : [],
    },
    ...routeYouStackCapability(body.request, capabilities),
  }, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
