"use client";

import FadeUp from "./FadeUp";
import { ButtonLink } from "@/components/ui/Button";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const primaryTools = ["Claude Code", "Cursor", "Codex", "ChatGPT"];
const methods = [
  ["context links", "https://www.you.md/ctx/user/token"],
  ["protected MCP", "npx --yes youmd@latest mcp"],
  ["plain text", "GET /ctx/user/token"],
  ["protected API", "GET /api/v1/profiles?username=x"],
];

const Integrations = () => (
  <Section compact>
    <Container>
      <FadeUp>
        <SectionHeader
          eyebrow="works everywhere"
          title="runtime first, API when needed"
          description="Most agents start from local files and public context. Private brain retrieval, tokens, sync, and connected actions go through protected API/MCP."
        />
      </FadeUp>

      <div className="grid gap-5 lg:grid-cols-[0.84fr_1.16fr]">
        <FadeUp delay={0.08}>
          <Card padding="default" className="h-full">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-accent/70">
              primary agents
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {primaryTools.map((tool) => (
                <div key={tool} className="border border-border bg-background px-3 py-2.5">
                  <p className="font-mono text-[12px] text-foreground/82">{tool}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              plus any agent that can read a URL, file, MCP server, or pasted context block.
            </p>
          </Card>
        </FadeUp>

        <div className="grid gap-5 md:grid-cols-2">
          <FadeUp delay={0.14}>
            <TerminalCard title="for users">
              <p className="font-mono text-[15px] leading-relaxed text-foreground/85">
                carry your context between tools
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Share one scoped link and the agent gets your public brain,
                preferences, voice, active projects, and public stacks before
                the work starts.
              </p>
              <code className="mt-5 block border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-accent">
                Read my identity first: https://www.you.md/ctx/houston/sk...
              </code>
            </TerminalCard>
          </FadeUp>

          <FadeUp delay={0.2}>
            <TerminalCard title="for builders">
              <p className="font-mono text-[15px] leading-relaxed text-foreground/85">
                integrate the brain without a profile form
              </p>
              <div className="mt-4 space-y-3">
                {methods.map(([label, code]) => (
                  <div key={label} className="grid gap-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent/60">
                      {label}
                    </p>
                    <code className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground/72">
                      {code}
                    </code>
                  </div>
                ))}
              </div>
              <ButtonLink href="/docs" variant="terminal-link" size="sm" className="mt-4 justify-start">
                read docs
              </ButtonLink>
            </TerminalCard>
          </FadeUp>
        </div>
      </div>
    </Container>
  </Section>
);

export default Integrations;
