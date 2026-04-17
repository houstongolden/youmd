"use client";

import { useState } from "react";
import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader, PaneEmptyState } from "./shared";

interface SourcesPaneProps {
  userId: Id<"users">;
  username: string;
}

type SourceStatus = "pending" | "fetching" | "fetched" | "extracting" | "extracted" | "failed";

const statusConfig: Record<SourceStatus, { icon: string; colorClass: string }> = {
  extracted: { icon: "\u2713", colorClass: "text-[hsl(var(--success))]" },
  fetched: { icon: "\u21BB", colorClass: "text-[hsl(var(--accent))]" },
  extracting: { icon: "\u21BB", colorClass: "text-[hsl(var(--accent))]" },
  fetching: { icon: "\u2026", colorClass: "text-[hsl(var(--accent-mid))]" },
  pending: { icon: "\u25CB", colorClass: "text-[hsl(var(--accent-mid))]" },
  failed: { icon: "\u2717", colorClass: "text-red-500" },
};

const defaultStatusConfig = { icon: "\u25CB", colorClass: "text-[hsl(var(--text-secondary))] opacity-40" };

/** Pretty-print a source type string. */
function formatSourceType(sourceType: string): string {
  const map: Record<string, string> = {
    linkedin: "LinkedIn",
    github: "GitHub",
    x: "X / Twitter",
    twitter: "X / Twitter",
    substack: "Substack",
    blog: "Blog",
    notion: "Notion",
    website: "Website",
  };
  return map[sourceType.toLowerCase()] ?? sourceType;
}

/** Format a timestamp to a relative "time ago" string. */
function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Count extracted data fields (rough heuristic). */
function countExtracted(extracted: unknown): number {
  if (!extracted || typeof extracted !== "object") return 0;
  const obj = extracted as Record<string, unknown>;
  // Skip internal fields
  const keys = Object.keys(obj).filter((k) => !k.startsWith("_"));
  let count = 0;
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val)) {
      count += val.length;
    } else if (val && typeof val === "object") {
      count += Object.keys(val as Record<string, unknown>).length;
    } else if (val !== null && val !== undefined) {
      count += 1;
    }
  }
  return count;
}

/** Try to infer sourceType from a URL. */
function inferSourceType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("github.com")) return "github";
  if (lower.includes("x.com") || lower.includes("twitter.com")) return "x";
  if (lower.includes("substack.com") || lower.includes(".substack.")) return "substack";
  if (lower.includes("notion.so") || lower.includes("notion.site")) return "notion";
  return "website";
}

