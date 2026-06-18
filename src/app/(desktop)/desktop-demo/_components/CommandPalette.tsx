"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { cn } from "../_lib/cn";

export type Command = {
  id: string;
  label: string;
  group: string;
  icon: IconName;
  hint?: string;
  keywords?: string;
  run: () => void;
};

// ⌘K command palette — jump to any view, open any note, switch projects, or run
// an action from the keyboard. The whole product surface in one input.
export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean;
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // Reset transient state whenever the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // Focus after the open transition so the caret lands reliably.
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  const run = (cmd?: Command) => {
    if (!cmd) return;
    cmd.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(filtered[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Group the filtered commands while remembering each row's flat index (the
  // flat index drives keyboard selection across groups).
  const groups: { name: string; items: { cmd: Command; index: number }[] }[] = [];
  filtered.forEach((cmd, index) => {
    let g = groups.find((x) => x.name === cmd.group);
    if (!g) {
      g = { name: cmd.group, items: [] };
      groups.push(g);
    }
    g.items.push({ cmd, index });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] shadow-2xl"
        onKeyDown={onKeyDown}
      >
        {/* search input */}
        <div className="flex items-center gap-2.5 border-b border-[hsl(var(--border))] px-4 py-3">
          <Icon name="search" size={15} className="text-[hsl(var(--text-secondary))]/60" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or run a command…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[hsl(var(--text-secondary))]/45"
          />
          <span className="rounded-sm border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">
            esc
          </span>
        </div>

        {/* results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-[12px] text-[hsl(var(--text-secondary))]/50">
              no matches for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1">
                <div className="px-4 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/45">
                  {g.name}
                </div>
                {g.items.map(({ cmd, index }) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={cmd.id}
                      data-active={isActive}
                      onMouseMove={() => setActive(index)}
                      onClick={() => run(cmd)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] transition-colors",
                        isActive ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]" : "text-[hsl(var(--text-secondary))]",
                      )}
                    >
                      <Icon
                        name={cmd.icon}
                        size={15}
                        className={isActive ? "text-[hsl(var(--accent))]" : "opacity-70"}
                      />
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.hint && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
                          {cmd.hint}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
