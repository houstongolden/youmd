"use client";

import FadeUp from "./FadeUp";
import AsciiPortraitGenerator from "./AsciiPortraitGenerator";

const PortraitSection = () => (
  <section id="portrait" className="py-24 md:py-32">
    <div className="max-w-xl mx-auto px-6">
      <FadeUp>
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- ascii portrait --
        </p>
        <p className="text-foreground/90 font-mono text-[15px] md:text-[17px] font-light leading-[1.8] tracking-tight mb-3">
          what you look like to machines.
        </p>
        <p className="text-muted-foreground text-[13px] font-body mb-10 max-w-md">
          your profile photo, rendered as code. four formats -- classic, braille,
          block, minimal. generated automatically from your social profiles.
          the visual signature of your identity on the agent internet.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <AsciiPortraitGenerator />
      </FadeUp>

      <FadeUp delay={0.2}>
        <div className="mt-8 grid grid-cols-2 gap-4 font-mono text-[11px]">
          <div className="py-2 border-l-2 border-accent/20 pl-3">
            <span className="text-foreground/80">auto-generated</span>
            <p className="text-muted-foreground/60 text-[10px] mt-0.5">
              from linkedin, github, x profile images
            </p>
          </div>
          <div className="py-2 border-l-2 border-accent/20 pl-3">
            <span className="text-foreground/80">4 render modes</span>
            <p className="text-muted-foreground/60 text-[10px] mt-0.5">
              classic, braille, block, minimal
            </p>
          </div>
          <div className="py-2 border-l-2 border-accent/20 pl-3">
            <span className="text-foreground/80">terminal + web</span>
            <p className="text-muted-foreground/60 text-[10px] mt-0.5">
              renders in cli, profile pages, og cards
            </p>
          </div>
          <div className="py-2 border-l-2 border-accent/20 pl-3">
            <span className="text-foreground/80">exportable</span>
            <p className="text-muted-foreground/60 text-[10px] mt-0.5">
              download as png or copy as text
            </p>
          </div>
        </div>
      </FadeUp>
    </div>
  </section>
);

export default PortraitSection;
