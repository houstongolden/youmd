"use client";

import { useState } from "react";
import { type AgentSession } from "../_data/mock";
import { SessionRail } from "./SessionRail";
import { ResizeHandle } from "./ResizeHandle";
import { ModelMark } from "./ModelSelector";
import { ChatPanel, type AgentAction, type ChatScope } from "./ChatPanel";
import { TerminalView } from "./views/TerminalView";
import { WatchView } from "./WatchView";
import { Icon } from "./icons";

// A thin intelligence bar above local sessions: what task it's on, and — loudly
// — if it's blocked on you. (Watched remote sessions carry their own header.)
function SessionTaskBar({ session }: { session: AgentSession }) {
  if (!session.task && !session.needsYou) return null;
  return (
    <div className="shrink-0 border-b border-[hsl(var(--border))]">
      <div className="flex items-center gap-2 px-4 py-1.5">
        <ModelMark id={session.model} size={14} />
        <span className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{session.agent}</span>
        {session.task && (
          <span className="truncate font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">↳ {session.task}</span>
        )}
      </div>
      {session.needsYou && (
        <div className="flex items-center gap-2 border-t border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 px-4 py-1.5">
          <Icon name="sparkles" size={12} className="text-[hsl(var(--accent))]" />
          <span className="text-[11.5px] text-[hsl(var(--accent))]">Needs you: {session.needsYou}</span>
        </div>
      )}
    </div>
  );
}

// The unified shell: one surface for every agent session — your chat, local CLI
// terminals, and watched remote sessions. The rail switches between them.
export function SessionShell({
  sessions,
  activeId,
  onSelect,
  onNew,
  full = false,
  showRail = true,
  onToggleRail,
  scope,
  onAction,
  chatId,
  chatTitle,
}: {
  sessions: AgentSession[];
  activeId: string;
  onSelect: (s: AgentSession) => void;
  onNew: (project: string) => void;
  full?: boolean;
  showRail?: boolean; // collapse/expand the session list (toggle lives on the panel)
  onToggleRail?: () => void;
  scope: ChatScope;
  onAction: (a: AgentAction, scope?: ChatScope) => void;
  chatId: string;
  chatTitle?: string;
}) {
  const [railWidth, setRailWidth] = useState(172);
  const session = sessions.find((s) => s.id === activeId) ?? sessions[0];

  return (
    <div className="flex h-full min-w-0">
      {showRail && (
        <>
          <div style={{ width: railWidth }} className="shrink-0">
            <SessionRail sessions={sessions} activeId={session.id} onSelect={onSelect} onNew={onNew} onCollapse={onToggleRail} />
          </div>
          <ResizeHandle width={railWidth} setWidth={setRailWidth} min={132} max={300} side="right" />
        </>
      )}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {!showRail && onToggleRail && (
          <button
            onClick={onToggleRail}
            title="Show sessions"
            className="absolute left-1.5 top-1.5 z-10 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-0.5 text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
          >
            <Icon name="chevronsRight" size={14} strokeWidth={1.5} />
          </button>
        )}
        {session.local && <SessionTaskBar session={session} />}
        <div className="min-h-0 flex-1">
          {!session.local ? (
            <WatchView key={session.id} session={session} />
          ) : session.kind === "terminal" ? (
            <TerminalView />
          ) : (
            <ChatPanel full={full} scope={scope} onAction={onAction} chatId={chatId} chatTitle={chatTitle} />
          )}
        </div>
      </div>
    </div>
  );
}
