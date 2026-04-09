"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback, useMemo } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

interface SharePaneProps {
  username: string;
  userId?: Id<"users">;
  clerkId: string;
  profileId?: Id<"profiles">;
  plan: string;
}

// ── Types ───────────────────────────────────────────────────────────────

type Scope = "public" | "full";
type Ttl = "1h" | "24h" | "7d" | "30d" | "90d" | "never";
type MaxUses = "unlimited" | "1" | "5" | "10" | "25";
type OutputFormat = "url" | "prompt";

interface PreviewLink {
  token: string;
  scope: string;
  useCount: number;
  expiresAt: string;
  isExpired: boolean;
}

interface ProjectOption {
  slug: string;
  name: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function projectSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "never";
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatExpiry(iso: string): { label: string; soon: boolean; expired: boolean } {
  if (iso === "never") return { label: "never expires", soon: false, expired: false };
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return { label: "never expires", soon: false, expired: false };
  const diff = ts - Date.now();
  if (diff <= 0) return { label: "expired", soon: false, expired: true };
  const hrs = Math.floor(diff / (60 * 60 * 1000));
  if (hrs < 1) return { label: "expires <1h", soon: true, expired: false };
  if (hrs < 24) return { label: `expires in ${hrs}h`, soon: hrs < 6, expired: false };
  const days = Math.floor(hrs / 24);
  if (days < 30) return { label: `expires in ${days}d`, soon: days < 2, expired: false };
  return { label: `expires ${iso.split("T")[0]}`, soon: false, expired: false };
}

function buildAgentPrompt(url: string, projectName?: string): string {
  const projectLine = projectName
    ? `\n\nFocus on the project "${projectName}" — prioritize project-specific context, goals, and constraints from my profile.`
    : "";
  return `Read my identity context: ${url}

Apply my preferences from the start. Address me by name. Reference my projects when relevant.${projectLine}`;
}

const TTL_OPTIONS: { value: Ttl; label: string }[] = [
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "never", label: "never" },
];

const MAX_USES_OPTIONS: { value: MaxUses; label: string }[] = [
  { value: "unlimited", label: "unlimited" },
  { value: "1", label: "1 use" },
  { value: "5", label: "5 uses" },
  { value: "10", label: "10 uses" },
  { value: "25", label: "25 uses" },
];

// ── Link preview modal (kept from previous version) ─────────────────────

