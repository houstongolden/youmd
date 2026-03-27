"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import FadeUp from "./FadeUp";

const faqs = [
  {
    q: "what is you.md exactly?",
    a: "a structured identity file that gives AI agents context about who you are. your name, projects, values, preferences, voice -- all in one portable bundle any agent can read.",
  },
  {
    q: "how is this different from a system prompt?",
    a: "system prompts are per-tool, per-session, and forgotten. you.md is persistent, portable, and works across every agent. write once, share everywhere.",
  },
  {
    q: "what data does my bundle include?",
    a: "your public profile (bio, projects, values, links), voice analysis (how you write), agent directives (how you want AI to talk to you), and optionally private context for trusted agents.",
  },
  {
    q: "is my data private?",
    a: "you control everything. public profiles live at you.md/username. private context requires scoped tokens. you can self-host with youmd export. your API keys are hashed, never stored raw.",
  },
  {
    q: "do i need to sign up?",
    a: "yes, but it takes 30 seconds. sign up with email + password, then the AI builds your identity through conversation. your data is encrypted and you control who sees what.",
  },
  {
    q: "which agents work with you.md?",
    a: "any agent that can read a URL or accept context. tested with Claude Code, Cursor, ChatGPT, Codex, Perplexity, Gemini, Grok, and more. share your link and it just works.",
  },
  {
    q: "what's the you/v1 spec?",
    a: "an open protocol for structured identity bundles. plain markdown files that compile to JSON. no vendor lock-in. fork it, self-host it, build on it.",
  },
  {
    q: "is there an API?",
    a: "yes. 30+ HTTP endpoints for reading profiles, managing context, chat, memory, and more. full docs at you.md/docs.",
  },
];

const FAQItem = ({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[0];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <FadeUp delay={index * 0.04}>
    <motion.div
      whileHover={{
        borderColor: "hsl(var(--accent) / 0.15)",
      }}
      className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] transition-colors overflow-hidden"
      style={{ borderRadius: "2px" }}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 cursor-pointer"
      >
        <span className="font-mono text-[12px] text-accent leading-relaxed">
          {faq.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="text-muted-foreground/40 font-mono text-[14px] shrink-0 select-none"
        >
          +
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-0">
              <div className="border-t border-[hsl(var(--border))] pt-3">
                <p className="font-body text-[12px] text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  </FadeUp>
);

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="max-w-xl mx-auto px-6">
        <FadeUp>
          <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
            -- frequently asked --
          </p>
          <p className="text-muted-foreground text-[13px] font-body mb-14">
            The short answers to the obvious questions.
          </p>
        </FadeUp>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              faq={faq}
              index={i}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>

        <FadeUp delay={0.35}>
          <p className="text-muted-foreground/60 font-mono text-[10px] text-center mt-10">
            still have questions? run{" "}
            <span className="text-accent">youmd chat</span> and ask the agent.
          </p>
        </FadeUp>
      </div>
    </section>
  );
};

export default FAQ;
