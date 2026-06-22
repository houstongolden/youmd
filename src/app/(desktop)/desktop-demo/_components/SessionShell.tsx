"use client";

import { SESSIONS, type AgentSession } from "../_data/mock";
import { SessionRail } from "./SessionRail";
import { ChatPanel, type AgentAction, type ChatScope } from "./ChatPanel";
import { TerminalView } from "./views/TerminalView";
import { WatchView } from "./WatchView";

// The unified shell: one surface for every agent session — your chat, local CLI
// terminals, and watched remote sessions on other machines. The rail switches
// between them; the body renders whichever the session is.
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
  onNew: () => void;
  full?: boolean;
  showRail?: boolean;
  scope: ChatScope;
  onAction: (a: AgentAction, scope?: ChatScope) => void;
  chatId: string;
  chatTitle?: string;
}) {
  const session = SESSIONS.find((s) => s.id === activeId) ?? SESSIONS[0];

  return (
    <div className="flex h-full min-w-0">
      {showRail && <SessionRail activeId={session.id} onSelect={onSelect} onNew={onNew} />}
      <div className="min-w-0 flex-1">
        {!session.local ? (
          <WatchView key={session.id} session={session} />
        ) : session.kind === "terminal" ? (
          <TerminalView />
        ) : (
          <ChatPanel full={full} scope={scope} onAction={onAction} chatId={chatId} chatTitle={chatTitle} />
        )}
      </div>
    </div>
  );
}
