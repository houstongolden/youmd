"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useState } from "react";
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

const PROMPT_TEMPLATES: { agent: string; icon: string; prompt: (url: string) => string }[] = [
  {
    agent: "Universal",
    icon: "[*]",
    prompt: (url) =>
      `Read my identity context before we start:\n${url}\n\nThis is my you.md profile -- it contains my bio, projects, values, preferences, and how I like to communicate. Use it to understand who I am so we can skip the intro and get straight to work.`,
  },
  {
    agent: "Claude",
    icon: "[cl]",
    prompt: (url) =>
      `Before responding, read my identity context:\n${url}\n\nThis is my you.md identity bundle. It has my background, current projects, values, and communication preferences. Reference it throughout our conversation.`,
  },
  {
    agent: "ChatGPT",
    icon: "[gp]",
    prompt: (url) =>
      `Before we begin, read my you.md profile for context about who I am:\n${url}\n\nIt contains my bio, projects, values, and preferences. Use this context to personalize our conversation.`,
  },
  {
    agent: "Cursor",
    icon: "[|>]",
    prompt: (url) =>
      `Add this to your context -- my developer identity:\n${url}\n\nThis is my you.md profile with my tech stack, projects, coding preferences, and communication style.`,
  },
  {
    agent: "Copilot",
    icon: "[cp]",
    prompt: (url) =>
      `Read my developer context before assisting:\n${url}\n\nThis you.md profile contains my projects, preferred technologies, and coding style. Use it to tailor your suggestions.`,
  },
];

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
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[11px] font-mono border border-[hsl(var(--accent))]/30 text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent-wash))] transition-colors"
              style={{ borderRadius: "2px" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              copy prompt + link
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeUrl);
              }}
              className="px-3 py-2 text-[11px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
              style={{ borderRadius: "2px" }}
            >
              link only
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
                  <button
                    onClick={() => revokeLink({ clerkId, linkId: link.id })}
                    className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-dark))] transition-colors"
                  >
                    revoke
                  </button>
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
    </div>
  );
}
