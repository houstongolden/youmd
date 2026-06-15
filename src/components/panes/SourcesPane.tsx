"use client";

import { useState } from "react";
import { useUser } from "@/lib/you-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { Button } from "@/components/ui/Button";
import { FieldError, FieldHelp, Input } from "@/components/ui/Form";

interface SourcesPaneProps {
  userId: Id<"users">;
  username: string;
}

type SourceStatus = "pending" | "fetching" | "fetched" | "extracting" | "extracted" | "failed";
type ConnectorKind = "website" | "github" | "rss" | "okf" | "webhook" | "json";
type CrawlerProvider = "native" | "firecrawl" | "agent-browser" | "manual";
type RefreshPolicy = "manual" | "hourly" | "daily" | "weekly" | "monthly";
type SourceVisibility = "private" | "scoped" | "public";
type TrustLevel = "low" | "medium" | "high" | "verified";

const connectorOptions: Array<{
  kind: ConnectorKind;
  label: string;
  hint: string;
  placeholder: string;
  defaultProvider: CrawlerProvider;
}> = [
  {
    kind: "website",
    label: "Website",
    hint: "page, blog, docs, profile",
    placeholder: "https://example.com/about",
    defaultProvider: "native",
  },
  {
    kind: "github",
    label: "GitHub",
    hint: "repo or profile context",
    placeholder: "https://github.com/owner/repo",
    defaultProvider: "native",
  },
  {
    kind: "rss",
    label: "RSS",
    hint: "blog/news feed",
    placeholder: "https://example.com/feed.xml",
    defaultProvider: "native",
  },
  {
    kind: "okf",
    label: "OKF",
    hint: "markdown brain directory",
    placeholder: "https://github.com/owner/brain",
    defaultProvider: "manual",
  },
  {
    kind: "webhook",
    label: "Webhook",
    hint: "push updates into You.md",
    placeholder: "https://api.example.com/youmd-hook",
    defaultProvider: "manual",
  },
  {
    kind: "json",
    label: "JSON",
    hint: "structured endpoint",
    placeholder: "https://api.example.com/context.json",
    defaultProvider: "native",
  },
];

const crawlerOptions: Array<{ value: CrawlerProvider; label: string; hint: string }> = [
  { value: "native", label: "native", hint: "cheap fetch first" },
  { value: "firecrawl", label: "firecrawl", hint: "render + extract" },
  { value: "agent-browser", label: "agent-browser", hint: "browser task/sandbox" },
  { value: "manual", label: "manual", hint: "owner supplied" },
];

const refreshOptions: Array<{ value: RefreshPolicy; label: string }> = [
  { value: "manual", label: "manual" },
  { value: "daily", label: "daily" },
  { value: "weekly", label: "weekly" },
  { value: "monthly", label: "monthly" },
  { value: "hourly", label: "hourly" },
];

const visibilityOptions: Array<{ value: SourceVisibility; label: string }> = [
  { value: "private", label: "private" },
  { value: "scoped", label: "scoped" },
  { value: "public", label: "public" },
];

const trustOptions: Array<{ value: TrustLevel; label: string }> = [
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "verified", label: "verified" },
  { value: "low", label: "low" },
];

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

