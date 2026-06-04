import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE,
  generateOpaqueToken,
  hashOpaqueToken,
} from "@/lib/auth-session";
import {
  GITHUB_OAUTH_STATE_COOKIE,
  exchangeCodeForToken,
  fetchGithubIdentity,
  getAppUrl,
  isGithubOAuthConfigured,
} from "@/lib/github-oauth";
import { sanitizeNextPath } from "@/lib/redirects";

function redirectWithError(reason: string) {
  return NextResponse.redirect(
    `${getAppUrl()}/sign-in?error=${encodeURIComponent(reason)}`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectWithError(oauthError);
  }
  if (!isGithubOAuthConfigured()) {
    return redirectWithError("github_unconfigured");
  }
  if (!code || !returnedState) {
    return redirectWithError("github_missing_code");
  }

  // Validate the CSRF state against the cookie set in /start.
  const stateCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GITHUB_OAUTH_STATE_COOKIE}=`));

  let expectedState: string | null = null;
  let nextPath = "/shell";
  if (stateCookie) {
    try {
      const raw = decodeURIComponent(stateCookie.split("=").slice(1).join("="));
      const parsed = JSON.parse(raw) as { state?: string; next?: string };
      expectedState = parsed.state ?? null;
      nextPath = sanitizeNextPath(parsed.next ?? null, "/shell");
    } catch {
      expectedState = null;
    }
  }

  if (!expectedState || expectedState !== returnedState) {
    return redirectWithError("github_state_mismatch");
  }

  const trustedToken = process.env.TRUSTED_INTERNAL_AUTH_TOKEN;
  if (!trustedToken) {
    return redirectWithError("github_server_misconfigured");
  }

  try {
    const token = await exchangeCodeForToken(code);
    const identity = await fetchGithubIdentity(token.accessToken);

    const client = getConvexHttpClient();
    const result = await client.mutation(api.github.findOrCreateGithubUser, {
      _internalAuthToken: trustedToken,
      githubUserId: identity.githubUserId,
      githubLogin: identity.githubLogin,
      githubName: identity.githubName,
      githubEmail: identity.githubEmail,
      githubAvatarUrl: identity.githubAvatarUrl,
      accessToken: token.accessToken,
      scopes: token.scopes,
      tokenType: token.tokenType,
    });

    const sessionToken = generateOpaqueToken();
    await client.mutation(api.auth.createSession, {
      userId: result.userId,
      tokenHash: hashOpaqueToken(sessionToken),
      userAgent: request.headers.get("user-agent") ?? undefined,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
    });

    // New users go to onboarding; returning users go to their destination.
    const destination = result.isNewUser ? "/initialize" : nextPath;
    const response = NextResponse.redirect(`${getAppUrl()}${destination}`);

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE,
    });
    // Clear the one-time state cookie.
    response.cookies.set(GITHUB_OAUTH_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "github_auth_failed";
    return redirectWithError(reason);
  }
}
