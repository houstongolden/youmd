"use client";

import { useState, useEffect } from "react";
import { PaneHeader } from "./shared";

// TODO: Wire up real activity/security logs from Convex
// Replace mock data with useQuery(api.activity.getSecurityLogs, { userId })

const EVENT_ICONS: Record<string, string> = {
  profile_claimed: "\u2295",
  token_created: "\u25C7",
  token_used: "\u25C7",
  token_revoked: "\u2717",
  profile_updated: "\u25B3",
  source_added: "\u21BB",
};

const EVENT_COLORS: Record<string, string> = {
  profile_claimed: "text-[hsl(var(--success))]",
  token_created: "text-[hsl(var(--accent))]",
  token_used: "text-[hsl(var(--text-primary))] opacity-60",
  token_revoked: "text-red-500",
  profile_updated: "text-[hsl(var(--accent))]",
  source_added: "text-[hsl(var(--accent))]",
};

interface ActivityLog {
  id: string;
  event_type: string;
  details?: { username?: string; token_name?: string };
  created_at: string;
}

interface ActivityPaneProps {
  username: string;
}

export function ActivityPane({ username }: ActivityPaneProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // TODO: Replace with real Convex query
  useEffect(() => {
    // Simulate loading with mock data
    const timer = setTimeout(() => {
      setLogs([
        { id: "1", event_type: "profile_updated", details: { username }, created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
        { id: "2", event_type: "token_created", details: { token_name: "cli-dev" }, created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
        { id: "3", event_type: "source_added", details: {}, created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
        { id: "4", event_type: "token_used", details: { token_name: "cli-dev" }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
        { id: "5", event_type: "profile_claimed", details: { username }, created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() },
      ]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [username]);

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>activity</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <h2 className="font-mono text-sm text-[hsl(var(--text-primary))] mb-6">
          security &amp; activity log
        </h2>

        {loading ? (
          <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
            loading...
          </p>
        ) : logs.length > 0 ? (
          <div className="space-y-0">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))] opacity-20 last:border-0"
              >
                <span className={`font-mono text-[12px] w-4 text-center shrink-0 ${EVENT_COLORS[log.event_type] || "text-[hsl(var(--text-secondary))] opacity-50"}`}>
                  {EVENT_ICONS[log.event_type] || "\u00B7"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                    {log.event_type.replace(/_/g, " ")}
                    {log.details?.username && ` -- @${log.details.username}`}
                    {log.details?.token_name && ` -- "${log.details.token_name}"`}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 shrink-0">
                  {new Date(log.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))]"
            style={{ borderRadius: "2px" }}
          >
            <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40">
              no activity recorded yet -- events will appear here as you use your profile.
            </p>
            <div className="mt-3 space-y-1 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30">
              <p>tracked events:</p>
              <p>{"\u00B7"} profile claimed</p>
              <p>{"\u00B7"} token created / used / revoked</p>
              <p>{"\u00B7"} profile updated</p>
              <p>{"\u00B7"} source added</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
