"use client";

import Link from "next/link";
import PixelYOU from "./PixelYOU";
import HeroPortrait from "./HeroPortrait";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const proofItems = ["Claude Code", "Cursor", "Codex", "ChatGPT"];

const terminalLines = [
  ["$ curl -fsSL https://you.md/install.sh | bash", "install one runtime instead of retraining every agent separately"],
  ["$ you", "give the agent your identity, memory, project context, and preferences"],
  ["$ youmd stack link", "make your best workflows portable across tools"],
];

const Hero = () => {
  return (
    <Section
      hero
      className="flex min-h-[720px] items-start overflow-hidden pt-28 md:min-h-[760px] md:pt-24"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[78%] w-[96px] -translate-x-1/2 beam-glow opacity-70" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none opacity-[0.012]"
      >
        <p className="break-all font-mono text-[6px] leading-none text-foreground whitespace-pre-wrap">
          {`$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `.repeat(120)}
        </p>
      </div>

      <Container className="relative z-10">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(360px,0.78fr)] lg:gap-14">
          <div>
            <div className="mb-8 max-w-[160px]" aria-hidden="true">
              <PixelYOU />
            </div>

            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
              context for the agent internet
            </p>

            <h1 className="max-w-[760px] font-mono text-[42px] leading-[1.01] text-foreground sm:text-[56px] lg:text-[66px]">
              stop re-explaining yourself
              <br />
              to every new agent
            </h1>

            <p className="mt-6 max-w-[640px] text-[17px] leading-[1.62] text-muted-foreground md:text-[18px]">
              You.md gives every agent the same portable layer of context:
              your public identity, private memory, preferences, project context,
              and named stacks of workflows. Install once, then stop starting from zero.
            </p>

            <p className="mt-4 max-w-[620px] font-mono text-[12px] leading-[1.7] text-accent/82">
              not another chat app. not another prompt library.
              one system layer between you and every agent you use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/create" variant="primary" size="lg">
                Create your you.md
              </ButtonLink>
              <ButtonLink href="/docs" variant="secondary" size="lg">
                Read docs
              </ButtonLink>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] text-muted-foreground/55">
              <span className="text-accent/70">works across</span>
              {proofItems.map((item) => (
                <span key={item} className="border-l border-border pl-3">
                  {item}
                </span>
              ))}
              <span className="border-l border-border pl-3">+ any URL-aware agent</span>
            </div>
          </div>

          <div className="grid gap-4">
            <TerminalCard title="what agents stop missing" bodyClassName="space-y-3">
              {[
                "who you are",
                "what you are working on",
                "how you like to operate",
                "which workflows are actually good",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 border-b border-border/65 pb-3 last:border-b-0 last:pb-0">
                  <span className="font-mono text-[11px] text-accent">+</span>
                  <p className="text-[14px] leading-relaxed text-muted-foreground">{item}</p>
                </div>
              ))}
            </TerminalCard>

            <Link href="/houstongolden" className="group block" aria-label="view houstongolden live profile">
              <TerminalCard title="live identity surface" bodyClassName="p-3">
                <div className="aspect-[1.22/1] overflow-hidden rounded-[2px] border border-border bg-background">
                  <HeroPortrait />
                </div>
                <p className="mt-3 text-center font-mono text-[10px] text-muted-foreground/45 transition-colors group-hover:text-accent/75">
                  view live profile
                </p>
              </TerminalCard>
            </Link>

            <TerminalCard title="one runtime, three steps" bodyClassName="space-y-3">
              {terminalLines.map(([command, detail]) => (
                <div key={command} className="grid gap-1 font-mono">
                  <code className="text-[12px] leading-relaxed text-accent">{command}</code>
                  <p className="text-[11px] leading-relaxed text-muted-foreground/55">{detail}</p>
                </div>
              ))}
            </TerminalCard>
          </div>
        </div>
      </Container>

      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </Section>
  );
};

export default Hero;
