import { NextResponse } from "next/server";
import { getConvexHttpClient, api } from "@/lib/convex-http";
import {
  getSessionTokenFromCookies,
  hashOpaqueToken,
} from "@/lib/auth-session";
import { getAppUrl } from "@/lib/github-oauth";

/**
 * GitHub App post-install "Setup URL" callback (Phase 5). GitHub redirects here
 * with `installation_id` after a user installs the You.md GitHub App. We attach
 * the installation to the logged-in user's connection so repo ops can use
 * fine-grained installation tokens.
 *
 * Configure this URL as the App's "Setup URL" in the App settings:
 *   <app>/api/auth/github/app/setup
 */
export async function GET(request: Request) {
  const appUrl = getAppUrl();
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));

  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.redirect(`${appUrl}/shell?github_app=missing`);
  }

  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.redirect(
      `${appUrl}/sign-in?next=${encodeURIComponent("/shell")}`
    );
  }

  const client = getConvexHttpClient();
  const session = await client.query(api.auth.validateSession, {
    tokenHash: hashOpaqueToken(token),
  });
  if (!session) {
    return NextResponse.redirect(
      `${appUrl}/sign-in?next=${encodeURIComponent("/shell")}`
    );
  }

  try {
    await client.mutation(api.github.setInstallation, {
      clerkId: session.clerkId,
      _internalAuthToken: process.env.TRUSTED_INTERNAL_AUTH_TOKEN,
      installationId,
    });
    return NextResponse.redirect(`${appUrl}/shell?github_app=installed`);
  } catch {
    return NextResponse.redirect(`${appUrl}/shell?github_app=error`);
  }
}
