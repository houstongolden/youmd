import type { Metadata } from "next";
import { redirect } from "next/navigation";

/**
 * /claim is a legacy URL alias from when "claim username" was a separate
 * step in the sign-up flow. The functionality has since been merged into
 * /initialize (which runs the boot animation, claims the username, and
 * launches the onboarding agent in one flow).
 *
 * We keep the route as a stable redirect target for any cached links,
 * old onboarding flows, or stale browser history entries that still
 * point at /claim after the passwordless auth migration.
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
