"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import FadeUp from "./FadeUp";

const painPoints = [
  "re-explaining your stack, role, and preferences to every new agent",
  "copy-pasting system prompts between Claude Code, Cursor, ChatGPT",
  "new projects start cold -- no CLAUDE.md, no context, no preferences",
  "agents can't match your voice because they don't know how you write",
  "switching tools means losing all the context you built up",
  "spending 10 minutes onboarding yourself before you can start working",
];

const beforeSnippets = [
  { role: "agent" as const, text: "What do you do? What technologies do you use?" },
  { role: "you" as const, text: "I'm a founder building AI tools. TypeScript, Next.js, Convex..." },
  { role: "agent" as const, text: "Got it. And what's your communication preference? Formal or casual?" },
  { role: "you" as const, text: "Direct. No fluff. I've said this 100 times across 10 tools." },
  { role: "agent" as const, text: "What project are you working on currently?" },
  { role: "you" as const, text: "[closes tab]" },
];

const afterSnippets = [
  { role: "ctx" as const, text: "loading you.md/houston..." },
  {
    role: "agent" as const,
    text: "Houston -- you're building You.md (Next.js + Convex + passwordless auth), prefer terminal-native design, ship fast, no emoji. I see your CLAUDE.md generator skill and your project-context setup. You have 3 active projects. What are we working on?",
  },
  { role: "you" as const, text: "new feature for the skill system." },
  {
    role: "agent" as const,
    text: "on it. i'll follow your directives: act decisively, no forms, terminal-first. pulling in your project context now.",
  },
];

const ProblemStrip = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} className="py-24 md:py-32 overflow-hidden">
      <motion.div className="max-w-3xl mx-auto px-6" style={{ y }}>
        <FadeUp>
          <h2 className="text-muted-foreground/60 font-mono text-[10px] mb-8 tracking-widest uppercase text-center">
            -- the problem --
          </h2>
          <p className="text-foreground/90 font-mono text-[15px] md:text-[17px] font-light leading-[1.8] tracking-tight text-center">
            every agent starts from scratch.{" "}
            <span className="text-accent">you re-explain yourself endlessly.</span>
          </p>
        </FadeUp>

        {/* Pain points grid */}
        <FadeUp delay={0.1}>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
            {painPoints.map((item, i) => (
              <motion.div
                key={item}
                className="flex items-start gap-2 font-mono text-[11px] text-destructive/70 px-3 py-2 border border-destructive/15 bg-destructive/[0.03]"
                style={{ borderRadius: "2px" }}
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
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {/* BEFORE */}
            <div className="terminal-panel">
              <div className="terminal-panel-header">
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <div className="terminal-dot" />
                <span className="ml-2 text-destructive/60 font-mono text-[9px]">before you.md</span>
              </div>
              <div className="p-4 space-y-2.5">
                {beforeSnippets.map((line, i) => (
                  <motion.div
                    key={i}
                    className={`font-mono text-[10px] leading-relaxed ${
                      line.role === "agent" ? "text-muted-foreground/60" : "text-foreground/70"
                    }`}
                    whileInView={{ opacity: [0, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                  >
                    <span className={line.role === "agent" ? "text-muted-foreground/40" : "text-destructive/50"}>
                      {line.role === "agent" ? "agent" : "  you"}
                    </span>
                    <span className="text-muted-foreground/20"> | </span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50">
                  <span className="font-mono text-[9px] text-destructive/40">
                    -- repeat for every tool, every session, every project --
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
                <span className="ml-2 text-accent/60 font-mono text-[9px]">with you.md</span>
              </div>
              <div className="p-4 space-y-2.5">
                {afterSnippets.map((line, i) => (
                  <motion.div
                    key={i}
                    className={`font-mono text-[10px] leading-relaxed ${
                      line.role === "ctx"
                        ? "text-accent/50"
                        : line.role === "agent"
                        ? "text-muted-foreground/70"
                        : "text-foreground/80"
                    }`}
                    whileInView={{ opacity: [0, 1] }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.12 }}
                  >
                    <span className={
                      line.role === "ctx"
                        ? "text-accent/40"
                        : line.role === "agent"
                        ? "text-accent/50"
                        : "text-accent/70"
                    }>
                      {line.role === "ctx" ? "  ctx" : line.role === "agent" ? "agent" : "  you"}
                    </span>
                    <span className="text-muted-foreground/20"> | </span>
                    <span>{line.text}</span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border/50">
                  <span className="font-mono text-[9px] text-accent/40">
                    -- full context from identity + skills + directives. zero onboarding --
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
