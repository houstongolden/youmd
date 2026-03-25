"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneHeader } from "./shared";

const EVENT_ICONS: Record<string, string> = {
  profile_created: "\u2295",
  profile_claimed: "\u2295",
  token_created: "\u25C7",
  token_used: "\u25C7",
  token_revoked: "\u2717",
  profile_updated: "\u25B3",
  source_added: "\u21BB",
  private_context_updated: "\u25A0",
};

const EVENT_COLORS: Record<string, string> = {
  profile_created: "text-[hsl(var(--success))]",
  profile_claimed: "text-[hsl(var(--success))]",
  token_created: "text-[hsl(var(--accent))]",
  token_used: "text-[hsl(var(--text-primary))] opacity-60",
  token_revoked: "text-red-500",
  profile_updated: "text-[hsl(var(--accent))]",
  source_added: "text-[hsl(var(--accent))]",
  private_context_updated: "text-[hsl(var(--accent))]",
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDetails(details: Record<string, unknown> | undefined): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.username) parts.push(`@${details.username}`);
  if (details.token_name) parts.push(`"${details.token_name}"`);
  if (details.reason) parts.push(`${details.reason}`);
  return parts.length > 0 ? ` -- ${parts.join(", ")}` : "";
}

interface ActivityPaneProps {
  profileId?: Id<"profiles">;
  username: string;
}

export function ActivityPane({ profileId, username }: ActivityPaneProps) {
  const logs = useQuery(
    api.profiles.getSecurityLogs,
    profileId ? { profileId } : "skip"
  );

  const loading = logs === undefined;

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
        ) : logs && logs.length > 0 ? (
          <div className="space-y-0">
            {logs.map((log) => (
              <div
                key={log._id}
                className="flex items-center gap-3 py-2 border-b border-[hsl(var(--border))] opacity-20 last:border-0"
              >
                <span className={`font-mono text-[12px] w-4 text-center shrink-0 ${EVENT_COLORS[log.eventType] || "text-[hsl(var(--text-secondary))] opacity-50"}`}>
                  {EVENT_ICONS[log.eventType] || "\u00B7"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80 truncate">
                    {log.eventType.replace(/_/g, " ")}
                    {formatDetails(log.details as Record<string, unknown> | undefined)}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 shrink-0">
                  {formatTimestamp(log.createdAt)}
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
              <p>{"\u00B7"} profile created / claimed</p>
              <p>{"\u00B7"} token created / used / revoked</p>
              <p>{"\u00B7"} profile updated</p>
              <p>{"\u00B7"} source added</p>
              <p>{"\u00B7"} private context updated</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
