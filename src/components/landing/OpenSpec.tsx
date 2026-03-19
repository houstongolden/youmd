"use client";

import { motion } from "motion/react";
import FadeUp from "./FadeUp";

const OpenSpec = () => (
  <section className="py-16 md:py-20">
    <div className="max-w-xl mx-auto px-6">
      <div className="section-divider mb-12" />
      <FadeUp>
        <div className="text-center py-8">
          <p className="text-muted-foreground/60 font-mono text-[10px] mb-6 tracking-wider uppercase">
            -- open standard --
          </p>
          <p className="text-foreground/80 font-mono text-[14px] font-light leading-relaxed">
            <motion.span
              className="text-accent inline-block"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              you/v1
            </motion.span>{" "}
            is an open protocol. No vendor lock-in. No walled gardens.
          </p>
          <p className="text-muted-foreground font-body text-[13px] mt-2">
            Your identity belongs to you. Read it, fork it, self-host
            it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <a
              href="https://github.com/houstongolden/youmd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors duration-200"
            >
              &gt; cat spec.you &rarr;
            </a>
            <a
              href="https://github.com/houstongolden/youmd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 font-mono text-[11px] hover:text-accent transition-colors duration-200"
            >
              &gt; github &rarr;
            </a>
          </div>
        </div>
      </FadeUp>
      <div className="section-divider mt-12" />
    </div>
  </section>
);

export default OpenSpec;
