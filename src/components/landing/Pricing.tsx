"use client";

import { motion } from "motion/react";
import Link from "next/link";
import FadeUp from "./FadeUp";

const Pricing = () => (
  <section id="pricing" className="py-24 md:py-32">
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <h2 className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- pricing --
        </h2>
        <p className="text-muted-foreground text-[13px] font-body mb-14">
          Your identity is free. Power features for power users.
        </p>
      </FadeUp>

      <div className="space-y-6">
        {/* Free */}
        <FadeUp delay={0}>
          <motion.div
            whileHover={{
              borderColor: "hsl(var(--accent) / 0.15)",
            }}
            className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-6 transition-colors overflow-hidden"
            style={{ borderRadius: "2px" }}
          >
            <div className="flex items-center gap-1.5 mb-4">
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--text-secondary))]/30" />
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--text-secondary))]/30" />
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--text-secondary))]/30" />
              <span className="ml-2 text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[9px]">
                free.plan
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-[hsl(var(--text-primary))] font-mono text-[13px]">
                Free
              </span>
              <span className="text-[hsl(var(--text-primary))] font-mono text-[20px] font-light">
                $0
                <span className="text-muted-foreground/60 text-[10px] ml-1">
                  /forever
                </span>
              </span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-muted-foreground mb-5">
              <p>{"  "}✓ Full identity context via CLI or web</p>
              <p>{"  "}✓ Public profile at you.md/username</p>
              <p>{"  "}✓ 4 bundled agent skills (CLAUDE.md gen, project scaffold, voice sync, meta-improve)</p>
              <p>{"  "}✓ Skill sync across Claude Code, Cursor, Codex</p>
              <p>{"  "}✓ Shareable context links with scoping</p>
              <p>{"  "}✓ Agent directives + voice profile</p>
              <p>{"  "}✓ API access for any agent</p>
            </div>
            <Link
              href="/create"
              className="cta-outline block text-center px-4 py-2.5 text-[11px]"
            >
              &gt; youmd init
            </Link>
          </motion.div>
        </FadeUp>

        {/* Pro */}
        <FadeUp delay={0.08}>
          <motion.div
            whileHover={{
              borderColor: "hsl(var(--accent) / 0.5)",
            }}
            className="border border-accent/30 bg-[hsl(var(--bg-raised))] p-6 relative overflow-hidden transition-colors"
            style={{ borderRadius: "2px" }}
          >
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
            <div className="flex items-center gap-1.5 mb-4">
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--accent))]/40" />
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--accent))]/40" />
              <span className="w-[6px] h-[6px] rounded-full bg-[hsl(var(--accent))]/40" />
              <span className="ml-2 text-[hsl(var(--accent))] opacity-60 font-mono text-[9px]">
                pro.plan
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[hsl(var(--text-primary))] font-mono text-[13px]">
                Pro
              </span>
              <span className="text-accent font-mono text-[9px] uppercase tracking-wider">
                recommended
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-muted-foreground font-body text-[11px]">
                For builders who live in agents daily.
              </span>
              <div className="text-right">
                <div>
                  <span className="text-[hsl(var(--text-primary))] font-mono text-[20px] font-light">
                    $29
                    <span className="text-muted-foreground/60 text-[10px] ml-1">
                      /mo
                    </span>
                  </span>
                </div>
                <div className="text-muted-foreground/40 font-mono text-[9px]">
                  scales with usage
                </div>
              </div>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-muted-foreground mb-5">
              <p>{"  "}&rsaquo; Everything in free, plus:</p>
              <p>{"  "}&rsaquo; Unlimited auto-syncs from connected sources</p>
              <p>{"  "}&rsaquo; Private encrypted vault for sensitive context</p>
              <p>{"  "}&rsaquo; Skill registry publishing + community skills</p>
              <p>{"  "}&rsaquo; Project-aware context management</p>
              <p>{"  "}&rsaquo; Version history + rollback</p>
              <p>{"  "}&rsaquo; Analytics -- which agents read your profile</p>
              <p>{"  "}&rsaquo; Scoped API keys per agent or project</p>
              <p>{"  "}&rsaquo; Custom domain hosting</p>
              <p>{"  "}&rsaquo; Bring your own API keys (OpenRouter, Perplexity)</p>
            </div>
            <Link
              href="/create"
              className="cta-primary block text-center px-4 py-2.5 text-[11px]"
            >
              &gt; youmd upgrade --pro
            </Link>
            <p className="text-muted-foreground/50 font-mono text-[9px] text-center mt-2">
              your keys stay local -- never stored on our servers
            </p>
          </motion.div>
        </FadeUp>
      </div>

      <FadeUp delay={0.15}>
        <p className="text-muted-foreground/60 font-mono text-[10px] text-center mt-10">
          you pay for features, not for being yourself. core identity context is always free.
        </p>
      </FadeUp>
    </div>
  </section>
);

export default Pricing;
