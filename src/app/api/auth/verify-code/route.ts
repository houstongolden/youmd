import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  setSessionCookie,
} from "@/lib/auth-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const issueApiKey = !!body.issueApiKey;

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const client = getConvexHttpClient();
    const result = await client.mutation(api.auth.completeEmailAuthWithCode, {
      email,
      codeHash: hashOpaqueToken(code),
      issueApiKey,
    });

    const sessionToken = generateOpaqueToken();
    await client.mutation(api.auth.createSession, {
      userId: result.userId,
      tokenHash: hashOpaqueToken(sessionToken),
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });
    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      username: result.username,
      apiKey: result.apiKey,
      user: {
        id: result.clerkId,
        username: result.username,
        email: result.email,
        displayName: result.displayName,
      },
      isNewUser: result.isNewUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      { status: 401 }
    );
  }
}
