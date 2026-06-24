"use client";

import { useState } from "react";
import { FILE_TREE, FILE_CONTENT, type FileNode } from "../../_data/mock";
import { useRealData } from "../../_lib/RealDataContext";
import { Markdown, slugify } from "../Markdown";
import { Icon, type IconName } from "../icons";
import { useToast } from "../Toast";
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

// Live preview: edit source on the left, see it rendered on the right as you
// type (Obsidian's source/live-preview split). Keyed by file so it resets.
function LiveEditor({ source, onWikiLink }: { source: string; onWikiLink?: (n: string) => void }) {
  const [draft, setDraft] = useState(source);
  return (
    <div className="flex h-full">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="h-full w-1/2 resize-none border-r border-[hsl(var(--border))] bg-transparent px-4 py-5 font-mono text-[13px] leading-relaxed text-[hsl(var(--text-secondary))] outline-none"
      />
      <div className="h-full w-1/2 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-2xl">
          <Markdown source={draft} onWikiLink={onWikiLink} />
        </div>
      </div>
    </div>
  );
}

// Note templates — the "how we write docs" layer. Frontmatter + structure so
// every note starts consistent (and agents can fill the sections).
type NoteTemplate = { id: string; label: string; icon: IconName; build: (n: number) => { name: string; content: string } };
const NOTE_TEMPLATES: NoteTemplate[] = [
  { id: "note", label: "Blank note", icon: "file", build: (n) => ({ name: `untitled-${n}.md`, content: `---\ntitle: Untitled ${n}\ntags: []\n---\n\n# Untitled ${n}\n\nStart writing…\n` }) },
  { id: "daily", label: "Daily note", icon: "file", build: (n) => ({ name: `daily-${n}.md`, content: `---\ntype: daily\ntags: [daily]\n---\n\n# Today\n\n## Focus\n- \n\n## Notes\n\n## Done\n- [ ] \n` }) },
  { id: "research", label: "Research", icon: "brain", build: (n) => ({ name: `research-${n}.md`, content: `---\ntype: research\ntags: [research]\n---\n\n# Research: \n\n## Question\n\n## Findings\n\n## Sources\n- [[you]]\n\n## Next\n- [ ] \n` }) },
  { id: "meeting", label: "Meeting", icon: "agent", build: (n) => ({ name: `meeting-${n}.md`, content: `---\ntype: meeting\ntags: [meeting]\n---\n\n# Meeting: \n\n**Who:** \n\n## Agenda\n- \n\n## Notes\n\n## Action items\n- [ ] \n` }) },
];

