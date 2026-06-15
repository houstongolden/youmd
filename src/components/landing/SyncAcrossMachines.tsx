"use client";

import FadeUp from "./FadeUp";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const syncPoints = [
  "skills + stacks sync across machines",
  "secrets travel in an encrypted vault",
  "background daemon keeps every mac current",
  "one command to set up a new machine",
];

export default function SyncAcrossMachines() {
  return (
    <Section className="border-b border-border bg-background">
      <Container size="narrow" className="space-y-10">
        <FadeUp>
          <div className="mx-auto max-w-[720px] text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
              -- your whole stack, everywhere --
            </p>
            <h2 className="mt-4 font-mono text-[28px] leading-[1.12] text-foreground md:text-[38px]">
              you.md isn&apos;t just your identity.
              <br />
              it&apos;s your stack, on every machine.
            </h2>
            <p className="mx-auto mt-5 max-w-[600px] text-[16px] leading-[1.7] text-muted-foreground">
              The same skills, stacks, preferences, and context follow you across every Mac.
              Edit a skill on one machine — it updates on the others. Secrets travel
              as an encrypted vault. Your new machine is ready in one command.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.07}>
          <div className="mx-auto max-w-[560px]">
            <TerminalCard title="new machine setup" bodyClassName="space-y-1">
              <p className="font-mono text-[13px] leading-[1.9] text-muted-foreground/80">
                <span className="text-accent/70">$</span>{" "}
                curl -fsSL https://you.md/install.sh | bash
              </p>
              <p className="font-mono text-[13px] leading-[1.9] text-muted-foreground/80">
                <span className="text-accent/70">$</span>{" "}
                youmd machine setup
              </p>
              <p className="mt-3 font-mono text-[11px] text-muted-foreground/42">
                &gt; syncing skills... stacks... vault... done.
              </p>
            </TerminalCard>
          </div>
        </FadeUp>

        <FadeUp delay={0.12}>
          <div className="mx-auto flex max-w-[640px] flex-wrap justify-center gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/44">
            {syncPoints.map((point, index) => (
              <span key={point} className="inline-flex items-center gap-6">
                {index > 0 ? (
                  <span className="h-px w-4 bg-border" aria-hidden="true" />
                ) : null}
                <span>{point}</span>
              </span>
            ))}
          </div>
        </FadeUp>
      </Container>
    </Section>
  );
}
