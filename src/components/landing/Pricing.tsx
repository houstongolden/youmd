"use client";

import FadeUp from "./FadeUp";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const freeFeatures = [
  "public agent brain/profile",
  "runtime + web shell",
  "context links + protected API",
  "bundled skills + starter stacks",
];

const proFeatures = [
  "private vault + richer scoping",
  "source auto-syncs",
  "skill publishing",
  "analytics + custom domains",
];

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 font-mono text-[12px] leading-relaxed text-muted-foreground">
          <span className="mt-[2px] text-accent/70" aria-hidden="true">
            /
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const Pricing = () => (
  <Section id="pricing">
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="pricing"
          title="core brain stays free"
          description="Pay for power features later, not for being readable by your own tools."
          align="center"
        />
      </FadeUp>

      <div className="mx-auto grid max-w-[860px] gap-5 md:grid-cols-2">
        <FadeUp delay={0.05}>
          <Card padding="default" className="h-full">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/55">
                  free.plan
                </p>
                <h3 className="mt-3 font-mono text-[18px] text-foreground">Free</h3>
              </div>
              <p className="font-mono text-[28px] leading-none text-foreground">
                $0
                <span className="ml-1 text-[11px] text-muted-foreground">forever</span>
              </p>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              Everything needed to create, publish, and share your public brain.
            </p>
            <div className="mt-6">
              <FeatureList items={freeFeatures} />
            </div>
            <ButtonLink href="/create" variant="primary" size="md" className="mt-7 w-full">
              create your you.md
            </ButtonLink>
          </Card>
        </FadeUp>

        <FadeUp delay={0.12}>
          <Card padding="default" className="h-full border-accent/35">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/70">
                  pro.plan
                </p>
                <h3 className="mt-3 font-mono text-[18px] text-foreground">Pro</h3>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent/75">
                  recommended
                </p>
                <p className="mt-2 font-mono text-[28px] leading-none text-foreground">
                  $29
                  <span className="ml-1 text-[11px] text-muted-foreground">/mo</span>
                </p>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              For builders who live across agents every day and need deeper control.
            </p>
            <div className="mt-6">
              <FeatureList items={proFeatures} />
            </div>
            <ButtonLink href="/create" variant="secondary" size="md" className="mt-7 w-full">
              start free, upgrade later
            </ButtonLink>
          </Card>
        </FadeUp>
      </div>

      <FadeUp delay={0.18}>
        <p className="mx-auto mt-8 max-w-[560px] text-center font-mono text-[11px] leading-relaxed text-muted-foreground/55">
          your public brain, public profile, and core agent access remain free.
        </p>
      </FadeUp>
    </Container>
  </Section>
);

export default Pricing;
