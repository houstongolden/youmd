"use client";

import { useState, useEffect, useRef } from "react";
import { useInView } from "motion/react";
import FadeUp from "./FadeUp";

const codeLines = [
  "---",
  "schema: you/v1",
  "name: Houston Golden",
  "username: houstongolden",
  "---",
  "",
  "# Houston Golden",
  "",
  "Founder. Building identity infrastructure",
  "for the agent internet.",
  "",
  "## Now",
  "",
  "- Shipping you.md v1",
  "- Scaling BAMF Media",
  "- Cosmology research (bigbounce)",
  "",
  "## Agent Preferences",
  "",
  "Tone: direct, no fluff, terminal-native",
  "Stack: TypeScript, Next.js, Convex",
  "Never: forms, emoji, corporate speak",
  "",
  "## Links",
  "",
  "- you.md/houstongolden",
  "- github.com/houstongolden",
];

const TypewriterCode = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [visibleChars, setVisibleChars] = useState(0);
  const totalChars = codeLines.join("\n").length;

  useEffect(() => {
    if (!inView) return;
    let current = 0;
    const interval = setInterval(() => {
      current += 2;
      if (current >= totalChars) {
        setVisibleChars(totalChars);
        clearInterval(interval);
      } else {
        setVisibleChars(current);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [inView, totalChars]);

  const fullText = codeLines.join("\n");
  const visibleText = fullText.slice(0, visibleChars);
  const lines = visibleText.split("\n");

  const renderLine = (line: string) => {
    if (line === "---")
      return (
        <span className="text-muted-foreground/40">{line}</span>
      );
    if (line === "") return <span>&nbsp;</span>;
    if (line.startsWith("# "))
      return <span className="text-accent">{line}</span>;
    if (line.startsWith("## "))
      return <span className="text-accent/80">{line}</span>;
    if (line.startsWith("- "))
      return <span className="text-foreground/75">{line}</span>;
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 20) {
      return (
        <>
          <span className="text-accent/70">
            {line.slice(0, colonIdx)}
          </span>
          <span className="text-muted-foreground/70">
            {line.slice(colonIdx)}
          </span>
        </>
      );
    }
    return <span className="text-foreground/70">{line}</span>;
  };

  return (
    <div ref={ref} className="terminal-panel overflow-x-auto">
      <div className="terminal-panel-header">
        <div className="terminal-dot" />
        <div className="terminal-dot" />
        <div className="terminal-dot" />
        <span className="ml-2 text-muted-foreground/50 font-mono text-[10px]">
          you.md identity bundle
        </span>
      </div>
      <div className="p-5">
        <pre className="font-mono text-[11px] md:text-[12px] leading-[1.9] min-h-[200px]">
          <code>
            {lines.map((line, i) => (
              <div key={i}>{renderLine(line)}</div>
            ))}
            {visibleChars < totalChars && (
              <span className="cursor-blink text-accent">
                {"\u2588"}
              </span>
            )}
          </code>
        </pre>
      </div>
    </div>
  );
};

const WhatsInside = () => (
  <section id="spec" className="py-24 md:py-32">
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- what&apos;s inside --
        </p>
        <p className="text-muted-foreground text-[13px] font-body mb-10">
          Your identity, structured for machines and humans.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <TypewriterCode />
      </FadeUp>

      <FadeUp delay={0.2}>
        <div className="mt-8 grid grid-cols-2 gap-4">
          {[
            {
              label: "identity",
              desc: "bio, role, projects -- agents skip the intro",
            },
            {
              label: "voice",
              desc: "how you write, per platform. responses match your tone.",
            },
            {
              label: "directives",
              desc: "your rules for AI: tone, never-do list, decision framework",
            },
            {
              label: "context",
              desc: "what you're working on now. goals. private notes for trusted agents.",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="py-3 border-l-2 border-accent/20 pl-3"
            >
              <p className="text-foreground font-mono text-[11px] mb-0.5">
                {item.label}
              </p>
              <p className="text-muted-foreground/70 font-body text-[11px]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </FadeUp>
    </div>
  </section>
);

export default WhatsInside;
