"use client";

import { useEffect, useMemo, useRef } from "react";

export type LiveLogEntry = {
  id: string;
  at?: number | string | null;
  source: string;
  channel?: string;
  kind?: string;
  title: string;
  detail?: string;
  status?: "live" | "ok" | "warn" | "error" | "info";
};

type LiveBrainLogProps = {
  entries: LiveLogEntry[];
  className?: string;
  compact?: boolean;
  maxEntries?: number;
  showIntro?: boolean;
  emptyText?: string;
};

function formatLogTime(value?: number | string | null): string {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function logStatusClass(status: LiveLogEntry["status"] = "info") {
  if (status === "live") return "text-[hsl(var(--success))]";
  if (status === "ok") return "text-[hsl(var(--success))] opacity-80";
  if (status === "warn") return "text-[hsl(var(--accent))]";
  if (status === "error") return "text-red-400";
  return "text-[hsl(var(--text-secondary))] opacity-45";
}

export function LiveBrainLog({
  entries,
  className = "",
  compact = false,
  maxEntries = 80,
  showIntro = true,
  emptyText = "waiting for the first brain event...",
}: LiveBrainLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const visibleEntries = useMemo(() => entries.slice(-maxEntries), [entries, maxEntries]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [visibleEntries.length]);

  return (
    <div
      className={[
        compact ? "max-h-72 overflow-y-auto px-1 py-1" : "h-full overflow-y-auto px-4 py-4",
        "font-mono text-[11px] leading-relaxed",
        className,
      ].join(" ")}
      role="log"
      aria-label="live You.md activity log"
    >
      {showIntro && (
        <div className="mb-4 border-l border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg))]/35 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-80">
            central brain log
          </div>
          <div className="mt-1 text-[10px] text-[hsl(var(--text-secondary))] opacity-55">
            realtime agent messages, local daemon proof, skill syncs, vault status, repo sync, tasks, and chat activity belong here.
          </div>
        </div>
      )}

      {visibleEntries.length === 0 ? (
        <div className="text-[hsl(var(--text-secondary))] opacity-45">
          {emptyText}
        </div>
      ) : (
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className={[
                "grid gap-2",
                compact ? "grid-cols-[58px_58px_1fr]" : "grid-cols-[72px_76px_1fr]",
              ].join(" ")}
            >
              <span className="text-[hsl(var(--text-secondary))] opacity-38 tabular-nums">
                {formatLogTime(entry.at)}
              </span>
              <span className={["truncate uppercase tracking-[0.12em]", logStatusClass(entry.status)].join(" ")}>
                {entry.source}
              </span>
              <span className="min-w-0">
                <span className="text-[hsl(var(--text-primary))] opacity-88">{entry.title}</span>
                {entry.detail && (
                  <span className="text-[hsl(var(--text-secondary))] opacity-48"> {entry.detail}</span>
                )}
                {(entry.channel || entry.kind) && (
                  <span className="ml-1 text-[hsl(var(--text-secondary))] opacity-32">
                    [{[entry.channel, entry.kind].filter(Boolean).join(" / ")}]
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
