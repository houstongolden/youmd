"use client";

import { useState } from "react";
import { DESTINATIONS, destinationForView, WORKSPACE, type ChatThread, type ViewId } from "../_data/mock";
import { Icon } from "./icons";
import { Dot, SectionLabel } from "./primitives";
import { cn } from "../_lib/cn";

export function Sidebar({
  collapsed,
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
  onOpenStatus,
  onExpand,
  chats,
  activeChat,
  onSelectChat,
  onNewChat,
  onSignOut,
}: {
  collapsed: boolean;
  activeView: ViewId;
  onNavigate: (v: ViewId) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenStatus: () => void;
  onExpand?: () => void;
  chats: ChatThread[];
  activeChat: string;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onSignOut?: () => void;
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--bg))] transition-[width] duration-200",
        collapsed ? "w-[58px]" : "w-60",
      )}
    >
      {/* workspace + system-status trigger. When collapsed, the Y mark is the
          primary affordance to re-expand the rail; when expanded it opens status. */}
      <button
        onClick={collapsed ? () => onExpand?.() : onOpenStatus}
        title={collapsed ? "Expand sidebar" : "System status"}
        className={cn(
          "flex shrink-0 items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-[hsl(var(--bg-raised))]",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-[hsl(var(--accent))] font-mono text-[13px] font-bold text-white">
          Y
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[13px] font-semibold leading-tight">{WORKSPACE.brain}</div>
            <div className="flex items-center gap-1.5">
              <Dot tone="green" pulse size={5} />
              <span className="truncate font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
                synced · {WORKSPACE.machines} machines
              </span>
            </div>
          </div>
        )}
      </button>

      {/* 6-destination rail. Some destinations hold multiple segments, shown as
          a segmented control in the workspace header — not a second tab row. */}
      <nav className="shrink-0 px-2 pt-1">
        {(["top", "workspace", "system"] as const).map((group) => {
          const items = DESTINATIONS.filter((d) => d.group === group);
          if (items.length === 0) return null;
          const heading = group === "workspace" ? "Workspace" : group === "system" ? "System" : null;
          return (
            <div key={group} className={cn(group !== "top" && "mt-4")}>
              {heading && !collapsed && <SectionLabel className="px-2.5 pb-1.5">{heading}</SectionLabel>}
              {heading && collapsed && (
                <div className="mx-auto mb-1.5 h-px w-5 bg-[hsl(var(--border))]" aria-hidden />
              )}
              {items.map((dest) => {
                const active = destinationForView(activeView).id === dest.id;
                return (
                  <button
                    key={dest.id}
                    onClick={() => onNavigate(dest.segments[0].id)}
                    title={collapsed ? dest.label : undefined}
                    className={cn(
                      "relative mb-0.5 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors active:scale-[0.98]",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-[hsl(var(--bg-raised))] text-[hsl(var(--accent))]"
                        : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]",
                    )}
                  >
                    {active && !collapsed && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-[hsl(var(--accent))]"
                      />
                    )}
                    <Icon name={dest.icon} size={16} className={active ? "text-[hsl(var(--accent))]" : ""} />
                    {!collapsed && <span>{dest.label}</span>}
                    {!collapsed && dest.segments.length > 1 && (
                      <span className="ml-auto font-mono text-[9px] text-[hsl(var(--text-secondary))]/40">
                        {dest.segments.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Chats — reserved scrollable history (Claude/ChatGPT style) */}
      {!collapsed && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-4 pb-1.5">
            <SectionLabel>Chats</SectionLabel>
            <button
              onClick={onNewChat}
              title="New chat"
              className="text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
            >
              <Icon name="plus" size={13} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectChat(c.id)}
                title={c.title}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[12.5px] transition-colors",
                  activeChat === c.id
                    ? "bg-[hsl(var(--bg-raised))] text-[hsl(var(--text-primary))]"
                    : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]",
                )}
              >
                <span className="truncate">{c.title}</span>
                <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
                  {c.at}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      {collapsed && <div className="flex-1" />}

      {/* account row + popout (theme / settings / sign out) */}
      <div className="relative shrink-0 border-t border-[hsl(var(--border))] p-2">
        {accountOpen && (
          <>
            <button
              aria-label="Close menu"
              onClick={() => setAccountOpen(false)}
              className="fixed inset-0 z-30 cursor-default"
            />
            <div
              className={cn(
                "absolute bottom-full z-40 mb-1 overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 shadow-2xl",
                // When collapsed, the rail is too narrow to hold the menu, so give
                // it a fixed comfortable width that floats out over the workspace
                // instead of being clipped at the rail's right border.
                collapsed ? "left-2 w-56" : "left-2 right-2",
              )}
            >
              <button
                onClick={() => {
                  onToggleTheme();
                  setAccountOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]"
              >
                <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
                {theme === "light" ? "Dark mode" : "Light mode"}
              </button>
              <button
                onClick={() => {
                  onNavigate("sync");
                  setAccountOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]"
              >
                <Icon name="settings" size={15} /> Settings
              </button>
              <button
                onClick={() => {
                  onSignOut?.();
                  setAccountOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]"
              >
                <Icon name="logout" size={15} /> Sign out
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setAccountOpen((o) => !o)}
          title={collapsed ? WORKSPACE.name : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-[hsl(var(--bg-raised))]",
            collapsed && "justify-center px-0",
          )}
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center font-mono text-[12px] font-semibold text-white"
            style={{ borderRadius: "50%", background: "hsl(var(--accent-dark))" }}
          >
            HG
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] leading-tight text-[hsl(var(--text-primary))]">{WORKSPACE.name}</div>
              <div className="truncate font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">{WORKSPACE.handle}</div>
            </div>
          )}
          {!collapsed && <Icon name="chevronDown" size={14} className="shrink-0 rotate-180 text-[hsl(var(--text-secondary))]/60" />}
        </button>
      </div>
    </aside>
  );
}
