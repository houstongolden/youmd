import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProfilesShowcase from "@/components/landing/ProfilesShowcase";
import ProblemStrip from "@/components/landing/ProblemStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import WhatsInside from "@/components/landing/WhatsInside";
import YouStacks from "@/components/landing/YouStacks";
import OpenSpec from "@/components/landing/OpenSpec";
import Integrations from "@/components/landing/Integrations";
import FAQ from "@/components/landing/FAQ";
import Pricing from "@/components/landing/Pricing";
import CTAFooter from "@/components/landing/CTAFooter";

export const metadata: Metadata = {
  title: "you.md — Identity context protocol for the agent internet",
  description:
    "An MCP where the context is you. The identity protocol and YouStack layer that gives every AI agent your identity, preferences, projects, skills, and protected memory access.",
  openGraph: {
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. YouStacks give Claude Code, Codex, Cursor, and other agents portable identity, skills, workflows, and safe brain access.",
    url: "https://you.md",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. YouStacks give agents portable identity, skills, workflows, and safe brain access.",
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
        <ProfilesShowcase />
        <ProblemStrip />
        <HowItWorks />
        <WhatsInside />
        <YouStacks />
        <Integrations />
        <OpenSpec />
        <Pricing />
        <FAQ />
        <CTAFooter />
      </main>
    </div>
  );
}
