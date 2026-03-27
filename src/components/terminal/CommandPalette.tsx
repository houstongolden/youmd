"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface SlashCommand {
  command: string;
  description: string;
  category: "navigation" | "action" | "info";
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: "/profile", description: "view your profile preview", category: "navigation" },
  { command: "/edit", description: "edit your identity context", category: "navigation" },
  { command: "/settings", description: "account and plan settings", category: "navigation" },
  { command: "/skills", description: "identity-aware agent skills", category: "navigation" },
  { command: "/share", description: "create a shareable identity link", category: "action" },
  { command: "/share --private", description: "share with private context included", category: "action" },
  { command: "/publish", description: "publish your latest bundle", category: "action" },
  { command: "/portrait --regenerate", description: "regenerate your ASCII portrait", category: "action" },
  { command: "/status", description: "show bundle status", category: "info" },
  { command: "/memory", description: "memory summary", category: "info" },
  { command: "/recall", description: "show recent memories", category: "info" },
  { command: "/help", description: "list available commands", category: "info" },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (command: string) => void;
}

export function CommandPalette({ isOpen, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return SLASH_COMMANDS;
    const q = query.toLowerCase().replace(/^\//, "");
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q)
    );
  }, [query]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-palette-item]");
    const item = items[selectedIndex];
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].command);
          onClose();
        }
        return;
      }
    },
    [filtered, selectedIndex, onClose, onSelect]
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case "navigation": return "navigate";
      case "action": return "actions";
      case "info": return "info";
      default: return cat;
    }
  };

  // Group filtered commands by category (preserving order)
  const grouped: Array<{ category: string; commands: SlashCommand[] }> = [];
  const seenCategories = new Set<string>();
  for (const cmd of filtered) {
    if (!seenCategories.has(cmd.category)) {
      seenCategories.add(cmd.category);
      grouped.push({
        category: cmd.category,
        commands: filtered.filter((c) => c.category === cmd.category),
      });
    }
  }

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] shadow-2xl overflow-hidden"
        style={{ borderRadius: "2px" }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[hsl(var(--border))]">
          <span className="text-[hsl(var(--accent))] font-mono text-[13px] shrink-0 select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="type a command..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent border-none outline-none font-mono text-[13px] text-[hsl(var(--text-primary))] caret-[hsl(var(--accent))] placeholder:text-[hsl(var(--text-secondary))]/20"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 border border-[hsl(var(--border))]" style={{ borderRadius: "2px" }}>
            esc
          </kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-30">
              no matching commands
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                <div className="px-3 pt-2 pb-1">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-25">
                    {categoryLabel(group.category)}
                  </span>
                </div>
                {group.commands.map((cmd) => {
                  const idx = globalIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.command}
                      data-palette-item
                      onClick={() => {
                        onSelect(cmd.command);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-3 transition-colors ${
                        isSelected
                          ? "bg-[hsl(var(--accent))]/8 text-[hsl(var(--text-primary))]"
                          : "text-[hsl(var(--text-secondary))]"
                      }`}
                    >
                      <span className={`font-mono text-[12px] shrink-0 ${isSelected ? "text-[hsl(var(--accent))]" : ""}`}>
                        {cmd.command}
                      </span>
                      <span className="font-mono text-[10px] opacity-40 truncate">
                        {cmd.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-[hsl(var(--border))]">
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-20">
            arrows to navigate
          </span>
          <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-20">
            enter to select
          </span>
          <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-20">
            esc to close
          </span>
        </div>
      </div>
    </div>
  );
}
