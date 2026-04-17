import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  hashOpaqueToken,
} from "@/lib/auth-session";

export async function POST() {
  const token = await getSessionTokenFromCookies();
  if (token) {
    const client = getConvexHttpClient();
    await client.mutation(api.auth.deleteSession, {
      tokenHash: hashOpaqueToken(token),
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
