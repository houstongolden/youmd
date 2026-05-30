import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import YouStacks from "@/components/landing/YouStacks";
import OpenSpec from "@/components/landing/OpenSpec";
import CTAFooter from "@/components/landing/CTAFooter";

export const metadata: Metadata = {
  title: "you.md — Your agent brain and expertise stacks",
  description:
    "Give Claude Code, Codex, Cursor, and every AI agent your brain, memory, preferences, project context, and named YouStacks of expertise through one simple runtime.",
  openGraph: {
    title: "you.md — Agent brain + expertise stacks",
    description:
      "Install once. Agents get your brain, your named expertise stacks, and protected API/MCP access only when private context or connected tools are needed.",
    url: "https://you.md",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Agent brain + expertise stacks",
    description:
      "Give every agent your brain, memory, project context, and named YouStacks of expertise through one curl-installed runtime.",
  },
  alternates: {
    canonical: "https://you.md",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main">
        <Hero />
        <YouStacks />
        <OpenSpec />
        <CTAFooter />
      </main>
    </div>
  );
}
