import type { Metadata } from "next";
import { InitializeContent } from "./initialize-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Initialize — you.md",
  description:
    "Set up your identity context for the agent internet. Guided onboarding for your you.md profile.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function InitializePage() {
  return <InitializeContent />;
}
