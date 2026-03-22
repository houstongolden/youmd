"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useCallback } from "react";
import { PaneHeader, PaneEmptyState } from "./shared";
import { decompileBundle, buildFileTree, generateMemoryFiles, type VirtualFile, type FileTreeNode, type MemoryEntry, type SessionEntry } from "@/lib/decompile";
import { recompileYouJson } from "@/lib/recompile";
import type { Id } from "../../../convex/_generated/dataModel";

interface FilesPaneProps {
  userId: Id<"users">;
}

// File extension to syntax hint mapping
const extLabel: Record<string, string> = {
  ".md": "markdown",
  ".json": "json",
};

function getExtLabel(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return extLabel[ext] || "text";
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
  const isDir = node.type === "directory";
  const isSelected = node.path === selectedPath;
  const indent = depth * 12;

  if (isDir) {
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
          <span className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-70">
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
        isSelected
          ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
          : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80 hover:bg-[hsl(var(--bg))]"
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
    >
      <span className="font-mono text-[10px] opacity-30">-</span>
      <span className="font-mono text-[11px] truncate">{node.name}</span>
    </button>
  );
}

// ── File Editor ─────────────────────────────────────────────────────────

function FileEditor({
  file,
  onContentChange,
  editedContent,
}: {
  file: VirtualFile;
  onContentChange: (path: string, content: string) => void;
  editedContent: string | undefined;
}) {
  const content = editedContent ?? file.content;
  const isModified = editedContent !== undefined && editedContent !== file.content;
  const lang = getExtLabel(file.path);

  return (
    <div className="flex flex-col h-full">
      {/* File header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
            {file.path}
          </span>
          {isModified && (
            <span className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase">
              modified
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase">
            {lang}
          </span>
          {!file.editable && (
            <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase border border-[hsl(var(--border))] px-1.5 py-0.5" style={{ borderRadius: "2px" }}>
              read-only
            </span>
          )}
        </div>
      </div>

      {/* Editor area */}
      {file.editable ? (
        <textarea
          value={content}
          onChange={(e) => onContentChange(file.path, e.target.value)}
          className="flex-1 w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] leading-relaxed p-4 resize-none focus:outline-none border-none"
          spellCheck={false}
        />
      ) : (
        <pre className="flex-1 overflow-auto bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))] font-mono text-[11px] leading-relaxed p-4 whitespace-pre-wrap break-all">
          {content}
        </pre>
      )}
    </div>
  );
}

// ── Main FilesPane ──────────────────────────────────────────────────────

export function FilesPane({ userId }: FilesPaneProps) {
  const { user } = useUser();
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    userId ? { userId } : "skip"
  );
  const saveYouJson = useMutation(api.me.saveYouJsonDirect);
  const memories = useQuery(
    api.memories.listMemories,
    userId ? { userId } : "skip"
  );
  const sessions = useQuery(
    api.memories.listSessions,
    userId ? { userId, limit: 20 } : "skip"
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const files = useMemo(() => {
    if (!latestBundle?.youJson) return [];
    const bundleFiles = decompileBundle(latestBundle.youJson, latestBundle.youMd ?? "");

    // Add memory + session files
    const memEntries: MemoryEntry[] = (memories ?? []).map((m) => ({
      _id: m._id,
      category: m.category,
      content: m.content,
      source: m.source,
      sourceAgent: m.sourceAgent,
      tags: m.tags,
      createdAt: m.createdAt,
    }));
    const sessEntries: SessionEntry[] = (sessions ?? []).map((s) => ({
      _id: s._id,
      sessionId: s.sessionId,
      surface: s.surface,
      summary: s.summary,
      messageCount: s.messageCount,
      lastMessageAt: s.lastMessageAt,
      createdAt: s.createdAt,
    }));
    const memoryFiles = generateMemoryFiles(memEntries, sessEntries);

    return [...bundleFiles, ...memoryFiles];
  }, [latestBundle, memories, sessions]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.path.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    );
  }, [files, searchQuery]);

  const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);

  const selectedFile = useMemo(
    () => files.find((f) => f.path === selectedPath) ?? null,
    [files, selectedPath]
  );

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
      // Get only actually modified files
      const modified: Record<string, string> = {};
      for (const [path, content] of Object.entries(editedFiles)) {
        const original = files.find((f) => f.path === path);
        if (original && content !== original.content) {
          modified[path] = content;
        }
      }

      const patchedYouJson = recompileYouJson(latestBundle.youJson, modified);
      const result = await saveYouJson({
        clerkId: user.id,
        youJson: patchedYouJson,
      });
      setSaveStatus(`saved as v${result.version}`);
      setEditedFiles({});
      // Clear status after a few seconds
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

  if (!latestBundle?.youJson && files.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <PaneHeader>files</PaneHeader>
        <PaneEmptyState>
          no bundle yet. talk to the agent to build your profile.
        </PaneEmptyState>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))] flex items-center gap-2">
          files
          {modifiedCount > 0 && (
            <span className="text-[hsl(var(--accent))]">
              ({modifiedCount} modified)
            </span>
          )}
          {saveStatus && (
            <span className={`text-[9px] ${saveStatus.startsWith("error") ? "text-red-400" : "text-[hsl(var(--success))]"}`}>
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

      <div className="flex-1 flex min-h-0">
        {/* File tree sidebar */}
        <div className="w-[180px] shrink-0 border-r border-[hsl(var(--border))] overflow-y-auto">
          {/* Tree header */}
          <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
            <span className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest">
              {">"} vault
            </span>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-[hsl(var(--border))]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search files..."
              className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[10px] px-2 py-1 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/40 focus:outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-30"
              style={{ borderRadius: "2px" }}
            />
          </div>

          {/* Stats */}
          <div className="px-3 py-1.5 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
              <span>{searchQuery ? `${filteredFiles.length}/${files.length}` : files.length} files</span>
              <span>{latestBundle ? `v${latestBundle.version}` : ""}{memories?.length ? ` / ${memories.length} mem` : ""}</span>
            </div>
          </div>

          {/* Tree */}
          <div className="py-1">
            {tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
              />
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0">
          {selectedFile ? (
            <FileEditor
              file={selectedFile}
              onContentChange={handleContentChange}
              editedContent={editedFiles[selectedFile.path]}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-30">
                  select a file to view
                </p>
                <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-20">
                  your identity bundle as a file system
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
