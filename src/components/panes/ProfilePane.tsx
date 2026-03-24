"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CopyButton } from "@/components/ui/CopyButton";
import AsciiAvatar from "@/components/AsciiAvatar";
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
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    userId ? { userId } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    ownerId ? { ownerId } : "skip"
  );

  const data = latestBundle?.youJson;
  const avatarUrl = userProfile?.avatarUrl || `https://avatars.githubusercontent.com/${username}?s=400`;
  const socialImages = (userProfile?.socialImages as Record<string, string | undefined>) || {};

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
    <div className="h-full overflow-y-auto">
      {/* Status bar */}
      <div className="px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full status-dot-pulse"
            style={{ background: "hsl(var(--success))" }}
          />
          <span className="text-[10px] font-mono text-[hsl(var(--success))] uppercase tracking-wider">
            active
          </span>
          <span className="text-[hsl(var(--border))] mx-1">|</span>
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
            public view
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton
            text={`https://you.md/${username}`}
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
          />
          <a
            href={`/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
            style={{ borderRadius: "2px" }}
          >
            open
          </a>
        </div>
      </div>

      {/* Profile content */}
      <div className="px-6 py-6 space-y-6 max-w-xl">
        {/* Identity + Portrait */}
        <section>
          <div className="flex items-start gap-4">
            {avatarUrl && (
              <div className="shrink-0 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] overflow-hidden" style={{ borderRadius: "2px" }}>
                <AsciiAvatar
                  src={avatarUrl}
                  cols={50}
                  canvasWidth={100}
                  className="block"
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-mono tracking-tight text-[hsl(var(--text-primary))]">
                @{username}
              </h1>
              {name && name !== username && (
                <p className="text-[hsl(var(--accent))] text-sm mt-1 font-mono">
                  {name}
                </p>
              )}
              {tagline && (
                <p className="text-[hsl(var(--text-secondary))] text-sm mt-1 leading-relaxed">
                  {tagline}
                </p>
              )}
              {location && (
                <p className="text-[hsl(var(--text-secondary))] opacity-40 text-xs mt-1 font-mono">
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
              <p className="text-[hsl(var(--text-secondary))] leading-relaxed text-sm mt-3">
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
                    className="text-[hsl(var(--text-secondary))] text-sm flex items-start gap-2"
                  >
                    <span className="text-[hsl(var(--accent))] mt-0.5 shrink-0 text-xs">
                      {"\u203A"}
                    </span>
                    <span>{item}</span>
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
              <div className="grid gap-2 mt-3">
                {data.projects.map((project: Project, i: number) => (
                  <div
                    key={i}
                    className="border border-[hsl(var(--border))] p-3 bg-[hsl(var(--bg-raised))]"
                    style={{ borderRadius: "2px" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-[hsl(var(--text-primary))]">
                        {project.name}
                      </span>
                      {project.status && (
                        <span className="text-[9px] px-2 py-0.5 bg-[hsl(var(--accent-wash))] text-[hsl(var(--accent-mid))] font-mono border border-[hsl(var(--accent))]/15">
                          {project.status}
                        </span>
                      )}
                    </div>
                    {project.description && (
                      <p className="text-[hsl(var(--text-secondary))] opacity-60 text-xs mt-1.5">
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
                    className="text-xs px-2.5 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] bg-[hsl(var(--bg-raised))]"
                    style={{ borderRadius: "2px" }}
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
                        className="flex items-center gap-2 text-xs font-mono py-1.5 hover:text-[hsl(var(--accent))] transition-colors"
                      >
                        <LinkFavicon url={url as string} />
                        <span className="text-[hsl(var(--text-secondary))] opacity-40 w-16">
                          {platform}
                        </span>
                        <span className="text-[hsl(var(--accent-mid))] truncate">
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
              <div
                className="mt-3 border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-1.5"
                style={{ borderRadius: "2px" }}
              >
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
            <div className="grid grid-cols-2 gap-2 mt-3">
              {sources.map((src) => (
                <div
                  key={src.platform}
                  className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-2 overflow-hidden"
                  style={{ borderRadius: "2px" }}
                >
                  <AsciiAvatar src={src.url} cols={40} canvasWidth={180} className="w-full" />
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
  const domain = extractDomain(url);
  if (!domain) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      alt=""
      width={16}
      height={16}
      className="shrink-0"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
