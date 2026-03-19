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
