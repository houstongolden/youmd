"use client";

import { useState } from "react";
import { FILE_TREE, FILE_CONTENT, type FileNode } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { Markdown } from "../Markdown";
import { Icon } from "../icons";
import { SectionLabel } from "../primitives";
import { cn } from "../../_lib/cn";

function FileTree({
  nodes,
  depth,
  activeId,
  onSelect,
  openInit,
}: {
  nodes: FileNode[];
  depth: number;
  activeId: string;
  onSelect: (id: string) => void;
  openInit: Record<string, boolean>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(openInit);
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
                {n.children && (
                  <span className="ml-auto font-mono text-[9px] text-[hsl(var(--text-secondary))]/40">{n.children.length}</span>
                )}
              </button>
              {isOpen && n.children && (
                <FileTree nodes={n.children} depth={depth + 1} activeId={activeId} onSelect={onSelect} openInit={openInit} />
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
              activeId === n.id ? "bg-[hsl(var(--bg))] text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg))]",
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

export function EditorView({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<"read" | "edit">("read");
  const real = useRealData();

  // Build the tree + a content map from REAL data when available, else mock.
  let tree: FileNode[] = FILE_TREE;
  const content: Record<string, string> = { ...FILE_CONTENT };
  let openInit: Record<string, boolean> = { identity: true, projects: true };

  if (real?.available) {
    openInit = { identity: true, projects: true, skills: false, stacks: false };
    const brainNodes: FileNode[] = real.brain.map((f) => {
      content[f.id] = f.content ?? "_empty_";
      return { id: f.id, name: f.name, type: "file" };
    });
    const projectNodes: FileNode[] = real.projects.map((p) => {
      const id = `project:${p.name}`;
      content[id] = [
        `# ${p.name}`,
        p.blurb ? `\n> ${p.blurb}\n` : "",
        p.remote ? `**Repo:** ${p.remote}` : "_no git remote_",
        "",
        `- env.local: ${p.hasEnvLocal ? "✓ present" : "— missing"}`,
        `- agent docs: ${p.hasAgentDocs ? "✓ CLAUDE.md / AGENTS.md" : "— none"}`,
        `- project-context: ${p.hasProjectContext ? "✓" : "—"}`,
      ].join("\n");
      return { id, name: p.name, type: "file" };
    });
    const skillNodes: FileNode[] = real.skills.map((s) => {
      const id = `skill:${s.name}`;
      content[id] = `# ${s.name}\n\nShared agent skill · source: **${s.source}**\n\nSynced across your machines via the skill mesh.`;
      return { id, name: s.name, type: "file" };
    });
    const stackNodes: FileNode[] = real.stacks.map((s) => {
      const id = `stack:${s}`;
      content[id] = `# ${s}\n\nA YouStack — a grouped, shareable set of skills your agents use.`;
      return { id, name: s, type: "file" };
    });
    tree = [
      { id: "identity", name: "identity", type: "folder", children: brainNodes },
      { id: "projects", name: `projects`, type: "folder", children: projectNodes },
      { id: "skills", name: "skills", type: "folder", children: skillNodes },
      { id: "stacks", name: "stacks", type: "folder", children: stackNodes },
    ];
  }

  const source = content[activeId] ?? real?.brain[0]?.content ?? "# Vault\n\nSelect a file.";
  const title = activeId.startsWith("project:")
    ? activeId.slice(8)
    : activeId.startsWith("skill:")
      ? `skills/${activeId.slice(6)}`
      : activeId;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="max-h-40 w-full shrink-0 overflow-y-auto border-b border-[hsl(var(--border))] py-3 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-3 pb-2">
          <SectionLabel>Vault{real?.available ? " · live" : ""}</SectionLabel>
          <Icon name="plus" size={13} className="cursor-pointer text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))]" />
        </div>
        <FileTree nodes={tree} depth={0} activeId={activeId} onSelect={onSelect} openInit={openInit} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-2.5 lg:px-5">
          <div className="flex min-w-0 items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
            <Icon name="file" size={13} className="shrink-0 opacity-60" />
            <span className="truncate">{title}</span>
          </div>
          <div className="flex overflow-hidden rounded-sm border border-[hsl(var(--border))]">
            {(["read", "edit"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors",
                  mode === m ? "bg-[hsl(var(--accent))] text-white" : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "read" ? (
            <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8 sm:py-8">
              <Markdown source={source} />
            </div>
          ) : (
            <textarea
              key={activeId}
              defaultValue={source}
              spellCheck={false}
              className="h-full w-full resize-none bg-transparent px-5 py-6 font-mono text-[13px] leading-relaxed text-[hsl(var(--text-secondary))] outline-none sm:px-8 sm:py-8"
            />
          )}
        </div>
      </div>
    </div>
  );
}