export function EditorView({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<"read" | "live" | "source">("read");
  const [drafts, setDrafts] = useState<{ id: string; name: string; content: string }[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const real = useRealData();
  const toast = useToast();

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
        "",
        `#project · part of your [[you]] workspace`,
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
      content[`stack:${s}`] = `# ${s}\n\nA YouStack — a grouped, shareable set of skills your agents use across projects.\n\n#stack · a [[you]] stack`;
      return { id: `stack:${s}`, name: s, type: "file" };
    });

    // Skills auto-organized into folders by prefix (agent-*, bamf-*, google-*…).
    const groups: Record<string, FileNode[]> = {};
    for (const sk of real.skills) {
      content[`skill:${sk.name}`] = `# ${sk.name}\n\nShared agent skill · source: **${sk.source}**\n\nSynced across your machines via the skill mesh.\n\n#skill · shared in your [[you]] stacks`;
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

  // Merge this session's draft notes into the vault (manual authoring).
  for (const d of drafts) content[d.id] = d.content;
  if (drafts.length) {
    tree = [{ id: "drafts", name: "drafts", type: "folder", children: drafts.map((d) => ({ id: d.id, name: d.name, type: "file" as const })) }, ...tree];
    openInit = { ...openInit, drafts: true };
  }
  const createNote = (tpl: NoteTemplate) => {
    const n = drafts.length + 1;
    const { name, content: body } = tpl.build(n);
    const id = `draft:${tpl.id}-${n}`;
    setDrafts((d) => [...d, { id, name, content: body }]);
    setTplOpen(false);
    onSelect(id);
    setMode("live");
  };

  const renameDraft = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (trimmed) setDrafts((d) => d.map((x) => (x.id === id ? { ...x, name: trimmed } : x)));
    setRenamingId(null);
  };

  const source = content[activeId] ?? real?.brain[0]?.content ?? "# Vault\n\nSelect a file.";
  const title = activeId.startsWith("project:")
    ? activeId.slice(8)
    : activeId.startsWith("pfile:")
      ? activeId.slice(6)
      : activeId.startsWith("skill:")
        ? `skills/${activeId.slice(6)}`
        : activeId;

  // ── Obsidian-style intelligence computed from the live vault content ──
  const isDraft = activeId.startsWith("draft:");
  const draftName = isDraft ? drafts.find((d) => d.id === activeId)?.name ?? title : null;
  const baseName = (title.split("/").pop() ?? "").replace(/\.md$/, "");
  const headings = source
    .split("\n")
    .map((l) => /^(#{1,4})\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => ({ level: m[1].length, text: m[2], id: `h-${slugify(m[2])}` }));
  const tags = Array.from(new Set((source.match(/(?:^|\s)(#[A-Za-z][\w/-]*)/g) ?? []).map((t) => t.trim())));
  const outLinks = Array.from(new Set((source.match(/\[\[[^\]]+\]\]/g) ?? []).map((w) => w.slice(2, -2))));
  const nameIndex = new Map<string, string>();
  for (const id of Object.keys(content)) {
    const bn = (id.split("/").pop() ?? id).replace(/\.md$/, "").replace(/^(project|skill|stack|pfile):/, "").toLowerCase();
    if (!nameIndex.has(bn)) nameIndex.set(bn, id);
  }
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const backlinks =
    baseName.length > 1
      ? Object.entries(content)
          .filter(([id, c]) => id !== activeId && new RegExp(`\\[\\[${esc(baseName)}\\]\\]`, "i").test(c))
          .map(([id]) => ({ id, name: (id.split("/").pop() ?? id).replace(/\.md$/, "").replace(/^(project|skill|stack|pfile):/, "") }))
      : [];
  const backlinksShown = backlinks.slice(0, 15);
  const openWiki = (name: string) => {
    const id = nameIndex.get(name.toLowerCase());
    if (id) onSelect(id);
  };
  const scrollToHeading = (id: string) => {
    if (typeof document !== "undefined") document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const hasMeta = headings.length > 0 || tags.length > 0 || outLinks.length > 0 || backlinks.length > 0;

  // Tag index: for each tag in the right panel, find all vault notes containing it
  const tagIndex = (tag: string): { id: string; name: string }[] =>
    Object.entries(content)
      .filter(([, c]) => new RegExp(`(?:^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "m").test(c))
      .map(([id]) => ({
        id,
        name: (id.split("/").pop() ?? id).replace(/\.md$/, "").replace(/^(project|skill|stack|pfile|draft):/, ""),
      }))
      .slice(0, 30);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="max-h-40 w-full shrink-0 overflow-y-auto border-b border-[hsl(var(--border))] py-3 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-3 pb-2">
          <SectionLabel>Vault{real?.available ? " · live" : ""}</SectionLabel>
          <div className="relative">
            <button
              onClick={() => setTplOpen((o) => !o)}
              title="New note"
              aria-label="New note"
              className={cn("rounded-sm p-0.5 transition-colors", tplOpen ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))]")}
            >
              <Icon name="plus" size={13} />
            </button>
            {tplOpen && (
              <>
                <button aria-label="Close" onClick={() => setTplOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 shadow-2xl">
                  <div className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))]/50">New note</div>
                  {NOTE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => createNote(tpl)}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--bg))] hover:text-[hsl(var(--text-primary))]"
                    >
                      <Icon name={tpl.icon} size={12} className="opacity-60" /> {tpl.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <FileTree nodes={tree} depth={0} activeId={activeId} onSelect={onSelect} openInit={openInit} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-2.5 lg:px-5">
          <div className="group flex min-w-0 items-center gap-2 font-mono text-[12px] text-[hsl(var(--text-secondary))]">
            <Icon name="file" size={13} className="shrink-0 opacity-60" />
            {isDraft && renamingId === activeId ? (
              <input
                autoFocus
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={() => renameDraft(activeId, renameVal)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") renameDraft(activeId, renameVal);
                  if (e.key === "Escape") setRenamingId(null);
                }}
                className="min-w-0 rounded-sm border border-[hsl(var(--accent))]/50 bg-transparent px-1 font-mono text-[12px] text-[hsl(var(--text-primary))] outline-none focus:border-[hsl(var(--accent))]"
                style={{ borderRadius: 2 }}
              />
            ) : (
              <>
                <span className="truncate">{isDraft ? (draftName ?? title) : title}</span>
                {isDraft && (
                  <button
                    title="Rename note"
                    aria-label="Rename note"
                    onClick={() => { setRenamingId(activeId); setRenameVal(draftName ?? title); }}
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))]"
                  >
                    <Icon name="pencil" size={11} />
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => toast(`you-agent is drafting "${baseName || title}" from your brain context…`, "sparkles")}
            title="Draft / expand this note with your agent"
            className="flex items-center gap-1 rounded-sm border border-[hsl(var(--border))] px-2 py-1 font-mono text-[11px] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--accent))]/40 hover:text-[hsl(var(--accent))]"
          >
            <Icon name="sparkles" size={12} /> agent
          </button>
          <div className="flex overflow-hidden rounded-sm border border-[hsl(var(--border))]">
            {(["read", "live", "source"] as const).map((m) => (
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
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {mode === "read" ? (
            <div className="h-full overflow-y-auto">
              <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8 sm:py-8">
                <Markdown source={source} onWikiLink={openWiki} />
              </div>
            </div>
          ) : mode === "live" ? (
            <LiveEditor key={activeId} source={source} onWikiLink={openWiki} />
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

      {/* Obsidian-style metadata: outline · tags · links · backlinks */}
      {hasMeta && mode !== "source" && (
        <aside className="hidden w-56 shrink-0 flex-col gap-5 overflow-y-auto border-l border-[hsl(var(--border))] px-3.5 py-4 xl:flex">
          {headings.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Outline</SectionLabel>
              <div className="space-y-0.5">
                {headings.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToHeading(h.id)}
                    style={{ paddingLeft: (h.level - 1) * 10 }}
                    className="block w-full truncate text-left text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
                  >
                    {h.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tags.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Tags</SectionLabel>
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTag(activeTag === t ? null : t)}
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                      activeTag === t
                        ? "bg-[hsl(var(--accent))] text-white"
                        : "bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/25",
                    )}
                    style={{ borderRadius: 2 }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {activeTag && (() => {
                const hits = tagIndex(activeTag);
                return (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))]/50">
                        {hits.length} note{hits.length !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => setActiveTag(null)}
                        aria-label="Close tag filter"
                        className="font-mono text-[9px] text-[hsl(var(--text-secondary))]/40 hover:text-[hsl(var(--accent))]"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {hits.length === 0 ? (
                        <span className="text-[11px] text-[hsl(var(--text-secondary))]/40">no matches</span>
                      ) : (
                        hits.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => { onSelect(h.id); setActiveTag(null); }}
                            className="flex w-full items-center gap-1.5 truncate text-left text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
                          >
                            <Icon name="file" size={10} className="shrink-0 opacity-50" />
                            {h.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {outLinks.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Links</SectionLabel>
              <div className="space-y-0.5">
                {outLinks.map((n) => (
                  <button key={n} onClick={() => openWiki(n)} className="flex w-full items-center gap-1.5 truncate text-left text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
                    <Icon name="branch" size={10} className="shrink-0 opacity-50" /> {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {backlinks.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Backlinks · {backlinks.length}</SectionLabel>
              <div className="space-y-0.5">
                {backlinksShown.map((b) => (
                  <button key={b.id} onClick={() => onSelect(b.id)} className="flex w-full items-center gap-1.5 truncate text-left text-[12px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]">
                    <Icon name="file" size={10} className="shrink-0 opacity-50" /> {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
