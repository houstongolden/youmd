import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  GITHUB_OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  getAppUrl,
  isGithubOAuthConfigured,
} from "@/lib/github-oauth";
import { sanitizeNextPath } from "@/lib/redirects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next"), "/shell");

  if (!isGithubOAuthConfigured()) {
    return NextResponse.redirect(
      `${getAppUrl()}/sign-in?error=github_unconfigured`
    );
  }

  const state = randomBytes(16).toString("hex");
  const authorizeUrl = buildAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    GITHUB_OAUTH_STATE_COOKIE,
    JSON.stringify({ state, next }),
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
