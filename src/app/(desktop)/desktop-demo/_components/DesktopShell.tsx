"use client";

import { useState } from "react";
import { PRIMARY_NAV, type ViewId } from "../_data/mock";
import { useIsMobile } from "../_lib/useIsMobile";
import { cn } from "../_lib/cn";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { ChatPanel } from "./ChatPanel";
import { SummaryWidget } from "./SummaryWidget";
import { Icon } from "./icons";
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

// Mobile-only bottom bar: swap between the conversation and the active
// workspace view (the desktop split is collapsed into a single column).
function MobileTabBar({
  pane,
  activeView,
  onSelect,
}: {
  pane: "chat" | "view";
  activeView: ViewId;
  onSelect: (p: "chat" | "view") => void;
}) {
  const viewMeta = PRIMARY_NAV.find((n) => n.id === activeView);
  const tabs = [
    { id: "chat" as const, label: "Chat", icon: "chat" as const },
    { id: "view" as const, label: viewMeta?.label ?? "Workspace", icon: viewMeta?.icon ?? ("home" as const) },
  ];
  return (
    <nav className="flex shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
      {tabs.map((t) => {
        const active = pane === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors",
              active ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]",
            )}
          >
            <Icon name={t.icon} size={18} />
            <span className="font-mono text-[10px] uppercase tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function DesktopShell() {
  const isMobile = useIsMobile();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop rail
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile off-canvas
  const [chatFull, setChatFull] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [mobilePane, setMobilePane] = useState<"chat" | "view">("chat");

  const navigate = (v: ViewId) => {
    setActiveView(v);
    if (isMobile) {
      setMobilePane("view");
      setDrawerOpen(false);
    } else if (chatFull) {
      // Jumping to a workspace view from full-chat returns to split.
      setChatFull(false);
    }
  };

  const toggleSidebar = () => {
    if (isMobile) setDrawerOpen((o) => !o);
    else setSidebarCollapsed((c) => !c);
  };

  const title = isMobile
    ? mobilePane === "chat"
      ? "Chat"
      : PRIMARY_NAV.find((n) => n.id === activeView)?.label ?? ""
    : chatFull
      ? "Chat"
      : PRIMARY_NAV.find((n) => n.id === activeView)?.label ?? "";

  return (
    <div className="flex h-full w-full flex-col">
      <TitleBar
        title={title}
        isMobile={isMobile}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        chatFull={chatFull}
        onToggleChatFull={() => setChatFull((f) => !f)}
      />

      <div className="relative flex min-h-0 flex-1">
        {isMobile ? (
          <>
            {/* Off-canvas drawer + backdrop */}
            {drawerOpen && (
              <button
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 z-20 bg-black/50"
              />
            )}
            <div
              className={cn(
                "absolute inset-y-0 left-0 z-30 w-64 max-w-[82%] transition-transform duration-200",
                drawerOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <Sidebar collapsed={false} activeView={activeView} onNavigate={navigate} />
            </div>

            {/* Single-column workspace */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                {mobilePane === "chat" ? (
                  <ChatPanel full />
                ) : (
                  <div className="h-full overflow-y-auto bg-[hsl(var(--bg))]">
                    <MainView view={activeView} onNavigate={navigate} />
                  </div>
                )}
              </div>
              <MobileTabBar pane={mobilePane} activeView={activeView} onSelect={setMobilePane} />
            </div>
          </>
        ) : (
          <>
            <Sidebar collapsed={sidebarCollapsed} activeView={activeView} onNavigate={navigate} />

            {chatFull ? (
              // Full-chat: chat fills the workspace, summary widget floats.
              <div className="relative min-w-0 flex-1">
                <ChatPanel full />
                <div className="pointer-events-none absolute right-5 top-4">
                  <div className="pointer-events-auto">
                    <SummaryWidget />
                  </div>
                </div>
              </div>
            ) : (
              // Split: chat 1/3 left, main view 2/3 right.
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
          </>
        )}
      </div>
    </div>
  );
}
