"use client";

import { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { Copy, Check } from "lucide-react";
import Link from "next/link";
import FadeUp from "./FadeUp";
import ThemeToggle from "./ThemeToggle";

const CTAFooter = () => {
  const [copied, setCopied] = useState(false);
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], [40, -20]);

  const handleCopy = () => {
    navigator.clipboard.writeText("npx youmd init");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <section
        ref={sectionRef}
        id="get-started"
        className="relative overflow-hidden py-32 md:py-40"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100px] h-[400px] beam-glow pointer-events-none" />

        <motion.div
          className="relative z-10 text-center px-6"
          style={{ y: contentY }}
        >
          <FadeUp>
            <h2 className="text-muted-foreground/60 font-mono text-[10px] mb-8 tracking-widest uppercase">
              -- get started --
            </h2>
            <p className="text-[hsl(var(--text-primary))] font-mono text-[16px] md:text-[20px] font-light tracking-tight mb-4 leading-relaxed">
              Stop re-explaining yourself to machines.
            </p>
            <p className="text-muted-foreground font-body text-[13px] mb-10">
              One command. Persistent identity context. Every agent
              knows you from the first message.
            </p>
          </FadeUp>
          <FadeUp delay={0.08}>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-3">
              <button
                onClick={handleCopy}
                className="cli-pill inline-flex items-center gap-3 px-5 py-3 whitespace-nowrap"
              >
                <span className="text-muted-foreground">$</span>
                <span className="text-accent font-medium">
                  npx youmd init
                </span>
                <span className="cursor-blink text-accent">
                  {"\u2588"}
                </span>
                <span className="ml-2 text-muted-foreground/50">
                  {copied ? (
                    <Check size={13} className="text-success" />
                  ) : (
                    <Copy size={13} />
                  )}
                </span>
              </button>
              <Link
                href="/create"
                className="cta-primary px-5 py-3 text-[13px] font-mono whitespace-nowrap"
              >
                &gt; start in browser
              </Link>
            </div>
            {copied && (
              <p className="text-success font-mono text-[10px] mt-1">
                copied to clipboard
              </p>
            )}
          </FadeUp>
        </motion.div>
      </section>

      <footer className="py-10 px-6">
        <div className="section-divider mb-10" />
        <div className="max-w-2xl mx-auto">
          {/* Cycle 65: bumped all 12 footer links from h:18 to inline-flex min-h-[44px].
              Tightened space-y from 2 to 0 (the 44px tap area provides spacing). */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <div>
              <p className="text-muted-foreground/40 font-mono text-[9px] uppercase tracking-widest mb-2">product</p>
              <div className="flex flex-col">
                <Link href="/create" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; create</Link>
                <Link href="/profiles" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; profiles</Link>
                <a href="#pricing" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; pricing</a>
                <Link href="/docs#skills" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; skills</Link>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground/40 font-mono text-[9px] uppercase tracking-widest mb-2">developers</p>
              <div className="flex flex-col">
                <Link href="/docs" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; docs</Link>
                <Link href="/docs#api" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; api</Link>
                <Link href="/docs#cli" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; cli</Link>
                <a href="#spec" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; spec</a>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground/40 font-mono text-[9px] uppercase tracking-widest mb-2">open source</p>
              <div className="flex flex-col">
                <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; github</a>
                <a href="https://www.npmjs.com/package/youmd" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; npm</a>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground/40 font-mono text-[9px] uppercase tracking-widest mb-2">connect</p>
              <div className="flex flex-col">
                <a href="https://x.com/haborngolden" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; x</a>
                <a href="https://linkedin.com/in/houstongolden" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors">&gt; linkedin</a>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-border/30">
            {/* Cycle 67: bumped from min-h-[44px] to min-h-[48px] — at 44 the
                subpixel rounding occasionally lands on 43.998px which fails the
                strict < 44 audit check. 48px is comfortably above the threshold. */}
            <Link
              href="/"
              className="inline-flex items-center min-h-[48px] px-3 text-accent font-mono text-[11px] hover:text-accent-light transition-colors"
            >
              you
            </Link>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-muted-foreground/50 font-mono text-[9px]">
                you/v1
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default CTAFooter;
