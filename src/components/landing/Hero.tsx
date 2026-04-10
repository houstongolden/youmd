"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useScroll, useTransform, motion } from "motion/react";
import { Copy, Check } from "lucide-react";
import PixelYOU from "./PixelYOU";
import HeroPortrait from "./HeroPortrait";

/* -- Agent pills (shown below CTA) -- */
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
        <div className="font-mono text-[11px] text-muted-foreground hero-enter" style={{ animationDuration: "0.2s" }}>
          {typed}<span className="cursor-blink text-accent">{"\u2588"}</span>
        </div>
      )}
      {(phase === "tagline" || phase === "done") && (
        <div>
          <div className="font-mono text-[11px] text-accent hero-enter" style={{ animationDuration: "0.2s" }}>
            identity context protocol
          </div>
          {phase === "done" && (
            <div className="font-mono text-[10px] text-muted-foreground mt-1 hero-enter-up" style={{ animationDelay: "0.1s", animationDuration: "0.3s" }}>
              an MCP where the context is you
            </div>
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

/* -- CLI commands list -- */
const commands = [
  ["you init", "build your identity via AI conversation"],
  ["you push", "publish to you.md/username"],
  ["you skill init-project", "CLAUDE.md + project-context/ in any repo"],
  ["you skill link claude", "sync identity skills to your agent"],
  ["you link create", "scoped context link for any agent"],
];

const Hero = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const contentOpacity = useTransform(scrollYProgress, [0, 0.5, 0.8], [1, 0.8, 0]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-16">
      {/* Beam glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[80%] beam-glow pointer-events-none" />

      {/* BG texture — decorative, hidden from screen readers */}
      <div
        aria-hidden="true"
        role="presentation"
        className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-[0.02]"
      >
        <p className="font-mono text-[6px] leading-none text-[hsl(var(--text-primary))] break-all whitespace-pre-wrap">
          {`$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `.repeat(300)}
        </p>
      </div>

      <motion.div className="relative z-10 w-full max-w-5xl px-4" style={{ opacity: contentOpacity }}>
        {/* Two-column layout — branding left, ASCII portrait right */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* LEFT — branding & commands */}
          <div className="flex-1 text-left">
            {/* Pixel YOU — wrapped in h1 for SEO + a11y. Visible glyph is decorative; sr-only text gives semantic meaning. */}
            <h1 className="mb-6 hero-enter-scale" style={{ animationDelay: "0.3s" }}>
              <span className="sr-only">you.md — identity context protocol for the agent internet</span>
              <span aria-hidden="true">
                <PixelYOU />
              </span>
            </h1>

            {/* Boot sequence */}
            <div className="mb-6 hero-enter" style={{ animationDelay: "0.8s" }}>
              <BootSequence />
            </div>

            {/* Value prop */}
            <div
              className="font-mono text-[11px] leading-relaxed text-muted-foreground/60 mb-6 max-w-sm space-y-1.5 hero-enter-up"
              style={{ animationDelay: "1.1s" }}
            >
              <p>
                every agent starts from scratch.{" "}
                <span className="text-accent">you.md fixes that.</span>
              </p>
              <p className="text-[10px] text-muted-foreground/40">
                public profile + private file system + agent skills.
                your identity, preferences, and best practices sync across
                Claude Code, Cursor, and every tool you use.
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-border mb-6" />

            {/* Commands */}
            <div className="space-y-1.5 mb-8 hero-enter" style={{ animationDelay: "1.5s" }}>
              {commands.map(([cmd, desc]) => (
                <div key={cmd} className="font-mono text-[10px] leading-relaxed">
                  <span className="text-muted-foreground/50">$ </span>
                  <span className="text-accent">{cmd}</span>
                  <span className="text-muted-foreground/30 ml-3"># {desc}</span>
                </div>
              ))}
            </div>

            {/* Dual CTA */}
            <div className="mb-6 flex items-center gap-3 hero-enter-up" style={{ animationDelay: "1.8s" }}>
              <CliPill />
              <Link href="/create" className="cta-primary px-5 py-3 text-[13px] font-mono shrink-0 whitespace-nowrap">
                &gt; start now
              </Link>
            </div>

            {/* Badge */}
            <div className="flex items-center gap-3 font-mono text-[8px] text-muted-foreground/30 uppercase tracking-widest hero-enter" style={{ animationDelay: "2.1s" }}>
              <span>YOU/V1 &middot; OPEN SPEC &middot; FREE</span>
            </div>
          </div>

          {/* RIGHT — ASCII portrait */}
          <div className="flex-1 flex justify-center">
            <Link href="/houstongolden" className="block w-full max-w-md group">
              <div className="hero-enter-scale" style={{ animationDelay: "1.2s" }}>
                <HeroPortrait />
                <p className="text-center font-mono text-[9px] text-muted-foreground/40 mt-2 group-hover:text-accent/60 transition-colors">
                  &gt; view live profile
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Agent pills — BELOW the main hero content */}
        <div
          className="mt-12 flex flex-wrap items-center justify-center gap-1.5 hero-enter"
          style={{ animationDelay: "2.3s" }}
        >
          <span className="font-mono text-[8px] text-muted-foreground/25 uppercase tracking-widest mr-1.5">
            works with
          </span>
          {AGENTS.map((agent) => (
            <span
              key={agent.name}
              className={`font-mono text-[9px] px-2 py-0.5 border cursor-default select-none ${
                agent.tier === "primary"
                  ? "text-accent/60 border-accent/15"
                  : "text-muted-foreground/30 border-border/30"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {agent.name}
            </span>
          ))}
        </div>

        {/* Quick links — cycle 65: bumped to min-h-[44px] inline-flex */}
        <div className="flex items-center justify-center gap-4 font-mono text-[12px] mt-4 hero-enter" style={{ animationDelay: "2.5s" }}>
          <Link href="/create" className="inline-flex items-center min-h-[44px] px-3 text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; get started</Link>
          <Link href="/docs" className="inline-flex items-center min-h-[44px] px-3 text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; docs</Link>
          <a href="https://github.com/houstongolden/youmd" target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] px-3 text-muted-foreground/50 hover:text-accent transition-colors duration-200">&gt; github</a>
        </div>
      </motion.div>

      <div className="absolute bottom-0 inset-x-0 section-divider" />
    </section>
  );
};

export default Hero;
