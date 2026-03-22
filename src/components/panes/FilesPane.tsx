"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useCallback } from "react";
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
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-[hsl(var(--bg))] transition-colors"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 w-3">
            {expanded ? "v" : ">"}
          </span>
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

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-left transition-colors ${
        node.path === selectedPath
          ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
          : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80 hover:bg-[hsl(var(--bg))]"
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
    >
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
}: {
  file: VirtualFile;
  onContentChange: (path: string, content: string) => void;
  editedContent: string | undefined;
  onBack?: () => void;
}) {
  const content = editedContent ?? file.content;
  const isModified = editedContent !== undefined && editedContent !== file.content;

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
          <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate">
            {file.path}
          </span>
          {isModified && (
            <span className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase shrink-0">modified</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase hidden sm:inline">
            {getExtLabel(file.path)}
          </span>
          {!file.editable && (
            <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase border border-[hsl(var(--border))] px-1.5 py-0.5" style={{ borderRadius: "2px" }}>
              read-only
            </span>
          )}
        </div>
      </div>
      {file.editable ? (
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

// ── Main ────────────────────────────────────────────────────────────────

export function FilesPane({ userId }: FilesPaneProps) {
  const { user } = useUser();
  const latestBundle = useQuery(api.bundles.getLatestBundle, userId ? { userId } : "skip");
  const saveYouJson = useMutation(api.me.saveYouJsonDirect);
  const memories = useQuery(api.memories.listMemories, userId ? { userId } : "skip");
  const sessions = useQuery(api.memories.listSessions, userId ? { userId, limit: 20 } : "skip");

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const files = useMemo(() => {
    const bundleFiles = latestBundle?.youJson
      ? decompileBundle(latestBundle.youJson, latestBundle.youMd ?? "")
      : [];
    const memoryFiles = generateMemoryFiles(memories ?? [], sessions ?? []);
    return [...bundleFiles, ...memoryFiles];
  }, [latestBundle, memories, sessions]);

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
        {modifiedCount > 0 && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </div>

      {/* Mobile: full-width file viewer when selected */}
      <div className={`flex-1 min-h-0 ${showMobileViewer ? "hidden md:flex" : "flex"} md:flex`}>
        {/* Sidebar — full width on mobile, fixed width on desktop */}
        <div className="w-full md:w-[180px] md:shrink-0 md:border-r border-[hsl(var(--border))] overflow-y-auto">
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
          <div className="py-1">
            {tree.map((node) => (
              <FileTreeItem key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
            ))}
          </div>
        </div>

        {/* Desktop editor */}
        <div className="hidden md:flex flex-1 min-w-0">
          {selectedFile ? (
            <div className="flex-1">
              <FileViewer file={selectedFile} onContentChange={handleContentChange} editedContent={editedFiles[selectedFile.path]} />
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
            />
          </div>
        </div>
      )}
    </div>
  );
}
