"use client";

import { useState } from "react";
import { SESSIONS, type AgentSession } from "../_data/mock";
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
  activeId,
  onSelect,
  onNew,
  full = false,
  showRail = true,
  scope,
  onAction,
  chatId,
  chatTitle,
}: {
  activeId: string;
  onSelect: (s: AgentSession) => void;
  onNew: (project: string) => void;
  full?: boolean;
  showRail?: boolean; // controlled by the top-bar « » toggle; no empty column when off
  scope: ChatScope;
  onAction: (a: AgentAction, scope?: ChatScope) => void;
  chatId: string;
  chatTitle?: string;
}) {
  const [railWidth, setRailWidth] = useState(172);
  const session = SESSIONS.find((s) => s.id === activeId) ?? SESSIONS[0];

  return (
    <div className="flex h-full min-w-0">
      {showRail && (
        <>
          <div style={{ width: railWidth }} className="shrink-0">
            <SessionRail activeId={session.id} onSelect={onSelect} onNew={onNew} />
          </div>
          <ResizeHandle width={railWidth} setWidth={setRailWidth} min={132} max={300} side="right" />
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
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
