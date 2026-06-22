"use client";

import { Icon } from "./icons";
import { Dot } from "./primitives";
import { DEVICES, SUB_AGENTS } from "../_data/mock";
import { cn } from "../_lib/cn";

// macOS-style title bar: traffic lights, current view title, and the
// window-level controls (sidebar toggle, chat layout, command search).
// On phones the desktop chrome (traffic lights, wide command bar, chat-layout
// toggle) collapses to a menu button + title; navigation moves to the drawer
// and the bottom tab bar.
export function TitleBar({
  title,
  isMobile,
  sidebarCollapsed,
  onToggleSidebar,
  chatFull,
  onToggleChatFull,
  onOpenCommand,
  mobileOnView = false,
  onGoToChat,
  inspectorOpen = false,
  onToggleInspector,
  chatSide = "left",
  onFlipSide,
}: {
  title: string;
  isMobile: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  chatFull: boolean;
  onToggleChatFull: () => void;
  onOpenCommand: () => void;
  mobileOnView?: boolean;
  onGoToChat?: () => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  chatSide?: "left" | "right";
  onFlipSide?: () => void;
}) {
  const machines = DEVICES.length;
  const agents = SUB_AGENTS.filter((a) => a.status === "active").length;
  return (
    <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-3 pt-[env(safe-area-inset-top)] lg:h-10 lg:min-h-0 lg:gap-3 lg:pt-0">
      {/* traffic lights — desktop only */}
      <div className="hidden items-center gap-2 lg:flex">
        {["#ED6A5E", "#F4BF4F", "#61C554"].map((c) => (
          <span key={c} aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
      </div>

      <div className="mx-1 hidden h-4 w-px bg-[hsl(var(--border))] lg:block" />

      {/* sidebar / menu toggle */}
      <button
        onClick={onToggleSidebar}
        title={isMobile ? "Menu" : "Toggle sidebar"}
        aria-label={isMobile ? "Open menu" : "Toggle sidebar"}
        className="-ml-1 p-1 text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))] lg:ml-0 lg:p-0"
      >
        <Icon name={isMobile ? "menu" : sidebarCollapsed ? "panelOpen" : "panelClose"} size={18} />
      </button>

      {/* breadcrumb / title */}
      <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
        <span className="hidden text-[hsl(var(--text-secondary))]/50 sm:inline">you.md</span>
        <Icon name="chevronRight" size={11} className="hidden opacity-40 sm:block" />
        <span className="truncate text-[hsl(var(--text-primary))]">{title}</span>
      </div>

      {/* center command bar — desktop only */}
      <button
        onClick={onOpenCommand}
        className="mx-auto hidden w-72 items-center gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3 py-1 text-[12px] text-[hsl(var(--text-secondary))]/60 transition-colors hover:border-[hsl(var(--accent))]/30 lg:flex"
      >
        <Icon name="search" size={13} />
        <span>Search or run a command…</span>
        <span className="ml-auto font-mono text-[10px] tracking-wider opacity-60">⌘K</span>
      </button>

      {/* mobile-only right action: return to chat when on a view, else search */}
      <button
        aria-label={mobileOnView ? "Back to chat" : "Search"}
        onClick={mobileOnView ? onGoToChat : onOpenCommand}
        className="ml-auto p-1 text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))] lg:hidden"
      >
        <Icon name={mobileOnView ? "chat" : "search"} size={17} />
      </button>

      {/* ambient presence strip — desktop only */}
      <div className="hidden items-center gap-3 lg:flex">
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
          <Icon name="device" size={12} /> {machines} machines
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
          <Icon name="agent" size={12} /> {agents} agents
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
          <Dot tone="green" pulse size={5} /> synced
        </span>
      </div>

      <div className="mx-1 hidden h-4 w-px bg-[hsl(var(--border))] lg:block" />

      {/* dock shell left/right — desktop only */}
      {onFlipSide && !chatFull && (
        <button
          onClick={onFlipSide}
          title={`Dock shell ${chatSide === "left" ? "right" : "left"}`}
          className="hidden rounded-sm border border-[hsl(var(--border))] p-1 text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))] lg:block"
        >
          <Icon name={chatSide === "left" ? "panelClose" : "panelOpen"} size={14} />
        </button>
      )}

      {/* inspector toggle — desktop only */}
      {onToggleInspector && (
        <button
          onClick={onToggleInspector}
          title="Toggle inspector"
          className={cn(
            "hidden rounded-sm border border-[hsl(var(--border))] p-1 transition-colors lg:block",
            inspectorOpen
              ? "bg-[hsl(var(--accent))] text-white"
              : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
          )}
        >
          <Icon name="panelClose" size={14} className="rotate-180" />
        </button>
      )}

      {/* chat layout toggle — desktop only */}
      <div className="hidden items-center overflow-hidden rounded-sm border border-[hsl(var(--border))] lg:flex">
        <button
          onClick={() => chatFull && onToggleChatFull()}
          title="Split view"
          className={cn(
            "px-2 py-1 transition-colors",
            !chatFull
              ? "bg-[hsl(var(--accent))] text-white"
              : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
          )}
        >
          <Icon name="split" size={14} />
        </button>
        <button
          onClick={() => !chatFull && onToggleChatFull()}
          title="Full chat"
          className={cn(
            "px-2 py-1 transition-colors",
            chatFull
              ? "bg-[hsl(var(--accent))] text-white"
              : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
          )}
        >
          <Icon name="chat" size={14} />
        </button>
      </div>
    </div>
  );
}
