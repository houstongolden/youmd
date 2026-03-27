"use client";

import { motion } from "motion/react";
import FadeUp from "./FadeUp";

const useCases = [
  {
    label: "zero cold start",
    desc: "new user signs up with their you.md — your app knows their name, role, preferences, and voice before they type a word.",
  },
  {
    label: "instant personalization",
    desc: "agent preferences, communication style, tools they use — skip the settings wizard. adapt from day one.",
  },
  {
    label: "cross-app context",
    desc: "users build identity once. every app they connect gets the same rich context. no more per-tool onboarding.",
  },
  {
    label: "higher retention",
    desc: "personalized from first interaction. users feel understood, not interrogated. stickiness from minute one.",
  },
];

const integrationMethods = [
  { label: "MCP server", code: "youmd mcp connect", desc: "agent serves identity context on demand" },
  { label: "REST API", code: "GET /api/v1/profiles?username=x", desc: "structured identity data as JSON" },
  { label: "context links", code: "https://you.md/ctx/user/token", desc: "scoped, expiring identity access" },
  { label: "OAuth flow", code: "coming soon", desc: "\"sign in with you.md\" for AI-native apps" },
];

const ForDevelopers = () => (
  <section className="py-20 md:py-28">
    <div className="max-w-2xl mx-auto px-6">
      <FadeUp>
        <div className="text-center mb-12">
          <span className="inline-block font-mono text-[9px] uppercase tracking-widest text-accent/70 border border-accent/20 px-3 py-1 mb-4"
            style={{ borderRadius: "2px" }}
          >
            for AI builders
          </span>
          <h2 className="font-mono text-lg text-foreground/90 mb-3">
            integrate identity context into your app
          </h2>
          <p className="text-muted-foreground/60 font-body text-[13px] leading-relaxed max-w-md mx-auto">
            let users bring their full context when they sign up.
            eliminate the cold start problem. personalize from the first interaction.
          </p>
        </div>
      </FadeUp>

      {/* Use cases */}
      <FadeUp delay={0.1}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.label}
              className="border border-border/40 bg-[hsl(var(--bg-raised))]/50 p-4"
              style={{ borderRadius: "2px" }}
              whileInView={{ opacity: [0, 1], y: [8, 0] }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.06 }}
            >
              <p className="font-mono text-[11px] text-accent/80 mb-1.5">
                {uc.label}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/50 leading-relaxed">
                {uc.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </FadeUp>

      {/* Integration methods */}
      <FadeUp delay={0.2}>
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="ml-2 text-muted-foreground/50 font-mono text-[10px]">
              integration methods
            </span>
          </div>
          <div className="p-5 space-y-4">
            {integrationMethods.map((method, i) => (
              <motion.div
                key={method.label}
                className="flex items-start gap-4"
                whileInView={{ opacity: [0, 1] }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 + i * 0.08 }}
              >
                <span className="font-mono text-[10px] text-accent/70 w-24 shrink-0 pt-0.5">
                  {method.label}
                </span>
                <div className="flex-1">
                  <code className="font-mono text-[10px] text-foreground/70">
                    {method.code}
                  </code>
                  <p className="font-mono text-[9px] text-muted-foreground/40 mt-0.5">
                    {method.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={0.3}>
        <p className="text-center mt-8 font-mono text-[10px] text-muted-foreground/40">
          API docs at{" "}
          <a href="/docs" className="text-accent/60 hover:text-accent transition-colors">
            you.md/docs
          </a>
          {" "}-- MCP server + OAuth coming soon
        </p>
      </FadeUp>
    </div>
  </section>
);

export default ForDevelopers;
