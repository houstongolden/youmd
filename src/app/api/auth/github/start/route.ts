import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  GITHUB_OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  getAppUrl,
  isGithubOAuthConfigured,
} from "@/lib/github-oauth";
import { sanitizeNextPath } from "@/lib/redirects";
import { getSessionTokenFromCookies, hashOpaqueToken } from "@/lib/auth-session";
import { getConvexHttpClient, api } from "@/lib/convex-http";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next"), "/shell");

  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(
      `${getAppUrl()}/sign-in?error=github_unconfigured`
    );
  }

  // Resolve the connecting user from the current session HERE (on the www host,
  // where the session cookie is reliably present) and carry their id in the
  // OAuth state. The github callback runs after an apex->www redirect hop where
  // the session cookie isn't reliably re-sent, so it links GitHub using this
  // connectUserId instead of re-reading the session.
  let connectUserId: string | null = null;
  try {
    const sessionToken = await getSessionTokenFromCookies();
    if (sessionToken) {
      const client = getConvexHttpClient();
      const session = await client.query(api.auth.validateSession, {
        tokenHash: hashOpaqueToken(sessionToken),
      });
      connectUserId = session?.userId ?? null;
    }
  } catch {
    connectUserId = null;
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    GITHUB_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, next, connectUserId }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    }
  );
  return response;
}
