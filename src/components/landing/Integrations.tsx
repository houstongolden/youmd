"use client";

import FadeUp from "./FadeUp";

const agents = [
  { name: "Claude Code", tier: "primary" },
  { name: "Cursor", tier: "primary" },
  { name: "Codex CLI", tier: "primary" },
  { name: "ChatGPT", tier: "primary" },
  { name: "Gemini", tier: "primary" },
  { name: "Grok", tier: "secondary" },
  { name: "Perplexity", tier: "secondary" },
  { name: "Copilot", tier: "secondary" },
  { name: "Aider", tier: "secondary" },
  { name: "Windsurf", tier: "secondary" },
  { name: "CrewAI", tier: "secondary" },
  { name: "OpenClaw", tier: "secondary" },
];

const methods = [
  { label: "context links", desc: "paste a URL, agent reads your identity" },
  { label: "MCP server", desc: "youmd agent serves context on demand" },
  { label: "plain text", desc: "/ctx/username returns raw markdown" },
  { label: "JSON API", desc: "/api/you/v1/username returns structured data" },
];

const Integrations = () => (
  <section className="py-16 md:py-24">
    <div className="max-w-2xl mx-auto px-6">
      <FadeUp>
        <h2 className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-3 text-center">
          -- works everywhere --
        </h2>
        <p className="text-muted-foreground/70 font-body text-[12px] mb-10 text-center max-w-md mx-auto">
          One link gives every agent your full context. No per-tool config, no
          system prompt hacks, no manual copy-paste.
        </p>
      </FadeUp>

      {/* Agent pills */}
      <FadeUp delay={0.08}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {agents.map((agent) => (
            <span
              key={agent.name}
              className={`font-mono text-[11px] transition-colors duration-300 cursor-default select-none px-3 py-1.5 border hover:scale-105 hover:-translate-y-px transition-transform ${
                agent.tier === "primary"
                  ? "text-accent/80 border-accent/20 hover:border-accent/40 hover:text-accent bg-accent-wash/30"
                  : "text-muted-foreground/60 border-border/60 hover:border-accent/20 hover:text-accent/80"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {agent.name}
            </span>
          ))}
        </div>
      </FadeUp>

      {/* Demo: how it works */}
      <FadeUp delay={0.18}>
        <div className="mt-12 terminal-panel max-w-xl mx-auto">
          <div className="terminal-panel-header">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="ml-2 text-muted-foreground/60 font-mono text-[9px]">
              &gt; sharing context with any agent
            </span>
          </div>
          <div className="p-4 space-y-4">
            {/* User prompt */}
            <div className="space-y-1.5">
              <div className="font-mono text-[9px] text-muted-foreground/40">
                you
              </div>
              <div className="font-mono text-[11px] text-foreground/80 leading-relaxed pl-3 border-l border-accent/20">
                <p>Read my identity before we start:</p>
                <p className="text-accent/70 mt-1">
                  https://you.md/ctx/houston/sk_a1b2c3
                </p>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Agent response */}
            <div className="space-y-1.5">
              <div className="font-mono text-[9px] text-accent/40">agent</div>
              <div className="font-mono text-[11px] text-muted-foreground/70 leading-relaxed pl-3 border-l border-border/40">
                <p>
                  Got it. You&apos;re Houston Golden -- TypeScript-first, building
                  on Next.js + Convex, prefer terminal-native design, no emoji.
                  I&apos;ll match your style. What are we working on?
                </p>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Result */}
            <div className="font-mono text-[9px] text-accent/50 text-center">
              zero onboarding. works in any chat window.
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Integration methods */}
      <FadeUp delay={0.28}>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-xl mx-auto">
          {methods.map((method) => (
            <div
              key={method.label}
              className="text-center px-3 py-3 border border-border/40 bg-[hsl(var(--bg-raised))]/50"
              style={{ borderRadius: "2px" }}
            >
              <p className="font-mono text-[10px] text-accent/70 mb-1">
                {method.label}
              </p>
              <p className="font-mono text-[8px] text-muted-foreground/50 leading-relaxed">
                {method.desc}
              </p>
            </div>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={0.35}>
        <p className="text-center mt-8">
          <span className="text-muted-foreground/50 font-mono text-[10px]">
            + any tool that accepts a URL, file, or MCP connection
          </span>
        </p>
      </FadeUp>
    </div>
  </section>
);

export default Integrations;
