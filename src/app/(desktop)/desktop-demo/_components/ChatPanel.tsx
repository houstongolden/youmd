"use client";

import { useState, useRef, useEffect } from "react";
import { SEED_CHAT, type ChatMessage } from "../_data/mock";
import { Markdown } from "./Markdown";
import { Icon } from "./icons";
import { Dot } from "./primitives";
import { cn } from "../_lib/cn";

const WORK_STEPS = ["Reading portfolio graph", "Drafting plan", "Composing reply"];

// Rotating "alive" thinking labels (nod to the CLI BrailleSpinner personality).
const THINKING = [
  "computing your main character energy…",
  "consulting your second brain…",
  "tracing connections…",
];

function WorkingCard() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= WORK_STEPS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [step]);
  return (
    <div className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon name="sparkles" size={12} className="text-[hsl(var(--accent))]" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">
          working
        </span>
      </div>
      <div className="space-y-1.5">
        {WORK_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 text-[12px]">
            <Dot tone={i < step ? "green" : i === step ? "orange" : "dim"} pulse={i === step} size={6} />
            <span className={i <= step ? "text-[hsl(var(--text-secondary))]" : "text-[hsl(var(--text-secondary))]/40"}>
              {s}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-sm bg-[hsl(var(--bg))] px-3 py-2 text-[13px] leading-relaxed text-[hsl(var(--text-primary))]">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-[hsl(var(--border))] text-[hsl(var(--accent))]">
        <Icon name="agent" size={13} />
      </span>
      <div className="min-w-0 flex-1 text-[13px]">
        <Markdown source={m.text} />
      </div>
    </div>
  );
}

export function ChatPanel({ full = false }: { full?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(SEED_CHAT);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [thinkIdx] = useState(() => Math.floor(Math.random() * THINKING.length));
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, working]);

  const send = () => {
    const text = input.trim();
    if (!text || working) return;
    setInput("");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    setWorking(true);
    setTimeout(() => {
      setWorking(false);
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "agent",
          text:
            "On it. I pulled the relevant context from your brain and lined up the next move.\n\n*(Demo response — the real desktop app streams this from your you.md agent.)*",
        },
      ]);
    }, 2100);
  };

  return (
    <div className="flex h-full flex-col">
      {/* messages */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", full ? "px-0" : "px-4")}>
        <div className={cn("mx-auto space-y-4 py-5", full ? "max-w-2xl px-6" : "")}>
          {messages.map((m) => (
            <Bubble key={m.id} m={m} />
          ))}
          {working && (
            <div className="flex gap-2.5">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-[hsl(var(--border))] text-[hsl(var(--accent))]">
                <Icon name="agent" size={13} />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="font-mono text-[11px] italic text-[hsl(var(--text-secondary))]/70">
                  {THINKING[thinkIdx]}
                </div>
                <WorkingCard />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* composer */}
      <div className={cn("border-t border-[hsl(var(--border))] p-3", full && "px-6")}>
        <div className={cn("mx-auto", full && "max-w-2xl")}>
          <div className="flex items-end gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 focus-within:border-[hsl(var(--accent))]/40">
            <textarea
              rows={full ? 2 : 1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask your brain anything…"
              className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-[hsl(var(--text-secondary))]/50"
            />
            <button
              onClick={send}
              disabled={!input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[hsl(var(--accent))] text-white transition-opacity disabled:opacity-30"
            >
              <Icon name="send" size={15} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
            <Icon name="stack" size={11} /> you.md context · claude-sonnet-4.6
          </div>
        </div>
      </div>
    </div>
  );
}
