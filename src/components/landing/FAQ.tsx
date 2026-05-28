"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import FadeUp from "./FadeUp";
import { Container, Section, SectionHeader } from "@/components/ui/Layout";

const faqs = [
  {
    q: "what is you.md exactly?",
    a: "your agent brain plus named expertise stacks. the brain stores identity, memory, preferences, and project context; stacks package the skills and workflows agents should use.",
  },
  {
    q: "how is this different from a system prompt?",
    a: "system prompts are per-tool and per-session. you.md is persistent, portable, shareable, and installable into Claude Code, Codex, Cursor, or any agent that can read files, URLs, API, or MCP.",
  },
  {
    q: "is my data private?",
    a: "you control what is public. private context requires scoped tokens or authenticated access, and you can revoke links or export your files.",
  },
  {
    q: "which agents work with you.md?",
    a: "Claude Code, Cursor, Codex, ChatGPT, and any agent that can read a URL, local file, pasted context, protected API endpoint, or MCP server.",
  },
  {
    q: "do i need to sign up?",
    a: "yes. email-code auth takes about 30 seconds, then U builds your brain conversationally and helps organize your first private stacks.",
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
