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

          <blockquote className="font-mono text-sm md:text-base leading-relaxed text-foreground/85 space-y-4">
            <p>
              <span className="text-accent">&gt;</span> I got sick of
              re-introducing myself to every new agent I started
              working with. Who I am, what I&apos;m building, what
              matters, my preferences -- every session started from a
              blank slate.
            </p>
            <p>
              <span className="text-accent">&gt;</span> I realized
              there needed to be a simple, agent-driven identity
              context protocol -- one link that gives any agent full
              context about you instantly. Turns out others had the
              same problem and had hacked together their own systems
              or just dealt with it.
            </p>
            <p>
              <span className="text-accent">&gt;</span> So I created{" "}
              <span className="text-accent font-medium">you.md</span>
              .
            </p>
          </blockquote>

          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded overflow-hidden border border-border">
                <AsciiAvatar
                  src="/assets/houston-portrait.jpeg"
                  cols={40}
                  canvasWidth={40}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="font-mono text-xs text-foreground/80">
                  Houston Golden
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/50">
                  founder &middot; you.md
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeUp>
    <div className="absolute bottom-0 inset-x-0 section-divider" />
  </section>
);

export default FounderQuote;
