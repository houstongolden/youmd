"use client";

import { NAV_SECTIONS, WORKSPACE, type ViewId } from "../_data/mock";
import { Icon } from "./icons";
import { Dot, SectionLabel } from "./primitives";
import { cn } from "../_lib/cn";

export function Sidebar({
  collapsed,
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
}: {
  collapsed: boolean;
  activeView: ViewId;
  onNavigate: (v: ViewId) => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--bg))] transition-[width] duration-200",
        collapsed ? "w-[58px]" : "w-60",
      )}
    >
      {/* workspace switcher */}
      <div className={cn("flex items-center gap-2.5 px-3 py-3", collapsed && "justify-center px-0")}>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-[hsl(var(--accent))] font-mono text-[13px] font-bold text-white">
          Y
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[13px] font-semibold leading-tight">{WORKSPACE.name}</div>
            <div className="flex items-center gap-1.5">
              <Dot tone="green" pulse size={5} />
              <span className="truncate font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">
                {WORKSPACE.brain} · {WORKSPACE.machines} machines
              </span>
            </div>
          </div>
        )}
      </div>

      {/* sectioned primary nav (Context / Stacks / Runtime) */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pt-1">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.title ?? `s${si}`} className={cn(section.title && "mt-4")}>
            {section.title && !collapsed && (
              <SectionLabel className="px-2.5 pb-1.5">{section.title}</SectionLabel>
            )}
            {section.title && collapsed && (
              <div className="mx-auto mb-1.5 h-px w-5 bg-[hsl(var(--border))]" aria-hidden />
            )}
            {section.items.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "mb-0.5 flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] transition-colors",
                    collapsed && "justify-center px-0",
                    active
                      ? "bg-[hsl(var(--bg-raised))] text-[hsl(var(--accent))]"
                      : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]",
                  )}
                >
                  <Icon name={item.icon} size={16} className={active ? "text-[hsl(var(--accent))]" : ""} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* footer */}
      <div className={cn("border-t border-[hsl(var(--border))] px-2 py-2", collapsed && "px-0")}>
        <button
          onClick={onToggleTheme}
          title={collapsed ? `Switch to ${theme === "light" ? "dark" : "light"} mode` : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={16} />
          {!collapsed && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
        </button>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg-raised))] hover:text-[hsl(var(--text-primary))]",
            collapsed && "justify-center px-0",
          )}
        >
          <Icon name="settings" size={16} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
