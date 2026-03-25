import type { Metadata } from "next";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import FounderQuote from "@/components/landing/FounderQuote";
import ProfilesShowcase from "@/components/landing/ProfilesShowcase";
import ProblemStrip from "@/components/landing/ProblemStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import WhatsInside from "@/components/landing/WhatsInside";
import PortraitSection from "@/components/landing/PortraitSection";
import OpenSpec from "@/components/landing/OpenSpec";
import Integrations from "@/components/landing/Integrations";
import Pricing from "@/components/landing/Pricing";
import CTAFooter from "@/components/landing/CTAFooter";

export const metadata: Metadata = {
  title: "you.md — Your identity file for the agent internet",
  description:
    "Claim your identity. Onboard any AI in seconds. The structured, portable identity bundle that gives every agent context about who you are.",
  openGraph: {
    title: "you.md — Identity as Code",
    description:
      "Your identity file for the agent internet. Onboard any AI in seconds.",
    url: "https://you.md",
    siteName: "you.md",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "you.md — Identity as Code",
    description:
      "Your identity file for the agent internet. Onboard any AI in seconds.",
  },
  alternates: {
    canonical: "https://you.md",
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <FounderQuote />
      <ProfilesShowcase />
      <ProblemStrip />
      <HowItWorks />
      <WhatsInside />
      <PortraitSection />
      <OpenSpec />
      <Integrations />
      <Pricing />
      <CTAFooter />
    </div>
  );
}
