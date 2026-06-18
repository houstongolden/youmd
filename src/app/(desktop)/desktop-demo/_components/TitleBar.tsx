"use client";

import { PRIMARY_NAV, type ViewId } from "../_data/mock";
import { Icon } from "./icons";
import { cn } from "../_lib/cn";

// macOS-style title bar: traffic lights, current view title, and the
// window-level controls (sidebar toggle, chat layout, command search).
export function TitleBar({
  activeView,
  sidebarCollapsed,
  onToggleSidebar,
  chatFull,
  onToggleChatFull,
}: {
  activeView: ViewId;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  chatFull: boolean;
  onToggleChatFull: () => void;
}) {
  const title = chatFull ? "Chat" : PRIMARY_NAV.find((n) => n.id === activeView)?.label ?? "";

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-3">
      {/* traffic lights */}
      <div className="flex items-center gap-2">
        {["#ED6A5E", "#F4BF4F", "#61C554"].map((c) => (
          <span key={c} aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
      </div>

      <div className="mx-1 h-4 w-px bg-[hsl(var(--border))]" />

      {/* sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))]"
      >
        <Icon name={sidebarCollapsed ? "panelOpen" : "panelClose"} size={16} />
      </button>

      {/* breadcrumb / title */}
      <div className="flex items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
        <span className="text-[hsl(var(--text-secondary))]/50">you.md</span>
        <Icon name="chevronRight" size={11} className="opacity-40" />
        <span className="text-[hsl(var(--text-primary))]">{title}</span>
      </div>

      {/* center command bar */}
      <button className="mx-auto flex w-72 items-center gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3 py-1 text-[12px] text-[hsl(var(--text-secondary))]/60 transition-colors hover:border-[hsl(var(--accent))]/30">
        <Icon name="search" size={13} />
        <span>Search or run a command…</span>
        <span className="ml-auto font-mono text-[10px] tracking-wider opacity-60">⌘K</span>
      </button>

      {/* chat layout toggle */}
      <div className="flex items-center overflow-hidden rounded-sm border border-[hsl(var(--border))]">
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
