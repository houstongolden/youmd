"use client";

import FadeUp from "./FadeUp";
import { CliInstallTabs } from "@/components/install/CliInstallTabs";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";
import { TerminalCard } from "@/components/ui/Card";

const steps = [
  {
    num: "01",
    title: "install the runtime",
    cmd: "curl -fsSL https://you.md/install.sh | bash",
    desc: "one command gives local agents the You.md helper, native skills, auto-upgrade, MCP, and stack checks.",
  },
  {
    num: "02",
    title: "build your brain",
    cmd: "you",
    desc: "U captures identity, preferences, memory, project context, voice, and trust rules.",
  },
  {
    num: "03",
    title: "use named stacks",
    cmd: "/stacks",
    desc: "choose coding, research, content, BAMFStack, or any named expertise package the agent should follow.",
  },
  {
    num: "04",
    title: "protect sensitive access",
    cmd: "youmd mcp --install codex",
    desc: "private memory, repo sync, tokens, connected tools, and remote actions stay behind scoped You.md API/MCP.",
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
              title="one runtime, four simple layers"
              description="Brain, stacks, runtime, protected API/MCP. That is the product model agents and humans should understand."
              className="mb-6"
            />
            <CliInstallTabs
              className="max-w-[520px]"
              title="install"
              helperText="then run you"
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
