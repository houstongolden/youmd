import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HandlePreview from "@/components/landing/HandlePreview";
import PositioningStory from "@/components/landing/PositioningStory";
import CTAFooter from "@/components/landing/CTAFooter";

export const metadata: Metadata = {
  title: "you.md — Stop re-explaining yourself to every agent",
  description:
    "You.md gives every AI agent your context, preferences, memory, and best workflows through one runtime, so new sessions stop starting from zero.",
  openGraph: {
    title: "you.md — Stop re-explaining yourself to every agent",
    description:
      "Build one identity and workflow layer for every AI agent. Public context stays easy to share. Private context stays protected.",
    url: "https://www.you.md",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Stop re-explaining yourself to every agent",
    description:
      "One runtime for your context, memory, preferences, and best workflows across Claude Code, Codex, Cursor, ChatGPT, and more.",
  },
  alternates: {
    canonical: "https://www.you.md",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main">
        <Hero />
        <HandlePreview />
        <PositioningStory />
        <CTAFooter />
      </main>
    </div>
  );
}
