"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CopyButton } from "@/components/ui/CopyButton";
import type { Id } from "../../../convex/_generated/dataModel";

interface Project {
  name: string;
  role: string;
  status: string;
  url: string;
  description: string;
}

interface ProfilePreviewPaneProps {
  userId: Id<"users">;
  username: string;
}

export function ProfilePreviewPane({ userId, username }: ProfilePreviewPaneProps) {
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    userId ? { userId } : "skip"
  );

  const data = latestBundle?.youJson;

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <p className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-40">
            no bundle yet.
          </p>
          <p className="text-xs font-mono text-[hsl(var(--text-secondary))] opacity-25">
            talk to the agent to build your profile.
          </p>
        </div>
      </div>
    );
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
        {/* Identity */}
        <section>
          <h1 className="text-lg font-mono tracking-tight text-[hsl(var(--text-primary))]">
            @{username}
          </h1>
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
          {name && name !== username && (
            <p className="text-[hsl(var(--accent))] text-sm mt-1 font-mono">
              {name}
            </p>
          )}
        </section>

        <Divider />

        {/* Bio */}
        {bio && (
          <>
            <section>
              <SectionLabel>bio</SectionLabel>
              <p className="text-[hsl(var(--text-secondary))] leading-relaxed text-sm mt-3">
                {bio}
              </p>
            </section>
            <Divider />
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
            <Divider />
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
            <Divider />
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
            <Divider />
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
              <Divider />
            </>
          )}

        {/* Agent Preferences */}
        {data.preferences?.agent && (
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

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))]" />;
}