export function SourcesPane({ userId, username }: SourcesPaneProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  // Real data from Convex
  const sources = useQuery(api.me.getSources, clerkId ? { clerkId } : "skip");
  const addSource = useMutation(api.me.addSource);

  // Add-source form state
  const [newUrl, setNewUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddSource = async () => {
    if (!clerkId || !newUrl.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const url = newUrl.trim();
      const sourceType = inferSourceType(url);
      await addSource({ clerkId, sourceType, sourceUrl: url });
      setNewUrl("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add source");
    } finally {
      setIsAdding(false);
    }
  };

  // Loading state
  if (sources === undefined) {
    return (
      <div className="h-full overflow-y-auto">
        <PaneHeader>sources</PaneHeader>
        <div className="px-6 py-12">
          <p className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
            loading sources...
          </p>
        </div>
      </div>
    );
  }

  // Computed stats
  const totalSources = sources.length;
  const connectedCount = sources.filter(
    (s) => s.status === "fetched" || s.status === "extracted" || s.status === "extracting"
  ).length;
  const totalExtracted = sources.reduce(
    (sum, s) => sum + countExtracted(s.extracted),
    0
  );
  const lastFetchedSource = sources
    .filter((s) => s.lastFetched)
    .sort((a, b) => (b.lastFetched ?? 0) - (a.lastFetched ?? 0))[0];
  const lastSyncLabel = lastFetchedSource?.lastFetched
    ? timeAgo(lastFetchedSource.lastFetched)
    : "--";

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>sources</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: "connected", value: String(connectedCount) },
            { label: "extracted fields", value: totalExtracted > 0 ? totalExtracted.toLocaleString() : "--" },
            { label: "last sync", value: lastSyncLabel },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] text-center"
              style={{ borderRadius: "2px" }}
            >
              <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase">
                {s.label}
              </p>
              <p className="font-mono text-sm text-[hsl(var(--text-primary))] mt-1">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <SectionLabel>all sources ({totalSources})</SectionLabel>

        {totalSources === 0 ? (
          <div
            className="border border-[hsl(var(--border))] p-6 bg-[hsl(var(--bg-raised))] text-center"
            style={{ borderRadius: "2px" }}
          >
            <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40">
              no sources added yet
            </p>
            <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mt-2">
              add a URL below to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => {
              const status = s.status as SourceStatus;
              const cfg = statusConfig[status] || defaultStatusConfig;
              const extractedCount = countExtracted(s.extracted);

              return (
                <div
                  key={s._id}
                  className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                  style={{ borderRadius: "2px" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[12px] ${cfg.colorClass}`}>
                        {cfg.icon}
                      </span>
                      <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80">
                        {formatSourceType(s.sourceType)}
                      </span>
                    </div>
                    <span className={`font-mono text-[9px] uppercase tracking-wider ${cfg.colorClass}`}>
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                    <span>last sync: {s.lastFetched ? timeAgo(s.lastFetched) : "--"}</span>
                    <span>fields: {extractedCount > 0 ? extractedCount : "--"}</span>
                  </div>
                  <div className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mt-1 truncate">
                    {s.sourceUrl}
                  </div>
                  {status === "failed" && s.errorMessage && (
                    <div className="font-mono text-[9px] text-red-500 opacity-70 mt-1 truncate">
                      error: {s.errorMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Divider />

        <SectionLabel>add source</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-3">
            paste a URL to connect a new source:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSource();
              }}
              placeholder="https://linkedin.com/in/username"
              disabled={isAdding || !clerkId}
              className="flex-1 min-w-0 font-mono text-[11px] bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] border border-[hsl(var(--border))] px-3 py-2 placeholder:text-[hsl(var(--text-secondary))]/30 focus:outline-none focus:border-[hsl(var(--accent))]/40 disabled:opacity-40"
              style={{ borderRadius: "2px" }}
            />
            <button
              onClick={handleAddSource}
              disabled={isAdding || !newUrl.trim() || !clerkId}
              className="shrink-0 font-mono text-[10px] px-3 py-2 bg-[hsl(var(--accent))] text-[hsl(var(--bg))] border border-[hsl(var(--accent))] hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderRadius: "2px" }}
            >
              {isAdding ? "..." : "add"}
            </button>
          </div>
          {addError && (
            <p className="font-mono text-[9px] text-red-500 opacity-70 mt-2">
              {addError}
            </p>
          )}
          <div className="mt-3 space-y-1">
            <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30">
              supported: linkedin, github, x/twitter, substack, blogs, websites
            </p>
          </div>
        </div>

        <Divider />

        <SectionLabel>pipeline</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">total sources</span>
            <span className="text-[hsl(var(--text-primary))] opacity-70">{totalSources}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">extracted</span>
            <span className="text-[hsl(var(--text-primary))] opacity-70">
              {sources.filter((s) => s.status === "extracted").length} / {totalSources}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">pending</span>
            <span className="text-[hsl(var(--text-primary))] opacity-70">
              {sources.filter((s) => s.status === "pending" || s.status === "fetching" || s.status === "extracting").length}
            </span>
          </div>
          <div className="flex items-center justify-between font-mono text-[11px]">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">failed</span>
            <span className={`opacity-70 ${sources.some((s) => s.status === "failed") ? "text-red-500" : "text-[hsl(var(--text-primary))]"}`}>
              {sources.filter((s) => s.status === "failed").length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
