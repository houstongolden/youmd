"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GithubRepoSection } from "./GithubRepoSection";
import { GithubOnboarding } from "./GithubOnboarding";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";
import { Bot, Code2, GitBranch, KeyRound, Layers3, LockKeyhole, Plug, Radar, Share2, Wrench } from "lucide-react";

interface GithubPaneProps {
  clerkId: string;
}

const SURFACES = [
  {
    label: "ystack",
    detail: "the built-in base runtime, docs, install script, API routes, MCP discovery, and guarded defaults",
    status: "base",
  },
  {
    label: "youstack",
    detail: "the user's default private stack: identity, memories, projects, skills, tools, endpoints, and objects",
    status: "private",
  },
  {
    label: "{name}stack",
    detail: "custom named stacks for domains like coding, research, content, BAMF, or a single project",
    status: "scoped",
  },
];

const ACCESS_ROWS = [
  ["public", "published profile, public stacks, read-only docs, llms.txt", "open"],
  ["auth", "owner session for shell, private files, sources, conversations, and settings", "cookie"],
  ["token", "agent API keys scoped to memories, projects, stacks, tools, webhooks, and MCP", "scoped"],
  ["share", "expiring links for specific profile/project/context bundles", "limited"],
] as const;

const EXTENSION_ROWS = [
  ["endpoints", "custom read/write API routes exposed under your personal namespace"],
  ["functions", "agent-callable routines with policy, inputs, outputs, smoke checks"],
  ["tools", "MCP tools generated from stack capabilities and connected services"],
  ["objects", "typed identity, project, source, preference, and memory entities"],
  ["properties", "small durable fields agents can read without scraping prose"],
] as const;

export function GithubPane({ clerkId }: GithubPaneProps) {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();

  const connection = useQuery(
    api.github.getConnection,
    isAuthenticated && clerkId ? { clerkId } : "skip"
  );

  // Show onboarding when:
  // (a) the user just completed OAuth (?integration=github), OR
  // (b) they are connected but have no repo yet (first-time experience).
  const isPostOAuth = searchParams.get("integration") === "github";
  const isConnected = connection !== null && connection !== undefined;
  const hasRepo = isConnected && !!connection?.repoFullName;
  const showOnboarding = isConnected && (isPostOAuth || !hasRepo);

  return (
    <div className="flex flex-col h-full">
      <PaneHeader>connectors</PaneHeader>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl">
          <div className="mb-7 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <section>
              <PaneSectionLabel>personal api gateway</PaneSectionLabel>
              <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
                your agents get a private, scoped interface to you.
              </h2>
              <p className="mt-3 max-w-2xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
                Connectors feed the brain. Stacks decide what becomes installable
                agent behavior. API keys, MCP tools, and shared links decide who
                can touch which layer.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {ACCESS_ROWS.map(([label, detail, status]) => (
                  <div
                    key={label}
                    className="group border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/40 px-3 py-2 transition-colors hover:border-[hsl(var(--accent))]/70 hover:bg-[hsl(var(--accent))]/[0.035]"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[hsl(var(--text-primary))]">
                      {label === "token" ? <KeyRound size={13} /> : label === "share" ? <Share2 size={13} /> : <LockKeyhole size={13} />}
                      <span>{label}</span>
                      <span className="ml-auto text-[8px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-60">
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-45">
                      {detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[hsl(var(--bg))]/45 p-4">
              <PaneSectionLabel>naming model</PaneSectionLabel>
              <div className="space-y-3">
                {SURFACES.map((surface) => (
                  <div key={surface.label} className="flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-[hsl(var(--accent))]/[0.08] text-[hsl(var(--accent))]">
                      {surface.label === "ystack" ? <Code2 size={14} /> : surface.label === "youstack" ? <Layers3 size={14} /> : <Wrench size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-[hsl(var(--text-primary))]">
                        <span>{surface.label}</span>
                        <span className="text-[8px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-35">
                          {surface.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                        {surface.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <PaneSectionLabel>extension surface</PaneSectionLabel>
          <div className="mb-7 grid gap-x-6 gap-y-3 md:grid-cols-2">
            {EXTENSION_ROWS.map(([label, detail]) => (
              <div key={label} className="flex items-start gap-3 border-t border-[hsl(var(--border))]/45 pt-3">
                <div className="mt-0.5 text-[hsl(var(--accent))] opacity-75">
                  {label === "tools" ? <Bot size={14} /> : label === "endpoints" ? <Code2 size={14} /> : <Plug size={14} />}
                </div>
                <div>
                  <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{label}</p>
                  <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <PaneSectionLabel>source graph</PaneSectionLabel>
          <div className="mb-7 grid gap-3 md:grid-cols-3">
            <div className="bg-[hsl(var(--bg))]/45 p-3">
              <GitBranch size={15} className="mb-2 text-[hsl(var(--accent))]" />
              <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">github repos</p>
              <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                projects, code context, stack manifests, docs, and installable repo memory.
              </p>
            </div>
            <div className="bg-[hsl(var(--bg))]/45 p-3">
              <Radar size={15} className="mb-2 text-[hsl(var(--accent))]" />
              <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">crawlers</p>
              <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                sites, feeds, profiles, webhooks, and JSON sources refreshed into context.
              </p>
            </div>
            <div className="bg-[hsl(var(--bg))]/45 p-3">
              <KeyRound size={15} className="mb-2 text-[hsl(var(--accent))]" />
              <p className="font-mono text-[11px] text-[hsl(var(--text-primary))]">grants</p>
              <p className="mt-1 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-48">
                scoped tokens and shared links decide which agents can call which private surfaces.
              </p>
            </div>
          </div>

          <PaneDivider />

          <div className="space-y-8">
        {/* Loading */}
        {connection === undefined && (
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
            loading...
          </p>
        )}

        {/* Not connected — GithubRepoSection handles the connect CTA */}
        {connection === null && (
          <GithubRepoSection clerkId={clerkId} />
        )}

        {/* Connected: show onboarding flow first, then repo management below */}
        {isConnected && (
          <>
            {showOnboarding && (
              <GithubOnboarding clerkId={clerkId} connection={connection} />
            )}

            {/* Always keep repo management available; separate it with a divider
                when onboarding is also visible so the pane reads cleanly. */}
            {showOnboarding && hasRepo && (
              <div className="h-px bg-[hsl(var(--border))]" />
            )}

            {/* Show GithubRepoSection once onboarding is complete (repo exists),
                or always so users can reconfigure. */}
            {hasRepo && (
              <GithubRepoSection clerkId={clerkId} />
            )}
          </>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
