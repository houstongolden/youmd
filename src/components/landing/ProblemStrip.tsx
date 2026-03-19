"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import FadeUp from "./FadeUp";

const painPoints = [
  "re-explain who you are",
  "lost context between tools",
  "agents that forget everything",
];

const ProblemStrip = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [30, -30]);

  return (
    <section ref={ref} className="py-24 md:py-32 overflow-hidden">
      <motion.div
        className="max-w-xl mx-auto px-6 text-center"
        style={{ y }}
      >
        <FadeUp>
          <p className="text-muted-foreground/60 font-mono text-[10px] mb-8 tracking-widest uppercase">
            -- the problem --
          </p>
          <p className="text-foreground/90 font-mono text-[15px] md:text-[17px] font-light leading-[1.8] tracking-tight">
            every agent starts from scratch.{" "}
            <span className="text-accent">
              you re-explain yourself endlessly.
            </span>
          </p>
          <p className="text-muted-foreground text-[13px] font-body mt-6 leading-relaxed max-w-md mx-auto">
            you.md fixes that -- one link, full context, every agent.
          </p>
        </FadeUp>
        <FadeUp delay={0.15}>
          <div className="mt-10 flex flex-wrap justify-center gap-3 font-mono text-[10px]">
            {painPoints.map((item, i) => (
              <motion.span
                key={item}
                className="text-destructive/70 border border-destructive/20 px-3 py-1 rounded"
                whileInView={{ opacity: [0, 1] }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {"\u2717"} {item}
              </motion.span>
            ))}
          </div>
        </FadeUp>
        <FadeUp delay={0.25}>
          <p className="text-foreground/60 font-mono text-[12px] mt-8 italic">
            you shouldn&apos;t have to onboard{" "}
            <span className="text-accent">yourself</span> to your own
            tools.
          </p>
          <p className="text-accent/70 font-mono text-[11px] mt-3">
            you.md makes this go away &rarr;
          </p>
        </FadeUp>
      </motion.div>
    </section>
  );
};

export default ProblemStrip;
