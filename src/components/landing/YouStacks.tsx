"use client";

import Link from "next/link";
import FadeUp from "./FadeUp";
import { ButtonLink } from "@/components/ui/Button";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const useCases = [
  {
    label: "expertise stack",
    title: "package how you think",
    desc: "turn your years of taste, skills, prompts, sub-agents, review loops, examples, and favorite workflows into an installable stack.",
  },
  {
    label: "project stack",
    title: "make a repo agent-ready",
    desc: "ship the commands, repo rules, docs, QA flow, smoke tests, and release habits an agent should follow before touching code.",
  },
  {
    label: "team stack",
    title: "share the playbook",
    desc: "give teammates, friends, or contractors your operating system without handing over your whole private brain.",
  },
  {
    label: "public stack",
    title: "publish a useful agent kit",
    desc: "release an open stack of skills and workflows people can inspect, fork, install, and run in their own agents.",
  },
];

const stackFiles = [
  "youstack.json",
  "skills/founder-review/SKILL.md",
  "skills/growth-writing/SKILL.md",
  "subagents/operator.md",
  "workflows/release-review.md",
  "examples/golden-prompts.md",
];

const YouStacks = () => (
  <Section id="youstacks" compact>
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="youstacks"
          title="package your expertise into your own GStack"
          description="A YouStack bottles how you work: years of expertise, skills, sub-agents, prompts, workflows, taste, examples, tool rules, and safe You.md memory access that any agent can install."
        />
      </FadeUp>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <FadeUp delay={0.08}>
          <TerminalCard title="personal-youstack/">
            <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="font-mono text-[13px] leading-relaxed text-foreground/85">
                  like GStack, but yours.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  If GStack packages founder operating wisdom into agent
                  skills and workflows, YouStacks let anyone do that for their
                  own domain. Local files carry the reusable expertise; You.md
                  API/MCP protects private memory and connected actions.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <ButtonLink href="/docs#youstacks" variant="primary" size="sm">
                    read stack docs
                  </ButtonLink>
                  <ButtonLink href="/docs#youstacks-api-mcp" variant="secondary" size="sm">
                    API + MCP
                  </ButtonLink>
                </div>
              </div>
              <pre className="font-mono text-[11px] leading-[1.85] text-muted-foreground/72">
                {stackFiles.map((file, index) => (
                  <div key={file}>
                    <span className="text-muted-foreground/25">
                      {String(index + 1).padStart(2, "0")} |
                    </span>{" "}
                    <span className={index === 0 ? "text-accent" : ""}>{file}</span>
                  </div>
                ))}
              </pre>
            </div>
          </TerminalCard>
        </FadeUp>

        <div className="grid gap-4 sm:grid-cols-2">
          {useCases.map((item, index) => (
            <FadeUp key={item.label} delay={0.12 + index * 0.04}>
              <Card padding="compact" className="h-full">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/65">
                  {item.label}
                </p>
                <h3 className="mt-3 font-mono text-[15px] leading-snug text-foreground/90">
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

      <FadeUp delay={0.24}>
        <div className="mt-5 grid gap-3 border border-border bg-[hsl(var(--bg-raised))] p-4 md:grid-cols-[1fr_auto] md:items-center">
          <code className="break-all font-mono text-[11px] leading-relaxed text-accent">
            $ youmd stack link --path stacks/my-founder-stack --hosts codex,claude,cursor --target .
          </code>
          <Link
            href="/docs#youstacks-examples"
            className="inline-flex min-h-[44px] items-center justify-start font-mono text-[11px] text-muted-foreground transition-colors hover:text-accent md:justify-end"
          >
            examples in docs
          </Link>
        </div>
      </FadeUp>
    </Container>
  </Section>
);

export default YouStacks;
