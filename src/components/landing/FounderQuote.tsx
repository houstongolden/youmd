"use client";

import FadeUp from "./FadeUp";
import AsciiAvatar from "./AsciiAvatar";

const FounderQuote = () => (
  <section className="relative py-20 px-4">
    <FadeUp>
      <div className="max-w-3xl mx-auto">
        {/* Quote block */}
        <div className="terminal-panel p-8 md:p-12">
          <div className="terminal-panel-header -mx-8 -mt-8 md:-mx-12 md:-mt-12 mb-8">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="font-mono text-[10px] text-muted-foreground/40 ml-2">
              founder.log
            </span>
          </div>

          <div className="font-mono text-[10px] text-muted-foreground/40 mb-4">
            $ cat /why/youmd.txt
          </div>

          <blockquote className="font-mono text-sm md:text-base leading-relaxed text-[hsl(var(--text-primary)/0.85)] space-y-4">
            <p>
              <span className="text-accent">&gt;</span> I run agents
              constantly -- dozens a day, across more projects than I
              can count. for a while, every new one started from scratch.
              who am I, what am I building, how do I like to work.
            </p>
            <p>
              <span className="text-accent">&gt;</span> so I built a
              system: a personal context layer, shared conventions,
              identity files, project structure, reusable skills. one
              command and any agent knows everything.
            </p>
            <p>
              <span className="text-accent">&gt;</span> then I turned
              it into{" "}
              <span className="text-accent font-medium">you.md</span>
              {" "}-- so anyone can have it.
            </p>
          </blockquote>

          <div className="mt-8 pt-6 border-t border-[hsl(var(--border))]">
            {/* Cycle 67: bumped to min-h-[44px] tap area (was 40 tall, constrained
                by the 40x40 avatar div). Cycle 65 missed this file. */}
            <a href="/houstongolden" className="flex items-center gap-3 min-h-[44px] py-1 group">
              <div className="w-10 h-10 overflow-hidden border border-[hsl(var(--border))] group-hover:border-accent/30 transition-colors" style={{ borderRadius: "2px" }}>
                <AsciiAvatar
                  src="/assets/houston-portrait.jpeg"
                  cols={40}
                  canvasWidth={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="font-mono text-xs text-[hsl(var(--text-primary)/0.8)] group-hover:text-accent transition-colors">
                  Houston Golden
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/50">
                  founder &middot; you.md/houstongolden
                </div>
              </div>
            </a>
          </div>
        </div>
      </div>
    </FadeUp>
    <div className="absolute bottom-0 inset-x-0 section-divider" />
  </section>
);

export default FounderQuote;
