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
                <Icon name={isOpen ? "folderOpen" : "folder"} size={13} className={n.badge ? "text-[hsl(var(--accent))]" : "opacity-70"} />
                <span className="truncate font-mono">{n.name}</span>
                {n.badge && (
                  <span className="shrink-0 rounded-sm border border-[hsl(var(--accent))]/40 px-1 font-mono text-[8px] uppercase tracking-wider text-[hsl(var(--accent))]">
                    {n.badge}
                  </span>
                )}
                {n.children && !n.badge && (
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
    openInit = { identity: true, projects: true, stacks: false, skills: false };

    const brainNodes: FileNode[] = real.brain.map((f) => {
      content[f.id] = f.content ?? "_empty_";
      return { id: f.id, name: f.name, type: "file" };
    });

    // Projects are real directories: each is a folder with an overview + its
    // actual top-level files. The *-you-md brain repo is pinned first + badged.
    const projectFolders: FileNode[] = real.projects.map((p) => {
      const overviewId = `project:${p.name}`;
      content[overviewId] = [
        `# ${p.name}`,
        p.label ? `\n\`${p.label}\` — the you.md repo that persists your skills, stacks, project + personal context, and orchestration.` : "",
        p.blurb ? `\n> ${p.blurb}\n` : "",
        p.remote ? `**Repo:** ${p.remote}` : "_no git remote_",
        "",
        `- env.local: ${p.hasEnvLocal ? "✓ present" : "— missing"}`,
        `- agent docs: ${p.hasAgentDocs ? "✓" : "—"}`,
        `- project-context: ${p.hasProjectContext ? "✓" : "—"}`,
        `- files synced: ${p.files.length}`,
      ].join("\n");
      const fileLeaves: FileNode[] = p.files.map((f) => {
        const id = `pfile:${p.name}/${f}`;
        content[id] = `# ${p.name}/${f}\n\nTracked in the repo, synced via you.md.\n\n_Open in your editor to view contents._`;
        return { id, name: f, type: "file" };
      });
      return {
        id: `proj:${p.name}`,
        name: p.name,
        type: "folder",
        badge: p.label,
        children: [{ id: overviewId, name: "· overview", type: "file" }, ...fileLeaves],
      };
    });

    const stackNodes: FileNode[] = real.stacks.map((s) => {
      content[`stack:${s}`] = `# ${s}\n\nA YouStack — a grouped, shareable set of skills your agents use across projects.`;
      return { id: `stack:${s}`, name: s, type: "file" };
    });

    // Skills auto-organized into folders by prefix (agent-*, bamf-*, google-*…).
    const groups: Record<string, FileNode[]> = {};
    for (const sk of real.skills) {
      content[`skill:${sk.name}`] = `# ${sk.name}\n\nShared agent skill · source: **${sk.source}**\n\nSynced across your machines via the skill mesh.`;
      const key = sk.name.includes("-") ? sk.name.split("-")[0] : "misc";
      (groups[key] ??= []).push({ id: `skill:${sk.name}`, name: sk.name, type: "file" });
    }
    const misc: FileNode[] = [];
    const skillFolders: FileNode[] = [];
    for (const [k, items] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
      if (items.length < 2) misc.push(...items);
      else skillFolders.push({ id: `skgrp:${k}`, name: `${k}-*`, type: "folder", children: items });
    }
    if (misc.length) skillFolders.push({ id: "skgrp:misc", name: "misc", type: "folder", children: misc.sort((a, b) => a.name.localeCompare(b.name)) });

    tree = [
      { id: "identity", name: "identity", type: "folder", children: brainNodes },
      { id: "projects", name: "projects", type: "folder", children: projectFolders },
      { id: "stacks", name: "stacks", type: "folder", children: stackNodes },
      { id: "skills", name: "skills", type: "folder", children: skillFolders },
    ];
  }

  const source = content[activeId] ?? real?.brain[0]?.content ?? "# Vault\n\nSelect a file.";
  const title = activeId.startsWith("project:")
    ? activeId.slice(8)
    : activeId.startsWith("pfile:")
      ? activeId.slice(6)
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
