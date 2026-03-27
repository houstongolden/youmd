"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { CopyableLink, CopyableCommand } from "./CopyableCommand";

interface SharePaneProps {
  username: string;
  userId?: Id<"users">;
  clerkId: string;
  profileId?: Id<"profiles">;
  plan: string;
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

// Extract username from a you.md URL (public or context link)
function usernameFromUrl(url: string): string | null {
  const m = url.match(/you\.md\/([^/]+)/);
  return m ? m[1] : null;
}

function backupUrls(url: string): { json: string; txt: string } {
  const u = usernameFromUrl(url);
  if (u && !url.includes("/ctx/")) {
    return {
      json: `https://you.md/${u}/you.json`,
      txt: `https://you.md/${u}/you.txt`,
    };
  }
  // For context links, the URL itself works — no backup needed
  return { json: url, txt: url };
}

// Response directive — tells the receiving agent exactly how to use the identity context
const RESPONSE_DIRECTIVE = `After reading my identity context, respond with:
1. Confirm what you learned — name, role, key projects, and any preferences that affect how you work with me
2. Note anything you'll adjust based on my preferences (tone, formality, things to avoid)
3. If any context seems outdated or contradictory, flag it
4. Save or persist my identity context for the duration of our conversation — reference it naturally, don't ask me to re-explain things that are in my profile
5. Then ask what I need help with today`;

const PROMPT_TEMPLATES: { agent: string; icon: string; prompt: (url: string) => string }[] = [
  {
    agent: "Universal",
    icon: "[*]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Fetch this URL and load my identity context before we start:\n${url}\n\nIt returns plain text (not HTML) -- my you.md identity context with bio, projects, values, preferences, and communication style.\n\nIf the URL above fails to load, use one of these direct endpoints instead:\n- JSON: ${b.json}\n- Plain text: ${b.txt}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
  {
    agent: "Claude",
    icon: "[cl]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Before responding, fetch and read my identity context from this URL:\n${b.txt}\n\nThe URL returns plain text (not a webpage). It's my you.md identity context.\n\nAlternative endpoint (JSON): ${b.json}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
  {
    agent: "ChatGPT",
    icon: "[gp]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Before we begin, browse to this URL and read my you.md identity context:\n${b.txt}\n\nThis returns plain text (not a webpage) -- my identity context protocol.\n\nIf that URL doesn't load, try the JSON version: ${b.json}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
  {
    agent: "Gemini",
    icon: "[gm]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Fetch this URL and read my identity context before we start:\n${b.txt}\n\nThis is a plain-text endpoint (not a webpage) that returns my you.md identity context.\n\nAlternative URL (JSON format): ${b.json}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
  {
    agent: "Cursor",
    icon: "[|>]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Fetch this URL and load my developer identity context:\n${b.txt}\n\nIt returns plain text with my tech stack, projects, coding preferences, and communication style.\n\nJSON endpoint: ${b.json}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
  {
    agent: "Copilot",
    icon: "[cp]",
    prompt: (url) => {
      const b = backupUrls(url);
      return `Fetch this URL and read my developer identity context before assisting:\n${b.txt}\n\nThis returns plain-text identity context with my projects, preferred technologies, and coding style.\n\nJSON endpoint: ${b.json}\n\n${RESPONSE_DIRECTIVE}`;
    },
  },
];

interface PreviewLink {
  token: string;
  scope: string;
  useCount: number;
  expiresAt: string;
  isExpired: boolean;
}

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
    return () => { cancelled = true; };
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
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80" />

      {/* Modal panel */}
      <div
        className="relative w-full max-w-2xl max-h-[80vh] mx-4 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] flex flex-col"
        style={{ borderRadius: "2px" }}
      >
        {/* Terminal 3-dot header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--accent))]/60" />
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--text-secondary))]/20" />
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--text-secondary))]/20" />
            <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
              link preview
            </span>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors px-1.5 py-0.5"
          >
            [esc]
          </button>
        </div>

        {/* Link metadata */}
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
          <div className="flex items-center gap-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
            <span>
              token: <span className="text-[hsl(var(--text-primary))] opacity-70">{link.token}</span>
            </span>
            <span>
              scope:{" "}
              <span
                className={
                  link.scope === "full"
                    ? "text-[hsl(var(--accent))]"
                    : "text-[hsl(var(--text-primary))] opacity-70"
                }
              >
                {link.scope}
              </span>
            </span>
            <span>
              uses: <span className="text-[hsl(var(--text-primary))] opacity-70">{link.useCount}</span>
            </span>
            <span>
              expires:{" "}
              <span className="text-[hsl(var(--text-primary))] opacity-70">
                {link.isExpired
                  ? "expired"
                  : typeof link.expiresAt === "string"
                    ? link.expiresAt === "never"
                      ? "never"
                      : link.expiresAt.split("T")[0]
                    : "never"}
              </span>
            </span>
          </div>
        </div>

        {/* Content area */}
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
              <p className="font-mono text-[11px] text-[hsl(var(--accent))]">
                error: {error}
              </p>
            </div>
          )}
          {content && (
            <pre className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap leading-relaxed">
              {content}
            </pre>
          )}
        </div>

        {/* Footer with copy button */}
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
              {copiedContent ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  copied
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  copy agent text
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function SharePane({ username, userId, clerkId, profileId, plan }: SharePaneProps) {
  const recentBundles = useQuery(
    api.bundles.listRecentBundles,
    userId ? { userId, limit: 3 } : "skip"
  );
  const links = useQuery(api.contextLinks.listLinks, clerkId ? { clerkId } : "skip");
  const createLink = useMutation(api.contextLinks.createLink);
  const revokeLink = useMutation(api.contextLinks.revokeLink);
  const agentStats = useQuery(
    api.private.getAgentStats,
    profileId ? { profileId } : "skip"
  );

  const [creating, setCreating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewLink, setPreviewLink] = useState<PreviewLink | null>(null);

  const liveBundle = recentBundles?.find((b) => b.isPublished);
  const publicUrl = `https://you.md/${username}`;

  const handleGenerateLink = async () => {
    setCreating(true);
    try {
      const result = await createLink({ clerkId, scope: "public", ttl: "7d" });
      setGeneratedUrl(result.url);
    } catch {
      // silently handle
    }
    setCreating(false);
  };

  const activeUrl = generatedUrl || publicUrl;
  const activePrompt = PROMPT_TEMPLATES[selectedTemplate].prompt(activeUrl);

  const hasRealStats = agentStats && agentStats.agents.length > 0;
  const totalInteractions = hasRealStats ? agentStats.totalInteractions : 0;
  const uniqueAgents = hasRealStats ? agentStats.uniqueAgents : 0;

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>share</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Publish status — compact */}
        <div
          className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))] mb-2"
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
                    v{liveBundle.version} -- {formatTime(liveBundle.publishedAt)}
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
                text={publicUrl}
                className="text-[9px] font-mono px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
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

        <Divider />

        {/* Share with any agent — THE hero section */}
        <SectionLabel>share your context with any agent</SectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 mb-3">
          copy your identity link + prompt and paste it into any AI conversation.
        </p>

        {/* Agent template selector */}
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {PROMPT_TEMPLATES.map((t, i) => (
            <button
              key={t.agent}
              onClick={() => setSelectedTemplate(i)}
              className={`px-2 py-1 text-[10px] font-mono border transition-colors ${
                selectedTemplate === i
                  ? "text-[hsl(var(--text-primary))] border-[hsl(var(--accent))]/40 bg-[hsl(var(--bg))]"
                  : "text-[hsl(var(--text-secondary))] opacity-30 border-[hsl(var(--border))] hover:opacity-60"
              }`}
              style={{ borderRadius: "2px" }}
            >
              <span className="text-[hsl(var(--accent))] opacity-70 mr-1">{t.icon}</span>
              {t.agent}
            </button>
          ))}
        </div>

        {/* The copyable prompt block */}
        <div
          className="border border-[hsl(var(--accent))]/20 bg-[hsl(var(--bg))] p-3 space-y-3"
          style={{ borderRadius: "2px" }}
        >
          <pre className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-70 whitespace-pre-wrap leading-relaxed select-all">
            {activePrompt}
          </pre>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(activePrompt);
                setCopiedPrompt(true);
                setTimeout(() => setCopiedPrompt(false), 2000);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-mono border transition-colors ${
                copiedPrompt
                  ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                  : "border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-wash))]"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {copiedPrompt ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  copied
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  copy prompt + link
                </>
              )}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeUrl);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className={`px-3 py-2 text-[11px] font-mono border transition-colors ${
                copiedLink
                  ? "border-[hsl(var(--success))]/40 text-[hsl(var(--success))] bg-[hsl(var(--success))]/5"
                  : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {copiedLink ? "copied" : "link only"}
            </button>
          </div>
        </div>

        {/* Generate a scoped/expiring link */}
        <div className="mt-3">
          <button
            onClick={handleGenerateLink}
            disabled={creating}
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors disabled:opacity-30"
            style={{ borderRadius: "2px" }}
          >
            {creating ? "creating..." : generatedUrl ? "generate another link" : "generate expiring link (7d)"}
          </button>
          {generatedUrl && (
            <p className="font-mono text-[9px] text-[hsl(var(--accent-mid))] opacity-60 mt-1">
              using generated link: {generatedUrl}
            </p>
          )}
        </div>

        <div className="mt-3">
          <p className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 mb-1">
            or use the terminal:
          </p>
          <div className="space-y-1">
            <CopyableCommand command="/share" />
            <CopyableCommand command="/share --private" dimmed />
            <CopyableCommand command="/share --project my-project" dimmed />
          </div>
        </div>

        <Divider />

        {/* Active context links */}
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>active links</SectionLabel>
          {links && links.filter((l) => !l.isExpired).length > 0 && (
            <span className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
              {links.filter((l) => !l.isExpired).length} active
            </span>
          )}
        </div>

        {links && links.length > 0 ? (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className={`flex items-center justify-between px-3 py-2.5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] text-[10px] font-mono ${
                  link.isExpired ? "opacity-30" : ""
                }`}
                style={{ borderRadius: "2px" }}
              >
                <div className="space-y-1 min-w-0 flex-1 mr-3">
                  <div className="flex items-center gap-2">
                    <code className="text-[hsl(var(--accent-mid))] truncate">
                      you.md/ctx/{username}/{link.token}
                    </code>
                    {!link.isExpired && (
                      <CopyButton
                        text={`https://you.md/ctx/${username}/${link.token}`}
                        className="shrink-0 px-1.5 py-0.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors text-[9px]"
                      />
                    )}
                  </div>
                  <div className="text-[hsl(var(--text-secondary))] opacity-40">
                    {link.scope} -- {link.useCount} uses --{" "}
                    {link.isExpired
                      ? "expired"
                      : `expires ${typeof link.expiresAt === "string" ? link.expiresAt.split("T")[0] : "never"}`}
                  </div>
                </div>
                {!link.isExpired && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setPreviewLink({
                          token: link.token,
                          scope: link.scope,
                          useCount: link.useCount,
                          expiresAt: typeof link.expiresAt === "string" ? link.expiresAt : "never",
                          isExpired: link.isExpired,
                        })
                      }
                      className="text-[10px] font-mono text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
                    >
                      preview
                    </button>
                    <button
                      onClick={() => revokeLink({ clerkId, linkId: link.id })}
                      className="text-[10px] font-mono text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-dark))] transition-colors"
                    >
                      revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
            no context links yet. generate one above or type /share in the terminal.
          </p>
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
                  {totalInteractions >= 1000 ? `${(totalInteractions / 1000).toFixed(1)}k` : totalInteractions}
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
