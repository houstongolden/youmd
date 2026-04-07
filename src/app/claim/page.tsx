import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Claim Your Username — you.md",
  description:
    "Claim your unique username on the you.md network. Your identity protocol for the agent internet.",
  openGraph: {
    title: "Claim Your Username — you.md",
    description:
      "Claim your unique username on the you.md network. Your identity protocol for the agent internet.",
    url: "https://you.md/claim",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Claim Your Username — you.md",
    description:
      "Claim your unique username on the you.md network. Your identity protocol for the agent internet.",
  },
};

export const dynamic = "force-dynamic";

export default function ClaimPage() {
  redirect("/sign-up");
}
