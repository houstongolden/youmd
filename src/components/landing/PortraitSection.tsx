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
        <p className="text-muted-foreground text-[13px] font-body mb-10">
          A visual fingerprint for your identity. Recognizable by
          humans and machines.
        </p>
      </FadeUp>

      <FadeUp delay={0.1}>
        <AsciiPortraitGenerator />
      </FadeUp>
    </div>
  </section>
);

export default PortraitSection;
