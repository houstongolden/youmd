import { NextRequest, NextResponse } from "next/server";

import { proxyChatRequest } from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyChatRequest(request, "/api/v1/chat/stream");
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return proxyChatRequest(request, "/api/v1/chat/stream");
}
