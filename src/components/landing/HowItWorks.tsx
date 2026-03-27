"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import FadeUp from "./FadeUp";

const steps = [
  {
    num: "01",
    cmd: "$ npx youmd init",
    desc: "A conversational AI builds your identity through dialogue -- not a form. Projects, values, preferences, voice. Your data stays local. No account needed.",
  },
  {
    num: "02",
    cmd: "$ youmd push",
    desc: "Your identity goes live at you.md/username. Now any agent can read it instantly. No more copy-pasting system prompts.",
  },
  {
    num: "03",
    cmd: "$ youmd link create",
    desc: "Generate scoped context links. Give Claude Code your full identity. Give ChatGPT just the public view. You control every scope.",
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
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- how it works --
        </p>
        <p className="text-muted-foreground text-[13px] font-body mb-10">
          Three commands. No signup. Your identity travels with you from the first message.
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
