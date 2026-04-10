import type { Metadata } from "next";
import DocsContent from "./docs-content";

export const metadata: Metadata = {
  title: "Documentation — you.md",
  description:
    "Learn how to create, manage, and share your identity context for the agent internet.",
  openGraph: {
    title: "Documentation — you.md",
    description:
      "Learn how to create, manage, and share your identity context for the agent internet.",
    url: "https://you.md/docs",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Documentation — you.md",
    description:
      "Learn how to create, manage, and share your identity context for the agent internet.",
  },
  alternates: {
    canonical: "https://you.md/docs",
  },
};

export default function DocsPage() {
  return <DocsContent />;
}
