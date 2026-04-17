"use client";

import { useUser } from "@/lib/you-auth";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState } from "react";

interface AgentSummary {
  agentName: string;
  agentSource?: string;
  sources?: string[];
  reads: number;
  writes: number;
  verifiedReads?: number;
  selfReads?: number;
  trustLevel?: string;
  firstSeen: number;
  lastSeen: number;
}

interface ActivityEvent {
  _id: string;
  agentName: string;
  agentSource?: string;
  action: string;
  resource?: string;
  scope?: string;
  status?: string;
  trust?: string;
  tokenId?: string;
  apiKeyId?: string;
  bundleVersionBefore?: number;
  bundleVersionAfter?: number;
  createdAt: number;
}

export function AgentsPane() {
  const { user } = useUser();
  const [filter, setFilter] = useState<string>("");

  // These references will be `any` at type level because the generated api
  // may not yet include the `activity` module. At runtime the backend agent
  // wires them up via `api.activity.listActivity` / `api.activity.agentSummary`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiAny = api as any;

  const activity = useQuery(
    apiAny.activity?.listActivity,
    user?.id ? { clerkId: user.id, limit: 100 } : "skip"
  ) as ActivityEvent[] | undefined;

  const summary = useQuery(
    apiAny.activity?.agentSummary,
    user?.id ? { clerkId: user.id } : "skip"
  ) as AgentSummary[] | undefined;

  if (!user) {
    return (
      <div className="p-4 font-mono text-xs text-[hsl(var(--text-secondary))] opacity-60">
        sign in to see agent activity
      </div>
    );
  }

  const events: ActivityEvent[] = activity || [];
  const agents: AgentSummary[] = summary || [];

  const FIVE_MIN = 5 * 60 * 1000;
  const now = Date.now();

  const filtered = filter
    ? events.filter((e) => e.action.includes(filter))
    : events;

  return (
    <div className="p-6 font-mono text-xs space-y-6 text-[hsl(var(--text-primary))]">
      {/* Connected agents */}
      <div>
        <div className="text-[10px] text-[hsl(var(--accent))] uppercase tracking-wider mb-3">
          -- connected agents --
        </div>
        {agents.length === 0 ? (
          <div className="opacity-60">
            no agents yet -- they&apos;ll appear when they connect
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => {
              const isActive = now - a.lastSeen < FIVE_MIN;
              return (
                <div
                  key={a.agentName}
                  className="flex items-center gap-3 flex-wrap"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive
                        ? "bg-green-500 animate-pulse"
                        : "bg-white/30"
                    }`}
                  />
                  <span className="font-bold w-40 truncate">{a.agentName}</span>
                  {a.trustLevel === "verified-third-party" && (
                    <span
                      className="text-[hsl(var(--success))] text-[9px] px-1 border border-[hsl(var(--success))]/40 rounded"
                      title="External agent fetched anonymously or via context-link token. This is a real third-party read."
                      style={{ borderRadius: "2px" }}
                    >
                      verified
                    </span>
                  )}
                  {a.trustLevel === "self-attributed" && (
                    <span
                      className="text-yellow-500 text-[9px] px-1 border border-yellow-500/40 rounded"
                      title="Authenticated as you (API key or MCP). The 'agent name' is self-reported, not verified."
                      style={{ borderRadius: "2px" }}
                    >
                      self
                    </span>
                  )}
                  {a.trustLevel === "mixed" && (
                    <span
                      className="text-cyan-400 text-[9px] px-1 border border-cyan-400/40 rounded"
                      title="Mix of verified third-party and self-attributed events"
                      style={{ borderRadius: "2px" }}
                    >
                      mixed
                    </span>
                  )}
                  <span className="opacity-60 w-40">
                    {a.reads} read{a.reads === 1 ? "" : "s"},{" "}
                    {a.writes} write{a.writes === 1 ? "" : "s"}
                  </span>
                  <span className="opacity-40">
                    last {relativeTime(a.lastSeen)}
                  </span>
                  {a.sources && a.sources.length > 0 && (
                    <span className="opacity-40 text-[10px]">
                      [{a.sources.join(", ")}]
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "read", "write", "push", "memory"].map((f) => {
          const active = filter === (f === "all" ? "" : f);
          return (
            <button
              key={f}
              onClick={() => setFilter(f === "all" ? "" : f)}
              aria-pressed={active}
              aria-label={`filter by ${f}`}
              className={`px-2 py-1 text-[10px] border transition-colors ${
                active
                  ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
                  : "border-white/10 opacity-60 hover:opacity-100"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Activity feed */}
      <div>
        <div className="text-[10px] text-[hsl(var(--accent))] uppercase tracking-wider mb-3">
          -- recent activity --
        </div>
        {filtered.length === 0 ? (
          <div className="opacity-60">no activity</div>
        ) : (
          <div className="space-y-1">
            {filtered.slice(0, 50).map((e) => {
              const trustIcon =
                e.trust === "verified-third-party" ? (
                  <span className="text-[hsl(var(--success))]" title="Verified external agent (anonymous fetch or context-link token)">●</span>
                ) : e.trust === "self-attributed" ? (
                  <span className="text-yellow-500" title="Self-attributed (authenticated as you, agent name self-reported)">●</span>
                ) : (
                  <span className="opacity-30">●</span>
                );
              return (
                <div
                  key={e._id}
                  className="grid grid-cols-12 gap-2 text-[11px]"
                  title={e.tokenId ? `via token ${e.tokenId.slice(0, 12)}...` : e.apiKeyId ? `via API key ${e.apiKeyId.slice(0, 12)}...` : "anonymous fetch"}
                >
                  <span className="col-span-2 opacity-40">
                    {formatTime(e.createdAt)} {trustIcon}
                  </span>
                  <span className="col-span-3 font-bold truncate">
                    {e.agentName}
                  </span>
                  <span className={`col-span-2 ${actionClass(e.action)}`}>
                    {e.action}
                  </span>
                  <span className="col-span-4 opacity-60 truncate">
                    {e.resource || ""}
                    {e.bundleVersionBefore && e.bundleVersionAfter
                      ? ` v${e.bundleVersionBefore}→v${e.bundleVersionAfter}`
                      : ""}
                  </span>
                  <span className="col-span-1 opacity-40">{e.scope || ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toTimeString().slice(0, 5);
}

function actionClass(action: string): string {
  if (action.includes("read") || action === "skill_use") return "text-cyan-400";
  if (
    action.includes("write") ||
    action === "push" ||
    action === "publish"
  )
    return "text-green-400";
  if (action === "memory_add") return "text-purple-400";
  return "";
}
