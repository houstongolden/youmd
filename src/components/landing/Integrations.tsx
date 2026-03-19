"use client";

import { motion } from "motion/react";
import FadeUp from "./FadeUp";

const agents = [
  { name: "Claude Code", tier: "primary" },
  { name: "Cursor", tier: "primary" },
  { name: "Codex CLI", tier: "primary" },
  { name: "Perplexity", tier: "primary" },
  { name: "ChatGPT", tier: "secondary" },
  { name: "CrewAI", tier: "secondary" },
  { name: "Goose", tier: "secondary" },
  { name: "Aider", tier: "secondary" },
  { name: "OpenClaw", tier: "secondary" },
  { name: "Windsurf", tier: "secondary" },
];

const Integrations = () => (
  <section className="py-16 md:py-24">
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-3 text-center">
          -- works everywhere --
        </p>
        <p className="text-muted-foreground/70 font-body text-[12px] mb-10 text-center">
          Share one link. Every agent gets your context. No per-tool
          setup, no system prompt hacks.
        </p>
      </FadeUp>

      <FadeUp delay={0.08}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {agents.map((agent, i) => (
            <motion.span
              key={agent.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              whileHover={{ scale: 1.05, y: -1 }}
              className={`font-mono text-[11px] transition-colors duration-300 cursor-default select-none px-3 py-1.5 rounded border ${
                agent.tier === "primary"
                  ? "text-accent/80 border-accent/20 hover:border-accent/40 hover:text-accent bg-accent-wash/30"
                  : "text-muted-foreground/60 border-border/60 hover:border-accent/20 hover:text-accent/80"
              }`}
            >
              {agent.name}
            </motion.span>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.15}>
        <p className="text-center mt-8">
          <span className="text-muted-foreground/50 font-mono text-[10px]">
            + any tool that supports structured context or MCP
          </span>
        </p>
      </FadeUp>
    </div>
  </section>
);

export default Integrations;
