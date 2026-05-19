"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import FadeUp from "./FadeUp";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const faqs = [
  {
    q: "what is you.md exactly?",
    a: "an identity context protocol: your profile, projects, values, preferences, voice, and directives structured so any agent can onboard instantly.",
  },
  {
    q: "how is this different from a system prompt?",
    a: "system prompts are per-tool and per-session. you.md is persistent, portable, shareable, and readable as markdown, JSON, URLs, or MCP context.",
  },
  {
    q: "is my data private?",
    a: "you control what is public. private context requires scoped tokens or authenticated access, and you can revoke links or export your files.",
  },
  {
    q: "which agents work with you.md?",
    a: "Claude Code, Cursor, Codex, ChatGPT, and any agent that can read a URL, local file, pasted context, API endpoint, or MCP server.",
  },
  {
    q: "do i need to sign up?",
    a: "yes. email-code auth takes about 30 seconds, then U builds your identity context conversationally instead of sending you through a form.",
  },
  {
    q: "what's the you/v1 spec?",
    a: "plain markdown files that compile to structured JSON and agent-ready context. no vendor lock-in, and self-hosting/export are built in.",
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" compact>
      <Container size="narrow">
        <FadeUp>
          <SectionHeader
            eyebrow="faq"
            title="short answers"
            description="The questions people ask before they give another agent their life story again."
            align="center"
          />
        </FadeUp>

        <div className="border-y border-border">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <FadeUp key={faq.q} delay={index * 0.025}>
                <div className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    className="flex min-h-14 w-full items-center justify-between gap-5 px-1 py-4 text-left transition-colors hover:bg-card/40 md:px-3"
                  >
                    <span className="font-mono text-[13px] leading-relaxed text-foreground/88">
                      {faq.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="shrink-0 font-mono text-[18px] leading-none text-accent/70"
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-panel-${index}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="px-1 pb-5 text-[14px] leading-relaxed text-muted-foreground md:px-3">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </FadeUp>
            );
          })}
        </div>
      </Container>
    </Section>
  );
};

export default FAQ;
