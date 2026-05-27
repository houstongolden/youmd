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
    "An MCP where the context is you. Create named GStack-like YouStacks and a GBrain-guided personal brain: skills, sub-agents, workflows, protected memory, and self-improving context for any agent.",
  openGraph: {
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. Name separate YouStacks for each domain, keep a GBrain-guided personal brain, and let reference patterns plus usage improve skills and context.",
    url: "https://you.md",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Identity Context Protocol",
    description:
      "An MCP where the context is you. Build named GStack-like YouStacks and a GBrain-guided personal brain with self-improving skills, workflows, taste, tools, and safe memory access.",
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
