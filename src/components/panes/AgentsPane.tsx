"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { CopyableLink, CopyableCommand } from "./CopyableCommand";

interface AgentsPaneProps {
  username: string;
  profileId?: Id<"profiles">;
}

// ── Agent display metadata ──────────────────────────────────

const AGENT_META: Record<string, { icon: string; label: string }> = {
  "claude code":   { icon: "[>_]", label: "Claude Code" },
  "claude":        { icon: "[cl]", label: "Claude" },
  "anthropic":     { icon: "[an]", label: "Anthropic" },
  "cursor":        { icon: "[|>]", label: "Cursor" },
  "chatgpt":       { icon: "[gp]", label: "ChatGPT" },
  "openai":        { icon: "[oa]", label: "OpenAI" },
  "gpt-4":         { icon: "[g4]", label: "GPT-4" },
  "gpt-4o":        { icon: "[go]", label: "GPT-4o" },
  "copilot":       { icon: "[cp]", label: "Copilot" },
  "gemini":        { icon: "[gm]", label: "Gemini" },
  "perplexity":    { icon: "[px]", label: "Perplexity" },
  "llama":         { icon: "[ll]", label: "Llama" },
  "mistral":       { icon: "[ms]", label: "Mistral" },
  "windsurf":      { icon: "[ws]", label: "Windsurf" },
  "codex":         { icon: "[cx]", label: "Codex" },
};

function getAgentMeta(name: string): { icon: string; label: string } {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(AGENT_META)) {
    if (key.includes(k)) return { icon: v.icon, label: v.label };
  }
  return { icon: "[??]", label: name };
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// ── Mock data (fallback) ────────────────────────────────────

const MOCK_AGENTS = [
  { name: "Claude (Anthropic)", type: "read" as const, count: 4201, lastUsed: Date.now() - 120000 },
  { name: "GPT-4 (OpenAI)", type: "read" as const, count: 3847, lastUsed: Date.now() - 840000 },
  { name: "Gemini (Google)", type: "read" as const, count: 2109, lastUsed: Date.now() - 7200000 },
  { name: "Perplexity", type: "read" as const, count: 1892, lastUsed: Date.now() - 18000000 },
  { name: "Copilot (Microsoft)", type: "write" as const, count: 643, lastUsed: Date.now() - 86400000 },
  { name: "Llama (Meta)", type: "read" as const, count: 312, lastUsed: Date.now() - 172800000 },
  { name: "Mistral", type: "read" as const, count: 198, lastUsed: Date.now() - 259200000 },
];

const MOCK_STATS = {
  totalReads: 12559,
  totalWrites: 643,
  uniqueAgents: 7,
  totalInteractions: 13202,
};

export function AgentsPane({ username, profileId }: AgentsPaneProps) {
  const agentStats = useQuery(
    api.private.getAgentStats,
    profileId ? { profileId } : "skip"
  );

  // Resolve data: real or mock
  const hasRealData = agentStats && agentStats.agents.length > 0;
  const stats = hasRealData
    ? {
        totalReads: agentStats.totalReads,
        totalWrites: agentStats.totalWrites,
        uniqueAgents: agentStats.uniqueAgents,
        totalInteractions: agentStats.totalInteractions,
      }
    : MOCK_STATS;

  const agents = hasRealData ? agentStats.agents : MOCK_AGENTS;

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>agents{hasRealData ? "" : " [mock]"}</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Share context with agents */}
        <SectionLabel>share your context</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2 mb-2"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-2">
            give any agent your full context in one paste:
          </p>
          <CopyableLink
            url={`https://you.md/${username}`}
            label={`you.md/${username}`}
            withPrompt={`Read my identity context before we start:\nhttps://you.md/${username}\n\nThis is my you.md profile — it contains my bio, projects, values,\npreferences, and how I like to communicate. Use it to understand\nwho I am so we can skip the intro and get straight to work.`}
          />
          <div className="mt-2 space-y-1">
            <CopyableCommand command="/share" />
            <CopyableCommand command="/share --private" dimmed />
            <CopyableCommand command="create a share link for my new agent" dimmed />
          </div>
        </div>

        <Divider />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          {[
            { label: "total reads", value: formatCount(stats.totalReads) },
            { label: "total writes", value: formatCount(stats.totalWrites) },
            { label: "agents", value: String(stats.uniqueAgents) },
            { label: "interactions", value: formatCount(stats.totalInteractions) },
          ].map((s) => (
            <div
              key={s.label}
              className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] text-center"
              style={{ borderRadius: "2px" }}
            >
              <p className="font-mono text-[8px] sm:text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase">
                {s.label}
              </p>
              <p className="font-mono text-xs sm:text-sm text-[hsl(var(--text-primary))] mt-1">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <SectionLabel>connected agents</SectionLabel>
        <div className="space-y-2">
          {agents.map((a) => {
            const meta = getAgentMeta(a.name);
            const isWrite = a.type === "write";
            return (
              <div
                key={a.name}
                className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                style={{ borderRadius: "2px" }}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-70 shrink-0">
                      {meta.icon}
                    </span>
                    <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase shrink-0 border px-1.5 py-0.5 ${
                      isWrite
                        ? "text-[hsl(var(--warning,40_100%_50%))] border-[hsl(var(--warning,40_100%_50%))]/20"
                        : "text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                    }`}
                    style={{ borderRadius: "2px" }}
                  >
                    {a.type}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                  <span>interactions: {formatCount(a.count)}</span>
                  <span>last: {formatRelativeTime(a.lastUsed)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <Divider />

        <SectionLabel>access policy</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "default access", value: "public context only" },
            { label: "verified agents", value: "full context" },
            { label: "unverified agents", value: "public context" },
            { label: "blocked agents", value: "0" },
          ].map((p) => (
            <div key={p.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{p.label}</span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">{p.value}</span>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>top queries about @{username}</SectionLabel>
        <div className="space-y-0">
          {[
            { query: `What does ${username} do?`, count: "2,341" },
            { query: `Is ${username} available for consulting?`, count: "891" },
            { query: `What are ${username}'s current projects?`, count: "743" },
            { query: `${username} contact information`, count: "612" },
            { query: `${username} expertise and skills`, count: "508" },
          ].map((q, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] opacity-30 last:border-0 gap-2"
            >
              <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-60 flex-1 min-w-0 truncate">
                &quot;{q.query}&quot;
              </span>
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 shrink-0">
                {q.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
