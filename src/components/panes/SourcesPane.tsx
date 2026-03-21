"use client";

import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";

// TODO: Wire up real data from Convex queries (e.g., api.sources.listByUser)
// Currently using mock/placeholder data

interface SourcesPaneProps {
  username: string;
}

const statusConfig: Record<string, { icon: string; colorClass: string }> = {
  verified: { icon: "\u2713", colorClass: "text-[hsl(var(--success))]" },
  synced: { icon: "\u21BB", colorClass: "text-[hsl(var(--accent))]" },
  pending: { icon: "\u2026", colorClass: "text-[hsl(var(--accent-mid))]" },
  disconnected: { icon: "\u25CB", colorClass: "text-[hsl(var(--text-secondary))] opacity-40" },
};

export function SourcesPane({ username }: SourcesPaneProps) {
  // TODO: Replace with useQuery(api.sources.listByUser, { username })
  const sources = [
    { name: "LinkedIn", status: "verified", lastSync: "2m ago", records: "142 fields", url: `linkedin.com/in/${username}` },
    { name: "GitHub", status: "synced", lastSync: "14m ago", records: "87 repos", url: `github.com/${username}` },
    { name: "X / Twitter", status: "synced", lastSync: "1h ago", records: "2.4k posts", url: `x.com/${username}` },
    { name: "Notion", status: "pending", lastSync: "--", records: "--", url: "--" },
    { name: "Google Calendar", status: "disconnected", lastSync: "--", records: "--", url: "--" },
    { name: "Substack", status: "disconnected", lastSync: "--", records: "--", url: "--" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>sources</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: "connected", value: "3" },
            { label: "total records", value: "2,629" },
            { label: "last sync", value: "2m ago" },
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

        <SectionLabel>all sources</SectionLabel>
        <div className="space-y-2">
          {sources.map((s) => {
            const cfg = statusConfig[s.status] || statusConfig.disconnected;
            return (
              <div
                key={s.name}
                className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                style={{ borderRadius: "2px" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[12px] ${cfg.colorClass}`}>
                      {cfg.icon}
                    </span>
                    <span className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80">
                      {s.name}
                    </span>
                  </div>
                  <span className={`font-mono text-[9px] uppercase tracking-wider ${cfg.colorClass}`}>
                    {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                  <span>last sync: {s.lastSync}</span>
                  <span>records: {s.records}</span>
                </div>
                {s.url !== "--" && (
                  <div className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mt-1 truncate">
                    {s.url}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Divider />

        <SectionLabel>add source</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
            connect a new source via terminal:
          </p>
          <div
            className="mt-2 font-mono text-[11px] text-[hsl(var(--accent))] bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
            style={{ borderRadius: "2px" }}
          >
            &gt; add source https://linkedin.com/in/you
          </div>
        </div>

        <Divider />

        <SectionLabel>sync schedule</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "auto-sync", value: "enabled" },
            { label: "frequency", value: "every 30 min" },
            { label: "next sync", value: "in 28 min" },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60">{r.label}</span>
              <span className="text-[hsl(var(--text-primary))] opacity-70">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
