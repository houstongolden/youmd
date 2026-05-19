"use client";

import FadeUp from "./FadeUp";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const items = [
  {
    label: "profile",
    title: "who you are",
    desc: "bio, role, links, proof, and current work agents can cite without asking.",
  },
  {
    label: "voice",
    title: "how you sound",
    desc: "writing style, tone rules, and platform-specific communication preferences.",
  },
  {
    label: "directives",
    title: "how agents should work",
    desc: "decision rules, never-do lists, action bias, and session behavior.",
  },
  {
    label: "projects",
    title: "what you are building",
    desc: "active repos, goals, architecture context, TODOs, and project memory.",
  },
  {
    label: "skills",
    title: "portable agent abilities",
    desc: "identity-aware skills for context setup, voice sync, scaffolding, and review.",
  },
  {
    label: "private",
    title: "controlled context",
    desc: "scoped notes and links for trusted agents, separate from the public profile.",
  },
];

const codeLines = [
  "schema: you/v1",
  "profile/about.md",
  "preferences/agent.md",
  "directives/agent.md",
  "skills/project-context-init",
  "you.json",
];

const WhatsInside = () => (
  <Section id="spec">
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="what's inside"
          title="a machine-readable identity bundle"
          description="Plain files for humans, structured JSON and context links for agents."
        />
      </FadeUp>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <FadeUp delay={0.08}>
          <TerminalCard title="you.md identity context">
            <pre className="font-mono text-[12px] leading-[1.8] text-muted-foreground/70">
              {codeLines.map((line, index) => (
                <div key={line}>
                  <span className="text-muted-foreground/25">
                    {String(index + 1).padStart(2, "0")} |
                  </span>{" "}
                  <span className={index === 0 ? "text-accent" : "text-foreground/72"}>
                    {line}
                  </span>
                </div>
              ))}
            </pre>
          </TerminalCard>
        </FadeUp>

        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, index) => (
            <FadeUp key={item.label} delay={0.1 + index * 0.04}>
              <Card padding="compact" className="h-full">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/65">
                  {item.label}
                </p>
                <h3 className="mt-3 font-mono text-[16px] leading-snug text-foreground/90">
                  {item.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </Card>
            </FadeUp>
          ))}
        </div>
      </div>
    </Container>
  </Section>
);

export default WhatsInside;
