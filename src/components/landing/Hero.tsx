"use client";

import Link from "next/link";
import PixelYOU from "./PixelYOU";
import HeroPortrait from "./HeroPortrait";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const proofItems = ["Claude Code", "Cursor", "Codex", "ChatGPT"];

const quietPoints = [
  "public identity + private context",
  "one runtime across your agents",
  "stacks for your best workflows",
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
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(320px,0.72fr)] lg:gap-12">
          <div>
            <div className="mb-6 max-w-[160px]" aria-hidden="true">
              <PixelYOU />
            </div>

            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.24em] text-accent/72">
              context for the agent internet
            </p>

            <h1 className="max-w-[760px] font-mono text-[40px] leading-[0.98] tracking-[-0.04em] text-foreground sm:text-[54px] lg:text-[66px]">
              stop re-explaining yourself
              <br />
              to every new agent
            </h1>

            <p className="mt-5 max-w-[570px] text-[16px] leading-[1.46] text-muted-foreground md:text-[17px]">
              One elegant layer for your identity, context, memory, and workflows,
              so the agents you use can meet the same version of you from the first turn.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/44">
              {quietPoints.map((item, index) => (
                <span key={item} className="inline-flex items-center gap-4">
                  {index > 0 ? <span className="h-px w-4 bg-border" aria-hidden="true" /> : null}
                  <span>{item}</span>
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/create" variant="primary" size="lg">
                Create your you.md
              </ButtonLink>
              <ButtonLink href="/docs" variant="secondary" size="lg">
                Read docs
              </ButtonLink>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] text-muted-foreground/50">
              <span className="text-accent/68">works across</span>
              {proofItems.map((item) => (
                <span key={item} className="border-l border-border pl-3">
                  {item}
                </span>
              ))}
              <span className="border-l border-border pl-3">+ any URL-aware agent</span>
            </div>
          </div>

          <div className="lg:pt-3">
            <Link href="/houstongolden" className="group block" aria-label="view houstongolden live profile">
              <TerminalCard title="live identity surface" bodyClassName="space-y-4 p-3">
                <div className="aspect-[1.18/1] overflow-hidden rounded-[2px] border border-border bg-background">
                  <HeroPortrait />
                </div>
                <div className="space-y-3 px-1 pb-1">
                  <p className="max-w-[360px] text-[14px] leading-[1.62] text-muted-foreground/78">
                    A public identity surface for machines, with private context
                    retrieved only when it should be.
                  </p>
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/42 transition-colors group-hover:text-accent/70">
                    <span>profile + memory + stacks</span>
                    <span>&gt; enter</span>
                  </div>
                </div>
              </TerminalCard>
            </Link>
          </div>
        </div>
      </Container>

      <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
    </Section>
  );
};

export default Hero;
