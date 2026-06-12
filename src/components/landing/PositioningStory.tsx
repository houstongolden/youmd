"use client";

import Link from "next/link";
import FadeUp from "./FadeUp";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const pains = [
  "Every new agent session starts cold, so you repeat your preferences, projects, and background again.",
  "Great prompts and workflows stay trapped inside one tool instead of following you everywhere.",
  "Private context is either missing entirely or shoved into random docs, notes, and chat threads.",
];

const advantages = [
  {
    label: "one identity layer",
    body: "Your public profile, preferences, memory, project context, and private retrieval rules live in one place instead of scattered across tools.",
  },
  {
    label: "one runtime install",
    body: "Install once, then let Claude Code, Codex, Cursor, ChatGPT, and future agents start from the same context and stack rules.",
  },
  {
    label: "one protected boundary",
    body: "Public context stays easy to share. Private memory, repo data, and connected tools stay behind scoped API and MCP access when they are actually needed.",
  },
];

const steps = [
  ["build your you.md", "Create your identity layer once, including public context and the private context you want agents to retrieve safely."],
  ["add your stacks", "Package skills, workflows, prompts, and operating rules into named expertise stacks for different kinds of work."],
  ["use any agent", "Start a new session and the agent gets your context, your defaults, and your best workflows instead of a blank slate."],
];

export default function PositioningStory() {
  return (
    <Section className="border-y border-border bg-background">
      <Container size="narrow" className="space-y-14">
        <FadeUp>
          <div className="mx-auto max-w-[720px] text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
              -- why this matters --
            </p>
            <h2 className="mt-4 font-mono text-[28px] leading-[1.12] text-foreground md:text-[38px]">
              the problem is not prompts.
              <br />
              it is context loss.
            </h2>
            <p className="mx-auto mt-5 max-w-[640px] text-[16px] leading-[1.7] text-muted-foreground">
              Most AI products act like each conversation is a fresh start.
              That forces people to re-explain who they are, what they are working on,
              how they like to operate, and which workflows are actually good.
            </p>
          </div>
        </FadeUp>

        <FadeUp delay={0.06}>
          <TerminalCard title="what first-time visitors already feel" bodyClassName="space-y-4">
            {pains.map((pain, index) => (
              <div key={pain} className="border-l border-border pl-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent/70">
                  0{index + 1}
                </p>
                <p className="mt-2 text-[15px] leading-[1.75] text-muted-foreground">
                  {pain}
                </p>
              </div>
            ))}
          </TerminalCard>
        </FadeUp>

        <FadeUp delay={0.1}>
          <div className="space-y-4">
            <div className="max-w-[720px]">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent/75">
                -- why you.md is different --
              </p>
              <h3 className="mt-4 font-mono text-[24px] leading-[1.2] text-foreground md:text-[32px]">
                one portable brain, one runtime, one safe boundary for private context
              </h3>
            </div>

            <div className="space-y-3">
              {advantages.map((item) => (
                <TerminalCard key={item.label} title={item.label} bodyClassName="pt-4">
                  <p className="text-[15px] leading-[1.75] text-muted-foreground">
                    {item.body}
                  </p>
                </TerminalCard>
              ))}
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.14}>
          <TerminalCard title="how it works" bodyClassName="space-y-5">
            {steps.map(([label, body], index) => (
              <div key={label} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-[2px] border border-border font-mono text-[11px] text-accent">
                  {index + 1}
                </div>
                <div>
                  <p className="font-mono text-[12px] text-foreground">{label}</p>
                  <p className="mt-2 text-[15px] leading-[1.7] text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </TerminalCard>
        </FadeUp>

        <FadeUp delay={0.18}>
          <div className="flex flex-col items-center gap-3 border-t border-border pt-8 text-center sm:flex-row sm:justify-center sm:text-left">
            <ButtonLink href="/create" variant="primary" size="lg">
              create your you.md
            </ButtonLink>
            <ButtonLink href="/docs" variant="secondary" size="lg">
              read docs
            </ButtonLink>
            <Link
              href="/profiles"
              className="font-mono text-[11px] text-muted-foreground/62 transition-colors hover:text-accent"
            >
              &gt; view live profiles
            </Link>
          </div>
        </FadeUp>
      </Container>
    </Section>
  );
}
