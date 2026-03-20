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
            <p className="text-muted-foreground/60 font-mono text-[10px] mb-8 tracking-widest uppercase">
              -- get started --
            </p>
            <p className="text-[hsl(var(--text-primary))] font-mono text-[16px] md:text-[20px] font-light tracking-tight mb-4 leading-relaxed">
              Stop re-explaining yourself to machines.
            </p>
            <p className="text-muted-foreground font-body text-[13px] mb-10">
              One command. Persistent identity context. Every agent
              knows you from the first message.
            </p>
          </FadeUp>
          <FadeUp delay={0.08}>
            <button
              onClick={handleCopy}
              className="cli-pill inline-flex items-center gap-3 px-5 py-3 mb-3"
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
            {copied && (
              <p className="text-success font-mono text-[10px] mt-1">
                copied to clipboard
              </p>
            )}
          </FadeUp>
        </motion.div>
      </section>

      <footer className="py-8 px-6">
        <div className="section-divider mb-8" />
        <div className="max-w-xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="text-accent font-mono text-[11px] hover:text-accent-light transition-colors"
          >
            you
          </Link>
          <div className="flex items-center gap-5">
            <a
              href="#spec"
              className="text-muted-foreground/60 font-mono text-[10px] hover:text-accent transition-colors"
            >
              &gt; spec
            </a>
            <a
              href="https://github.com/houstongolden/youmd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 font-mono text-[10px] hover:text-accent transition-colors"
            >
              &gt; github
            </a>
            <a
              href="#pricing"
              className="text-muted-foreground/60 font-mono text-[10px] hover:text-accent transition-colors"
            >
              &gt; pricing
            </a>
            <Link
              href="/profiles"
              className="text-muted-foreground/60 font-mono text-[10px] hover:text-accent transition-colors"
            >
              &gt; profiles
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-muted-foreground/50 font-mono text-[9px]">
              you/v1
            </span>
          </div>
        </div>
      </footer>
    </>
  );
};

export default CTAFooter;
