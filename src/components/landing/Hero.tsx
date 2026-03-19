"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { Copy, Check } from "lucide-react";
import PixelYOU from "./PixelYOU";
import HeroPortrait from "./HeroPortrait";

/* -- Boot sequence -- */
const BootSequence = () => {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"typing" | "tagline" | "done">(
    "typing"
  );

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-mono text-[11px] text-muted-foreground"
        >
          {typed}
          <span className="cursor-blink text-accent">
            {"\u2588"}
          </span>
        </motion.div>
      )}
      {(phase === "tagline" || phase === "done") && (
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-[11px] text-accent"
          >
            identity context protocol
          </motion.div>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-mono text-[10px] text-muted-foreground mt-1"
            >
              mcp for your identity
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
    <button
      onClick={handleCopy}
      className="cli-pill flex items-center gap-3 px-5 py-3 group"
    >
      <span className="text-muted-foreground">$</span>
      <span className="text-accent font-medium">npx youmd init</span>
      <span className="cursor-blink text-accent">{"\u2588"}</span>
      <span className="ml-2 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
        {copied ? (
          <Check size={13} className="text-success" />
        ) : (
          <Copy size={13} />
        )}
      </span>
    </button>
  );
};

/* -- CLI commands list -- */
const commands = [
  ["you init", "create your identity bundle"],
  ["you sync", "pull from linkedin / github / x"],
  ["you publish", "go live at you.md/username"],
  ["you share", "give any agent your context"],
  ["you agent", "start identity context server"],
];

const Hero = () => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const contentOpacity = useTransform(
    scrollYProgress,
    [0, 0.5, 0.8],
    [1, 0.8, 0]
  );

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-16"
    >
      {/* Beam glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[80%] beam-glow pointer-events-none" />

      {/* BG texture */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-[0.02]">
        <p className="font-mono text-[6px] leading-none text-foreground break-all whitespace-pre-wrap">
          {`$@B%8&#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}?-_+~<>i!lI;:,". `.repeat(
            300
          )}
        </p>
      </div>

      <motion.div
        className="relative z-10 w-full max-w-5xl px-4"
        style={{ opacity: contentOpacity }}
      >
        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* LEFT -- branding & commands */}
          <div className="flex-1 text-left">
            {/* Pixel YOU */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mb-6"
            >
              <PixelYOU />
            </motion.div>

            {/* Boot sequence */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.8 }}
              className="mb-6"
            >
              <BootSequence />
            </motion.div>

            {/* Value prop */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.1 }}
              className="font-mono text-[11px] leading-relaxed text-muted-foreground/60 mb-6 max-w-sm"
            >
              <p>
                help agents find you, know you, work with you --
                instantly.
              </p>
              <p className="mt-1">
                one file. public or private context. scoped,
                shareable, managed via cli.
              </p>
            </motion.div>

            {/* Divider */}
            <div className="w-full h-px bg-border mb-6" />

            {/* Commands */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.5 }}
              className="space-y-1.5 mb-8"
            >
              {commands.map(([cmd, desc]) => (
                <div
                  key={cmd}
                  className="font-mono text-[10px] leading-relaxed"
                >
                  <span className="text-muted-foreground/50">$ </span>
                  <span className="text-accent">{cmd}</span>
                  <span className="text-muted-foreground/30 ml-3">
                    # {desc}
                  </span>
                </div>
              ))}
            </motion.div>

            {/* CLI pill */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.8 }}
              className="mb-6"
            >
              <CliPill />
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 2.1 }}
              className="flex items-center gap-3 font-mono text-[8px] text-muted-foreground/30 uppercase tracking-widest"
            >
              <span>YOU/V1 &middot; OPEN SPEC &middot; FREE</span>
            </motion.div>
          </div>

          {/* RIGHT -- ASCII portrait */}
          <div className="flex-1 flex justify-center">
            <Link
              href="/houston"
              className="block w-full max-w-md group"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                <HeroPortrait />
                <p className="text-center font-mono text-[9px] text-muted-foreground/40 mt-2 group-hover:text-accent/60 transition-colors">
                  &gt; view live profile
                </p>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Command links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2.3 }}
          className="flex items-center justify-center gap-8 font-mono text-[12px] mt-12"
        >
          <a
            href="#get-started"
            className="text-muted-foreground/50 hover:text-accent transition-colors duration-200"
          >
            &gt; get started
          </a>
          <a
            href="#spec"
            className="text-muted-foreground/50 hover:text-accent transition-colors duration-200"
          >
            &gt; view spec
          </a>
          <a
            href="https://github.com/houstongolden/youmd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/50 hover:text-accent transition-colors duration-200"
          >
            &gt; github
          </a>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 inset-x-0 section-divider" />
    </section>
  );
};

export default Hero;
