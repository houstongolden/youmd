import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  hashOpaqueToken,
} from "@/lib/auth-session";
import { signConvexToken } from "@/lib/auth-jwt";

export async function GET() {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const tokenHash = hashOpaqueToken(token);
  const client = getConvexHttpClient();
  const session = await client.query(api.auth.validateSession, { tokenHash });

  if (!session) {
    await clearSessionCookie();
    return NextResponse.json({ authenticated: false });
  }

  await client.mutation(api.auth.touchSession, { tokenHash });

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.clerkId,
      username: session.username,
      email: session.email,
      displayName: session.displayName,
    },
    convexToken: signConvexToken({
      subject: session.clerkId,
      email: session.email,
      username: session.username,
      displayName: session.displayName,
    }),
  });
}
