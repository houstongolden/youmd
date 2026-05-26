"use client";

import Link from "next/link";
import FadeUp from "./FadeUp";
import { ButtonLink } from "@/components/ui/Button";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const useCases = [
  {
    label: "personal stack",
    title: "your default agent operating layer",
    desc: "identity, preferences, project context, starter skills, and memory-safe routing for Claude Code, Codex, and Cursor.",
  },
  {
    label: "project stack",
    title: "repo-specific workflows",
    desc: "ship the commands, review patterns, docs, and smoke tests an agent should use before touching a codebase.",
  },
  {
    label: "team stack",
    title: "shared taste and playbooks",
    desc: "give teammates and collaborators a scoped package without dumping your private brain into local files.",
  },
  {
    label: "public stack",
    title: "open agent workflows",
    desc: "publish useful skills, prompts, examples, and adapter files while protected memory stays behind You.md auth.",
  },
];

const stackFiles = [
  "youstack.json",
  "skills/youstack-start/SKILL.md",
  "workflows/startup.md",
  "docs/quickstart.md",
  "tests/smoke.md",
  ".codex/skills/youstack-start",
];

const YouStacks = () => (
  <Section id="youstacks" compact>
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="youstacks"
          title="portable execution packages for your agents"
          description="You.md is the brain. YouStacks are the installable layer that tells Claude Code, Codex, Cursor, and other hosts how to use that brain safely."
        />
      </FadeUp>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <FadeUp delay={0.08}>
          <TerminalCard title="personal-youstack/">
            <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="font-mono text-[13px] leading-relaxed text-foreground/85">
                  local first. brain protected.
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  A stack can run as static files: skills, workflows, prompts,
                  docs, examples, and host adapters. It calls You.md API/MCP only
                  when it needs protected memory, private context, sync, tokens,
                  connected tools, or server-side actions.
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
            $ youmd stack smoke --path cli/examples/youstack-personal && youmd stack link --hosts codex,claude,cursor --target .
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
