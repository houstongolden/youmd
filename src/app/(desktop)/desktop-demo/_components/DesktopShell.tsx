"use client";

import { useState } from "react";
import type { ViewId } from "../_data/mock";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { ChatPanel } from "./ChatPanel";
import { SummaryWidget } from "./SummaryWidget";
import { HomeView } from "./views/HomeView";
import { EditorView } from "./views/EditorView";
import { GraphView } from "./views/GraphView";
import { TasksView } from "./views/TasksView";
import { AppsView } from "./views/AppsView";
import { AgentsView } from "./views/AgentsView";
import { TerminalView } from "./views/TerminalView";

function MainView({
  view,
  onNavigate,
}: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
}) {
  switch (view) {
    case "home":
      return <HomeView onNavigate={onNavigate} />;
    case "editor":
      return <EditorView />;
    case "graph":
      return <GraphView />;
    case "tasks":
      return <TasksView />;
    case "apps":
      return <AppsView />;
    case "agents":
      return <AgentsView />;
    case "terminal":
      return <TerminalView />;
  }
}

export function DesktopShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatFull, setChatFull] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("home");

  const navigate = (v: ViewId) => {
    setActiveView(v);
    // Jumping to a workspace view from full-chat returns to split so you can
    // see it next to the conversation.
    if (chatFull) setChatFull(false);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <TitleBar
        activeView={activeView}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        chatFull={chatFull}
        onToggleChatFull={() => setChatFull((f) => !f)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar collapsed={sidebarCollapsed} activeView={activeView} onNavigate={navigate} />

        {chatFull ? (
          // ── Full-chat mode: chat fills the workspace, Codex-style summary
          //    widget floats top-right. No main area. ─────────────────────────
          <div className="relative min-w-0 flex-1">
            <ChatPanel full />
            <div className="pointer-events-none absolute right-5 top-4">
              <div className="pointer-events-auto">
                <SummaryWidget />
              </div>
            </div>
          </div>
        ) : (
          // ── Split mode: chat 1/3 on the left, main view 2/3 on the right. ──
          <div className="flex min-w-0 flex-1">
            <div className="flex w-[33%] min-w-[320px] max-w-[460px] flex-col border-r border-[hsl(var(--border))]">
              <ChatPanel />
            </div>
            <main className="min-w-0 flex-1 overflow-hidden bg-[hsl(var(--bg))]">
              <div className="h-full overflow-y-auto">
                <MainView view={activeView} onNavigate={navigate} />
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