function timeDistance(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return timeAgo(timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
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

function sourceApprovedUntil(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const runPolicy = (metadata as Record<string, unknown>).runPolicy;
  if (!runPolicy || typeof runPolicy !== "object") return null;
  const approvedUntil = (runPolicy as Record<string, unknown>).approvedUntil;
  return typeof approvedUntil === "number" ? approvedUntil : null;
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

function inferConnectorKind(url: string): ConnectorKind {
  const lower = url.toLowerCase();
  if (lower.includes("github.com")) return "github";
  if (lower.endsWith(".json") || lower.includes("format=json")) return "json";
  if (lower.includes("feed") || lower.includes("rss") || lower.endsWith(".xml")) return "rss";
  return "website";
}

function connectorFor(kind: ConnectorKind) {
  return connectorOptions.find((option) => option.kind === kind) ?? connectorOptions[0];
}

export function SourcesPane({}: SourcesPaneProps) {
  const { user } = useUser();
  const clerkId = user?.id;

  // Real data from Convex
  const sources = useQuery(api.me.getSources, clerkId ? { clerkId } : "skip");
  const addSource = useMutation(api.me.addSource);
  const refreshSourceNow = useMutation(api.me.refreshSourceNow);
  const pauseSourceRefresh = useMutation(api.me.pauseSourceRefresh);
  const updateSourcePolicy = useMutation(api.me.updateSourcePolicy);
  const approveSourceRun = useMutation(api.me.approveSourceRun);
  const approveSourceChange = useMutation(api.me.approveSourceChange);

  // Add-source form state
  const [newUrl, setNewUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [connectorKind, setConnectorKind] = useState<ConnectorKind>("website");
  const [crawlerProvider, setCrawlerProvider] = useState<CrawlerProvider>("native");
  const [refreshPolicy, setRefreshPolicy] = useState<RefreshPolicy>("manual");
  const [visibility, setVisibility] = useState<SourceVisibility>("private");
  const [trustLevel, setTrustLevel] = useState<TrustLevel>("medium");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<Id<"sources"> | null>(null);
  const [actionSourceId, setActionSourceId] = useState<Id<"sources"> | null>(null);
  const [sourceActionError, setSourceActionError] = useState<string | null>(null);
  const sourceVersions = useQuery(
    api.me.getSourceVersions,
    clerkId && selectedSourceId ? { clerkId, sourceId: selectedSourceId } : "skip"
  );
  const sourceChanges = useQuery(
    api.me.getSourceChangeSummaries,
    clerkId && selectedSourceId ? { clerkId, sourceId: selectedSourceId } : "skip"
  );

  const runSourceAction = async (
    sourceId: Id<"sources">,
    action: () => Promise<unknown>
  ) => {
    if (!clerkId) return;
    setActionSourceId(sourceId);
    setSourceActionError(null);
    try {
      await action();
    } catch (err) {
      setSourceActionError(err instanceof Error ? err.message : "Source action failed");
    } finally {
      setActionSourceId(null);
    }
  };

  const handleAddSource = async () => {
    if (!clerkId || !newUrl.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const url = newUrl.trim();
      const inferredKind = connectorKind || inferConnectorKind(url);
      const sourceType = inferredKind === "website" ? inferSourceType(url) : inferredKind;
      await addSource({
        clerkId,
        sourceType,
        sourceUrl: url,
        displayName: displayName.trim() || connectorFor(inferredKind).label,
        connectorKind: inferredKind,
        crawlerProvider,
        refreshPolicy,
        visibility,
        trustLevel,
        metadata: {
          ux: "lovable-simple-connectors",
          addedFrom: "sources-pane",
        },
      });
      setNewUrl("");
      setDisplayName("");
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
              style={{ borderRadius: "var(--radius)" }}
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
            style={{ borderRadius: "var(--radius)" }}
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
              const isSelected = selectedSourceId === s._id;
              const isBusy = actionSourceId === s._id;
              const provider = s.crawlerProvider ?? "native";
              const approvedUntil = sourceApprovedUntil(s.metadata);
              const needsApproval = provider === "firecrawl" || provider === "agent-browser";
              const latestChange = isSelected ? sourceChanges?.[0] : undefined;

              return (
                <div
                  key={s._id}
                  className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                  style={{ borderRadius: "var(--radius)" }}
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
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40 mt-1">
                    <span>provider: {s.crawlerProvider ?? "native"}</span>
                    <span>refresh: {s.refreshPolicy ?? "manual"}</span>
                    <span>visibility: {s.visibility ?? "private"}</span>
                    <span>trust: {s.trustLevel ?? "medium"}</span>
                  </div>
                  <div className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mt-1 truncate">
                    {s.sourceUrl}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[10px]"
                      disabled={isBusy || status === "fetching" || status === "extracting"}
                      onClick={() =>
                        runSourceAction(s._id, () =>
                          refreshSourceNow({ clerkId: clerkId!, sourceId: s._id })
                        )
                      }
                    >
                      {isBusy ? "working" : "refresh"}
                    </Button>
                    {(s.refreshPolicy ?? "manual") !== "manual" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px]"
                        disabled={isBusy}
                        onClick={() =>
                          runSourceAction(s._id, () =>
                            pauseSourceRefresh({ clerkId: clerkId!, sourceId: s._id })
                          )
                        }
                      >
                        pause cron
                      </Button>
                    )}
                    {needsApproval && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px]"
                        disabled={isBusy}
                        onClick={() =>
                          runSourceAction(s._id, () =>
                            approveSourceRun({
                              clerkId: clerkId!,
                              sourceId: s._id,
                              durationHours: 24,
                              maxEstimatedCostCents: provider === "agent-browser" ? 25 : 5,
                            })
                          )
                        }
                      >
                        approve 24h
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="terminal-link"
                      className="h-7 px-0 text-[10px]"
                      onClick={() => setSelectedSourceId(isSelected ? null : s._id)}
                    >
                      {isSelected ? "hide details" : "details"}
                    </Button>
                  </div>
                  {isSelected && (
                    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <SourcePolicyRow
                          label="crawler"
                          value={s.crawlerProvider ?? "native"}
                          options={crawlerOptions}
                          disabled={isBusy}
                          onChange={(value) =>
                            runSourceAction(s._id, () =>
                              updateSourcePolicy({
                                clerkId: clerkId!,
                                sourceId: s._id,
                                crawlerProvider: value,
                              })
                            )
                          }
                        />
                        <SourcePolicyRow
                          label="cron"
                          value={s.refreshPolicy ?? "manual"}
                          options={refreshOptions}
                          disabled={isBusy}
                          onChange={(value) =>
                            runSourceAction(s._id, () =>
                              updateSourcePolicy({
                                clerkId: clerkId!,
                                sourceId: s._id,
                                refreshPolicy: value,
                              })
                            )
                          }
                        />
                        <SourcePolicyRow
                          label="access"
                          value={s.visibility ?? "private"}
                          options={visibilityOptions}
                          disabled={isBusy}
                          onChange={(value) =>
                            runSourceAction(s._id, () =>
                              updateSourcePolicy({
                                clerkId: clerkId!,
                                sourceId: s._id,
                                visibility: value,
                              })
                            )
                          }
                        />
                        <SourcePolicyRow
                          label="trust"
                          value={s.trustLevel ?? "medium"}
                          options={trustOptions}
                          disabled={isBusy}
                          onChange={(value) =>
                            runSourceAction(s._id, () =>
                              updateSourcePolicy({
                                clerkId: clerkId!,
                                sourceId: s._id,
                                trustLevel: value,
                              })
                            )
                          }
                        />
                      </div>
                      <div className="mt-3 grid gap-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                        <span>next refresh: {s.nextRefreshAt ? timeDistance(s.nextRefreshAt) : "manual"}</span>
                        <span>run approval: {needsApproval ? (approvedUntil && approvedUntil > Date.now() ? timeDistance(approvedUntil) : "required") : "not required"}</span>
                        <span>latest change: {latestChange ? latestChange.summary : sourceChanges === undefined ? "loading" : "--"}</span>
                        {latestChange?.contentPreview && (
                          <span>preview: {latestChange.contentPreview}</span>
                        )}
                        {latestChange?.status === "pending_review" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              runSourceAction(s._id, () =>
                                approveSourceChange({
                                  clerkId: clerkId!,
                                  sourceId: s._id,
                                  changeSummaryId: latestChange._id,
                                })
                              )
                            }
                            className="w-fit border border-[hsl(var(--accent))] px-2 py-1 text-[hsl(var(--text-primary))] disabled:cursor-not-allowed disabled:opacity-35"
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            approve change
                          </button>
                        )}
                        <span>failures: {s.failureCount ?? 0}</span>
                        <span>latest hash: {s.lastRawContentHash ? s.lastRawContentHash.slice(0, 16) : "--"}</span>
                        <span>versions: {sourceVersions === undefined ? "loading" : sourceVersions.length}</span>
                        {sourceVersions?.slice(0, 3).map((version) => (
                          <span key={version._id}>
                            {timeAgo(version.fetchedAt)} / {version.contentHash.slice(0, 16)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {status === "failed" && s.errorMessage && (
                    <div className="font-mono text-[9px] text-red-500 opacity-70 mt-1 truncate">
                      error: {s.errorMessage}
                    </div>
                  )}
                  {isSelected && sourceActionError && (
                    <div className="font-mono text-[9px] text-red-500 opacity-70 mt-2">
                      {sourceActionError}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Divider />

        <SectionLabel>add source</SectionLabel>
        <div className="border border-border bg-card p-4">
          <FieldHelp className="mb-3 text-[11px]">
            choose a connector, preview the contract, then save it into your brain:
          </FieldHelp>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {connectorOptions.map((option) => {
              const active = connectorKind === option.kind;
              return (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => {
                    setConnectorKind(option.kind);
                    setCrawlerProvider(option.defaultProvider);
                    setNewUrl((current) => current || "");
                  }}
                  className={`border p-3 text-left transition-colors ${
                    active
                      ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                      : "border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]"
                  }`}
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <span className="block font-mono text-[11px] text-[hsl(var(--text-primary))]">
                    {option.label}
                  </span>
                  <span className="block font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 mt-1">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              value={newUrl}
              onChange={(e) => {
                const value = e.target.value;
                setNewUrl(value);
                if (value.trim()) {
                  const inferred = inferConnectorKind(value.trim());
                  setConnectorKind((current) => (current === "website" ? inferred : current));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSource();
              }}
              placeholder={connectorFor(connectorKind).placeholder}
              disabled={isAdding || !clerkId}
              className="min-w-0 flex-1 text-[12px]"
            />
            <Button
              onClick={handleAddSource}
              disabled={isAdding || !newUrl.trim() || !clerkId}
              variant="primary"
              size="md"
              className="text-[11px]"
            >
              {isAdding ? "..." : "add"}
            </Button>
          </div>
          <div className="mt-2">
            <Input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="optional label"
              disabled={isAdding || !clerkId}
              className="text-[12px]"
            />
          </div>
          {addError && (
            <FieldError className="mt-2 text-[11px]">
              {addError}
            </FieldError>
          )}
          <div className="mt-4 space-y-3">
            <div>
              <FieldHelp className="mb-2 text-[10px]">crawler provider</FieldHelp>
              <div className="grid grid-cols-2 gap-2">
                {crawlerOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCrawlerProvider(option.value)}
                    className={`border px-2 py-2 text-left font-mono text-[10px] ${
                      crawlerProvider === option.value
                        ? "border-[hsl(var(--accent))] text-[hsl(var(--text-primary))]"
                        : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70"
                    }`}
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    <span className="block">{option.label}</span>
                    <span className="block opacity-50 mt-1">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <OptionRow
              label="refresh"
              value={refreshPolicy}
              options={refreshOptions}
              onChange={(value) => setRefreshPolicy(value as RefreshPolicy)}
            />
            <OptionRow
              label="visibility"
              value={visibility}
              options={visibilityOptions}
              onChange={(value) => setVisibility(value as SourceVisibility)}
            />
            <OptionRow
              label="trust"
              value={trustLevel}
              options={trustOptions}
              onChange={(value) => setTrustLevel(value as TrustLevel)}
            />
          </div>
          <div className="mt-3 space-y-1">
            <FieldHelp className="text-[10px]">
              firecrawl and agent-browser are saved as provider intent; the runner must still be configured server-side before expensive crawls run.
            </FieldHelp>
          </div>
        </div>

        <Divider />

        <SectionLabel>pipeline</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2"
          style={{ borderRadius: "var(--radius)" }}
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

function OptionRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldHelp className="mb-2 text-[10px]">{label}</FieldHelp>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`border px-2 py-1 font-mono text-[10px] ${
              value === option.value
                ? "border-[hsl(var(--accent))] text-[hsl(var(--text-primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70"
            }`}
            style={{ borderRadius: "var(--radius)" }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SourcePolicyRow({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldHelp className="mb-2 text-[10px]">{label}</FieldHelp>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`border px-2 py-1 font-mono text-[9px] disabled:cursor-not-allowed disabled:opacity-35 ${
              value === option.value
                ? "border-[hsl(var(--accent))] text-[hsl(var(--text-primary))]"
                : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70"
            }`}
            style={{ borderRadius: "var(--radius)" }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
