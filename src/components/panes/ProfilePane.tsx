"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@/lib/you-auth";
import { api } from "../../../convex/_generated/api";
import { CopyButton } from "@/components/ui/CopyButton";
import AsciiAvatar from "@/components/AsciiAvatar";
import type { PreRenderedPortrait } from "@/components/AsciiAvatar";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneDivider, PaneEmptyState } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

interface Project {
  name: string;
  role: string;
  status: string;
  url: string;
  description: string;
}

interface ProfilePaneProps {
  userId: Id<"users">;
  username: string;
  ownerId?: Id<"users">;
}

export function ProfilePane({ userId, username, ownerId }: ProfilePaneProps) {
  const { user } = useUser();
  const clerkId = user?.id;
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    clerkId && userId ? { clerkId, userId } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    ownerId ? { ownerId } : "skip"
  );

  const data = latestBundle?.youJson;
  const avatarUrl = userProfile?.avatarUrl || `https://avatars.githubusercontent.com/${username}?s=400`;
  const socialImages = (userProfile?.socialImages as Record<string, string | undefined>) || {};
  const storedPortrait = userProfile?.asciiPortrait as PreRenderedPortrait | undefined;

  // Collect portrait sources
  const sources: { platform: string; url: string }[] = [];
  if (socialImages.github) sources.push({ platform: "github", url: socialImages.github });
  if (socialImages.x) sources.push({ platform: "x", url: socialImages.x });
  if (socialImages.linkedin) sources.push({ platform: "linkedin", url: socialImages.linkedin });
  if (socialImages.custom) sources.push({ platform: "custom", url: socialImages.custom });

  if (!data) {
    return <PaneEmptyState>no bundle yet. talk to the agent to build your profile.</PaneEmptyState>;
  }

  const name = data.identity?.name || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio =
    data.identity?.bio?.long ||
    data.identity?.bio?.medium ||
    data.identity?.bio?.short ||
    "";

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))]/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="w-2 h-2 rounded-full status-dot-pulse"
            style={{ background: "hsl(var(--success))" }}
          />
          <span className="text-[10px] font-mono text-[hsl(var(--success))] uppercase tracking-wider">
            active
          </span>
          <span className="text-[hsl(var(--border))] mx-1" aria-hidden="true">|</span>
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
            public view
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CopyButton
            text={`https://you.md/${username}`}
            className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-55 transition-colors hover:text-[hsl(var(--text-primary))] hover:opacity-95"
          />
          <a
            href={`/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-75 transition-colors hover:text-[hsl(var(--text-primary))] hover:opacity-100"
          >
            open
          </a>
        </div>
      </div>

      {/* Profile content */}
      <div className="w-full max-w-[760px] space-y-6 px-4 py-5 sm:px-5">
        {/* Identity + Portrait */}
        <section>
          <div className="grid grid-cols-[84px_minmax(0,1fr)] items-start gap-4">
            {avatarUrl && (
              <div className="shrink-0 overflow-hidden bg-[hsl(var(--bg))]" style={{ borderRadius: "var(--radius)" }}>
                <AsciiAvatar
                  src={avatarUrl}
                  cols={38}
                  canvasWidth={84}
                  className="block"
                  preRendered={storedPortrait && storedPortrait.sourceUrl === avatarUrl ? storedPortrait : undefined}
                />
              </div>
            )}
            <div className="min-w-0 break-words">
              <h1 className="break-all text-lg font-mono tracking-tight text-[hsl(var(--text-primary))]">
                @{username}
              </h1>
              {name && name !== username && (
                <p className="text-[hsl(var(--accent))] text-sm mt-1 font-mono break-words">
                  {name}
                </p>
              )}
              {tagline && (
                <p className="text-[hsl(var(--text-secondary))] text-sm mt-1 leading-relaxed break-words">
                  {tagline}
                </p>
              )}
              {location && (
                <p className="text-[hsl(var(--text-secondary))] opacity-40 text-xs mt-1 font-mono break-words">
                  {location}
                </p>
              )}
            </div>
          </div>
        </section>

        <PaneDivider />

        {/* Bio */}
        {bio && (
          <>
            <section>
              <SectionLabel>bio</SectionLabel>
              <p className="text-[hsl(var(--text-secondary))] leading-relaxed text-sm mt-3 break-words">
                {bio}
              </p>
            </section>
            <PaneDivider />
          </>
        )}

        {/* Now */}
        {data.now?.focus && data.now.focus.length > 0 && (
          <>
            <section>
              <SectionLabel>now</SectionLabel>
              <ul className="space-y-1.5 mt-3">
                {data.now.focus.map((item: string, i: number) => (
                  <li
                    key={i}
                    className="text-[hsl(var(--text-secondary))] text-sm flex min-w-0 items-start gap-2"
                  >
                    <span className="text-[hsl(var(--accent))] mt-0.5 shrink-0 text-xs">
                      {"\u203A"}
                    </span>
                    <span className="min-w-0 break-words">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
            <PaneDivider />
          </>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <>
            <section>
              <SectionLabel>projects</SectionLabel>
              <div className="mt-3 divide-y divide-[hsl(var(--border))]/45">
                {data.projects.map((project: Project, i: number) => (
                  <div
                    key={i}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-sm text-[hsl(var(--text-primary))]">
                        {project.name}
                      </span>
                      {project.status && (
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-[hsl(var(--accent))] opacity-70">
                          {project.status}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-[hsl(var(--text-secondary))] opacity-60 text-xs mt-1.5 break-words">
                        {project.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <PaneDivider />
          </>
        )}

        {/* Values */}
        {data.values && data.values.length > 0 && (
          <>
            <section>
              <SectionLabel>values</SectionLabel>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.values.map((value: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs text-[hsl(var(--text-secondary))] opacity-65"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </section>
            <PaneDivider />
          </>
        )}

        {/* Links */}
        {data.links &&
          Object.keys(data.links).some((k: string) => data.links[k]) && (
            <>
              <section>
                <SectionLabel>links</SectionLabel>
                <div className="grid gap-1 mt-3">
                  {Object.entries(data.links)
                    .filter(([, url]) => url)
                    .map(([platform, url]) => (
                      <a
                        key={platform}
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2 text-xs font-mono py-1.5 hover:text-[hsl(var(--accent))] transition-colors"
                      >
                        <LinkFavicon url={url as string} />
                        <span className="text-[hsl(var(--text-secondary))] opacity-40 w-16">
                          {platform}
                        </span>
                        <span className="min-w-0 truncate text-[hsl(var(--accent-mid))]">
                          {url as string}
                        </span>
                      </a>
                    ))}
                </div>
              </section>
              <PaneDivider />
            </>
          )}

        {/* Agent Preferences */}
        {data.preferences?.agent && (
          <>
            <section>
              <SectionLabel>agent preferences</SectionLabel>
              <div className="mt-3 space-y-2 font-mono text-xs">
                {data.preferences.agent.tone && (
                  <div className="flex gap-2">
                    <span className="text-[hsl(var(--text-secondary))] opacity-40">
                      tone:
                    </span>
                    <span className="text-[hsl(var(--text-secondary))]">
                      {data.preferences.agent.tone}
                    </span>
                  </div>
                )}
                {data.preferences.agent.avoid?.length > 0 && (
                  <div className="flex gap-2">
                    <span className="text-[hsl(var(--text-secondary))] opacity-40">
                      avoid:
                    </span>
                    <span className="text-[hsl(var(--text-secondary))]">
                      {data.preferences.agent.avoid.join(", ")}
                    </span>
                  </div>
                )}
                {data.preferences?.writing?.style && (
                  <div className="flex gap-2">
                    <span className="text-[hsl(var(--text-secondary))] opacity-40">
                      style:
                    </span>
                    <span className="text-[hsl(var(--text-secondary))]">
                      {data.preferences.writing.style}
                    </span>
                  </div>
                )}
              </div>
            </section>
            <PaneDivider />
          </>
        )}

        {/* Portrait — collapsible at bottom */}
        {sources.length > 1 && (
          <section>
            <SectionLabel>portrait sources</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {sources.map((src) => (
                <div
                  key={src.platform}
                  className="overflow-hidden"
                >
                  <AsciiAvatar src={src.url} cols={28} canvasWidth={130} className="w-full opacity-80" />
                  <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60 mt-1 block">
                    {src.platform}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <CopyableCommand command="/portrait --regenerate" dimmed />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-[hsl(var(--accent))] uppercase tracking-widest font-mono">
      {children}
    </span>
  );
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
