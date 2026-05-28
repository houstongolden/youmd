"use client";

import Link from "next/link";
import PixelYOU from "./PixelYOU";
import HeroPortrait from "./HeroPortrait";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const proofItems = ["Claude Code", "Cursor", "Codex", "ChatGPT"];

const terminalLines = [
  ["$ curl -fsSL https://you.md/install.sh | bash", "install the You.md runtime"],
  ["$ you", "build and sync your agent brain"],
  ["$ /stacks", "choose the expertise stacks agents should use"],
];

const Hero = () => {
  return (
    <Section
      hero
      className="flex min-h-[720px] items-center overflow-hidden pt-24 md:min-h-[calc(100svh-16px)]"
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
              agent brain + expertise stacks
            </p>

            <h1 className="max-w-[720px] font-mono text-[44px] leading-[1.02] text-foreground sm:text-[56px] lg:text-[64px]">
              give every agent your brain and best workflows
            </h1>

            <p className="mt-6 max-w-[620px] text-[17px] leading-[1.58] text-muted-foreground md:text-[18px]">
              Install once. You.md gives Claude Code, Codex, Cursor, ChatGPT,
              and any agent your public profile, memory, preferences, project context,
              and named stacks of skills and workflows you want it to use.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/create" variant="primary" size="lg">
                Create your you.md
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                Install runtime
              </ButtonLink>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] text-muted-foreground/55">
              <span className="text-accent/70">works with</span>
              {proofItems.map((item) => (
                <span key={item} className="border-l border-border pl-3">
                  {item}
                </span>
              ))}
              <span className="border-l border-border pl-3">+ any URL-aware agent</span>
            </div>
          </div>

          <div className="grid gap-4">
            <Link href="/houstongolden" className="group block" aria-label="view houstongolden live profile">
              <TerminalCard title="live portrait preview" bodyClassName="p-3">
                <div className="aspect-[1.16/1] overflow-hidden rounded-[2px] border border-border bg-background">
                  <HeroPortrait />
                </div>
                <p className="mt-3 text-center font-mono text-[10px] text-muted-foreground/45 transition-colors group-hover:text-accent/75">
                  view live profile
                </p>
              </TerminalCard>
            </Link>

            <TerminalCard title="context pipeline" bodyClassName="space-y-3">
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
