"use client";

import { useState } from "react";
import { Icon } from "./icons";
import { Dot } from "./primitives";
import { DEVICES, SUB_AGENTS } from "../_data/mock";
import { cn } from "../_lib/cn";

// macOS-style title bar. Window-level layout controls (shell dock side,
// inspector, focus) are consolidated behind one minimal "layout" popover so the
// bar stays clean; the sidebar toggle + command bar stay inline.
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
  shellOpen = true,
  onToggleShell,
  railCollapsed = false,
  onToggleRail,
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
  shellOpen?: boolean;
  onToggleShell?: () => void;
  railCollapsed?: boolean;
  onToggleRail?: () => void;
}) {
  const machines = DEVICES.length;
  const agents = SUB_AGENTS.filter((a) => a.status === "active").length;
  const [layoutOpen, setLayoutOpen] = useState(false);

  return (
    <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-3 pt-[env(safe-area-inset-top)] lg:h-10 lg:min-h-0 lg:gap-3 lg:pt-0">
      {/* traffic lights — desktop only */}
      <div className="hidden items-center gap-2 lg:flex">
        {["#ED6A5E", "#F4BF4F", "#61C554"].map((c) => (
          <span key={c} aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
        ))}
      </div>

      <div className="mx-1 hidden h-4 w-px bg-[hsl(var(--border))] lg:block" />

      {/* sidebar / menu toggle — minimal panel icon */}
      <button
        onClick={onToggleSidebar}
        title={isMobile ? "Menu" : "Toggle sidebar"}
        aria-label={isMobile ? "Open menu" : "Toggle sidebar"}
        className="-ml-1 p-1 text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))] lg:ml-0 lg:p-0"
      >
        <Icon name={isMobile ? "menu" : sidebarCollapsed ? "panelOpen" : "panelClose"} size={17} strokeWidth={1.5} />
      </button>

      {/* breadcrumb / title */}
      <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
        <span className="hidden text-[hsl(var(--text-secondary))]/50 sm:inline">you.md</span>
        <Icon name="chevronRight" size={11} className="hidden opacity-40 sm:block" />
        <span className="truncate text-[hsl(var(--text-primary))]">{title}</span>
      </div>

      {/* sessions rail collapse/expand — minimal « », up top by the title */}
      {onToggleRail && (
        <button
          onClick={onToggleRail}
          title={railCollapsed ? "Show sessions" : "Hide sessions"}
          aria-label="Toggle sessions list"
          className="hidden rounded-sm p-0.5 text-[hsl(var(--text-secondary))]/70 transition-colors hover:text-[hsl(var(--text-primary))] lg:block"
        >
          <Icon name={railCollapsed ? "chevronsRight" : "chevronsLeft"} size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* center command bar — desktop only */}
      <button
        onClick={onOpenCommand}
        className="mx-auto hidden w-72 items-center gap-2 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3 py-1 text-[12px] text-[hsl(var(--text-secondary))]/60 transition-colors hover:border-[hsl(var(--accent))]/30 lg:flex"
      >
        <Icon name="search" size={13} />
        <span>Search or run a command…</span>
        <span className="ml-auto font-mono text-[10px] tracking-wider opacity-60">⌘K</span>
      </button>

      {/* mobile-only right action */}
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
          <Icon name="device" size={12} /> {machines}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
          <Icon name="agent" size={12} /> {agents}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
          <Dot tone="green" pulse size={5} /> synced
        </span>
      </div>

      {/* show/hide the sessions shell — prominent, the clearest control */}
      {onToggleShell && (
        <button
          onClick={onToggleShell}
          title={shellOpen ? "Hide sessions shell" : "Show sessions shell"}
          aria-label="Toggle sessions shell"
          className={cn(
            "hidden rounded-sm p-1 transition-colors lg:block",
            shellOpen ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
          )}
        >
          <Icon name="chat" size={16} strokeWidth={1.5} />
        </button>
      )}

      {/* consolidated layout popover — desktop only */}
      <div className="relative hidden lg:block">
        <button
          onClick={() => setLayoutOpen((o) => !o)}
          title="Layout"
          aria-label="Layout options"
          className={cn(
            "rounded-sm p-1 transition-colors",
            layoutOpen ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
          )}
        >
          <Icon name="sliders" size={16} strokeWidth={1.5} />
        </button>
        {layoutOpen && (
          <>
            <button aria-label="Close" onClick={() => setLayoutOpen(false)} className="fixed inset-0 z-10 cursor-default" />
            <div className="absolute right-0 top-full z-20 mt-1.5 w-52 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 shadow-2xl">
              <div className="px-1 pb-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]/50">
                Shell dock
              </div>
              <div className="mb-2 flex gap-0.5 rounded-sm border border-[hsl(var(--border))] p-0.5">
                {(["left", "right"] as const).map((side) => (
                  <button
                    key={side}
                    onClick={() => {
                      if (chatSide !== side) onFlipSide?.();
                    }}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-sm py-1 font-mono text-[11px] capitalize transition-colors",
                      chatSide === side
                        ? "bg-[hsl(var(--accent))] text-white"
                        : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
                    )}
                  >
                    <Icon name={side === "left" ? "panelOpen" : "panelRight"} size={13} strokeWidth={1.5} />
                    {side}
                  </button>
                ))}
              </div>
              <LayoutToggle
                label="Inspector"
                icon="panelRight"
                on={inspectorOpen}
                onClick={() => onToggleInspector?.()}
                disabled={!onToggleInspector}
              />
              <LayoutToggle
                label="Focus shell"
                icon="expand"
                on={chatFull}
                onClick={onToggleChatFull}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LayoutToggle({
  label,
  icon,
  on,
  onClick,
  disabled,
}: {
  label: string;
  icon: "panelRight" | "expand";
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left font-mono text-[11.5px] transition-colors",
        disabled ? "text-[hsl(var(--text-secondary))]/30" : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]",
      )}
    >
      <Icon name={icon} size={13} strokeWidth={1.5} />
      <span>{label}</span>
      <span
        className={cn(
          "ml-auto flex h-3.5 w-6 items-center rounded-full px-0.5 transition-colors",
          on ? "justify-end bg-[hsl(var(--accent))]" : "justify-start bg-[hsl(var(--border))]",
        )}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-white" />
      </span>
    </button>
  );
}
