import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  hashOpaqueToken,
} from "@/lib/auth-session";
import { signConvexToken } from "@/lib/auth-jwt";

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (index < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 180 * (index + 1)));
      }
    }
  }
  throw lastError;
}

export async function GET() {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const tokenHash = hashOpaqueToken(token);
  const client = getConvexHttpClient();
  const session = await retry(() => client.query(api.auth.validateSession, { tokenHash }));

  if (!session) {
    await clearSessionCookie();
    return NextResponse.json({ authenticated: false });
  }

  await retry(() => client.mutation(api.auth.touchSession, { tokenHash }));

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
