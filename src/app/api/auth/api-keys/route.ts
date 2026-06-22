import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  getSessionTokenFromCookies,
  hashOpaqueToken,
} from "@/lib/auth-session";

type CreateApiKeyBody = {
  label?: string;
  scopes?: string[];
  expiresInDays?: number | null;
  revokeExisting?: boolean;
};

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const trustedToken = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;
  if (!trustedToken) {
    return error("API key creation is not configured on this server.", 500);
  }

  const token = await getSessionTokenFromCookies();
  if (!token) {
    return error("Sign in before creating an API key.", 401);
  }

  const client = getConvexHttpClient();
  const session = await client.query(api.auth.validateSession, {
    tokenHash: hashOpaqueToken(token),
  });

  if (!session) {
    return error("Your session expired. Sign in again, then retry.", 401);
  }

  let body: CreateApiKeyBody;
  try {
    body = (await request.json()) as CreateApiKeyBody;
  } catch {
    body = {};
  }

  try {
    const result = await client.mutation(api.apiKeys.createKey, {
      _internalAuthToken: trustedToken,
      clerkId: session.clerkId,
      label: body.label,
      scopes:
        Array.isArray(body.scopes) && body.scopes.length > 0
          ? body.scopes
          : ["read:public"],
      expiresInDays: body.expiresInDays,
      revokeExisting: body.revokeExisting,
    });
    return NextResponse.json(result);
  } catch (err) {
    return error(
      err instanceof Error ? err.message : "Failed to create API key.",
      500
    );
  }
}
