import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /claim is a legacy URL alias from when "claim username" was a separate
 * step in the sign-up flow. The functionality has since been merged into
 * /initialize (which runs the boot animation, claims the username, and
 * launches the onboarding agent in one flow).
 *
 * Clerk's `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` env var is set to /claim
 * for legacy reasons, so signed-up users land here. Redirecting straight
 * to /initialize avoids a 3-hop chain (/claim → /sign-up → /shell).
 *
 * This page never renders — the metadata exists only for any direct
 * /claim links that may still be cached by search engines.
 */

export const metadata: Metadata = {
  title: "Claim Your Username — you.md",
  description:
    "Claim your unique username and start onboarding to the you.md identity protocol for the agent internet.",
  // Don't index — this is a redirect-only stub
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default function ClaimPage() {
  redirect("/initialize");
}
