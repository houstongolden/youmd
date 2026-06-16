"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { useUser } from "@/lib/you-auth";
import { CopyButton } from "@/components/ui/CopyButton";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import AsciiAvatar from "@/components/AsciiAvatar";
import type { PreRenderedPortrait } from "@/components/AsciiAvatar";
import ProfilePortrait from "@/components/ProfilePortrait";
import { generateYouJson, generateYouMd, downloadFile } from "@/lib/exportProfile";
import { hasRenderableAsciiPortrait } from "@/lib/profilePortrait";
import { useCachedPortrait } from "@/lib/portraitCache";

/* ── Types ────────────────────────────────────────────────── */

type ViewMode = "public" | "private" | "agent";

interface Project {
  name: string;
  role: string;
  status: string;
  url: string;
  description: string;
}

interface ProfileYouStack {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  visibility?: "private" | "scoped-link" | "public-open" | "team" | string;
  install?: string;
  skills?: string[];
}

// The public profile payload is protocol-shaped but intentionally extensible.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileJson = Record<string, any>;

type PublicConversationResponse = {
  answer: string;
  voice_mode: string;
  sources: Array<{ label: string; href: string; scope: string }>;
  public_context_used: string[];
  capabilities?: string[];
  omitted_private_context: string[];
  suggested_followups: string[];
};

type PublicChatSettings = {
  enabled: boolean;
  style: "concise" | "voice" | "consultive";
  capabilities: string[];
};

/* ── Helpers ──────────────────────────────────────────────── */

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

const statusColor = (s: string) => {
  switch (s) {
    case "active": return "text-[hsl(var(--success))]";
    case "building": return "text-[hsl(var(--accent))]";
    case "shipped": return "text-[hsl(var(--success))]";
    default: return "text-[hsl(var(--text-secondary))]";
  }
};

const delay = (i: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3, delay: i * 0.06 },
});

function sanitizeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const raw = value.trim();
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    for (const param of ["apiKey", "apikey", "api_key", "access_token", "token"]) {
      url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function normalizeProfileYouStacks(value: unknown): ProfileYouStack[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): ProfileYouStack[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    if (!name || !slug) return [];
    return [{
      name,
      slug,
      domain: typeof record.domain === "string" ? record.domain : undefined,
      description: typeof record.description === "string" ? record.description : undefined,
      visibility: typeof record.visibility === "string" ? record.visibility : "private",
      install: typeof record.install === "string" ? record.install : undefined,
      skills: Array.isArray(record.skills)
        ? record.skills.filter((skill): skill is string => typeof skill === "string").slice(0, 12)
        : undefined,
    }];
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePublicChatSettings(value: unknown): PublicChatSettings {
  const raw = asRecord(value);
  const style = raw.style === "concise" || raw.style === "consultive" || raw.style === "voice"
    ? raw.style
    : "voice";
  const capabilities = Array.isArray(raw.capabilities)
    ? raw.capabilities.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : ["current_work", "expertise", "voice", "links", "api"];

  return {
    enabled: raw.enabled !== false,
    style,
    capabilities,
  };
}

function PublicProfileChatBox({
  username,
  name,
  settings,
}: {
  username: string;
  name: string;
  settings: PublicChatSettings;
}) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<PublicConversationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = [
    settings.capabilities.includes("current_work") ? `What is ${name} building right now?` : "",
    settings.capabilities.includes("expertise") ? `What should I ask ${name} about?` : "",
    settings.capabilities.includes("voice") ? `How does ${name} usually think and communicate?` : "",
    settings.capabilities.includes("api") ? `Which public endpoints can agents read for @${username}?` : "",
  ].filter(Boolean).slice(0, 3);

  const ask = useCallback(async (prompt?: string) => {
    const question = (prompt ?? message).trim();
    if (!question || loading) return;
    setLoading(true);
    setError(null);
    if (prompt) setMessage(prompt);

    try {
      const result = await fetch(`/api/v1/profiles/${encodeURIComponent(username)}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const json = await result.json();
      if (!result.ok) {
        throw new Error(typeof json?.error === "string" ? json.error : "conversation_failed");
      }
      setResponse(json as PublicConversationResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "conversation_failed");
    } finally {
      setLoading(false);
    }
  }, [loading, message, username]);

  return (
    <div
      className="border border-[hsl(var(--accent))]/35 bg-[hsl(var(--accent))]/[0.025] p-4 font-mono text-[11px]"
      style={{ borderRadius: "var(--radius)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[hsl(var(--accent))] uppercase tracking-[0.16em] text-[9px]">public conversation api</p>
          <p className="mt-1 text-[hsl(var(--text-primary))] text-[13px]">ask @{username}&apos;s public You.md</p>
        </div>
        <span className="text-[hsl(var(--text-secondary))] opacity-45 text-[10px]">
          {settings.style} / public context only
        </span>
      </div>

      <div className="mt-3 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]" style={{ borderRadius: "var(--radius)" }}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void ask();
            }
          }}
          rows={3}
          maxLength={1200}
          placeholder={`ask what ${name} is building, how they think, or which public endpoints agents can read...`}
          className="block w-full resize-none bg-transparent px-3 py-2 text-[12px] leading-relaxed text-[hsl(var(--text-primary))] outline-none placeholder:text-[hsl(var(--text-secondary))]/35"
        />
        <div className="flex items-center justify-between border-t border-[hsl(var(--border))]/50 px-3 py-2">
          <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-35">
            POST /api/v1/profiles/{username}/conversation
          </span>
          <button
            type="button"
            onClick={() => void ask()}
            disabled={loading || !message.trim()}
            className="border border-[hsl(var(--accent))]/45 px-2.5 py-1 text-[10px] text-[hsl(var(--accent))] transition-colors hover:bg-[hsl(var(--accent))]/10 disabled:cursor-not-allowed disabled:opacity-30"
            style={{ borderRadius: "var(--radius)" }}
          >
            {loading ? "thinking" : "ask"}
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void ask(suggestion)}
            className="border border-[hsl(var(--border))] px-2 py-1 text-[10px] text-[hsl(var(--text-secondary))] opacity-60 transition-colors hover:border-[hsl(var(--accent))]/35 hover:text-[hsl(var(--accent))] hover:opacity-90"
            style={{ borderRadius: "var(--radius)" }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-[10px] text-[hsl(var(--accent))] opacity-80">
          ERR: {error}
        </p>
      )}

      {response && (
        <div className="mt-4 border-t border-[hsl(var(--border))]/50 pt-3">
          <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
            {response.answer}
          </pre>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {response.public_context_used.map((field) => (
              <span
                key={field}
                className="border border-[hsl(var(--border))] px-1.5 py-0.5 text-[9px] text-[hsl(var(--text-secondary))] opacity-45"
                style={{ borderRadius: "var(--radius)" }}
              >
                {field}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-35">
            omitted: {response.omitted_private_context.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Owner edit context ───────────────────────────────────────
 * Provides ownership flag down the tree so that <SectionLabel>
 * can render an edit affordance for the owner without prop drilling.
 */
const OwnerContext = createContext<boolean>(false);

/* ── Main Component ───────────────────────────────────────── */

interface ProfileContentProps {
  ssrData?: ProfileJson | null;
  /**
   * Inline dashboard preview mode. When true:
   * - no view-count / analytics side effects (recordView is skipped)
   * - renders exactly what the public sees: owner affordances (view-mode
   *   toggle, edit pencils, private context) are disabled
   * - no fixed claim banner overlay
   * - natural height instead of min-h-[100dvh] so it fits the host pane
   * Behavior is byte-identical to the public page when this prop is absent.
   */
  preview?: boolean;
  /** Username to render in preview mode (route params are unavailable
   *  outside the /[username] route). */
  previewUsername?: string;
}

export function ProfileContent({ ssrData, preview = false, previewUsername }: ProfileContentProps) {
  const params = useParams();
  const username = (preview && previewUsername ? previewUsername : params.username) as string;

  // ── Anon-vs-auth query branch ─────────────────────────────────
  // Authenticated users get a live Convex subscription (data freshness +
  // ownership detection). Anonymous visitors skip the subscription and rely
  // on the ssrData already fetched server-side; this avoids an unnecessary
  // WebSocket connection on every public profile page view.
  const { isAuthenticated } = useConvexAuth();
  const skipLiveQuery = !isAuthenticated && !preview;
  const profile = useQuery(api.profiles.getPublicProfile, skipLiveQuery ? "skip" : { username });
  const recordView = useMutation(api.profiles.recordView);
  const hasRecordedView = useRef(false);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawCopied, setRawCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("public");
  const [agentPreview, setAgentPreview] = useState<string | null>(null);
  const [agentPreviewLoading, setAgentPreviewLoading] = useState(false);

  // ── Verifications ─────────────────────────────────────────
  // getPublicProfile already returns profileId — no need for a second query
  const verifications = useQuery(
    api.profiles.listVerifications,
    profile?.profileId ? { profileId: profile.profileId } : "skip"
  );

  // ── Ownership detection ──────────────────────────────────────
  const { user: clerkUser } = useUser();
  // isAuthenticated declared above (used for skipLiveQuery)
  const convexUser = useQuery(
    api.users.getByClerkId,
    isAuthenticated && clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );
  const ownedProfile = useQuery(
    api.profiles.getByOwnerId,
    convexUser?._id ? { ownerId: convexUser._id } : "skip"
  );
  // Preview renders the public view — owner affordances stay off
  const isOwner = !preview && ownedProfile?.username === username;

  // ── Public stats (social proof) ──────────────────────────────
  const publicStats = useQuery(api.profiles.getPublicStats, { username });

  // ── Private context (only fetched for owner) ─────────────────
  const privateContext = useQuery(
    api.private.getPrivateContext,
    isOwner && clerkUser?.id && ownedProfile?._id
      ? { clerkId: clerkUser.id, profileId: ownedProfile._id }
      : "skip"
  );

  // ── Agent preview fetch ──────────────────────────────────────
  const fetchAgentPreview = useCallback(async () => {
    if (agentPreview !== null) return;
    setAgentPreviewLoading(true);
    try {
      const res = await fetch(`/${username}/you.txt`);
      if (res.ok) {
        setAgentPreview(await res.text());
      } else {
        setAgentPreview("-- failed to load agent preview --");
      }
    } catch {
      setAgentPreview("-- failed to load agent preview --");
    } finally {
      setAgentPreviewLoading(false);
    }
  }, [username, agentPreview]);

  useEffect(() => {
    if (viewMode === "agent" && agentPreview === null && !agentPreviewLoading) {
      fetchAgentPreview();
    }
  }, [viewMode, agentPreview, agentPreviewLoading, fetchAgentPreview]);

  // SSR fallback shape matching the Convex query return type
  const ssrProfile = ssrData ? {
    youJson: ssrData,
    displayName: ssrData.identity?.name || username,
    avatarUrl: sanitizeImageUrl(ssrData._profile?.avatarUrl ?? ssrData.meta?.avatarUrl),
    asciiPortrait: hasRenderableAsciiPortrait(ssrData._profile?.asciiPortrait)
      ? ssrData._profile.asciiPortrait as PreRenderedPortrait
      : undefined,
    isClaimed: (ssrData.meta?.isClaimed as boolean) ?? true,
  } : null;

  useEffect(() => {
    if (preview) return; // dashboard preview must not count as a view
    if (hasRecordedView.current) return;
    if (profile === undefined || profile === null) return;
    hasRecordedView.current = true;
    recordView({
      username,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      isAgentRead: false,
    }).catch(() => {});
  }, [profile, username, recordView, preview]);

  // ── Local-first portrait (U13) ────────────────────────────────
  // Resolve the freshest portrait the existing fetch path knows about:
  // undefined while loading, null once resolved without one. The hook
  // backfills from localStorage so the portrait paints instantly.
  const portraitSource = (profile ?? ssrData?._profile ?? null) as Record<string, unknown> | null;
  const freshPortrait: PreRenderedPortrait | null | undefined =
    portraitSource && hasRenderableAsciiPortrait(portraitSource.asciiPortrait)
      ? (portraitSource.asciiPortrait as PreRenderedPortrait)
      : profile === undefined
        ? undefined
        : null;
  const displayPortrait = useCachedPortrait(username, freshPortrait);

  const handleCopy = () => {
    navigator.clipboard.writeText(`you.md/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Natural height inside the dashboard pane; full viewport on the public page
  const rootMinH = preview ? "min-h-full" : "min-h-[100dvh]";

  // The dashboard already provides the <main> landmark — avoid nesting a
  // second <main> when this component renders inline as the profile preview.
  const MainEl: "main" | "div" = preview ? "div" : "main";

  // Not found — live Convex null for auth'd visitors; null ssrData for anon
  if (profile === null || (skipLiveQuery && ssrData === null)) {
    return (
      <MainEl className={`${rootMinH} flex items-center justify-center bg-[hsl(var(--bg))] p-4`}>
        <div className="w-full max-w-md">
          <div className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden" style={{ borderRadius: "var(--radius)" }}>
            <TerminalHeader title="you.md -- error" asHeading />
            <div className="p-6 font-mono text-[14px] space-y-2">
              <p className="text-[hsl(var(--text-secondary))] opacity-60">
                &gt; lookup @{username}
              </p>
              <p className="text-[hsl(var(--accent))]">ERR: profile not found</p>
              <p className="text-[hsl(var(--text-secondary))] opacity-40 text-[13px] mt-3">
                this username has not been claimed yet.
              </p>
              <div className="border-t border-[hsl(var(--border))] pt-3 mt-4 flex gap-4">
                <Link href="/create" className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors">
                  &gt; create profile
                </Link>
                <Link href="/profiles" className="text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80 transition-opacity">
                  &gt; ls /profiles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </MainEl>
    );
  }

  // Use live Convex data when available, fall back to SSR data for instant first paint
  const resolvedProfile = profile ?? ssrProfile;

  // Loading — only show spinner if no data at all (neither SSR nor Convex)
  if (!resolvedProfile) {
    return (
      <div className={`${rootMinH} flex items-center justify-center bg-[hsl(var(--bg))]`}>
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  const data = resolvedProfile.youJson as ProfileJson | null;
  const resolvedRecord = resolvedProfile as Record<string, unknown>;
  const resolvedAvatarUrl = sanitizeImageUrl(resolvedRecord.avatarUrl);
  // Local-first: cached portrait fills in while the fresh one loads (U13)
  const storedPortrait = displayPortrait ?? undefined;
  const allProfileStacks = normalizeProfileYouStacks(
    data?.youstacks ?? data?.youStacks ?? data?.identity?.youstacks ?? data?.identity?.youStacks
  );
  const visibleProfileStacks = allProfileStacks.filter((stack) =>
    isOwner || stack.visibility === "public-open"
  );

  // YouStacks hosted in the user's own (public) GitHub repo — surfaced from the
  // You.md server-side mirror via the profile API's `_profile.repoStacks`.
  const repoStacks = (ssrData?._profile?.repoStacks ?? null) as {
    repoFullName: string;
    repoUrl: string;
    stacks: { slug: string; fileCount: number; hasManifest: boolean }[];
  } | null;

  const handleCopyRawJson = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setRawCopied(true);
    setTimeout(() => setRawCopied(false), 1500);
  };

  // Profile exists but no youJson yet
  if (!data) {
    return (
      <div className={`profile-page ${rootMinH} flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]`}>
        <ProfileHeader username={username} />
        <MainEl className="flex-1 max-w-[680px] mx-auto w-full px-4 md:px-6 pt-8 md:pt-12 pb-16">
          <div className="flex items-end gap-4 mb-4">
            <ProfilePortrait
              username={username}
              name={resolvedProfile.displayName || username}
              avatarUrl={resolvedAvatarUrl}
              asciiPortrait={storedPortrait}
              className="h-16 w-16"
              cols={36}
              canvasWidth={64}
              showPhotoOnHover
            />
            <div className="pb-1 flex-1 min-w-0">
              <h1 className="text-[hsl(var(--text-primary))] font-mono text-lg font-medium tracking-tight truncate">
                {resolvedProfile.displayName || `@${username}`}
              </h1>
              {resolvedProfile.displayName && (
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-xs font-mono mt-0.5">@{username}</p>
              )}
            </div>
          </div>
          <div className="mt-8 border border-[hsl(var(--border))] p-5 bg-[hsl(var(--bg-raised))]" style={{ borderRadius: "var(--radius)" }}>
            <p className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[13px]">
              this identity is being built. check back soon.
            </p>
            {!resolvedProfile.isClaimed && (
              <Link href="/sign-up" className="block mt-3 text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors font-mono text-[13px]">
                &gt; claim this identity
              </Link>
            )}
          </div>
        </MainEl>
        <ProfileFooter />

        {/* Claim banner — fixed overlay, suppressed in the dashboard preview */}
        {!preview && !resolvedProfile.isClaimed && <ClaimBanner username={username} />}
      </div>
    );
  }

  // Full profile
  const name = data.identity?.name || resolvedProfile.displayName || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";
  const topics: string[] = data.analysis?.topics || [];
  const voice = data.analysis?.voice_summary || "";
  const preferences = data.preferences || {};
  const publicChatSettings = normalizePublicChatSettings(
    preferences.public_chat ?? preferences.publicChat
  );
  const roles: string[] = data.identity?.roles || [];
  const sourceCount = data.sources?.length || Object.keys(data.identity?.links || {}).length || 0;
  const projectCount = data.now?.projects?.length || 0;

  return (
    <OwnerContext.Provider value={isOwner}>
    <div className={`profile-page ${rootMinH} flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]`}>

      <ProfileHeader username={username} />

      {/* ═══ OWNER VIEW MODE TOGGLE ═══ */}
      {isOwner && (
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="max-w-[680px] w-full px-4 md:px-6">
            <div
              className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-1 inline-flex gap-1 font-mono text-[11px]"
              style={{ borderRadius: "var(--radius)" }}
            >
              {(["public", "private", "agent"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  aria-label={`view ${mode === "agent" ? "agent preview" : mode} mode`}
                  className={`px-3 py-1.5 transition-colors ${
                    viewMode === mode
                      ? "border border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]"
                      : "border border-transparent text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80"
                  }`}
                  style={{ borderRadius: "var(--radius)" }}
                >
                  {mode === "agent" ? "agent preview" : mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ASCII Portrait Header — full-width above content */}
      {(resolvedAvatarUrl || storedPortrait) && viewMode !== "agent" && (() => {
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full flex justify-center pt-4 pb-2"
          >
            <div className="max-w-[680px] w-full px-4 md:px-6">
              <AsciiAvatar
                src={resolvedAvatarUrl || storedPortrait?.sourceUrl || `profile:${username}`}
                cols={140}
                canvasWidth={680}
                className="w-full opacity-80"
                preRendered={storedPortrait}
                fallback={
                  <div
                    className="flex min-h-[180px] items-center justify-center border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/35"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    portrait refresh queued
                  </div>
                }
              />
            </div>
          </motion.div>
        );
      })()}

      <MainEl className="flex-1 max-w-[680px] mx-auto w-full px-4 md:px-6 pb-20 relative z-10">

        {/* ═══ AGENT PREVIEW MODE ═══ */}
        {viewMode === "agent" ? (
          <AgentPreviewPane
            username={username}
            agentPreview={agentPreview}
            agentPreviewLoading={agentPreviewLoading}
          />
        ) : (
        <>

        {/* ═══ SYSTEM HEADER ═══ */}
        <motion.section {...delay(0)} className="mt-4 mb-6">
          {/* Name + real photo + tagline */}
          <div className="flex items-end gap-4 mb-4">
            <ProfilePortrait
              username={username}
              name={name as string}
              avatarUrl={resolvedAvatarUrl}
              asciiPortrait={storedPortrait}
              className="h-16 w-16 md:h-20 md:w-20"
              cols={40}
              canvasWidth={80}
              showPhotoOnHover
            />
            <div className="pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[hsl(var(--text-primary))] font-mono text-lg md:text-xl font-medium tracking-tight truncate">{name}</h1>
                {verifications && verifications.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[hsl(var(--success))] opacity-80 shrink-0" title={`Verified via: ${verifications.map((v: { method: string; platform?: string }) => v.platform ? `${v.method}:${v.platform}` : v.method).join(", ")}`}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                    [verified]
                  </span>
                )}
              </div>
              {tagline && <p className="text-[hsl(var(--text-secondary))] text-[13px] md:text-[12px] mt-0.5 truncate opacity-90 md:opacity-100">{tagline}</p>}
              {verifications && verifications.length > 0 && (
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {verifications.map((v: { _id: string; method: string; platform?: string }) => (
                    <span
                      key={v._id}
                      className="inline-flex items-center gap-1 text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-40 border border-[hsl(var(--border))] px-1.5 py-0.5"
                      style={{ borderRadius: "var(--radius)" }}
                    >
                      {v.platform ? `${v.method}:${v.platform}` : v.method}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Social proof row ─────────────────────────────── */}
          <SocialProofRow
            stats={publicStats ?? null}
            updatedAt={"updatedAt" in resolvedProfile ? (resolvedProfile.updatedAt as number | null) : null}
            verifiedCount={verifications ? verifications.length : 0}
          />

          {/* Status panel */}
          <div className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] space-y-1.5" style={{ borderRadius: "var(--radius)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-[hsl(var(--accent))] font-mono text-[12px] hover:opacity-80 transition-opacity">
                  you.md/{username}
                  {copied ? (
                    <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor" className="text-[hsl(var(--success))]">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className={`font-mono text-[10px] px-1.5 py-0.5 border transition-colors ${
                    showRawJson
                      ? "border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5"
                      : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-50 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30"
                  }`}
                  style={{ borderRadius: "var(--radius)" }}
                  title={showRawJson ? "show rendered profile" : "show raw JSON"}
                >
                  {"<>"}
                </button>
              </div>
              <span className="font-mono text-[10px] text-[hsl(var(--success))] uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] status-dot-pulse" />
                active
              </span>
            </div>
            {location && (
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 flex items-center gap-1">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {location}
              </p>
            )}
            <p className="font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-50">@{username}</span>
              {"updatedAt" in resolvedProfile && resolvedProfile.updatedAt && (
                <span className="text-[hsl(var(--text-secondary))] opacity-30 ml-2 text-[10px]">
                  updated {formatRelativeTime(resolvedProfile.updatedAt as number)}
                </span>
              )}
            </p>
            {/* Metrics row */}
            {(sourceCount > 0 || topics.length > 0 || projectCount > 0) && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[hsl(var(--border))]/30">
                {sourceCount > 0 && (
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
                    {sourceCount} source{sourceCount !== 1 ? "s" : ""}
                  </span>
                )}
                {topics.length > 0 && (
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
                    {topics.length} topic{topics.length !== 1 ? "s" : ""}
                  </span>
                )}
                {projectCount > 0 && (
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
                    {projectCount} project{projectCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
            {/* Role badges */}
            {roles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {roles.map((role: string) => (
                  <span key={role} className="font-mono text-[9px] px-1.5 py-0.5 border border-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] opacity-60" style={{ borderRadius: "var(--radius)" }}>
                    {role}
                  </span>
                ))}
              </div>
            )}
          </div>

          {!showRawJson && publicChatSettings.enabled && (
            <div className="mt-3">
              <PublicProfileChatBox
                username={username}
                name={name as string}
                settings={publicChatSettings}
              />
            </div>
          )}
        </motion.section>

        {/* ═══ FOR AGENTS (prominent, above the fold) ═══ */}
        {!showRawJson && (
          <motion.section
            {...delay(1)}
            id="for-agents"
            className="mb-6 scroll-mt-20"
          >
            <div
              className="relative border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/[0.03] p-4 font-mono text-[11px]"
              style={{ borderRadius: "var(--radius)" }}
            >
              {/* Accent stripe */}
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[hsl(var(--accent))]/60" />

              {/* Header row: AGENT-READY tag + label */}
              <div className="flex items-center justify-between mb-3 pl-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-[hsl(var(--accent))] font-medium border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 px-1.5 py-0.5" style={{ borderRadius: "var(--radius)" }}>
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] status-dot-pulse" />
                    agent brain
                  </span>
                  <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
                    public brain endpoints + optional public stacks
                  </span>
                </div>
              </div>

              {/* Endpoints */}
              <div className="pl-2 space-y-1">
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px]">public brain endpoints (no JS required):</p>
                <div className="flex items-center gap-2">
                  <p className="text-[hsl(var(--accent))]">GET you.md/{username}/you.json</p>
                  <CopyButton
                    text={`https://you.md/${username}/you.json`}
                    className="text-[9px] font-mono px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[hsl(var(--accent))] opacity-70">GET you.md/{username}/you.txt</p>
                  <CopyButton
                    text={`https://you.md/${username}/you.txt`}
                    className="text-[9px] font-mono px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
                  />
                </div>

                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">preferred retrieval order:</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">1. /{username}/you.json -- structured public brain</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">2. /{username}/you.txt -- plain text markdown</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">3. public YouStacks below -- installable expertise packages when exposed</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">4. protected API/MCP -- private memory, tokens, and connected tools by grant</p>

                {voice && (
                  <>
                    <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">voice:</p>
                    <p className="text-[hsl(var(--text-secondary))] opacity-70">{voice}</p>
                  </>
                )}
                {preferences?.agent?.tone && (
                  <>
                    <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">tone:</p>
                    <p className="text-[hsl(var(--text-secondary))] opacity-70">{preferences.agent.tone}</p>
                  </>
                )}
                {preferences?.agent?.avoid?.length > 0 && (
                  <>
                    <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">avoid:</p>
                    <p className="text-[hsl(var(--text-secondary))] opacity-70">{preferences.agent.avoid.join(", ")}</p>
                  </>
                )}
              </div>
            </div>
          </motion.section>
        )}

        <Divider />

        {/* ═══ RAW JSON VIEW ═══ */}
        {showRawJson ? (
          <motion.section {...delay(1)}>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel>raw you.json</SectionLabel>
              <button
                onClick={handleCopyRawJson}
                className="flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
              >
                {rawCopied ? "copied" : "copy"}
              </button>
            </div>
            <div
              className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4 overflow-x-auto"
              style={{ borderRadius: "var(--radius)" }}
            >
              <RawJsonRenderer json={data} />
            </div>
          </motion.section>
        ) : (
          <>
            {/* ═══ IDENTITY ═══ */}
            <motion.section {...delay(1)}>
              <SectionLabel editKey="identity">identity</SectionLabel>
              {bio && (
                <p className="text-[hsl(var(--text-secondary))] text-[14px] leading-[1.7] mt-3 mb-4 opacity-90 md:opacity-100">
                  <RenderInlineMarkdown text={bio} />
                </p>
              )}
              {topics.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {topics.map((t: string) => (
                    <span key={t} className="font-mono text-[10px] px-2 py-0.5 border border-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]/70" style={{ borderRadius: "var(--radius)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {/* Credibility signals — subtle list under identity */}
              {data.analysis?.credibility_signals && data.analysis.credibility_signals.length > 0 && (
                <div className="mt-4 space-y-1">
                  {data.analysis.credibility_signals.map((signal: string, i: number) => (
                    <p key={i} className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[10px] flex items-center gap-1.5">
                      <span className="text-[hsl(var(--accent))] opacity-50">--</span>
                      {signal}
                    </p>
                  ))}
                </div>
              )}
            </motion.section>

            {/* ═══ VOICE ═══ */}
            {(data.analysis?.voice_summary || data.voice?.overall) && (
              <>
                <Divider />
                <motion.section {...delay(2)}>
                  <SectionLabel editKey="voice">voice</SectionLabel>
                  <div className="mt-3 space-y-3">
                    {(data.analysis?.voice_summary || data.voice?.overall) && (
                      <p className="text-[hsl(var(--text-secondary))] text-[13px] leading-[1.7]">
                        {data.analysis?.voice_summary || data.voice?.overall}
                      </p>
                    )}
                    {/* Per-platform voice breakdown */}
                    {data.voice?.platforms && (
                      <div className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] space-y-2" style={{ borderRadius: "var(--radius)" }}>
                        {data.voice.platforms.linkedin && (
                          <div>
                            <span className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-60 uppercase tracking-wider">linkedin</span>
                            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px] mt-0.5">{data.voice.platforms.linkedin}</p>
                          </div>
                        )}
                        {data.voice.platforms.x && (
                          <div>
                            <span className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-60 uppercase tracking-wider">x / twitter</span>
                            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px] mt-0.5">{data.voice.platforms.x}</p>
                          </div>
                        )}
                        {data.voice.platforms.blog && (
                          <div>
                            <span className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-60 uppercase tracking-wider">blog</span>
                            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px] mt-0.5">{data.voice.platforms.blog}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ NOW ═══ */}
            {data.now?.focus && data.now.focus.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(3)}>
                  <SectionLabel editKey="now">current activity</SectionLabel>
                  <div className="mt-3">
                    {data.now.focus.map((item: string, i: number) => (
                      <p key={i} className="text-[hsl(var(--text-secondary))] font-mono text-[12px] leading-relaxed">- {item}</p>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ PROJECTS ═══ */}
            {data.projects && data.projects.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(4)}>
                  <SectionLabel editKey="projects">projects</SectionLabel>
                  <div className="grid gap-2 mt-3">
                    {data.projects
                      .filter((p: Project) => p.name && !p.name.startsWith("#"))
                      .map((project: Project, i: number) => (
                      <div
                        key={i}
                        className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] hover:border-[hsl(var(--accent))]/20 transition-colors group"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[13px] text-[hsl(var(--text-primary))]">{cleanMarkdown(project.name)}</span>
                            {project.status && (
                              <span className={`font-mono text-[9px] uppercase tracking-wider ${statusColor(project.status)}`}>
                                {project.status}
                              </span>
                            )}
                          </div>
                          {project.url && (
                            <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--text-secondary))] opacity-30 group-hover:text-[hsl(var(--accent))] transition-colors shrink-0 text-xs">
                              {"\u2197"}
                            </a>
                          )}
                        </div>
                        {project.role && (
                          <span className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[10px]">{cleanMarkdown(project.role)}</span>
                        )}
                        {project.description && (
                          <p className="text-[hsl(var(--text-secondary))] opacity-60 text-[12px] mt-1.5 leading-relaxed">
                            <RenderInlineMarkdown text={project.description} />
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ VALUES ═══ */}
            {data.values && data.values.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(5)}>
                  <SectionLabel editKey="values">values</SectionLabel>
                  <div className="space-y-0.5 mt-3">
                    {data.values.map((value: string, i: number) => (
                      <p key={i} className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[11px]">{"\u203A"} {value}</p>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ LINKS ═══ */}
            {data.links && Object.keys(data.links).some((k: string) => data.links[k]) && (
              <>
                <Divider />
                <motion.section {...delay(6)}>
                  <SectionLabel editKey="links">links</SectionLabel>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.entries(data.links)
                      .filter(([, url]) => url)
                      .map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))]/80 hover:text-[hsl(var(--accent))] font-mono text-[11px] transition-colors border border-[hsl(var(--border))] px-3 py-1.5 hover:border-[hsl(var(--accent))]/30"
                        >
                          <LinkFavicon url={url as string} />
                          {platform}
                          <span className="text-[9px] opacity-50">{"\u2197"}</span>
                        </a>
                      ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ CONNECTED SOURCES ═══ */}
            {data.meta?.sources_used && data.meta.sources_used.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(7)}>
                  <SectionLabel editKey="sources">connected sources</SectionLabel>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {data.meta.sources_used.map((source: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] opacity-60" />
                        {source}
                      </span>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ SKILLS ═══ */}
            {data.identity?.skills && (Array.isArray(data.identity.skills) ? data.identity.skills.length > 0 : true) && (
              <>
                <Divider />
                <motion.section {...delay(8)}>
                  <SectionLabel editKey="skills">skills</SectionLabel>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(Array.isArray(data.identity.skills)
                      ? data.identity.skills
                      : typeof data.identity.skills === "string"
                        ? data.identity.skills.split(",").map((s: string) => s.trim())
                        : []
                    ).map((skill: string, i: number) => (
                      <span
                        key={i}
                        className="font-mono text-[10px] px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-60"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {visibleProfileStacks.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(8)}>
                  <SectionLabel editKey="youstacks">public youstacks</SectionLabel>
                  <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                    Public stacks are installable expertise packages. Private
                    brain, secrets, and connected actions stay behind scoped
                    You.md API/MCP grants.
                  </p>
                  <div className="mt-3 space-y-2">
                    {visibleProfileStacks.map((stack) => (
                      <div
                        key={stack.slug}
                        className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3"
                        style={{ borderRadius: "var(--radius)" }}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-85">
                              {stack.name}
                            </p>
                            <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                              {stack.slug}{stack.domain ? ` / ${stack.domain}` : ""}
                            </p>
                          </div>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--accent))] opacity-70">
                            {stack.visibility || "private"}
                          </span>
                        </div>
                        {stack.description && (
                          <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-60">
                            {stack.description}
                          </p>
                        )}
                        {stack.skills && stack.skills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {stack.skills.map((skill) => (
                              <span
                                key={skill}
                                className="border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        {stack.install && stack.visibility === "public-open" && (
                          <code className="mt-2 block break-all font-mono text-[10px] text-[hsl(var(--accent))] opacity-80">
                            {stack.install}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {repoStacks && repoStacks.stacks.length > 0 && (
              <>
                <Divider />
                <motion.section {...delay(8)}>
                  <SectionLabel editKey="youstacks">stacks in their repo</SectionLabel>
                  <p className="mt-2 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                    Hosted in{" "}
                    <a
                      href={repoStacks.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[hsl(var(--accent))] opacity-80 hover:opacity-100"
                    >
                      {repoStacks.repoFullName}
                    </a>
                    {" "}— this user keeps their You.md and stacks in their own GitHub repo.
                  </p>
                  <div className="mt-3 space-y-2">
                    {repoStacks.stacks.map((stack) => (
                      <a
                        key={stack.slug}
                        href={`${repoStacks.repoUrl}/tree/HEAD/stacks/${stack.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 hover:border-[hsl(var(--accent))] transition-colors"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-85">
                            {stack.slug}
                          </p>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--accent))] opacity-70">
                            {stack.hasManifest ? "youstack" : "files"}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                          {stack.fileCount} file{stack.fileCount === 1 ? "" : "s"}
                        </p>
                      </a>
                    ))}
                  </div>
                </motion.section>
              </>
            )}

            {/* ═══ CUSTOM SECTIONS ═══ */}
            {data.custom_sections && Array.isArray(data.custom_sections) && data.custom_sections.length > 0 && (
              <>
                {(data.custom_sections as Array<{ id: string; title: string; content: string }>).map((cs, idx) => (
                  <div key={cs.id}>
                    <Divider />
                    <motion.section {...delay(8 + idx)}>
                      <SectionLabel editKey={`custom:${cs.id}`}>{cs.title.toLowerCase()}</SectionLabel>
                      <div className="text-[hsl(var(--text-secondary))] text-[14px] leading-[1.7] mt-3 whitespace-pre-wrap">
                        {cs.content}
                      </div>
                    </motion.section>
                  </div>
                ))}
              </>
            )}

            {/* ═══ EXPORT ═══ */}
            <Divider />
            <motion.section {...delay(9)}>
              <SectionLabel>export</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => {
                    const json = generateYouJson({
                      username,
                      name: name as string,
                      youJson: data,
                      isClaimed: resolvedProfile.isClaimed,
                      avatarUrl: resolvedAvatarUrl,
                    });
                    downloadFile(JSON.stringify(json, null, 2), `${username}.you.json`, "application/json");
                  }}
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  {"\u2193"} you.json
                </button>
                <button
                  onClick={() => {
                    const md = generateYouMd({ username, name: name as string, youJson: data });
                    downloadFile(md, `${username}.you.md`, "text/markdown");
                  }}
                  className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  {"\u2193"} you.md
                </button>
              </div>
            </motion.section>

            {/* ═══ SHARE ═══ */}
            <Divider />
            <motion.section {...delay(10)}>
              <SectionLabel>share</SectionLabel>
              <div className="flex items-center gap-2 mt-3">
                <CopyButton
                  text={`https://you.md/${username}`}
                  className="text-[10px] font-mono px-2.5 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                />
                <a
                  href={`https://x.com/intent/tweet?text=${encodeURIComponent(`my public agent brain and stacks: https://you.md/${username}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono px-2.5 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
                >
                  share on x
                </a>
              </div>
            </motion.section>

            {/* ═══ MAINTENANCE ═══ */}
            <Divider />
            <motion.section {...delay(11)}>
              <SectionLabel>maintenance</SectionLabel>
              <div className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] mt-3 space-y-1.5 font-mono text-[10px]" style={{ borderRadius: "var(--radius)" }}>
                <p className="text-[hsl(var(--text-secondary))] opacity-50">
                  maintained by: <span className="text-[hsl(var(--text-primary))] opacity-70">human + agent</span>
                </p>
                {data.meta?.last_updated && (
                  <p className="text-[hsl(var(--text-secondary))] opacity-50">
                    last updated: <span className="text-[hsl(var(--text-primary))] opacity-70">{formatTimestamp(data.meta.last_updated)}</span>
                  </p>
                )}
                {data.meta?.compiler_version && (
                  <p className="text-[hsl(var(--text-secondary))] opacity-50">
                    compiler: <span className="text-[hsl(var(--text-primary))] opacity-70">v{data.meta.compiler_version}</span>
                  </p>
                )}
                {data.schema && (
                  <p className="text-[hsl(var(--text-secondary))] opacity-50">
                    schema: <span className="text-[hsl(var(--text-primary))] opacity-70">{data.schema}</span>
                  </p>
                )}
              </div>
            </motion.section>
          </>
        )}

        {/* ═══ PRIVATE CONTEXT (owner only, private mode) ═══ */}
        {viewMode === "private" && isOwner && (
          <PrivateContextPane privateContext={privateContext} />
        )}

        {/* CTA for non-owners */}
        {!isOwner && (
          <motion.div {...delay(12)} className="mt-12 text-center">
            <p className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-40">
              want your own agent brain?
            </p>
            {/* Cycle 63: was an inline link inside the paragraph at 92x14.
                Promoted to a standalone block link with min-h-[44px] tap target. */}
            <Link
              href="/create"
              className="inline-flex items-center justify-center min-h-[44px] mt-2 px-4 text-[hsl(var(--accent))] opacity-80 hover:opacity-100 transition-opacity font-mono text-[11px]"
            >
              &gt; create yours
            </Link>
          </motion.div>
        )}

        {/* Footer tagline */}
        <motion.div {...delay(13)} className="text-center mt-16 space-y-2">
          <p className="text-[hsl(var(--text-secondary))] opacity-30 font-mono text-[9px]">
            updated by the human. maintained by the system.
          </p>
        </motion.div>

        </>
        )}
      </MainEl>

      <ProfileFooter />

      {/* Claim banner for unclaimed profiles — fixed overlay, suppressed in preview */}
      {!preview && !resolvedProfile.isClaimed && <ClaimBanner username={username} />}
    </div>
    </OwnerContext.Provider>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

interface SocialProofRowProps {
  stats: { totalViews: number; agentReads: number; webViews: number } | null;
  updatedAt: number | null;
  verifiedCount: number;
}

function SocialProofRow({ stats, updatedAt, verifiedCount }: SocialProofRowProps) {
  // Hide entirely when there's nothing meaningful to render
  const hasViews = stats && stats.totalViews > 0;
  const hasAgentReads = stats && stats.agentReads > 0;
  const hasUpdated = !!updatedAt;
  const hasVerified = verifiedCount > 0;

  if (!hasViews && !hasAgentReads && !hasUpdated && !hasVerified) return null;

  const items: React.ReactNode[] = [];

  if (hasViews) {
    items.push(
      <span key="views" className="text-[hsl(var(--text-secondary))]">
        {stats.totalViews} view{stats.totalViews !== 1 ? "s" : ""}
      </span>
    );
  }
  if (hasAgentReads) {
    items.push(
      <span key="agent" className="text-[hsl(var(--text-secondary))]">
        {stats.agentReads} agent read{stats.agentReads !== 1 ? "s" : ""}
      </span>
    );
  }
  if (hasUpdated) {
    items.push(
      <span key="updated" className="text-[hsl(var(--text-secondary))]">
        updated {formatRelativeTime(updatedAt)}
      </span>
    );
  }
  if (hasVerified) {
    items.push(
      <span key="verified" className="text-[hsl(var(--success))] inline-flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
        verified
      </span>
    );
  }

  return (
    <div className="font-mono text-[10px] opacity-60 mb-3 flex items-center gap-2 flex-wrap">
      {items.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span className="text-[hsl(var(--text-secondary))]/40">{"\u00B7"}</span>}
          {node}
        </span>
      ))}
    </div>
  );
}

function ProfileHeader({ username }: { username: string }) {
  return (
    <header className="border-b border-[hsl(var(--border))] shrink-0">
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link
          href={`/${username}`}
          className="font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
        >
          you.md/{username}
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/profiles" className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[10px] hover:text-[hsl(var(--accent))] transition-colors">
            /profiles
          </Link>
          <Link href="/" className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[10px] hover:opacity-70 transition-opacity">
            what is this?
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProfileFooter() {
  return (
    <footer className="border-t border-[hsl(var(--border))] shrink-0">
      {/* Cycle 63: bumped both inline-text links to min-h-[44px] standalone tap targets. */}
      <div className="max-w-[680px] mx-auto px-6 py-4 text-center flex items-center justify-center gap-2 flex-wrap">
        <span className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30 uppercase tracking-widest">
          powered by
        </span>
        <Link
          href="/"
          className="inline-flex items-center min-h-[44px] px-3 text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity font-mono text-[10px] uppercase tracking-widest"
        >
          you.md
        </Link>
        <Link
          href="/create"
          className="inline-flex items-center min-h-[44px] px-3 text-[hsl(var(--text-secondary))] opacity-30 font-mono text-[10px] hover:text-[hsl(var(--accent))] transition-colors"
        >
          &gt; create yours
        </Link>
      </div>
    </footer>
  );
}

function ClaimBanner({ username }: { username: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3">
      <div className="max-w-[680px] mx-auto">
        <div className="border border-[hsl(var(--accent))]/30 bg-[hsl(var(--bg-raised))] p-3 sm:p-4" style={{ borderRadius: "var(--radius)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80">
                this profile is unclaimed
              </p>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mt-0.5">
                sign in to claim @{username} and unlock editing + private context
              </p>
            </div>
            <Link
              href="/sign-up"
              className="shrink-0 font-mono text-[11px] px-3 py-1.5 bg-[hsl(var(--accent))] text-[hsl(var(--bg))] hover:opacity-90 transition-opacity"
            >
              claim profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  editKey,
}: {
  children: React.ReactNode;
  /** When set and the viewer is the profile owner, render a small pencil
   *  icon that links to /shell?tab=files&section=<editKey> */
  editKey?: string;
}) {
  const isOwner = useContext(OwnerContext);
  return (
    <h2 className="group text-[hsl(var(--accent))] font-mono text-[10px] uppercase tracking-widest flex items-center gap-3 my-1">
      {/* Cycle 69: aria-hidden on the decorative ── lead-in. The dashes
          render at border color (1.43:1 vs bg), which fails WCAG SC 1.4.3
          when treated as text. They're purely visual section dividers, so
          the right fix is to remove them from the a11y tree, not recolor. */}
      <span className="text-[hsl(var(--border))]" aria-hidden="true">{"\u2500\u2500"}</span>
      {children}
      {isOwner && editKey && (
        <Link
          href={`/shell?tab=files&section=${encodeURIComponent(editKey)}`}
          aria-label={`edit ${editKey}`}
          title={`edit ${editKey}`}
          className="opacity-0 group-hover:opacity-80 focus:opacity-100 transition-opacity duration-150 text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] inline-flex items-center justify-center min-w-[24px] min-h-[24px] -my-1 text-[12px] leading-none"
        >
          {"\u270E"}
        </Link>
      )}
      <span className="flex-1 h-px bg-[hsl(var(--border))]" />
    </h2>
  );
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] my-8" />;
}

/** Strip markdown syntax from plain text (for names, roles, etc.) */
function cleanMarkdown(text: string): string {
  return text
    .replace(/^#+\s*/gm, "")      // # headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/\*(.+?)\*/g, "$1")     // *italic*
    .replace(/`([^`]+)`/g, "$1")     // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
    .trim();
}

/** Render inline markdown as React elements (for descriptions) */
function RenderInlineMarkdown({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const match = remaining.match(/(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/);
    if (!match || match.index === undefined) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }

    if (match.index > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, match.index)}</span>);
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <span key={key++} className="text-[hsl(var(--text-primary))] opacity-80 font-medium">
          {match[2]}
        </span>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={key++} className="opacity-80">{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      parts.push(
        <code key={key++} className="px-1 py-0.5 text-[11px] bg-[hsl(var(--bg))]/50 text-[hsl(var(--accent-mid))] border border-[hsl(var(--border))]" style={{ borderRadius: "var(--radius)" }}>
          {match[4]}
        </code>
      );
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  return <>{parts}</>;
}

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function LinkFavicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const domain = extractDomain(url);
  if (!domain || failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      className="shrink-0"
      style={{ imageRendering: "pixelated" }}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function formatTimestamp(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return ts;
  }
}

/**
 * Renders JSON with syntax highlighting using the design system colors.
 * Keys in accent color, strings dimmed, numbers/booleans in primary.
 */
function RawJsonRenderer({ json }: { json: Record<string, unknown> }) {
  const renderValue = (value: unknown, indent: number): React.ReactNode => {
    if (value === null) {
      return <span className="text-[hsl(var(--text-secondary))] opacity-40">null</span>;
    }

    if (typeof value === "string") {
      return <span className="text-[hsl(var(--text-secondary))] opacity-60">&quot;{value}&quot;</span>;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return <span className="text-[hsl(var(--text-primary))] opacity-80">{String(value)}</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-[hsl(var(--text-secondary))] opacity-40">[]</span>;
      const pad = " ".repeat(indent + 2);
      const closePad = " ".repeat(indent);
      return (
        <>
          <span className="text-[hsl(var(--text-secondary))] opacity-40">[</span>
          {"\n"}
          {value.map((item, i) => (
            <span key={i}>
              {pad}{renderValue(item, indent + 2)}
              {i < value.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {closePad}<span className="text-[hsl(var(--text-secondary))] opacity-40">]</span>
        </>
      );
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) return <span className="text-[hsl(var(--text-secondary))] opacity-40">{"{}"}</span>;
      const pad = " ".repeat(indent + 2);
      const closePad = " ".repeat(indent);
      return (
        <>
          <span className="text-[hsl(var(--text-secondary))] opacity-40">{"{"}</span>
          {"\n"}
          {entries.map(([key, val], i) => (
            <span key={key}>
              {pad}<span className="text-[hsl(var(--accent))]">&quot;{key}&quot;</span>
              <span className="text-[hsl(var(--text-secondary))] opacity-40">: </span>
              {renderValue(val, indent + 2)}
              {i < entries.length - 1 ? "," : ""}
              {"\n"}
            </span>
          ))}
          {closePad}<span className="text-[hsl(var(--text-secondary))] opacity-40">{"}"}</span>
        </>
      );
    }

    return <span className="text-[hsl(var(--text-secondary))] opacity-40">{String(value)}</span>;
  };

  return (
    <pre className="font-mono text-[11px] leading-[1.6] whitespace-pre overflow-x-auto">
      {renderValue(json, 0)}
    </pre>
  );
}

/* ── Agent Preview Pane ────────────────────────────────────── */

function AgentPreviewPane({
  username,
  agentPreview,
  agentPreviewLoading,
}: {
  username: string;
  agentPreview: string | null;
  agentPreviewLoading: boolean;
}) {
  return (
    <div className="mt-6">
      <h2 className="text-[hsl(var(--accent))] font-mono text-[11px] uppercase tracking-wider mb-3">
        &gt; agent preview
      </h2>
      <p className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[10px] mb-4">
        this is what agents see when they fetch you.md/{username}/you.txt
      </p>
      <div
        className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] overflow-hidden"
        style={{ borderRadius: "var(--radius)" }}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--border))]">
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
            GET /{username}/you.txt
          </span>
          <span className="font-mono text-[9px] text-[hsl(var(--success))] opacity-60 ml-auto">
            200 OK
          </span>
        </div>
        <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto">
          {agentPreviewLoading ? (
            <p className="text-[hsl(var(--text-secondary))] font-mono text-[11px] animate-pulse">
              fetching agent view...
            </p>
          ) : (
            <pre className="font-mono text-[11px] leading-[1.7] text-[hsl(var(--text-secondary))] opacity-80 whitespace-pre-wrap">
              {agentPreview}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Private Context Pane ──────────────────────────────────── */

interface PrivateProject {
  name?: string;
  description?: string;
  status?: string;
  url?: string;
  [key: string]: unknown;
}

function PrivateContextPane({
  privateContext,
}: {
  privateContext: {
    privateNotes?: string | null;
    privateProjects?: PrivateProject[] | null;
    internalLinks?: Record<string, string> | null;
    calendarContext?: string | null;
    communicationPrefs?: Record<string, unknown> | null;
    investmentThesis?: string | null;
    customData?: unknown;
  } | null | undefined;
}) {
  if (privateContext === undefined) {
    return (
      <>
        <Divider />
        <div className="mt-2">
          <SectionLabel>private context</SectionLabel>
          <p className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[11px] mt-3 animate-pulse">
            loading private data...
          </p>
        </div>
      </>
    );
  }

  const hasContent = privateContext && (
    privateContext.privateNotes ||
    (privateContext.privateProjects && privateContext.privateProjects.length > 0) ||
    (privateContext.internalLinks && Object.keys(privateContext.internalLinks).length > 0) ||
    privateContext.calendarContext ||
    privateContext.investmentThesis
  );

  return (
    <>
      <Divider />
      <div
        className="border-l-2 border-[hsl(var(--accent))]/40 pl-4 mt-2"
      >
        <div className="flex items-center gap-2 mb-4">
          <SectionLabel>private context</SectionLabel>
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 border border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] opacity-70 uppercase tracking-wider"
            style={{ borderRadius: "var(--radius)" }}
          >
            private
          </span>
        </div>

        {!hasContent ? (
          <div
            className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4"
            style={{ borderRadius: "var(--radius)" }}
          >
            <p className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[11px]">
              no private context yet. add private notes, projects, and links from your dashboard.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Private Notes */}
            {privateContext.privateNotes && (
              <div>
                <h3 className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[10px] uppercase tracking-wider mb-2">
                  notes
                </h3>
                <div
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <p className="text-[hsl(var(--text-secondary))] opacity-70 text-[13px] leading-[1.7] whitespace-pre-wrap">
                    {privateContext.privateNotes}
                  </p>
                </div>
              </div>
            )}

            {/* Private Projects */}
            {privateContext.privateProjects && privateContext.privateProjects.length > 0 && (
              <div>
                <h3 className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[10px] uppercase tracking-wider mb-2">
                  private projects
                </h3>
                <div className="grid gap-2">
                  {privateContext.privateProjects.map((project: PrivateProject, i: number) => (
                    <div
                      key={i}
                      className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                      style={{ borderRadius: "var(--radius)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">
                          {project.name || "untitled"}
                        </span>
                        {project.status && (
                          <span className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-60 uppercase">
                            {project.status}
                          </span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[11px] mt-1">
                          {project.description}
                        </p>
                      )}
                      {project.url && (
                        <a
                          href={project.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[hsl(var(--accent))] opacity-60 font-mono text-[10px] mt-1 inline-block hover:opacity-100 transition-opacity"
                        >
                          {project.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Internal Links */}
            {privateContext.internalLinks && Object.keys(privateContext.internalLinks).length > 0 && (
              <div>
                <h3 className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[10px] uppercase tracking-wider mb-2">
                  internal links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(privateContext.internalLinks as Record<string, string>).map(
                    ([label, url]) => (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))]/70 hover:text-[hsl(var(--accent))] font-mono text-[11px] transition-colors border border-[hsl(var(--border))] px-3 py-1.5 hover:border-[hsl(var(--accent))]/30"
                      >
                        {label}
                        <span className="text-[9px] opacity-50">{"\u2197"}</span>
                      </a>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Calendar Context */}
            {privateContext.calendarContext && (
              <div>
                <h3 className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[10px] uppercase tracking-wider mb-2">
                  calendar context
                </h3>
                <div
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <p className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[11px] whitespace-pre-wrap">
                    {privateContext.calendarContext}
                  </p>
                </div>
              </div>
            )}

            {/* Investment Thesis */}
            {privateContext.investmentThesis && (
              <div>
                <h3 className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[10px] uppercase tracking-wider mb-2">
                  investment thesis
                </h3>
                <div
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <p className="text-[hsl(var(--text-secondary))] opacity-60 text-[12px] leading-[1.7] whitespace-pre-wrap">
                    {privateContext.investmentThesis}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