function LinkPreviewModal({
  link,
  username,
  onClose,
}: {
  link: PreviewLink;
  username: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedContent, setCopiedContent] = useState(false);

  const fullUrl = `https://you.md/ctx/${username}/${link.token}`;

  useEffect(() => {
    let cancelled = false;
    async function fetchPreview() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/ctx/${username}/${link.token}`, {
          headers: { Accept: "text/plain" },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        }
        const text = await res.text();
        if (!cancelled) setContent(text);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed to fetch preview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPreview();
    return () => {
      cancelled = true;
    };
  }, [link.token, username]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleCopyContent = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopiedContent(true);
      setTimeout(() => setCopiedContent(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] mx-4 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] flex flex-col"
        style={{ borderRadius: "2px" }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))]/60" />
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--text-secondary))]/20" />
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--text-secondary))]/20" />
            <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
              link preview --{" "}
              <span
                className={
                  link.scope === "full"
                    ? "text-[hsl(var(--warning,38_92%_50%))]"
                    : "text-[hsl(var(--success))]"
                }
              >
                {link.scope}
              </span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors px-1.5 py-0.5"
          >
            [esc]
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[hsl(var(--border))] space-y-1.5">
          <div className="flex items-center gap-2">
            <code className="font-mono text-[11px] text-[hsl(var(--accent-mid))] truncate flex-1">
              {fullUrl}
            </code>
            <CopyButton
              text={fullUrl}
              className="shrink-0 px-1.5 py-0.5 text-[9px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
              label="copy url"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center">
              <span className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
                fetching context link resolution...
              </span>
            </div>
          )}
          {error && (
            <div className="py-4">
              <p className="font-mono text-[11px] text-[hsl(var(--accent))]">error: {error}</p>
            </div>
          )}
          {content && (
            <pre className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap leading-relaxed">
              {content}
            </pre>
          )}
        </div>

        {content && (
          <div className="px-4 py-2.5 border-t border-[hsl(var(--border))] flex items-center justify-between">
            <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30">
              {content.length.toLocaleString()} chars -- this is what the agent sees
            </span>
            <button
              onClick={handleCopyContent}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono border transition-colors ${
                copiedContent
                  ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                  : "border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-wash))]"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {copiedContent ? "copied" : "copy agent text"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main pane ───────────────────────────────────────────────────────────

export function SharePane({ username, userId, clerkId, profileId, plan }: SharePaneProps) {
  const recentBundles = useQuery(
    api.bundles.listRecentBundles,
    clerkId && userId ? { clerkId, userId, limit: 3 } : "skip"
  );
  const latestBundle = useQuery(api.bundles.getLatestBundle, clerkId && userId ? { clerkId, userId } : "skip");
  const links = useQuery(api.contextLinks.listLinks, clerkId ? { clerkId } : "skip");
  const createLink = useMutation(api.contextLinks.createLink);
  const revokeLink = useMutation(api.contextLinks.revokeLink);
  const agentStats = useQuery(
    api.private.getAgentStats,
    profileId ? { profileId } : "skip"
  );

  const isPro = plan === "pro";

  // ── Form state ────────────────────────────────────────────────────────
  const [scope, setScope] = useState<Scope>("public");
  const [ttl, setTtl] = useState<Ttl>("24h");
  const [maxUses, setMaxUses] = useState<MaxUses>("unlimited");
  const [linkName, setLinkName] = useState("");
  const [projectScope, setProjectScope] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Generated link state ──────────────────────────────────────────────
  const [generated, setGenerated] = useState<{
    url: string;
    scope: Scope;
    name: string | null;
    token: string;
  } | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("prompt");
  const [copiedPrimary, setCopiedPrimary] = useState(false);

  // ── Existing links state ──────────────────────────────────────────────
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [previewLink, setPreviewLink] = useState<PreviewLink | null>(null);
  const [confirmRevokeLink, setConfirmRevokeLink] = useState<string | null>(null);

  // ── Preview-as-agent state ────────────────────────────────────────────
  const [agentPreviewOpen, setAgentPreviewOpen] = useState(false);
  const [agentPreviewLoading, setAgentPreviewLoading] = useState(false);
  const [agentPreviewContent, setAgentPreviewContent] = useState<string | null>(null);
  const [agentPreviewError, setAgentPreviewError] = useState<string | null>(null);

  const liveBundle = recentBundles?.find((b) => b.isPublished);
  const publicProfileUrl = `https://you.md/${username}`;

  // Extract projects from the latest bundle's youJson for the scope dropdown
  const projectOptions: ProjectOption[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects: any[] = (latestBundle?.youJson as any)?.projects ?? [];
    if (!Array.isArray(projects)) return [];
    const seen = new Set<string>();
    const out: ProjectOption[] = [];
    for (const p of projects) {
      const name = typeof p === "string" ? p : p?.name;
      if (!name || typeof name !== "string") continue;
      const slug = projectSlug(name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, name });
    }
    return out;
  }, [latestBundle]);

  const selectedProject = projectOptions.find((p) => p.slug === projectScope);

  // ── Build the active URL (with project query param if scoped) ─────────
  const buildActiveUrl = useCallback(
    (rawUrl: string): string => {
      if (!projectScope) return rawUrl;
      const sep = rawUrl.includes("?") ? "&" : "?";
      return `${rawUrl}${sep}project=${encodeURIComponent(projectScope)}`;
    },
    [projectScope]
  );

  const generatedActiveUrl = generated ? buildActiveUrl(generated.url) : null;

  // ── Create link handler ───────────────────────────────────────────────
  const handleCreateLink = async () => {
    setCreating(true);
    setCreateError(null);
    setAgentPreviewOpen(false);
    setAgentPreviewContent(null);
    try {
      // Free plan + full scope = upgrade prompt (don't even hit the API)
      if (scope === "full" && !isPro) {
        setCreateError("Pro plan required for full-context links.");
        setCreating(false);
        return;
      }

      const args: {
        clerkId: string;
        scope: Scope;
        ttl?: string;
        maxUses?: number;
        name?: string;
      } = {
        clerkId,
        scope,
      };
      if (scope === "public") {
        // Public links default to never-expire / unlimited.
        args.ttl = "never";
      } else {
        args.ttl = ttl;
        if (maxUses !== "unlimited") {
          args.maxUses = parseInt(maxUses, 10);
        }
        if (linkName.trim()) args.name = linkName.trim();
      }

      const result = await createLink(args);
      setGenerated({
        url: result.url,
        scope: result.scope as Scope,
        name: result.name ?? null,
        token: result.token,
      });
      setOutputFormat("prompt");
      setLinkName("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  // ── Compute output text ───────────────────────────────────────────────
  const outputText = useMemo(() => {
    if (!generatedActiveUrl) return "";
    if (outputFormat === "url") return generatedActiveUrl;
    return buildAgentPrompt(generatedActiveUrl, selectedProject?.name);
  }, [generatedActiveUrl, outputFormat, selectedProject]);

  const handleCopyOutput = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopiedPrimary(true);
    setTimeout(() => setCopiedPrimary(false), 2000);
  };

  // ── Preview as agent (for the just-created link) ──────────────────────
  const handlePreviewAsAgent = useCallback(async () => {
    if (!generated) return;
    setAgentPreviewOpen(true);
    setAgentPreviewLoading(true);
    setAgentPreviewError(null);
    setAgentPreviewContent(null);
    try {
      const url = `/ctx/${username}/${generated.token}`;
      const res = await fetch(url, { headers: { Accept: "text/plain" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setAgentPreviewContent(text);
    } catch (err) {
      setAgentPreviewError(err instanceof Error ? err.message : "failed to load preview");
    } finally {
      setAgentPreviewLoading(false);
    }
  }, [generated, username]);

  // ── Sort + slice existing links ───────────────────────────────────────
  const sortedLinks = useMemo(() => {
    if (!links) return [];
    return [...links].sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [links]);

  const visibleLinks = showAllLinks ? sortedLinks : sortedLinks.slice(0, 5);
  const hiddenLinkCount = Math.max(0, sortedLinks.length - 5);

  const hasRealStats = agentStats && agentStats.agents.length > 0;
  const totalInteractions = hasRealStats ? agentStats.totalInteractions : 0;
  const uniqueAgents = hasRealStats ? agentStats.uniqueAgents : 0;

  // ── Color helpers per scope ───────────────────────────────────────────
  // public = green (success), full = orange/amber (warning)
  const scopeAccent = (s: Scope | string) =>
    s === "full" ? "hsl(38 92% 56%)" : "hsl(var(--success))";

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>share</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-2xl">
        {/* Publish status — compact */}
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] mb-4"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {liveBundle ? (
                <>
                  <span
                    className="w-2 h-2 rounded-full status-dot-pulse"
                    style={{ background: "hsl(var(--success))" }}
                  />
                  <span className="font-mono text-[11px] text-[hsl(var(--success))]">LIVE</span>
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 ml-1">
                    v{liveBundle.version}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: "hsl(var(--text-secondary))", opacity: 0.3 }}
                  />
                  <span className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40">
                    DRAFT
                  </span>
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-25 ml-1">
                    type /publish to go live
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <CopyButton
                text={publicProfileUrl}
                className="text-[9px] font-mono px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                label="copy profile url"
              />
              <a
                href={`/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                open
              </a>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: Share your identity — scope toggle ──────────────── */}
        <SectionLabel>share your identity</SectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 mb-3">
          create a link any agent can fetch. choose what they get to see.
        </p>

        <div
          className="border-2 p-4 mb-4"
          style={{
            borderRadius: "2px",
            borderColor: scope === "full" ? scopeAccent("full") + "55" : scopeAccent("public") + "55",
            background:
              scope === "full" ? scopeAccent("full") + "08" : scopeAccent("public") + "08",
          }}
        >
          <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 uppercase tracking-widest mb-3">
            what to share
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* PUBLIC option */}
            <button
              onClick={() => setScope("public")}
              className="text-left p-3 border-2 transition-all"
              style={{
                borderRadius: "2px",
                borderColor:
                  scope === "public" ? scopeAccent("public") : "hsl(var(--border))",
                background:
                  scope === "public" ? scopeAccent("public") + "12" : "hsl(var(--bg))",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor:
                      scope === "public" ? scopeAccent("public") : "hsl(var(--border))",
                  }}
                >
                  {scope === "public" && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: scopeAccent("public") }}
                    />
                  )}
                </span>
                <span
                  className="font-mono text-[12px] font-semibold uppercase tracking-wide"
                  style={{
                    color:
                      scope === "public"
                        ? scopeAccent("public")
                        : "hsl(var(--text-primary))",
                  }}
                >
                  public
                </span>
              </div>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
                only your published profile. anyone with the link reads your public identity.
              </p>
            </button>

            {/* FULL option */}
            <button
              onClick={() => setScope("full")}
              className="text-left p-3 border-2 transition-all"
              style={{
                borderRadius: "2px",
                borderColor: scope === "full" ? scopeAccent("full") : "hsl(var(--border))",
                background: scope === "full" ? scopeAccent("full") + "12" : "hsl(var(--bg))",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0"
                  style={{
                    borderColor:
                      scope === "full" ? scopeAccent("full") : "hsl(var(--border))",
                  }}
                >
                  {scope === "full" && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: scopeAccent("full") }}
                    />
                  )}
                </span>
                <span
                  className="font-mono text-[12px] font-semibold uppercase tracking-wide"
                  style={{
                    color:
                      scope === "full" ? scopeAccent("full") : "hsl(var(--text-primary))",
                  }}
                >
                  full context
                </span>
                {!isPro && (
                  <span
                    className="font-mono text-[8px] px-1 py-0.5 border ml-auto"
                    style={{
                      borderColor: scopeAccent("full") + "60",
                      color: scopeAccent("full"),
                      borderRadius: "2px",
                    }}
                  >
                    PRO
                  </span>
                )}
              </div>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
                public + private notes, private projects, internal links, vault notes.
              </p>
            </button>
          </div>
        </div>

        {/* ── SECTION 2: Link options ─────────────────────────────────── */}
        {scope === "public" ? (
          <div className="mb-4 px-3 py-2 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]" style={{ borderRadius: "2px" }}>
            <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 leading-relaxed">
              <span style={{ color: scopeAccent("public") }}>public link</span> -- never expires, unlimited uses. anyone with the URL reads your published profile.
            </p>
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            {/* WARNING block */}
            <div
              className="px-3 py-2.5 border-l-2"
              style={{
                borderLeftColor: scopeAccent("full"),
                background: scopeAccent("full") + "0a",
                borderRadius: "2px",
              }}
            >
              <div
                className="font-mono text-[10px] font-semibold uppercase tracking-wide mb-1"
                style={{ color: scopeAccent("full") }}
              >
                ! grants full access
              </div>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
                this link exposes private notes, vault items (when unlocked), private projects, and internal links. share only with trusted agents on devices you control.
              </p>
            </div>

            {/* Link name */}
            <div>
              <label
                htmlFor="link-name"
                className="block font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 mb-1"
              >
                name <span className="opacity-50">(optional)</span>
              </label>
              <input
                id="link-name"
                type="text"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Claude Code on my work laptop"
                className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] px-2 py-1.5 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/60 focus:outline-none placeholder:text-[hsl(var(--text-secondary))] placeholder:opacity-30"
                style={{ borderRadius: "2px" }}
              />
            </div>

            {/* TTL + max uses + project scope grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="link-ttl"
                  className="block font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 mb-1"
                >
                  expires after
                </label>
                <select
                  id="link-ttl"
                  value={ttl}
                  onChange={(e) => setTtl(e.target.value as Ttl)}
                  className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] px-2 py-1.5 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/60 focus:outline-none"
                  style={{ borderRadius: "2px" }}
                >
                  {TTL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="link-max-uses"
                  className="block font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 mb-1"
                >
                  max uses
                </label>
                <select
                  id="link-max-uses"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value as MaxUses)}
                  className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] px-2 py-1.5 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/60 focus:outline-none"
                  style={{ borderRadius: "2px" }}
                >
                  {MAX_USES_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project scope (full only) */}
            <div>
              <label
                htmlFor="link-project"
                className="block font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 mb-1"
              >
                project scope
              </label>
              <select
                id="link-project"
                value={projectScope}
                onChange={(e) => setProjectScope(e.target.value)}
                className="w-full bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))] font-mono text-[11px] px-2 py-1.5 border border-[hsl(var(--border))] focus:border-[hsl(var(--accent))]/60 focus:outline-none"
                style={{ borderRadius: "2px" }}
              >
                <option value="">all my private context</option>
                {projectOptions.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    scoped to: {p.name}
                  </option>
                ))}
              </select>
              {projectOptions.length === 0 && (
                <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mt-1">
                  no projects detected -- the link will include all your private context
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Pro upgrade callout ──────────────────────────────────────── */}
        {scope === "full" && !isPro && (
          <div
            className="mb-3 px-3 py-3 border-2"
            style={{
              borderColor: scopeAccent("full") + "60",
              background: scopeAccent("full") + "0f",
              borderRadius: "2px",
            }}
          >
            <div
              className="font-mono text-[11px] font-semibold mb-1"
              style={{ color: scopeAccent("full") }}
            >
              upgrade to pro to unlock full-context links
            </div>
            <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed mb-2">
              full context includes private notes, private projects, internal links, and vault items -- a Pro feature.
            </p>
            <a
              href="/pricing"
              className="inline-block font-mono text-[10px] px-2.5 py-1 border-2 transition-colors"
              style={{
                borderColor: scopeAccent("full"),
                color: scopeAccent("full"),
                borderRadius: "2px",
              }}
            >
              upgrade to pro &rarr;
            </a>
          </div>
        )}

        {/* ── Create button ───────────────────────────────────────────── */}
        <button
          onClick={handleCreateLink}
          disabled={creating || (scope === "full" && !isPro)}
          className="w-full flex items-center justify-center gap-2 px-3 py-3 text-[12px] font-mono font-semibold border-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            borderRadius: "2px",
            borderColor: scope === "full" ? scopeAccent("full") : scopeAccent("public"),
            color: scope === "full" ? scopeAccent("full") : scopeAccent("public"),
            background:
              scope === "full" ? scopeAccent("full") + "10" : scopeAccent("public") + "10",
          }}
        >
          {creating
            ? "creating..."
            : scope === "full"
              ? "+ create full-context link"
              : "+ create public link"}
        </button>

        {createError && (
          <p
            className="font-mono text-[10px] mt-2"
            style={{ color: scopeAccent("full") }}
          >
            {createError}
          </p>
        )}

        {/* ── SECTION 3: Generated link output ────────────────────────── */}
        {generated && generatedActiveUrl && (
          <div className="mt-4">
            <div
              className="border-2 p-4 space-y-3"
              style={{
                borderRadius: "2px",
                borderColor: scopeAccent(generated.scope),
                background: scopeAccent(generated.scope) + "08",
              }}
            >
              {/* Header with scope badge */}
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5"
                  style={{
                    background: scopeAccent(generated.scope) + "20",
                    color: scopeAccent(generated.scope),
                    border: `1px solid ${scopeAccent(generated.scope)}60`,
                    borderRadius: "2px",
                  }}
                >
                  {generated.scope === "full" ? "full context" : "public"}
                </span>
                {generated.name && (
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                    {generated.name}
                  </span>
                )}
                <span className="ml-auto font-mono text-[9px] text-[hsl(var(--success))]">
                  ready
                </span>
              </div>

              {/* The URL itself, large and prominent */}
              <div
                className="bg-[hsl(var(--bg))] p-2.5 border border-[hsl(var(--border))]"
                style={{ borderRadius: "2px" }}
              >
                <code className="font-mono text-[11px] text-[hsl(var(--accent-mid))] break-all select-all">
                  {generatedActiveUrl}
                </code>
              </div>

              {/* Output format toggle */}
              <div className="flex items-center gap-1">
                {(["prompt", "url"] as const).map((mode) => {
                  const active = outputFormat === mode;
                  const labels: Record<OutputFormat, string> = {
                    prompt: "prompt + url",
                    url: "just url",
                  };
                  return (
                    <button
                      key={mode}
                      onClick={() => setOutputFormat(mode)}
                      className={`px-2 py-1 text-[10px] font-mono border transition-colors ${
                        active
                          ? "text-[hsl(var(--accent))] border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/5"
                          : "text-[hsl(var(--text-secondary))] opacity-40 border-[hsl(var(--border))] hover:opacity-70"
                      }`}
                      style={{ borderRadius: "2px" }}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Output text preview */}
              {outputFormat === "prompt" && (
                <pre className="font-mono text-[10px] text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap leading-relaxed bg-[hsl(var(--bg))] p-2.5 border border-[hsl(var(--border))] select-all" style={{ borderRadius: "2px" }}>
                  {outputText}
                </pre>
              )}

              {/* PRIMARY ACTION: large copy button */}
              <button
                onClick={handleCopyOutput}
                className={`w-full flex items-center justify-center gap-2 px-3 py-3 text-[12px] font-mono font-semibold border-2 transition-colors ${
                  copiedPrimary
                    ? "border-[hsl(var(--success))]/60 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10"
                    : "border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5 hover:bg-[hsl(var(--accent-wash))]"
                }`}
                style={{ borderRadius: "2px" }}
              >
                {copiedPrimary ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    copied
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    copy {outputFormat === "prompt" ? "prompt + url" : "url"}
                  </>
                )}
              </button>

              {/* Preview as agent */}
              <button
                onClick={handlePreviewAsAgent}
                className="w-full px-3 py-1.5 text-[10px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                preview as agent (see what they'll receive)
              </button>

              {agentPreviewOpen && (
                <div
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-3"
                  style={{ borderRadius: "2px" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                      agent receives:
                    </span>
                    <button
                      onClick={() => setAgentPreviewOpen(false)}
                      className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100"
                    >
                      [close]
                    </button>
                  </div>
                  {agentPreviewLoading && (
                    <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
                      fetching agent view...
                    </p>
                  )}
                  {agentPreviewError && (
                    <p
                      className="font-mono text-[10px]"
                      style={{ color: scopeAccent("full") }}
                    >
                      error: {agentPreviewError}
                    </p>
                  )}
                  {agentPreviewContent && (
                    <pre className="font-mono text-[10px] text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-y-auto">
                      {agentPreviewContent}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Terminal hint */}
        <div className="mt-4">
          <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mb-1">
            or use the terminal:
          </p>
          <div className="space-y-1">
            <CopyableCommand command="/share" />
            <CopyableCommand command="/share --full" dimmed />
            <CopyableCommand command="/share --full --project my-project" dimmed />
          </div>
        </div>

        <Divider />

        {/* ── SECTION 4: Existing links ──────────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>your active links</SectionLabel>
          {sortedLinks.length > 0 && (
            <span className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
              {sortedLinks.filter((l) => !l.isExpired).length} active / {sortedLinks.length} total
            </span>
          )}
        </div>

        {visibleLinks.length === 0 ? (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
            no context links yet. create one above or type /share in the terminal.
          </p>
        ) : (
          <div className="space-y-2">
            {visibleLinks.map((link) => {
              const exp = formatExpiry(
                typeof link.expiresAt === "string" ? link.expiresAt : "never"
              );
              const accent = scopeAccent(link.scope);
              return (
                <div
                  key={link.id}
                  className={`px-3 py-2.5 border border-l-2 bg-[hsl(var(--bg-raised))] text-[10px] font-mono ${
                    link.isExpired ? "opacity-30" : ""
                  }`}
                  style={{
                    borderRadius: "2px",
                    borderLeftColor: accent,
                    borderTopColor: "hsl(var(--border))",
                    borderRightColor: "hsl(var(--border))",
                    borderBottomColor: "hsl(var(--border))",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top row: name + scope badge */}
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 shrink-0"
                          style={{
                            background: accent + "20",
                            color: accent,
                            border: `1px solid ${accent}60`,
                            borderRadius: "2px",
                          }}
                        >
                          {link.scope === "full" ? "full" : "public"}
                        </span>
                        <span className="text-[hsl(var(--text-primary))] opacity-80 truncate">
                          {link.name || `link-${link.token.slice(0, 6)}`}
                        </span>
                      </div>
                      {/* URL */}
                      <code className="block text-[hsl(var(--accent-mid))] truncate opacity-70">
                        you.md/ctx/{username}/{link.token}
                      </code>
                      {/* Metadata */}
                      <div className="flex items-center gap-3 text-[hsl(var(--text-secondary))] opacity-50 text-[9px]">
                        <span>created {formatRelative(link.createdAt)}</span>
                        <span>{link.useCount} uses</span>
                        {link.lastUsedAt && <span>last used {formatRelative(link.lastUsedAt)}</span>}
                        <span
                          style={{
                            color: exp.expired
                              ? scopeAccent("full")
                              : exp.soon
                                ? scopeAccent("full")
                                : undefined,
                            fontWeight: exp.soon || exp.expired ? 600 : undefined,
                          }}
                        >
                          {exp.label}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    {!link.isExpired && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <CopyButton
                          text={`https://you.md/ctx/${username}/${link.token}`}
                          className="px-2 py-1 text-[9px] font-mono border border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-wash))] transition-colors"
                          label="copy"
                        />
                        <button
                          onClick={() =>
                            setPreviewLink({
                              token: link.token,
                              scope: link.scope,
                              useCount: link.useCount,
                              expiresAt:
                                typeof link.expiresAt === "string" ? link.expiresAt : "never",
                              isExpired: link.isExpired,
                            })
                          }
                          className="px-2 py-1 text-[9px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                          style={{ borderRadius: "2px" }}
                        >
                          preview
                        </button>
                        <button
                          onClick={() => {
                            if (confirmRevokeLink === link.id) {
                              revokeLink({ clerkId, linkId: link.id });
                              setConfirmRevokeLink(null);
                            } else {
                              setConfirmRevokeLink(link.id);
                              setTimeout(
                                () =>
                                  setConfirmRevokeLink((c) =>
                                    c === link.id ? null : c
                                  ),
                                3000
                              );
                            }
                          }}
                          className={`px-2 py-1 text-[9px] font-mono border transition-colors ${
                            confirmRevokeLink === link.id
                              ? "border-red-400/60 text-red-400 hover:text-red-300"
                              : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/40"
                          }`}
                          style={{ borderRadius: "2px" }}
                        >
                          {confirmRevokeLink === link.id ? "confirm?" : "revoke"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {hiddenLinkCount > 0 && !showAllLinks && (
              <button
                onClick={() => setShowAllLinks(true)}
                className="w-full px-3 py-2 text-[10px] font-mono border border-dashed border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                style={{ borderRadius: "2px" }}
              >
                load {hiddenLinkCount} more {hiddenLinkCount === 1 ? "link" : "links"}
              </button>
            )}
            {showAllLinks && hiddenLinkCount > 0 && (
              <button
                onClick={() => setShowAllLinks(false)}
                className="w-full px-3 py-2 text-[10px] font-mono border border-dashed border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100 transition-opacity"
                style={{ borderRadius: "2px" }}
              >
                show fewer
              </button>
            )}
          </div>
        )}

        {/* Agent stats — compact */}
        {(totalInteractions > 0 || uniqueAgents > 0) && (
          <>
            <Divider />
            <SectionLabel>agent activity</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div
                className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] text-center"
                style={{ borderRadius: "2px" }}
              >
                <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase">
                  interactions
                </p>
                <p className="font-mono text-sm text-[hsl(var(--text-primary))] mt-1">
                  {totalInteractions >= 1000
                    ? `${(totalInteractions / 1000).toFixed(1)}k`
                    : totalInteractions}
                </p>
              </div>
              <div
                className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] text-center"
                style={{ borderRadius: "2px" }}
              >
                <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50 uppercase">
                  agents
                </p>
                <p className="font-mono text-sm text-[hsl(var(--text-primary))] mt-1">
                  {uniqueAgents}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Link preview modal */}
      {previewLink && (
        <LinkPreviewModal
          link={previewLink}
          username={username}
          onClose={() => setPreviewLink(null)}
        />
      )}
    </div>
  );
}
