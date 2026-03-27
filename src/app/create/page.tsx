import type { Metadata } from "next";
import { CreateContent } from "./create-content";

export const metadata: Metadata = {
  title: "Create Your Identity — you.md",
  description:
    "Pick a username and create your identity file for the agent internet. Sign up in seconds.",
  openGraph: {
    title: "Create Your Identity — you.md",
    description:
      "Pick a username and create your identity file for the agent internet. Sign up in seconds.",
    url: "https://you.md/create",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create Your Identity — you.md",
    description:
      "Pick a username and create your identity file for the agent internet. Sign up in seconds.",
  },
  alternates: {
    canonical: "https://you.md/create",
  },
};

export default function CreatePage() {
  return <CreateContent />;
}
