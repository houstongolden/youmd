"use client";

import { useState } from "react";
import { FILE_TREE, FILE_CONTENT, type FileNode } from "../../_data/mock";
import { Markdown } from "../Markdown";
import { Icon } from "../icons";
import { SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

function FileTree({
  nodes,
  depth,
  activeId,
  onSelect,
}: {
  nodes: FileNode[];
  depth: number;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    identity: true,
    projects: true,
  });

  return (
    <div>
      {nodes.map((n) => {
        if (n.type === "folder") {
          const isOpen = open[n.id];
          return (
            <div key={n.id}>
              <button
                onClick={() => setOpen((o) => ({ ...o, [n.id]: !o[n.id] }))}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[13px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg))]"
                style={{ paddingLeft: depth * 12 + 8 }}
              >
                <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={12} className="opacity-50" />
                <Icon name={isOpen ? "folderOpen" : "folder"} size={13} className="opacity-70" />
                <span className="font-mono">{n.name}</span>
              </button>
              {isOpen && n.children && (
                <FileTree nodes={n.children} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
              )}
            </div>
          );
        }
        return (
          <button
            key={n.id}
            onClick={() => onSelect(n.id)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[13px] transition-colors",
              activeId === n.id
                ? "bg-[hsl(var(--bg))] text-[hsl(var(--accent))]"
                : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]",
            )}
            style={{ paddingLeft: depth * 12 + 22 }}
          >
            <Icon name="file" size={12} className="opacity-60" />
            <span className="truncate">{n.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function EditorView() {
  const [activeId, setActiveId] = useState("identity/you.md");
  const [mode, setMode] = useState<"read" | "edit">("read");
  const source = FILE_CONTENT[activeId] ?? "# Untitled\n\nEmpty note.";

  return (
    <div className="flex h-full">
      {/* File explorer */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-[hsl(var(--border))] py-3">
        <div className="flex items-center justify-between px-3 pb-2">
          <SectionLabel>Vault</SectionLabel>
          <Icon name="plus" size={13} className="cursor-pointer text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))]" />
        </div>
        <FileTree nodes={FILE_TREE} depth={0} activeId={activeId} onSelect={setActiveId} />
      </aside>

      {/* Document */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
            <Icon name="file" size={13} className="opacity-60" />
            <span>{activeId}</span>
          </div>
          <div className="flex overflow-hidden rounded-sm border border-[hsl(var(--border))]">
            {(["read", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
                  mode === m
                    ? "bg-[hsl(var(--accent))] text-white"
                    : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "read" ? (
            <div className="mx-auto max-w-2xl px-8 py-8">
              <Markdown source={source} />
            </div>
          ) : (
            <textarea
              key={activeId}
              defaultValue={source}
              spellCheck={false}
              className="h-full w-full resize-none bg-transparent px-8 py-8 font-mono text-[13px] leading-relaxed text-[hsl(var(--text-secondary))] outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
