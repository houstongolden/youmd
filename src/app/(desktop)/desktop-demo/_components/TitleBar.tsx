"use client";

import { Icon } from "./icons";
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
}) {
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
