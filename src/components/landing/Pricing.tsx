"use client";

import { motion } from "motion/react";
import FadeUp from "./FadeUp";

const Pricing = () => (
  <section id="pricing" className="py-24 md:py-32">
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- pricing --
        </p>
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
            className="border border-border rounded p-6 transition-colors"
          >
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-foreground font-mono text-[13px]">
                Free
              </span>
              <span className="text-foreground font-mono text-[20px] font-light">
                $0
                <span className="text-muted-foreground/60 text-[10px] ml-1">
                  /forever
                </span>
              </span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-muted-foreground mb-5">
              <p>
                {"  "}&check; Full identity bundle -- generated
                locally via CLI
              </p>
              <p>
                {"  "}&check; Public profile at you.md/username
              </p>
              <p>
                {"  "}&check; Shareable context link -- works with
                any agent
              </p>
              <p>
                {"  "}&check; 3 auto-syncs/month from connected
                sources
              </p>
            </div>
            <a
              href="#get-started"
              className="cta-outline block text-center px-4 py-2.5 text-[11px]"
            >
              &gt; youmd init
            </a>
          </motion.div>
        </FadeUp>

        {/* Pro */}
        <FadeUp delay={0.08}>
          <motion.div
            whileHover={{
              borderColor: "hsl(var(--accent) / 0.5)",
            }}
            className="border border-accent/30 rounded p-6 relative overflow-hidden transition-colors"
          >
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-foreground font-mono text-[13px]">
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
              <span className="text-foreground font-mono text-[20px] font-light">
                $12
                <span className="text-muted-foreground/60 text-[10px] ml-1">
                  /mo
                </span>
              </span>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-muted-foreground mb-5">
              <p>
                {"  "}&rsaquo; Unlimited auto-syncs -- identity
                always current
              </p>
              <p>
                {"  "}&rsaquo; BYOK -- OpenRouter, Perplexity,
                Apify
              </p>
              <p>
                {"  "}&rsaquo; Private encrypted vault for
                sensitive context
              </p>
              <p>
                {"  "}&rsaquo; Version history -- roll back any
                change
              </p>
              <p>
                {"  "}&rsaquo; Custom domain -- your identity,
                your URL
              </p>
              <p>
                {"  "}&rsaquo; Analytics & scoped API keys
              </p>
            </div>
            <a
              href="#get-started"
              className="cta-primary block text-center px-4 py-2.5 text-[11px]"
            >
              &gt; youmd upgrade --pro
            </a>
            <p className="text-muted-foreground/50 font-mono text-[9px] text-center mt-2">
              your keys stay local -- never stored on our servers
            </p>
          </motion.div>
        </FadeUp>
      </div>

      <FadeUp delay={0.15}>
        <p className="text-muted-foreground/60 font-mono text-[10px] text-center mt-10">
          we gate on usage intensity -- never on core identity.
        </p>
      </FadeUp>
    </div>
  </section>
);

export default Pricing;
