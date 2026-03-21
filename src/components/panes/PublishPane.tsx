"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface PublishPaneProps {
  username: string;
  userId?: Id<"users">;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-widest mb-3">
      &gt; {children}
    </h3>
  );
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] my-6" />;
}

function formatTime(ts: number | undefined): string {
  if (!ts) return "never";
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en", { month: "short" });
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${h}:${m}`;
}

export function PublishPane({ username, userId }: PublishPaneProps) {
  const recentBundles = useQuery(
    api.bundles.listRecentBundles,
    userId ? { userId, limit: 8 } : "skip"
  );

  const liveBundle = recentBundles?.find((b) => b.isPublished);
  const latestBundle = recentBundles?.[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          publish
        </span>
      </div>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <SectionLabel>live status</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] mb-2"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center gap-2 mb-3">
            {liveBundle ? (
              <>
                <span
                  className="w-2 h-2 rounded-full status-dot-pulse"
                  style={{ background: "hsl(var(--success))" }}
                />
                <span className="font-mono text-[12px] text-[hsl(var(--success))]">LIVE</span>
              </>
            ) : (
              <>
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "hsl(var(--text-secondary))", opacity: 0.3 }}
                />
                <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">DRAFT</span>
              </>
            )}
          </div>
          <div className="space-y-2">
            {[
              { label: "public url", value: `you.md/${username}`, accent: true },
              { label: "last published", value: liveBundle?.publishedAt ? formatTime(liveBundle.publishedAt) : "never", accent: false },
              { label: "publish mode", value: "auto-publish on update", accent: false },
              { label: "version", value: liveBundle ? `v${liveBundle.version}` : latestBundle ? `v${latestBundle.version} (draft)` : "none", accent: false },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-[hsl(var(--text-secondary))] opacity-60">{r.label}</span>
                <span className={r.accent ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-primary))] opacity-70"}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Divider />

        <SectionLabel>domain</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "2px" }}
        >
          {[
            { label: "primary", value: `you.md/${username}`, active: true },
            { label: "custom", value: "not configured", active: false },
            { label: "api endpoint", value: `api.you.md/v1/${username}`, active: true },
          ].map((d) => (
            <div key={d.label} className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-60 shrink-0">{d.label}</span>
              <span className={`truncate ml-2 ${d.active ? "text-[hsl(var(--text-primary))] opacity-70" : "text-[hsl(var(--text-secondary))] opacity-40"}`}>
                {d.value}
              </span>
            </div>
          ))}
        </div>

        <Divider />

        <SectionLabel>version history</SectionLabel>
        {recentBundles && recentBundles.length > 0 ? (
          <div className="space-y-0">
            {recentBundles.map((b) => (
              <div
                key={b._id}
                className={`flex items-center justify-between py-2.5 border-b border-[hsl(var(--border))] last:border-0 ${b.isPublished ? "" : "opacity-40"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[11px] text-[hsl(var(--accent))] opacity-60 w-8 shrink-0">
                    v{b.version}
                  </span>
                  <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-70">
                    {formatTime(b.createdAt)}
                  </span>
                </div>
                <span className={`font-mono text-[10px] shrink-0 ${b.isPublished ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-30"}`}>
                  {b.isPublished ? "live" : "archived"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[hsl(var(--text-secondary))] opacity-30 font-mono text-[11px]">
            no versions yet. talk to the agent to build your profile.
          </p>
        )}

        <Divider />

        <SectionLabel>commands</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <div className="space-y-1">
            <div
              className="font-mono text-[11px] text-[hsl(var(--accent))] bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /publish
            </div>
            <div
              className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 bg-[hsl(var(--bg))] px-3 py-2 overflow-x-auto"
              style={{ borderRadius: "2px" }}
            >
              &gt; /status
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
