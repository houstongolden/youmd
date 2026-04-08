"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
import { PaneSectionLabel, PaneDivider } from "./shared";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sourceLabel(source: string): string {
  if (source === "web-shell") return "shell";
  if (source === "cli") return "CLI";
  if (source === "api") return "API";
  if (source === "rollback") return "rollback";
  if (source?.startsWith("agent:")) return source.slice(6);
  return source || "unknown";
}

function sourceColor(source: string): string {
  if (source === "web-shell") return "text-[hsl(var(--accent))]";
  if (source === "cli") return "text-[hsl(var(--success))]";
  if (source === "rollback") return "text-yellow-500";
  return "text-[hsl(var(--text-secondary))] opacity-50";
}

interface HistoryPaneProps {
  userId: Id<"users">;
  clerkId: string;
}

export function HistoryPane({ userId, clerkId }: HistoryPaneProps) {
  const history = useQuery(api.bundles.getHistory, { userId });
  // Use the new activity table (same source as agents tab) instead of legacy bundles.getAgentStats
  const userStats = useQuery((api as any).activity.userActivityStats, { clerkId });
  const agentSummary = useQuery((api as any).activity.agentSummary, { clerkId });
  const rollback = useMutation(api.bundles.rollbackToVersion);
  const publishBundle = useMutation(api.bundles.publishBundle);
  const [rolling, setRolling] = useState(false);

  const handleRollback = async (version: number) => {
    if (rolling) return;
    setRolling(true);
    try {
      const result = await rollback({ clerkId, targetVersion: version });
      // Auto-publish the rollback
      await publishBundle({ bundleId: result.bundleId as any });
    } catch (err) {
      console.error("Rollback failed:", err);
    }
    setRolling(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Agent Activity */}
      <div>
        <PaneSectionLabel>agent activity</PaneSectionLabel>
        {userStats === undefined ? (
          <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-[11px] font-mono">
              <span className="text-[hsl(var(--success))]">{userStats.reads} reads</span>
              <span className="text-[hsl(var(--text-secondary))] opacity-20">|</span>
              <span className="text-[hsl(var(--accent))]">{userStats.writes} writes</span>
              <span className="text-[hsl(var(--text-secondary))] opacity-20">|</span>
              <span className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px]">
                {userStats.verifiedReads} verified · {userStats.selfReads} self
              </span>
            </div>
            {agentSummary && agentSummary.length > 0 && (
              <div className="space-y-1">
                {agentSummary.slice(0, 10).map((a: any) => {
                  const trustBadge =
                    a.trustLevel === "verified-third-party" ? (
                      <span className="text-[hsl(var(--success))] text-[9px] ml-1.5" title="External agent fetched anonymously or via context-link token">verified</span>
                    ) : a.trustLevel === "self-attributed" ? (
                      <span className="text-yellow-500 text-[9px] ml-1.5" title="Authenticated as you (API key) — agent name is self-reported">self</span>
                    ) : a.trustLevel === "mixed" ? (
                      <span className="text-cyan-400 text-[9px] ml-1.5" title="Mix of verified third-party and self-attributed events">mixed</span>
                    ) : null;
                  return (
                    <div key={a.agentName} className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-[hsl(var(--text-primary))] opacity-70">
                        {a.agentName}
                        {trustBadge}
                      </span>
                      <span className="text-[hsl(var(--text-secondary))] opacity-30">
                        {a.reads}r {a.writes}w &middot; {timeAgo(a.lastSeen)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {userStats.total === 0 && (
              <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
                no agent interactions tracked yet.
              </p>
            )}
          </div>
        )}
      </div>

      <PaneDivider />

      {/* Version History */}
      <div>
        <PaneSectionLabel>version history</PaneSectionLabel>
        {history === undefined ? (
          <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">loading...</p>
        ) : history.length === 0 ? (
          <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">no versions yet.</p>
        ) : (
          <div className="space-y-0">
            {history.map((v: any, i: number) => (
              <div
                key={v._id}
                className={`flex items-start gap-3 py-2 border-b border-[hsl(var(--border))] last:border-0 ${
                  i === 0 ? "opacity-100" : "opacity-60"
                }`}
              >
                {/* Version indicator */}
                <div className="shrink-0 w-14 text-right">
                  <span className={`font-mono text-[11px] ${v.isPublished ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-50"}`}>
                    v{v.version}
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {v.isPublished && (
                      <span className="text-[8px] font-mono text-[hsl(var(--success))] border border-[hsl(var(--success))]/20 px-1.5 py-0.5" style={{ borderRadius: "2px" }}>
                        live
                      </span>
                    )}
                    <span className={`text-[9px] font-mono ${sourceColor(v.source)}`}>
                      {sourceLabel(v.source)}
                    </span>
                    {v.contentHash && (
                      <span className="text-[8px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
                        {v.contentHash}
                      </span>
                    )}
                  </div>
                  {v.changeNote && (
                    <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-40 mt-0.5 truncate">
                      {v.changeNote}
                    </p>
                  )}
                  <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-25 mt-0.5">
                    {timeAgo(v.createdAt)}
                  </p>
                </div>

                {/* Rollback button (not for current version) */}
                {!v.isPublished && i > 0 && (
                  <button
                    onClick={() => handleRollback(v.version)}
                    disabled={rolling}
                    className="shrink-0 text-[9px] font-mono text-[hsl(var(--accent))] opacity-40 hover:opacity-80 transition-opacity disabled:opacity-20"
                  >
                    restore
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
