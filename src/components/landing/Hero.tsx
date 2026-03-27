"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Copy, Check } from "lucide-react";
import PixelYOU from "./PixelYOU";

/* -- Agent logos as monochrome text marks (terminal-native, no decorative images) -- */
const AGENTS = [
  { name: "Claude Code", tier: "primary" },
  { name: "Cursor", tier: "primary" },
  { name: "OpenClaw", tier: "primary" },
  { name: "ChatGPT", tier: "primary" },
  { name: "Gemini", tier: "primary" },
  { name: "Grok", tier: "secondary" },
  { name: "Perplexity", tier: "secondary" },
  { name: "Copilot", tier: "secondary" },
  { name: "Manus", tier: "secondary" },
  { name: "Codex CLI", tier: "secondary" },
  { name: "Windsurf", tier: "secondary" },
  { name: "Aider", tier: "secondary" },
  { name: "Pi Agent", tier: "secondary" },
  { name: "CrewAI", tier: "secondary" },
];

/* -- Boot sequence -- */
const BootSequence = () => {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "tagline" | "done">("typing");

  useEffect(() => {
    const word = "initializing you...";
    let i = 0;
    const timer = setInterval(() => {
      setTyped(word.slice(0, ++i));
      if (i >= word.length) {
        clearInterval(timer);
        setTimeout(() => setPhase("tagline"), 300);
        setTimeout(() => setPhase("done"), 1200);
      }
    }, 55);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-left inline-block">
      {phase === "typing" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-[11px] text-muted-foreground">
          {typed}<span className="cursor-blink text-accent">{"\u2588"}</span>
        </motion.div>
      )}
      {(phase === "tagline" || phase === "done") && (
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-[11px] text-accent">
            identity context protocol
          </motion.div>
          {phase === "done" && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-mono text-[10px] text-muted-foreground mt-1">
              an MCP where the context is you
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

const CliPill = () => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText("npx youmd init");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button onClick={handleCopy} className="cli-pill flex items-center gap-3 px-5 py-3 group whitespace-nowrap">
      <span className="text-muted-foreground">$</span>
      <span className="text-accent font-medium">npx youmd init</span>
      <span className="cursor-blink text-accent">{"\u2588"}</span>
      <span className="ml-2 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
        {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      </span>
    </button>
  );
};

const Hero = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.8], [1, 0.8, 0]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-16">
      {/* Beam glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[80%] beam-glow pointer-events-none" />

      {/* BG texture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-[0.02]">
        <p className="font-mono text-[6px] leading-none text-[hsl(var(--text-primary))] break-all whitespace-pre-wrap">
          {`$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `.repeat(300)}
        </p>
      </div>

      <motion.div className="relative z-10 w-full max-w-4xl px-4" style={{ opacity: contentOpacity }}>
        {/* Agent logos — above the fold */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-2 mb-10"
        >
          <span className="font-mono text-[8px] text-muted-foreground/30 uppercase tracking-widest mr-2">
            works with
          </span>
          {AGENTS.map((agent, i) => (
            <motion.span
              key={agent.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.15 + i * 0.03 }}
              className={`font-mono text-[10px] px-2.5 py-1 border transition-colors cursor-default select-none ${
                agent.tier === "primary"
                  ? "text-accent/80 border-accent/20 bg-accent-wash/30"
                  : "text-muted-foreground/50 border-border/50"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {agent.name}
            </motion.span>
          ))}
        </motion.div>

        {/* Center-aligned hero content */}
        <div className="text-center">
          {/* Pixel YOU */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="mb-6 flex justify-center">
            <PixelYOU />
          </motion.div>

          {/* Boot sequence */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.8 }} className="mb-6 flex justify-center">
            <BootSequence />
          </motion.div>

          {/* Value prop — focused on what devs get */}
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.1 }}
            className="font-mono text-[12px] leading-relaxed text-muted-foreground/60 mb-8 max-w-lg mx-auto space-y-2"
          >
            <p>
              every agent you use starts from scratch.{" "}
              <span className="text-accent">you.md fixes that.</span>
            </p>
            <p className="text-[11px] text-muted-foreground/40">
              public profile for instant agent onboarding. private file system for
              deep context. skills that sync your identity, preferences, and best
              practices across Claude Code, Cursor, and every agent you use.
            </p>
          </motion.div>

          {/* Key features — 3 pillars */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10"
          >
            {[
              { label: "identity context", desc: "bio, voice, preferences, directives -- agents know you from the first message" },
              { label: "agent skills", desc: "CLAUDE.md generation, project scaffolding, voice sync -- travels with you across tools" },
              { label: "private + scoped", desc: "you control what's public vs private. context links with TTL, scope, and usage limits" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="text-left border border-border/30 p-3"
                style={{ borderRadius: "2px" }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5 + i * 0.1 }}
              >
                <p className="font-mono text-[10px] text-accent/80 mb-1">{item.label}</p>
                <p className="font-mono text-[9px] text-muted-foreground/40 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Dual CTA */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 1.8 }} className="mb-6 flex items-center justify-center gap-3">
            <CliPill />
            <Link href="/create" className="cta-primary px-5 py-3 text-[13px] font-mono shrink-0 whitespace-nowrap">
              &gt; start now
            </Link>
          </motion.div>

          {/* Badge */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 2.1 }} className="flex items-center justify-center gap-3 font-mono text-[8px] text-muted-foreground/30 uppercase tracking-widest mb-8">
            <span>YOU/V1 &middot; OPEN SPEC &middot; FREE &middot; CLI + WEB + API</span>
          </motion.div>
        </div>

        {/* Quick links */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 2.3 }} className="flex items-center justify-center gap-8 font-mono text-[12px]">
          <Link href="/create" className="text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; get started</Link>
          <Link href="/docs" className="text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; docs</Link>
          <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; github</a>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 inset-x-0 section-divider" />
    </section>
  );
};

export default Hero;
