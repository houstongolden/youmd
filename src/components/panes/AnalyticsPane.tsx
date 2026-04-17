"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PaneSectionLabel, PaneDivider, PaneEmptyState } from "./shared";
import type { Id } from "../../../convex/_generated/dataModel";

/* ── ASCII Sparkline ─────────────────────────────────────── */

const SPARK_CHARS = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

function sparkline(values: number[]): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 1);
  return values
    .map((v) => {
      const idx = Math.round((v / max) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join("");
}

/* ── ASCII Bar Chart ─────────────────────────────────────── */

function barChart(
  data: Array<{ label: string; value: number }>,
  maxWidth: number = 24
): Array<{ label: string; bar: string; value: number }> {
  const max = Math.max(...data.map((d) => d.value), 1);
  return data.map((d) => {
    const width = Math.round((d.value / max) * maxWidth);
    return {
      label: d.label,
      bar: "\u2588".repeat(width) + "\u2591".repeat(maxWidth - width),
      value: d.value,
    };
  });
}

/* ── Stat Box ────────────────────────────────────────────── */

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg))] flex-1 min-w-[100px]" style={{ borderRadius: "2px" }}>
      <div className={`font-mono text-lg font-bold ${accent ? "text-[#C46A3A]" : "text-[hsl(var(--text-primary))]"}`}>
        {value}
      </div>
      <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */

interface AnalyticsPaneProps {
  clerkId: string;
  profileId?: Id<"profiles">;
}

export function AnalyticsPane({ clerkId, profileId }: AnalyticsPaneProps) {
  const analytics = useQuery(api.me.getAnalytics, { clerkId });
  const agentStats = useQuery(
    api.private.getAgentStats,
    profileId ? { profileId } : "skip"
  );

  if (analytics === undefined) {
    return (
      <div className="p-6">
        <p className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
          loading analytics...
        </p>
      </div>
    );
  }

  if (!analytics) {
    return <PaneEmptyState>no analytics data yet</PaneEmptyState>;
  }

  const dailyTotals = (analytics.dailyViews ?? []).map((d) => d.total);
  const dailyAgents = (analytics.dailyViews ?? []).map((d) => d.agents);
  const dailyWeb = (analytics.dailyViews ?? []).map((d) => d.web);

  return (
    <div className="p-6 space-y-6 font-mono text-[12px]">
      {/* ── Stats Row ────────────────────────────────────── */}
      <div>
        <PaneSectionLabel>overview</PaneSectionLabel>
        <div className="flex flex-wrap gap-2">
          <StatBox label="total views" value={analytics.totalViews} accent />
          <StatBox label="agent reads" value={analytics.agentReads} />
          <StatBox label="web views" value={analytics.webViews} />
          <StatBox label="last 7 days" value={analytics.last7Days} />
          {analytics.contextLinkViews > 0 && (
            <StatBox label="ctx links" value={analytics.contextLinkViews} />
          )}
        </div>
      </div>

      <PaneDivider />

      {/* ── 30-Day Chart ─────────────────────────────────── */}
      <div>
        <PaneSectionLabel>30-day activity</PaneSectionLabel>

        {/* Combined sparkline */}
        <div className="space-y-2">
          <div>
            <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 mr-2">total</span>
            <span className="text-[#C46A3A] tracking-[1px]">{sparkline(dailyTotals)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 mr-2">agent</span>
            <span className="text-[hsl(var(--text-primary))] opacity-70 tracking-[1px]">{sparkline(dailyAgents)}</span>
          </div>
          <div>
            <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-40 mr-2">  web</span>
            <span className="text-[hsl(var(--text-secondary))] opacity-50 tracking-[1px]">{sparkline(dailyWeb)}</span>
          </div>
        </div>

        {/* Daily breakdown table (last 7 days) */}
        <div className="mt-4 border border-[hsl(var(--border))] bg-[hsl(var(--bg))]" style={{ borderRadius: "2px" }}>
          <div className="px-3 py-1.5 border-b border-[hsl(var(--border))] flex justify-between">
            <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-50">date</span>
            <div className="flex gap-4">
              <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-50 w-8 text-right">all</span>
              <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-50 w-8 text-right">bot</span>
              <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-50 w-8 text-right">web</span>
            </div>
          </div>
          {(analytics.dailyViews ?? []).slice(-7).reverse().map((day) => (
            <div
              key={day.date}
              className="px-3 py-1 flex justify-between border-b border-[hsl(var(--border))]/30 last:border-0"
            >
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{day.date.slice(5)}</span>
              <div className="flex gap-4">
                <span className={`w-8 text-right ${day.total > 0 ? "text-[#C46A3A]" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {day.total}
                </span>
                <span className={`w-8 text-right ${day.agents > 0 ? "text-[hsl(var(--text-primary))] opacity-70" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {day.agents}
                </span>
                <span className={`w-8 text-right ${day.web > 0 ? "text-[hsl(var(--text-secondary))]" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {day.web}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PaneDivider />

      {/* ── Top Referrers ────────────────────────────────── */}
      <div>
        <PaneSectionLabel>top referrers</PaneSectionLabel>
        {(analytics.topReferrers ?? []).length === 0 ? (
          <p className="text-[hsl(var(--text-secondary))] opacity-30">no referrer data yet</p>
        ) : (
          <div className="space-y-1">
            {barChart(
              (analytics.topReferrers ?? []).map((r) => ({ label: r.referrer, value: r.count }))
            ).map((row) => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-[120px] truncate text-[hsl(var(--text-secondary))] opacity-60 text-[11px]">{row.label}</span>
                <span className="text-[#C46A3A] opacity-60 text-[10px] leading-none">{row.bar}</span>
                <span className="text-[hsl(var(--text-secondary))] opacity-40 text-[10px] w-6 text-right">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PaneDivider />

      {/* ── Agent Interactions ────────────────────────────── */}
      <div>
        <PaneSectionLabel>agent interactions</PaneSectionLabel>
        {!agentStats || agentStats.agents.length === 0 ? (
          <p className="text-[hsl(var(--text-secondary))] opacity-30">
            no agent interactions yet. share your context link to get started.
          </p>
        ) : (
          <>
            <div className="flex gap-4 mb-3">
              <span className="text-[hsl(var(--text-secondary))] opacity-40">
                {agentStats.uniqueAgents} agent{agentStats.uniqueAgents !== 1 ? "s" : ""}
              </span>
              <span className="text-[hsl(var(--text-secondary))] opacity-40">
                {agentStats.totalInteractions} total
              </span>
            </div>
            <div className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))]" style={{ borderRadius: "2px" }}>
              {agentStats.agents.map((agent, i) => (
                <div
                  key={`${agent.name}-${i}`}
                  className="px-3 py-2 flex items-center justify-between border-b border-[hsl(var(--border))]/30 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#C46A3A]">{agent.name}</span>
                    <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-30 border border-[hsl(var(--border))] px-1" style={{ borderRadius: "2px" }}>
                      {agent.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[hsl(var(--text-secondary))] opacity-50">{agent.count}x</span>
                    <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-30">
                      {formatRelativeTime(agent.lastUsed)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
