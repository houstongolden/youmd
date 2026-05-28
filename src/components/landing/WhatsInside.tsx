"use client";

import FadeUp from "./FadeUp";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const items = [
  {
    label: "01 brain",
    title: "who you are and what matters",
    desc: "identity, preferences, voice, memory, private context, active projects, provenance, and trust rules.",
  },
  {
    label: "02 stacks",
    title: "your expertise packaged",
    desc: "named YouStacks for coding, research, content, growth, operations, or any domain-specific workflow.",
  },
  {
    label: "03 runtime",
    title: "one install for every host",
    desc: "curl-installed helper layer for Claude Code, Codex, Cursor, local files, MCP, smoke checks, and auto-update.",
  },
  {
    label: "04 protected api/mcp",
    title: "sensitive things stay gated",
    desc: "private memory, tokens, connected tools, repo sync, and server-side actions require scoped authenticated access.",
  },
];

const codeLines = [
  "brain/profile.md",
  "brain/memory.json",
  "stacks/coding/youstack.json",
  "stacks/content/youstack.json",
  "runtime/install.sh",
  "protected/mcp + api grants",
];

const WhatsInside = () => (
  <Section id="spec">
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="simple model"
          title="brain, stacks, runtime, protected access"
          description="The whole product should reduce to these four ideas. Everything else is plumbing."
        />
      </FadeUp>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <FadeUp delay={0.08}>
          <TerminalCard title="you.md product model">
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
