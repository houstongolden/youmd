import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  clearSessionCookie,
  generateOpaqueToken,
  hashOpaqueToken,
  setSessionCookie,
} from "@/lib/auth-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    const client = getConvexHttpClient();
    const result = await client.mutation(api.auth.completeEmailAuthWithToken, {
      tokenHash: hashOpaqueToken(token),
    });

    const sessionToken = generateOpaqueToken();
    await client.mutation(api.auth.createSession, {
      userId: result.userId,
      tokenHash: hashOpaqueToken(sessionToken),
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    await setSessionCookie(sessionToken);

    const redirectPath = result.isNewUser ? "/initialize" : "/shell";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch {
    await clearSessionCookie();
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
}
