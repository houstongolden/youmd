"use client";

import { ExternalButtonLink } from "@/components/ui/Button";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";
import FadeUp from "./FadeUp";

const bundleTree = [
  ".youmd/",
  "  profile/about.md",
  "  preferences/agent.md",
  "  directives/agent.md",
  "  skills/",
  "  you.json",
];

const principles = ["plain markdown", "JSON + API", "MCP-ready", "self-hostable"];

const OpenSpec = () => (
  <Section compact>
    <Container>
      <div className="border-y border-border py-10 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <FadeUp>
            <SectionHeader
              eyebrow="open standard"
              title="you own the files"
              description="you/v1 is plain markdown that compiles into the context agents need. no walled garden, no proprietary prompt vault."
              className="mb-0"
            />
            <div className="mt-5 flex flex-wrap gap-2">
              {principles.map((principle) => (
                <span
                  key={principle}
                  className="border border-accent/20 px-2.5 py-1 font-mono text-[10px] text-accent/70"
                >
                  {principle}
                </span>
              ))}
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="grid gap-4 md:grid-cols-[1fr_0.78fr]">
              <TerminalCard title="tree .youmd/" bodyClassName="p-4">
                <pre className="font-mono text-[12px] leading-[1.75] text-muted-foreground/70">
                  {bundleTree.map((line) => (
                    <div key={line} className={line.endsWith("/") ? "text-accent/75" : ""}>
                      {line}
                    </div>
                  ))}
                </pre>
              </TerminalCard>

              <Card padding="compact" className="flex flex-col justify-between gap-5">
                <div>
                  <p className="font-mono text-[12px] text-foreground/85">
                    export anywhere
                  </p>
                  <code className="mt-3 block font-mono text-[12px] leading-relaxed text-accent">
                    $ youmd export
                  </code>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                    Drop the bundle into a repo, serve it from a URL, or connect through MCP.
                  </p>
                </div>
                <ExternalButtonLink
                  href="https://github.com/houstongolden/youmd"
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  GitHub
                </ExternalButtonLink>
              </Card>
            </div>
          </FadeUp>
        </div>
      </div>
    </Container>
  </Section>
);

export default OpenSpec;
