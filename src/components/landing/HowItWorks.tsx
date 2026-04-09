"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import FadeUp from "./FadeUp";

const steps = [
  {
    num: "01",
    cmd: "$ npx youmd init",
    desc: "a conversational AI builds your identity through dialogue -- not a form. bio, projects, preferences, voice, directives. your agent learns how you think and what you care about.",
  },
  {
    num: "02",
    cmd: "$ youmd push",
    desc: "your identity goes live at you.md/username. any agent can read it instantly -- public profile + API + context links. skills auto-sync across all your tools.",
  },
  {
    num: "03",
    cmd: "$ youmd skill init-project",
    desc: "start any new project with full identity context. generates CLAUDE.md from your preferences, scaffolds project-context/, and links skills to Claude Code, Cursor, or Codex.",
  },
  {
    num: "04",
    cmd: "$ youmd skill link claude",
    desc: "your identity skills -- voice sync, agent preferences, directives -- render into .claude/skills/youmd/ or .cursor/rules/. every coding agent knows who you are from the first prompt.",
  },
];

const Step = ({
  step,
  index,
}: {
  step: (typeof steps)[0];
  index: number;
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [20, -10]);

  return (
    <motion.div ref={ref} style={{ y }}>
      <FadeUp delay={index * 0.1}>
        <div className="py-6 border-b border-border last:border-0">
          <div className="flex items-baseline gap-4 mb-3">
            <span className="text-muted-foreground/50 font-mono text-[10px]">
              {step.num}
            </span>
            <span className="text-accent font-mono text-[12px]">
              {step.cmd}
            </span>
          </div>
          <p className="text-muted-foreground text-[13px] font-body leading-relaxed pl-8">
            {step.desc}
          </p>
        </div>
      </FadeUp>
    </motion.div>
  );
};

const HowItWorks = () => (
  <section
    id="how-it-works"
    className="py-24 md:py-32 overflow-hidden"
  >
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <h2 className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- how it works --
        </h2>
        <p className="text-muted-foreground text-[13px] font-body mb-10">
          Sign up in seconds. Your identity is ready to share from the first message.
        </p>
      </FadeUp>

      <div>
        {steps.map((step, i) => (
          <Step key={step.num} step={step} index={i} />
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
