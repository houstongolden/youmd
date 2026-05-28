"use client";

import FadeUp from "./FadeUp";
import { Card, TerminalCard } from "@/components/ui/Card";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const painPoints = [
  "every new agent asks for your role, stack, tone, and current project",
  "system prompts rot inside individual tools instead of traveling with you",
  "new repos start cold, without your skills, preferences, or project structure",
];

const beforeLines = [
  ["agent", "what do you do? what stack do you use?"],
  ["you", "founder. ai tools. typescript, next.js, convex..."],
  ["agent", "what tone should i use?"],
  ["you", "direct. no fluff. i have typed this everywhere."],
];

const afterLines = [
  ["ctx", "loading houston's you.md brain + stacks..."],
  ["agent", "i see your preferences, current projects, and coding stack. i’ll use the terminal-native style and pull project context first."],
  ["you", "new feature for the skill system."],
  ["agent", "on it. running the repo startup workflow and keeping private memory behind MCP."],
];

function Transcript({
  title,
  lines,
  emphasis = false,
}: {
  title: string;
  lines: string[][];
  emphasis?: boolean;
}) {
  return (
    <TerminalCard title={title} className={emphasis ? "border-accent/30" : "opacity-80"}>
      <div className="space-y-2.5">
        {lines.map(([role, text]) => (
          <div key={`${role}-${text}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 font-mono text-[11px] leading-relaxed">
            <span className={emphasis && role !== "you" ? "text-accent/70" : "text-muted-foreground/45"}>
              {role}
            </span>
            <span className={emphasis ? "text-foreground/78" : "text-muted-foreground/58"}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </TerminalCard>
  );
}

const ProblemStrip = () => {
  return (
    <Section>
      <Container>
        <FadeUp>
          <SectionHeader
            eyebrow="problem"
            title="agents start cold"
            description="The current agent internet treats identity, memory, and workflows as disposable session input. you.md turns them into a brain and named stacks agents can actually use."
          />
        </FadeUp>

        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <FadeUp delay={0.08}>
            <Card padding="default">
              <p className="font-mono text-[13px] leading-relaxed text-foreground/85">
                the cold start tax:
              </p>
              <div className="mt-5 space-y-4">
                {painPoints.map((item) => (
                  <div key={item} className="border-l border-accent/30 pl-4">
                    <p className="text-[14px] leading-relaxed text-muted-foreground">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-6 font-mono text-[12px] leading-relaxed text-accent/80">
                you shouldn&apos;t have to onboard yourself to your own tools.
              </p>
            </Card>
          </FadeUp>

          <FadeUp delay={0.16}>
            <div className="grid gap-4 md:grid-cols-2">
              <Transcript title="before you.md" lines={beforeLines} />
              <Transcript title="with you.md" lines={afterLines} emphasis />
            </div>
          </FadeUp>
        </div>
      </Container>
    </Section>
  );
};

export default ProblemStrip;
