"use client";

import { motion } from "motion/react";
import FadeUp from "./FadeUp";

const bundleTree = [
  { path: ".youmd/", indent: 0, type: "dir" as const },
  { path: "profile/about.md", indent: 1, type: "file" as const, desc: "who you are" },
  { path: "profile/now.md", indent: 1, type: "file" as const, desc: "what you're working on" },
  { path: "profile/projects.md", indent: 1, type: "file" as const, desc: "your portfolio" },
  { path: "preferences/agent.md", indent: 1, type: "file" as const, desc: "how agents should talk to you" },
  { path: "voice/voice.md", indent: 1, type: "file" as const, desc: "your communication style" },
  { path: "directives/agent.md", indent: 1, type: "file" as const, desc: "rules agents must follow" },
  { path: "private/notes.md", indent: 1, type: "file" as const, desc: "context only you control" },
  { path: "skills/", indent: 1, type: "dir" as const, desc: "agent skills that travel with you" },
  { path: "you.json", indent: 1, type: "file" as const, desc: "compiled structured data" },
  { path: "you.md", indent: 1, type: "file" as const, desc: "human-readable identity" },
];

const principles = [
  "plain markdown files",
  "compile to JSON + API",
  "skills sync across agents",
  "host anywhere",
  "no vendor lock-in",
];

const OpenSpec = () => (
  <section className="py-16 md:py-20">
    <div className="max-w-2xl mx-auto px-6">
      <div className="section-divider mb-12" />

      <FadeUp>
        <p className="text-muted-foreground/60 font-mono text-[10px] mb-6 tracking-wider uppercase text-center">
          -- open standard --
        </p>
        <p className="text-foreground/80 font-mono text-[14px] font-light leading-relaxed text-center">
          <motion.span
            className="text-accent inline-block"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            you/v1
          </motion.span>{" "}
          is an open spec. Your identity is plain files you own.
        </p>
        <p className="text-muted-foreground font-body text-[13px] mt-2 text-center">
          No walled gardens. No proprietary formats. Markdown in, context out.
        </p>
      </FadeUp>

      {/* Bundle structure */}
      <FadeUp delay={0.12}>
        <div className="mt-10 terminal-panel max-w-md mx-auto">
          <div className="terminal-panel-header">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="ml-2 text-muted-foreground/60 font-mono text-[9px]">
              &gt; tree .youmd/
            </span>
          </div>
          <div className="p-4 space-y-0.5">
            {bundleTree.map((item, i) => (
              <motion.div
                key={item.path}
                className="font-mono text-[11px] leading-relaxed flex items-baseline gap-0"
                whileInView={{ opacity: [0, 1] }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.05 }}
              >
                {/* Tree characters */}
                <span className="text-muted-foreground/30 shrink-0 w-[120px] inline-block">
                  {item.indent === 0 ? "" : i === bundleTree.length - 1 ? "  \u2514\u2500\u2500 " : "  \u251C\u2500\u2500 "}
                  <span
                    className={
                      item.type === "dir"
                        ? "text-accent/60"
                        : "text-foreground/70"
                    }
                  >
                    {item.path}
                  </span>
                </span>
                {/* Description */}
                {"desc" in item && (
                  <span className="text-muted-foreground/35 text-[9px] ml-2">
                    # {item.desc}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </FadeUp>

      {/* Principles */}
      <FadeUp delay={0.22}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {principles.map((p, i) => (
            <motion.span
              key={p}
              className="font-mono text-[10px] text-accent/60 border border-accent/15 px-3 py-1 rounded"
              whileInView={{ opacity: [0, 1] }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              {p}
            </motion.span>
          ))}
        </div>
      </FadeUp>

      {/* Self-host callout */}
      <FadeUp delay={0.3}>
        <div className="mt-8 text-center">
          <div className="inline-block border border-border/40 rounded px-4 py-3 bg-[hsl(var(--bg-raised))]/50">
            <p className="font-mono text-[11px] text-muted-foreground/60 mb-1">
              self-host your identity:
            </p>
            <p className="font-mono text-[12px] text-accent/80">
              <span className="text-muted-foreground/40">$ </span>
              youmd export &rarr; drop in any repo
            </p>
            <p className="font-mono text-[9px] text-muted-foreground/40 mt-1.5">
              works as CLAUDE.md, .cursorrules, or standalone .youmd/
            </p>
          </div>
        </div>
      </FadeUp>

      {/* Links */}
      <FadeUp delay={0.38}>
        <div className="mt-8 flex items-center justify-center gap-6">
          <a
            href="https://github.com/houstongolden/youmd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors duration-200"
          >
            &gt; github/youmd &rarr;
          </a>
          <a
            href="https://github.com/houstongolden/youmd/blob/main/you-agent/soul.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors duration-200"
          >
            &gt; read the spec &rarr;
          </a>
        </div>
      </FadeUp>

      <div className="section-divider mt-12" />
    </div>
  </section>
);

export default OpenSpec;
