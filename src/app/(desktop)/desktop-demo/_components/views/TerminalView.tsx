"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "../../_lib/cn";

type Line = { kind: "in" | "out" | "sys"; text: string };

const AGENTS = [
  { id: "claude", label: "claude code", prompt: "claude" },
  { id: "codex", label: "codex", prompt: "codex" },
  { id: "shell", label: "shell", prompt: "~/youmd" },
];

const BANNER: Record<string, Line[]> = {
  claude: [
    { kind: "sys", text: "● Claude Code — connected to you.md MCP (whoami: @houstongolden)" },
    { kind: "sys", text: "  identity context loaded · 10 skills · 55 projects" },
  ],
  codex: [
    { kind: "sys", text: "● Codex CLI — you.md context injected via AGENTS.md" },
  ],
  shell: [{ kind: "sys", text: "● zsh — youmd runtime active (sync daemon: live)" }],
};

// Canned, vibe-y responses so the terminal feels real without doing anything.
function respond(agent: string, cmd: string): Line[] {
  const c = cmd.trim().toLowerCase();
  if (!c) return [];
  if (c === "clear") return [];
  if (c === "help")
    return [
      { kind: "out", text: "demo commands: whoami · status · skills · sync · spawn <name> · clear" },
    ];
  if (c === "whoami")
    return [{ kind: "out", text: "@houstongolden — you.md brain · 3 machines synced" }];
  if (c === "status")
    return [
      { kind: "out", text: "brain ........ synced (just now)" },
      { kind: "out", text: "skills ....... 10 installed · 7 shared" },
      { kind: "out", text: "agents ....... 3 active sub-agents" },
    ];
  if (c === "skills")
    return [
      { kind: "out", text: "portfolio-graph-auditor   braindump-task-router" },
      { kind: "out", text: "machine-bootstrap         youstack-maintainer" },
    ];
  if (c === "sync")
    return [
      { kind: "out", text: "↑ pushing identity bundle…" },
      { kind: "out", text: "✓ synced across 3 machines · repo mirror current" },
    ];
  if (c.startsWith("spawn"))
    return [
      { kind: "out", text: `forking identity → ${c.split(" ")[1] || "you"}-sub-agent` },
      { kind: "out", text: "✓ sub-agent online" },
    ];
  return [
    { kind: "out", text: `${agent}: running "${cmd}"…` },
    { kind: "out", text: "(demo) this terminal is a design mock — wire to PTY in the real app." },
  ];
}

export function TerminalView() {
  const [agent, setAgent] = useState("claude");
  const [history, setHistory] = useState<Record<string, Line[]>>({
    claude: BANNER.claude,
    codex: BANNER.codex,
    shell: BANNER.shell,
  });
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lines = history[agent];
  const promptStr = AGENTS.find((a) => a.id === agent)!.prompt;

  useEffect(() => {
    endRef.current?.scrollIntoView();
  }, [lines, agent]);

  const submit = () => {
    const cmd = input;
    setInput("");
    if (cmd.trim().toLowerCase() === "clear") {
      setHistory((h) => ({ ...h, [agent]: [] }));
      return;
    }
    setHistory((h) => ({
      ...h,
      [agent]: [...h[agent], { kind: "in", text: cmd }, ...respond(agent, cmd)],
    }));
  };

  return (
    <div className="flex h-full flex-col bg-[hsl(var(--bg))]">
      {/* agent tabs — Conductor/Cmux style */}
      <div className="flex items-center gap-1 border-b border-[hsl(var(--border))] px-2.5 py-1.5">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgent(a.id)}
            className={cn(
              "rounded-sm px-2.5 py-1 font-mono text-[11px] transition-colors",
              agent === a.id
                ? "bg-[hsl(var(--bg-raised))] text-[hsl(var(--accent))]"
                : "text-[hsl(var(--text-secondary))]/70 hover:text-[hsl(var(--text-primary))]",
            )}
          >
            {a.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
          run any CLI agent inside you.md
        </span>
      </div>

      {/* output */}
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

        {/* live input line */}
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
