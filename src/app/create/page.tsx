import type { Metadata } from "next";
import { CreateContent } from "./create-content";

export const metadata: Metadata = {
  title: "Create Your Identity — you.md",
  description:
    "Pick a username and create your identity file for the agent internet. No account required.",
  openGraph: {
    title: "Create Your Identity — you.md",
    description:
      "Pick a username and create your identity file for the agent internet. No account required.",
    url: "https://you.md/create",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Your Identity — you.md",
    description:
      "Pick a username and create your identity file for the agent internet. No account required.",
  },
  alternates: {
    canonical: "https://you.md/create",
  },
};

export default function CreatePage() {
  return <CreateContent />;
}
