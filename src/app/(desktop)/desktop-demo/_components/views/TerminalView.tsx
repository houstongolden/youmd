"use client";

import { useState, useRef, useEffect } from "react";
import { MODELS, type ModelId } from "../../_data/mock";
import { ModelSelector } from "../ModelSelector";
import { cn } from "../../_lib/cn";

type Line = { kind: "in" | "out" | "sys"; text: string };

const PROMPT: Record<ModelId, string> = {
  "claude-code": "claude",
  codex: "codex",
  cursor: "cursor",
  pi: "pi",
  openclaw: "claw",
  hermes: "hermes",
  shell: "~/youmd",
};

function banner(model: ModelId): Line[] {
  const label = MODELS.find((m) => m.id === model)?.label ?? model;
  if (model === "shell") return [{ kind: "sys", text: "● zsh — youmd runtime active (sync daemon: live)" }];
  return [
    { kind: "sys", text: `● ${label} — you.md context injected (whoami: @houstongolden)` },
    { kind: "sys", text: "  identity loaded · 12 skills · 6 active projects" },
  ];
}

function respond(agent: string, cmd: string): Line[] {
  const c = cmd.trim().toLowerCase();
  if (!c || c === "clear") return [];
  if (c === "help") return [{ kind: "out", text: "demo commands: whoami · status · skills · sync · spawn <name> · clear" }];
  if (c === "whoami") return [{ kind: "out", text: "@houstongolden — you.md brain · 3 machines synced" }];
  if (c === "status")
    return [
      { kind: "out", text: "brain ........ synced (just now)" },
      { kind: "out", text: "skills ....... 12 shared · mesh-synced" },
      { kind: "out", text: "agents ....... 4 sessions across 4 projects" },
    ];
  if (c === "skills") return [{ kind: "out", text: "agent-stack-sync  skill-governor  braindump-task-router  …" }];
  if (c === "sync") return [{ kind: "out", text: "↑ pushing identity…" }, { kind: "out", text: "✓ synced across 3 machines" }];
  if (c.startsWith("spawn")) return [{ kind: "out", text: `forking identity → ${c.split(" ")[1] || "you"}-sub-agent` }, { kind: "out", text: "✓ sub-agent online" }];
  return [{ kind: "out", text: `${agent}: running "${cmd}"…` }, { kind: "out", text: "(demo) wire to the agent's PTY / cloud sandbox in the real app." }];
}

export function TerminalView() {
  const [model, setModel] = useState<ModelId>("claude-code");
  const [history, setHistory] = useState<Record<string, Line[]>>({});
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lines = history[model] ?? banner(model);
  const promptStr = PROMPT[model];

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [lines, model]);

  const submit = () => {
    const cmd = input;
    setInput("");
    if (cmd.trim().toLowerCase() === "clear") {
      setHistory((h) => ({ ...h, [model]: [] }));
      return;
    }
    setHistory((h) => ({
      ...h,
      [model]: [...(h[model] ?? banner(model)), { kind: "in", text: cmd }, ...respond(promptStr, cmd)],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--bg))]">
      {/* model selector — dropdown, not a horizontal tab row */}
      <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-2.5 py-1.5">
        <ModelSelector value={model} onChange={setModel} />
        <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40 sm:inline">
          any CLI agent · local or cloud sandbox
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              l.kind === "in" && "text-[hsl(var(--text-primary))]",
              l.kind === "out" && "text-[hsl(var(--text-secondary))]",
              l.kind === "sys" && "text-[hsl(var(--accent-mid))]",
            )}
          >
            {l.kind === "in" ? (
              <>
                <span className="text-[hsl(var(--accent))]">{promptStr} ❯ </span>
                {l.text}
              </>
            ) : (
              l.text
            )}
          </div>
        ))}
        <div className="flex items-center text-[hsl(var(--text-primary))]">
          <span className="text-[hsl(var(--accent))]">{promptStr} ❯&nbsp;</span>
          <input
            ref={inputRef}
            value={input}
            autoFocus
            spellCheck={false}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="flex-1 bg-transparent font-mono text-[12.5px] outline-none"
            placeholder="type a command — try: status, skills, spawn writing"
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}
