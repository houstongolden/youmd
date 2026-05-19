"use client";

import FadeUp from "./FadeUp";
import { CliInstallTabs } from "@/components/install/CliInstallTabs";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const steps = [
  {
    num: "01",
    title: "create your identity",
    cmd: "youmd init",
    desc: "U builds your profile, voice, preferences, projects, and directives through conversation.",
  },
  {
    num: "02",
    title: "publish/share context",
    cmd: "youmd push",
    desc: "your public profile, scoped context links, API, and markdown bundle become agent-readable.",
  },
  {
    num: "03",
    title: "connect agents",
    cmd: "youmd mcp --install codex",
    desc: "Claude Code, Cursor, Codex, ChatGPT, or any URL-aware agent can load the same context.",
  },
  {
    num: "04",
    title: "sync skills/projects",
    cmd: "youmd skill init-project",
    desc: "bootstrap AGENTS.md, CLAUDE.md, project-context, and identity-aware skills additively.",
  },
];

const HowItWorks = () => (
  <Section id="how-it-works">
    <Container>
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1fr] lg:gap-12">
        <FadeUp>
          <div>
            <SectionHeader
              eyebrow="how it works"
              title="four commands, then every agent starts warmer"
              description="Install once, create once, then point any agent at the context it should have had from the beginning."
              className="mb-6"
            />
            <CliInstallTabs
              className="max-w-[520px]"
              title="install"
              helperText="then run youmd init"
            />
          </div>
        </FadeUp>

        <div className="grid gap-3">
          {steps.map((step, index) => (
            <FadeUp key={step.num} delay={index * 0.05}>
              <TerminalCard title={`${step.num} / ${step.title}`} bodyClassName="py-4">
                <div className="grid gap-2 sm:grid-cols-[190px_minmax(0,1fr)] sm:items-start">
                  <code className="font-mono text-[12px] leading-relaxed text-accent">
                    $ {step.cmd}
                  </code>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {step.desc}
                  </p>
                </div>
              </TerminalCard>
            </FadeUp>
          ))}
        </div>
      </div>
    </Container>
  </Section>
);

export default HowItWorks;
