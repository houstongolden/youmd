"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import FadeUp from "./FadeUp";

const painPoints = [
  "re-explaining your tech stack to every new agent",
  "re-listing your projects in every conversation",
  "re-sharing your communication preferences",
  "agents asking your name, role, and timezone -- again",
  "copy-pasting the same context into system prompts",
  "losing continuity when switching between tools",
];

const beforeSnippets = [
  {
    role: "agent" as const,
    text: "What programming languages do you work with?",
  },
  { role: "you" as const, text: "TypeScript, Python, Rust. I've told you this before." },
  {
    role: "agent" as const,
    text: "What's your preferred coding style? Do you use tabs or spaces?",
  },
  { role: "you" as const, text: "..." },
];

const afterSnippets = [
  {
    role: "agent" as const,
    text: "I see you're a TypeScript-first dev who prefers functional patterns, uses Convex + Next.js, and likes concise responses. Let's get to work.",
  },
  { role: "you" as const, text: "Finally." },
];

const ProblemStrip = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} className="py-24 md:py-32 overflow-hidden">
      <motion.div className="max-w-3xl mx-auto px-6" style={{ y }}>
        <FadeUp>
          <p className="text-muted-foreground/60 font-mono text-[10px] mb-8 tracking-widest uppercase text-center">
            -- the problem --
          </p>
          <p className="text-foreground/90 font-mono text-[15px] md:text-[17px] font-light leading-[1.8] tracking-tight text-center">
            every agent starts from scratch.{" "}
            <span className="text-accent">
              you re-explain yourself endlessly.
            </span>
          </p>
        </FadeUp>

        {/* Pain points grid */}
        <FadeUp delay={0.1}>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
            {painPoints.map((item, i) => (
              <motion.div
                key={item}
                className="flex items-start gap-2 font-mono text-[11px] text-destructive/70 px-3 py-2 border border-destructive/15 rounded bg-destructive/[0.03]"
                whileInView={{ opacity: [0, 1], x: [-8, 0] }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.06 }}
              >
                <span className="shrink-0 mt-px">{"\u2717"}</span>
                <span>{item}</span>
              </motion.div>
            ))}
          </div>
        </FadeUp>

        {/* Before / After comparison */}
        <FadeUp delay={0.25}>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* BEFORE */}
            <div className="terminal-panel">
              <div className="terminal-panel-header">
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <span className="ml-2 text-destructive/60 font-mono text-[9px]">
                  before you.md
                </span>
              </div>
              <div className="p-4 space-y-3">
                {beforeSnippets.map((line, i) => (
                  <motion.div
                    key={i}
                    className={`font-mono text-[10px] leading-relaxed ${
                      line.role === "agent"
                        ? "text-muted-foreground/60"
                        : "text-foreground/70"
                    }`}
                    whileInView={{ opacity: [0, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.12 }}
                  >
                    <span
                      className={
                        line.role === "agent"
                          ? "text-muted-foreground/40"
                          : "text-destructive/50"
                      }
                    >
                      {line.role === "agent" ? "agent" : "  you"}
                    </span>
                    <span className="text-muted-foreground/20"> | </span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50">
                  <span className="font-mono text-[9px] text-destructive/40">
                    -- repeat for every tool, every session --
                  </span>
                </div>
              </div>
            </div>

            {/* AFTER */}
            <div className="terminal-panel">
              <div className="terminal-panel-header">
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <span className="ml-2 text-accent/60 font-mono text-[9px]">
                  with you.md
                </span>
              </div>
              <div className="p-4 space-y-3">
                <motion.div
                  className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed"
                  whileInView={{ opacity: [0, 1] }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.5 }}
                >
                  <span className="text-accent/40">ctx</span>
                  <span className="text-muted-foreground/20"> | </span>
                  <span className="text-accent/60">
                    loading you.md/houston...
                  </span>
                </motion.div>
                {afterSnippets.map((line, i) => (
                  <motion.div
                    key={i}
                    className={`font-mono text-[10px] leading-relaxed ${
                      line.role === "agent"
                        ? "text-muted-foreground/70"
                        : "text-foreground/80"
                    }`}
                    whileInView={{ opacity: [0, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.65 + i * 0.15 }}
                  >
                    <span
                      className={
                        line.role === "agent"
                          ? "text-accent/50"
                          : "text-accent/70"
                      }
                    >
                      {line.role === "agent" ? "agent" : "  you"}
                    </span>
                    <span className="text-muted-foreground/20"> | </span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50">
                  <span className="font-mono text-[9px] text-accent/40">
                    -- zero onboarding. full context. every time --
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.35}>
          <p className="text-foreground/60 font-mono text-[12px] mt-10 italic text-center">
            you shouldn&apos;t have to onboard{" "}
            <span className="text-accent">yourself</span> to your own tools.
          </p>
        </FadeUp>
      </motion.div>
    </section>
  );
};

export default ProblemStrip;
