"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { SEED_CHAT, CHATS, type ChatMessage } from "../_data/mock";
import { Markdown } from "./Markdown";
import { Icon } from "./icons";
import { Dot } from "./primitives";
import { cn } from "../_lib/cn";
import { useAllowMockFallback } from "../_lib/RealDataContext";

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

export type ChatScope = {
  view: string;
  label: string; // what the agent is "looking at" with you
  project?: string;
};

export type AgentAction = "promote-task" | "spawn" | "sync" | "forge-skill" | "improve-skill";
type Suggestion = { label: string; action?: AgentAction };

// Contextual agent actions per view — the "light-touch direction" layer.
// Clicking one drops a scope-aware message into the chat; some also trigger a
// real effect (create a task, spawn an agent, sync) via onAction.
function suggestionsFor(scope?: ChatScope): Suggestion[] {
  const p = scope?.project;
  switch (scope?.view) {
    case "projects":
      return p
        ? [{ label: `Spawn coding-you on ${p}`, action: "spawn" }, { label: `Triage ${p} tasks` }, { label: `Summarize ${p} this week` }]
        : [{ label: "Which project needs me most?" }, { label: "Summarize this week" }, { label: "What should I build next?" }];
    case "editor":
      return [{ label: "Capture a new memory" }, { label: "Promote an idea to a task", action: "promote-task" }, { label: "What are my goals again?" }];
    case "tasks":
      return [{ label: "Delegate the top task to an agent", action: "spawn" }, { label: "What's blocking me?" }, { label: "Group tasks by project" }];
    case "skills":
      return [{ label: "Improve a skill from usage", action: "improve-skill" }, { label: "Forge a new skill from a pattern", action: "forge-skill" }, { label: "Any duplicated skills?" }];
    case "agents":
      return [{ label: "Spawn a YOU sub-agent", action: "spawn" }, { label: "What are my agents doing?" }, { label: "Sync all machines now", action: "sync" }];
    case "graph":
      return [{ label: "What connects to you.md?" }, { label: "Show isolated nodes" }, { label: "Trace bamfsite dependencies" }];
    case "apps":
      return [{ label: "What are my crawlers pulling?" }, { label: "Summarize my GitHub activity" }, { label: "Connect a new app" }];
    default:
      return [{ label: "What needs my attention today?" }, { label: "Summarize this week across projects" }, { label: "What should I build next?" }];
  }
}

// Seed a conversation for a given chat thread. The first thread shows the
// demo's canned exchange; brand-new chats start empty; others get a short
// "picking up where we left off" history derived from their title.
function seedFor(chatId: string, title?: string): ChatMessage[] {
  if (chatId.startsWith("new")) return [];
  if (chatId === CHATS[0].id) return SEED_CHAT;
  const t = title ?? "this thread";
  return [
    { id: `${chatId}-u`, role: "user", text: t },
    { id: `${chatId}-a`, role: "agent", text: `Picking up **${t}**. Want me to keep going, or recap where we left off?` },
  ];
}

export function ChatPanel({
  full = false,
  scope,
  onAction,
  chatId = CHATS[0].id,
  chatTitle,
}: {
  full?: boolean;
  scope?: ChatScope;
  onAction?: (action: AgentAction, scope?: ChatScope) => void;
  chatId?: string;
  chatTitle?: string;
}) {
  const allowMockFallback = useAllowMockFallback();
  const [messages, setMessages] = useState<ChatMessage[]>(() => allowMockFallback ? seedFor(chatId, chatTitle) : []);
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [thinkIdx] = useState(() => Math.floor(Math.random() * THINKING.length));
  const endRef = useRef<HTMLDivElement>(null);

  // Switching threads (or starting a new chat) swaps the conversation.
  useEffect(() => {
    setMessages(allowMockFallback ? seedFor(chatId, chatTitle) : []);
    setWorking(false);
    // chatTitle intentionally omitted — chatId drives the reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowMockFallback, chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, working]);

  const send = (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || working) return;
    setInput("");
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", text }]);
    if (!allowMockFallback) {
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "agent",
          text: "This production shell is currently showing real state only. The live You Agent stream is available in the classic shell while this new shell is being wired.",
        },
      ]);
      return;
    }
    setWorking(true);
    setTimeout(() => {
      setWorking(false);
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "agent",
          text: scope?.label
            ? `On it — using your **${scope.label}** context plus your brain.\n\n*(Demo response — the real desktop app streams this from your you.md agent.)*`
            : "On it. I pulled the relevant context from your brain and lined up the next move.\n\n*(Demo response — the real desktop app streams this from your you.md agent.)*",
        },
      ]);
    }, 2100);
  };

  return (
    <div className="flex h-full flex-col">
      {/* messages */}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", full ? "px-0" : "px-4")}>
        {messages.length === 0 && !working ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Icon name="sparkles" size={22} className="mb-3 text-[hsl(var(--accent))]" />
            <div className="font-mono text-lg tracking-tight text-[hsl(var(--text-primary))]">
              What can I help you with?
            </div>
            <p className="mt-1.5 max-w-xs text-[13px] text-[hsl(var(--text-secondary))]/70">
              Describe what you want to do — I&apos;ll use your full you.md context.
            </p>
          </div>
        ) : (
        <div className={cn("mx-auto space-y-4 py-5", full ? "max-w-2xl px-6" : "")}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Bubble m={m} />
            </motion.div>
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
        )}
      </div>

      {/* composer */}
      <div className={cn("border-t border-[hsl(var(--border))] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]", full && "px-6")}>
        <div className={cn("mx-auto", full && "max-w-2xl")}>
          {/* contextual agent suggestions */}
          {!working && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {suggestionsFor(scope).map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    send(s.label);
                    if (s.action) onAction?.(s.action, scope);
                  }}
                  className="shrink-0 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2.5 py-1 text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--accent))]/40 hover:text-[hsl(var(--text-primary))]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
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
              onClick={() => send()}
              disabled={!input.trim()}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[hsl(var(--accent))] text-white transition-opacity disabled:opacity-30"
            >
              <Icon name="send" size={15} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2 px-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
            <Icon name="stack" size={11} /> you.md · {scope?.label ?? "all context"} · claude-sonnet-4.6
          </div>
        </div>
      </div>
    </div>
  );
}
