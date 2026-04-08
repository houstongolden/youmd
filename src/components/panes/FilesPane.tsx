"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { PaneHeader, PaneEmptyState } from "./shared";
import { decompileBundle, buildFileTree, generateMemoryFiles, type VirtualFile, type FileTreeNode } from "@/lib/decompile";
import { recompileYouJson } from "@/lib/recompile";
import type { Id } from "../../../convex/_generated/dataModel";

interface FilesPaneProps {
  userId: Id<"users">;
}

function getExtLabel(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

// ── Visibility helpers ──────────────────────────────────────────────────
//
// Public  = accessible by any agent that hits your you.md profile URL
// Private = requires a context link with token, or authenticated CLI access
//
// Public surfaces:
//   - root: you.json, you.md, manifest.json
//   - profile/ (and everything inside it)
// Everything else (sessions/, sources/, voice/, projects/, skills/,
// directives/, memory/, preferences/, private/, custom dirs) is private.

const PUBLIC_ROOT_FILES = new Set(["you.json", "you.md", "manifest.json"]);
const PUBLIC_DIRS = new Set(["profile"]);

function isPublicPath(path: string): boolean {
  if (!path) return false;
  // Strip a leading slash if it ever exists
  const p = path.startsWith("/") ? path.slice(1) : path;
  // Root-level files
  if (!p.includes("/")) return PUBLIC_ROOT_FILES.has(p);
  // Directory-rooted files
  const top = p.split("/")[0];
  return PUBLIC_DIRS.has(top);
}

const PUBLIC_TOOLTIP = "Public — accessible by any agent with your you.md profile URL";
const PRIVATE_TOOLTIP = "Private — requires context link with token or authenticated CLI access";

function VisibilityIcon({ isPublic }: { isPublic: boolean }) {
  // Globe for public, lock for private. Sized + colored to match the
  // monochrome + burnt orange terminal aesthetic.
  if (isPublic) {
    return (
      <span
        title={PUBLIC_TOOLTIP}
        aria-label="public"
        className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 shrink-0 leading-none select-none"
        style={{ width: "10px", display: "inline-flex", justifyContent: "center" }}
      >
        {"\u25CB"}
      </span>
    );
  }
  return (
    <span
      title={PRIVATE_TOOLTIP}
      aria-label="private"
      className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 shrink-0 leading-none select-none"
      style={{ width: "10px", display: "inline-flex", justifyContent: "center" }}
    >
      {"\u25CF"}
    </span>
  );
}

// ── Simple Markdown Renderer ────────────────────────────────────────────

function renderMarkdown(source: string): string {
  const lines = source.split("\n");
  const html: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push('<hr class="md-hr" />');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { html.push("</ul>"); inList = false; }
      const level = headingMatch[1].length;
      html.push(`<h${level} class="md-h${level}">${escapeAndInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Bullet list items
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) { html.push('<ul class="md-ul">'); inList = true; }
      html.push(`<li class="md-li">${escapeAndInline(bulletMatch[1])}</li>`);
      continue;
    }

    // Close list if we're leaving it
    if (inList) { html.push("</ul>"); inList = false; }

    // Blank line
    if (line.trim() === "") {
      html.push('<div class="md-blank">&nbsp;</div>');
      continue;
    }

    // Paragraph
    html.push(`<p class="md-p">${escapeAndInline(line)}</p>`);
  }

  if (inList) html.push("</ul>");
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAndInline(text: string): string {
  let s = escapeHtml(text);
  // Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');
  // Italic: *text*
  s = s.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');
  // Inline code: `text`
  s = s.replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
  return s;
}

function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className="flex-1 overflow-auto p-3 md:p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-primary))] md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        // Scoped styles for the preview via CSS custom properties
        ["--md-accent" as string]: "hsl(var(--accent))",
        ["--md-muted" as string]: "hsl(var(--text-secondary))",
        ["--md-border" as string]: "hsl(var(--border))",
        ["--md-bg" as string]: "hsl(var(--bg))",
      }}
    />
  );
}

// Injected once — scoped preview styles
function MarkdownStyles() {
  return (
    <style>{`
      .md-preview .md-h1 { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; opacity: 0.9; }
      .md-preview .md-h2 { font-size: 14px; font-weight: 600; margin: 12px 0 6px 0; opacity: 0.85; color: var(--md-accent); }
      .md-preview .md-h3 { font-size: 12px; font-weight: 600; margin: 10px 0 4px 0; opacity: 0.8; }
      .md-preview .md-h4, .md-preview .md-h5, .md-preview .md-h6 { font-size: 11px; font-weight: 600; margin: 8px 0 4px 0; opacity: 0.7; }
      .md-preview .md-p { margin: 0 0 4px 0; opacity: 0.8; }
      .md-preview .md-blank { height: 8px; }
      .md-preview .md-hr { border: none; border-top: 1px solid var(--md-border); margin: 12px 0; opacity: 0.3; }
      .md-preview .md-ul { list-style: none; padding-left: 12px; margin: 4px 0; }
      .md-preview .md-li { opacity: 0.8; margin: 2px 0; }
      .md-preview .md-li::before { content: "- "; opacity: 0.4; }
      .md-preview .md-bold { font-weight: 600; opacity: 0.9; }
      .md-preview .md-italic { font-style: italic; opacity: 0.7; }
      .md-preview .md-code {
        background: var(--md-bg);
        border: 1px solid var(--md-border);
        border-radius: 2px;
        padding: 1px 4px;
        font-size: 10px;
        opacity: 0.8;
      }
    `}</style>
  );
}

// ── File Tree Item ──────────────────────────────────────────────────────

function FileTreeItem({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = depth * 12;

  if (node.type === "directory") {
    // A directory's visibility is determined by checking a synthetic file
    // path inside it. profile/ is public; everything else is private.
    const dirPublic = isPublicPath(`${node.path}/_`);
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={dirPublic ? PUBLIC_TOOLTIP : PRIVATE_TOOLTIP}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-[hsl(var(--bg))] transition-colors"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 w-3">
            {expanded ? "v" : ">"}
          </span>
          <VisibilityIcon isPublic={dirPublic} />
          <span className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-70">
            {node.name}/
          </span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const filePublic = isPublicPath(node.path);
  return (
    <button
      onClick={() => onSelect(node.path)}
      title={filePublic ? PUBLIC_TOOLTIP : PRIVATE_TOOLTIP}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-left transition-colors ${
        node.path === selectedPath
          ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
          : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80 hover:bg-[hsl(var(--bg))]"
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
    >
      <VisibilityIcon isPublic={filePublic} />
      <span className="font-mono text-[10px] opacity-30">-</span>
      <span className="font-mono text-[10px] truncate">{node.name}</span>
    </button>
  );
}

// ── File Viewer ─────────────────────────────────────────────────────────

function FileViewer({
  file,
  onContentChange,
  editedContent,
  onBack,
  isCustomDir,
  onAddFileInDir,
}: {
  file: VirtualFile;
  onContentChange: (path: string, content: string) => void;
  editedContent: string | undefined;
  onBack?: () => void;
  isCustomDir: boolean;
  onAddFileInDir?: () => void;
}) {
  const content = editedContent ?? file.content;
  const isModified = editedContent !== undefined && editedContent !== file.content;
  const isMarkdown = file.path.endsWith(".md");
  const [previewMode, setPreviewMode] = useState(false);

  // Reset preview mode when switching files
  const filePathRef = useRef(file.path);
  if (filePathRef.current !== file.path) {
    filePathRef.current = file.path;
    if (previewMode) setPreviewMode(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 mr-1"
            >
              {"<"} back
            </button>
          )}
          <VisibilityIcon isPublic={isPublicPath(file.path)} />
          <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate">
            {file.path}
          </span>
          {isModified && (
            <span className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase shrink-0">modified</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Markdown preview toggle */}
          {isMarkdown && (
            <div className="flex items-center border border-[hsl(var(--border))]" style={{ borderRadius: "2px" }}>
              <button
                onClick={() => setPreviewMode(false)}
                className={`font-mono text-[9px] px-1.5 py-0.5 transition-colors ${
                  !previewMode
                    ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                    : "text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-60"
                }`}
              >
                edit
              </button>
              <div className="w-px h-3 bg-[hsl(var(--border))]" />
              <button
                onClick={() => setPreviewMode(true)}
                className={`font-mono text-[9px] px-1.5 py-0.5 transition-colors ${
                  previewMode
                    ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                    : "text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-60"
                }`}
              >
                preview
              </button>
            </div>
          )}
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase hidden sm:inline">
            {getExtLabel(file.path)}
          </span>
          {!file.editable && (
            <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase border border-[hsl(var(--border))] px-1.5 py-0.5" style={{ borderRadius: "2px" }}>
              read-only
            </span>
          )}
          {isCustomDir && onAddFileInDir && (
            <button
              onClick={onAddFileInDir}
              className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 border border-[hsl(var(--accent))]/40 px-1.5 py-0.5 hover:bg-[hsl(var(--accent))]/10 transition-colors"
              style={{ borderRadius: "2px" }}
              title="add a new markdown file inside this custom directory"
            >
              + new file in dir
            </button>
          )}
        </div>
      </div>
      {/* Content area */}
      {previewMode && isMarkdown ? (
        <MarkdownPreview content={content} />
      ) : file.editable ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(file.path, e.target.value)}
          className="flex-1 w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] leading-relaxed p-3 md:p-4 resize-none focus:outline-none"
          spellCheck={false}
        />
      ) : (
        <pre className="flex-1 overflow-auto bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))] font-mono text-[11px] leading-relaxed p-3 md:p-4 whitespace-pre-wrap break-all">
          {content}
        </pre>
      )}
    </div>
  );
}

// ── New File Input ──────────────────────────────────────────────────────

function NewFileInput({
  onCreateFile,
  onCancel,
}: {
  onCreateFile: (path: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    let path = value.trim();
    if (!path) { onCancel(); return; }
    // Ensure .md extension
    if (!path.endsWith(".md")) path += ".md";
    // Remove leading slash
    if (path.startsWith("/")) path = path.slice(1);
    onCreateFile(path);
  };

  return (
    <div className="px-2 py-1.5 border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 shrink-0">+</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => { if (!value.trim()) onCancel(); }}
          placeholder="custom/my-notes.md"
          className="flex-1 bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[10px] px-1.5 py-0.5 border border-[hsl(var(--accent))]/40 focus:outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-30"
          style={{ borderRadius: "2px" }}
        />
      </div>
      <div className="font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-30 mt-0.5 pl-3">
        enter to create / esc to cancel
      </div>
    </div>
  );
}

// ── New Directory Input ─────────────────────────────────────────────────

function NewDirectoryInput({
  onCreateDirectory,
  onCancel,
  busy,
  error,
}: {
  onCreateDirectory: (dirName: string) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const name = value.trim().toLowerCase();
    if (!name) { onCancel(); return; }
    if (busy) return;
    onCreateDirectory(name);
  };

  // Live validation hint
  const validName = /^[a-z0-9-]+$/.test(value.trim()) && value.trim().length > 0 && value.trim().length <= 30;

  return (
    <div className="px-2 py-1.5 border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 shrink-0">+</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          disabled={busy}
          placeholder="my-notes"
          maxLength={30}
          className="flex-1 bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[10px] px-1.5 py-0.5 border border-[hsl(var(--accent))]/40 focus:outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-30 disabled:opacity-40"
          style={{ borderRadius: "2px" }}
        />
      </div>
      <div className="font-mono text-[8px] mt-0.5 pl-3">
        {error ? (
          <span className="text-[hsl(var(--accent))] opacity-80">{error}</span>
        ) : value.trim() && !validName ? (
          <span className="text-[hsl(var(--accent))] opacity-60">lowercase, hyphens only, max 30 chars</span>
        ) : (
          <span className="text-[hsl(var(--text-secondary))] opacity-30">
            {busy ? "creating..." : "new private directory / enter to create / esc to cancel"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export function FilesPane({ userId }: FilesPaneProps) {
  const { user } = useUser();
  const latestBundle = useQuery(api.bundles.getLatestBundle, userId ? { userId } : "skip");
  const saveYouJson = useMutation(api.me.saveYouJsonDirect);
  const createCustomDirectory = useMutation(api.me.createCustomDirectory);
  const memories = useQuery(api.memories.listMemories, userId ? { userId } : "skip");
  const sessions = useQuery(api.memories.listSessions, userId ? { userId, limit: 20 } : "skip");

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);
  const [creatingDirectory, setCreatingDirectory] = useState(false);
  const [creatingDirError, setCreatingDirError] = useState<string | null>(null);
  const [creatingDirBusy, setCreatingDirBusy] = useState(false);
  const [customFiles, setCustomFiles] = useState<VirtualFile[]>([]);

  const files = useMemo(() => {
    const bundleFiles = latestBundle?.youJson
      ? decompileBundle(latestBundle.youJson, latestBundle.youMd ?? "")
      : [];
    const memoryFiles = generateMemoryFiles(memories ?? [], sessions ?? []);
    return [...bundleFiles, ...memoryFiles, ...customFiles];
  }, [latestBundle, memories, sessions, customFiles]);

  // ── Custom directories ──
  // A "custom directory" is any directory backed by a youJson.custom_files entry,
  // OR any unsaved customFiles entry that lives 2+ levels deep.
  const customDirSet = useMemo(() => {
    const set = new Set<string>();
    // From persisted bundle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persisted = (latestBundle?.youJson as any)?.custom_files as Array<{ path?: string }> | undefined;
    if (Array.isArray(persisted)) {
      for (const cf of persisted) {
        if (cf?.path && typeof cf.path === "string") {
          const parts = cf.path.split("/");
          if (parts.length >= 2) {
            // Strip the filename, keep the dir path
            set.add(parts.slice(0, -1).join("/"));
          }
        }
      }
    }
    // From in-memory unsaved files
    for (const cf of customFiles) {
      const parts = cf.path.split("/");
      if (parts.length >= 2) set.add(parts.slice(0, -1).join("/"));
    }
    return set;
  }, [latestBundle, customFiles]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);
  const selectedFile = useMemo(() => files.find((f) => f.path === selectedPath) ?? null, [files, selectedPath]);

  const handleContentChange = useCallback((path: string, content: string) => {
    setEditedFiles((prev) => ({ ...prev, [path]: content }));
  }, []);

  const modifiedCount = useMemo(() => {
    return Object.entries(editedFiles).filter(([path, content]) => {
      const original = files.find((f) => f.path === path);
      return original && content !== original.content;
    }).length;
  }, [editedFiles, files]);

  const handleSave = useCallback(async () => {
    if (!latestBundle?.youJson || !user?.id || modifiedCount === 0) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const modified: Record<string, string> = {};
      for (const [path, content] of Object.entries(editedFiles)) {
        const original = files.find((f) => f.path === path);
        if (original && content !== original.content) modified[path] = content;
      }
      const patchedYouJson = recompileYouJson(latestBundle.youJson, modified);
      const result = await saveYouJson({ clerkId: user.id, youJson: patchedYouJson });
      setSaveStatus(`saved as v${result.version}`);
      setEditedFiles({});
      // Clear custom files that were saved (they'll come back from the bundle)
      setCustomFiles((prev) => prev.filter((f) => !modified[f.path]));
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }, [latestBundle, user, modifiedCount, editedFiles, files, saveYouJson]);

  const handleDiscard = useCallback(() => {
    setEditedFiles({});
    setSaveStatus(null);
  }, []);

  // ── Create new file ───────────────────────────────────────────────────

  const handleCreateFile = useCallback((path: string) => {
    // Check if file already exists
    const exists = files.some((f) => f.path === path);
    if (exists) {
      setSelectedPath(path);
      setCreatingFile(false);
      return;
    }

    // Determine section from path
    const section = path.split("/")[0] || "custom";

    const newFile: VirtualFile = {
      path,
      content: `---\ntitle: ${path.split("/").pop()?.replace(".md", "") || "Untitled"}\n---\n\n`,
      section,
      editable: true,
    };

    setCustomFiles((prev) => [...prev, newFile]);
    setEditedFiles((prev) => ({ ...prev, [path]: newFile.content }));
    setSelectedPath(path);
    setCreatingFile(false);
  }, [files]);

  // ── Create new custom directory ───────────────────────────────────────

  const handleCreateDirectory = useCallback(async (dirName: string) => {
    if (!user?.id) {
      setCreatingDirError("not signed in");
      return;
    }
    setCreatingDirBusy(true);
    setCreatingDirError(null);
    try {
      const result = await createCustomDirectory({
        clerkId: user.id,
        dirName,
        // default = private
      });
      setCreatingDirectory(false);
      setSaveStatus(`created /${result.filePath}`);
      setSelectedPath(result.filePath);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setCreatingDirError(err instanceof Error ? err.message : "failed to create directory");
    } finally {
      setCreatingDirBusy(false);
    }
  }, [user, createCustomDirectory]);

  // ── Add a new file inside the directory of the currently-selected file ─

  const handleAddFileInCurrentDir = useCallback(() => {
    if (!selectedPath) return;
    const parts = selectedPath.split("/");
    if (parts.length < 2) return;
    const dirPath = parts.slice(0, -1).join("/");

    // Find an unused filename
    let idx = 1;
    let candidate = `${dirPath}/note.md`;
    const taken = new Set(files.map((f) => f.path));
    while (taken.has(candidate)) {
      idx += 1;
      candidate = `${dirPath}/note-${idx}.md`;
    }

    const newFile: VirtualFile = {
      path: candidate,
      content: `---\ntitle: ${candidate.split("/").pop()?.replace(".md", "") || "Note"}\n---\n\n`,
      section: `custom_files.${candidate}`,
      editable: true,
    };
    setCustomFiles((prev) => [...prev, newFile]);
    setEditedFiles((prev) => ({ ...prev, [candidate]: newFile.content }));
    setSelectedPath(candidate);
  }, [selectedPath, files]);

  // Helper: is the currently selected file inside a custom directory?
  const selectedFileIsInCustomDir = useMemo(() => {
    if (!selectedPath) return false;
    const parts = selectedPath.split("/");
    if (parts.length < 2) return false;
    const dirPath = parts.slice(0, -1).join("/");
    return customDirSet.has(dirPath);
  }, [selectedPath, customDirSet]);

  // ── Keyboard shortcut: Cmd+S / Ctrl+S ────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (modifiedCount > 0 && !saving) {
          handleSave();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modifiedCount, saving, handleSave]);

  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <PaneHeader>files</PaneHeader>
        <PaneEmptyState>no bundle yet. talk to the agent to build your profile.</PaneEmptyState>
      </div>
    );
  }

  // Mobile: show file viewer full-width when a file is selected
  const showMobileViewer = selectedFile !== null;

  return (
    <div className="h-full flex flex-col">
      <MarkdownStyles />

      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))] flex items-center gap-2">
          files
          {modifiedCount > 0 && (
            <span className="text-[hsl(var(--accent))]">({modifiedCount} modified)</span>
          )}
          {saveStatus && (
            <span className={`text-[9px] ${saveStatus.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}`}>
              {saveStatus}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <>
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="font-mono text-[10px] px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors disabled:opacity-30"
                style={{ borderRadius: "2px" }}
              >
                discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="font-mono text-[10px] px-2 py-1 border border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10 transition-colors disabled:opacity-30"
                style={{ borderRadius: "2px" }}
              >
                {saving ? "saving..." : "save"}
              </button>
            </>
          )}
          {/* Keyboard shortcut hint */}
          {modifiedCount > 0 && (
            <span className="font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-30 hidden md:inline">
              {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "cmd" : "ctrl"}+s
            </span>
          )}
        </div>
      </div>

      {/* Mobile: full-width file viewer when selected */}
      <div className={`flex-1 min-h-0 ${showMobileViewer ? "hidden md:flex" : "flex"} md:flex`}>
        {/* Sidebar — full width on mobile, fixed width on desktop */}
        <div className="w-full md:w-[180px] md:shrink-0 md:border-r border-[hsl(var(--border))] overflow-y-auto flex flex-col">
          <div className="px-2 py-1.5 border-b border-[hsl(var(--border))]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search..."
              className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[10px] px-2 py-1 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/40 focus:outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-30"
              style={{ borderRadius: "2px" }}
            />
          </div>
          <div className="px-3 py-1.5 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
              <span>{searchQuery ? `${filteredFiles.length}/${files.length}` : files.length} files</span>
              <span>{latestBundle ? `v${latestBundle.version}` : ""}{memories?.length ? ` / ${memories.length} mem` : ""}</span>
            </div>
          </div>
          <div className="py-1 flex-1 overflow-y-auto">
            {tree.map((node) => (
              <FileTreeItem key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
            ))}
          </div>
          {/* New file button / input */}
          {creatingFile ? (
            <NewFileInput
              onCreateFile={handleCreateFile}
              onCancel={() => setCreatingFile(false)}
            />
          ) : (
            <button
              onClick={() => { setCreatingFile(true); setCreatingDirectory(false); }}
              className="w-full px-3 py-1.5 border-t border-[hsl(var(--border))] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70 hover:text-[hsl(var(--accent))] transition-colors text-left"
            >
              + new file
            </button>
          )}

          {/* New directory button / input */}
          {creatingDirectory ? (
            <NewDirectoryInput
              onCreateDirectory={handleCreateDirectory}
              onCancel={() => { setCreatingDirectory(false); setCreatingDirError(null); }}
              busy={creatingDirBusy}
              error={creatingDirError}
            />
          ) : (
            <button
              onClick={() => { setCreatingDirectory(true); setCreatingFile(false); setCreatingDirError(null); }}
              className="w-full px-3 py-1.5 border-t border-[hsl(var(--border))] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70 hover:text-[hsl(var(--accent))] transition-colors text-left"
              title="create a custom directory (private by default)"
            >
              + new directory
            </button>
          )}
        </div>

        {/* Desktop editor */}
        <div className="hidden md:flex flex-1 min-w-0">
          {selectedFile ? (
            <div className="flex-1">
              <FileViewer
                file={selectedFile}
                onContentChange={handleContentChange}
                editedContent={editedFiles[selectedFile.path]}
                isCustomDir={selectedFileIsInCustomDir}
                onAddFileInDir={handleAddFileInCurrentDir}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-30">
                select a file to view
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: full-width file viewer */}
      {showMobileViewer && (
        <div className="flex-1 min-h-0 flex md:hidden">
          <div className="flex-1">
            <FileViewer
              file={selectedFile!}
              onContentChange={handleContentChange}
              editedContent={editedFiles[selectedFile!.path]}
              onBack={() => setSelectedPath(null)}
              isCustomDir={selectedFileIsInCustomDir}
              onAddFileInDir={handleAddFileInCurrentDir}
            />
          </div>
        </div>
      )}
    </div>
  );
}
