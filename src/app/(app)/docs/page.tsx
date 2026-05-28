import type { Metadata } from "next";
import DocsContent from "./docs-content";

export const metadata: Metadata = {
  title: "Developer Docs — you.md",
  description:
    "Build with the You.md agent brain, named YouStacks, runtime installer, protected API/MCP, context links, skills, schema, and agent workflows.",
  openGraph: {
    title: "Developer Docs — you.md",
    description:
      "Build with the You.md agent brain, named YouStacks, runtime installer, protected API/MCP, context links, skills, schema, and agent workflows.",
    url: "https://you.md/docs",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Developer Docs — you.md",
    description:
      "Build with the You.md agent brain, named YouStacks, runtime installer, protected API/MCP, context links, skills, schema, and agent workflows.",
  },
  alternates: {
    canonical: "https://you.md/docs",
  },
};

export default function DocsPage() {
  return <DocsContent />;
}
