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
      {/* Preview header */}
      <div className="px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          you.md/{username}
        </span>
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
      <div className="px-6 py-8 space-y-8 max-w-xl">
        {/* Identity */}
        <section>
          <h1 className="text-xl font-mono tracking-tight text-[hsl(var(--accent))]">
            {name}
          </h1>
          {tagline && (
            <p className="text-[hsl(var(--text-secondary))] text-sm mt-2 leading-relaxed">
              {tagline}
            </p>
          )}
          {location && (
            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-xs mt-1 font-mono">
              {location}
            </p>
          )}
        </section>

        {/* Bio */}
        {bio && (
          <section>
            <p className="text-[hsl(var(--text-secondary))] leading-relaxed text-sm">
              {bio}
            </p>
          </section>
        )}

        {/* Now */}
        {data.now?.focus && data.now.focus.length > 0 && (
          <section>
            <SectionLabel>Now</SectionLabel>
            <ul className="space-y-1.5 mt-3">
              {data.now.focus.map((item: string, i: number) => (
                <li
                  key={i}
                  className="text-[hsl(var(--text-secondary))] text-sm flex items-start gap-2"
                >
                  <span className="text-[hsl(var(--accent))] mt-0.5 shrink-0 text-xs">
                    &rsaquo;
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <section>
            <SectionLabel>Projects</SectionLabel>
            <div className="grid gap-2 mt-3">
              {data.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))]"
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
                    <p className="text-[hsl(var(--text-secondary))] text-xs mt-1.5">
                      {project.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Values */}
        {data.values && data.values.length > 0 && (
          <section>
            <SectionLabel>Values</SectionLabel>
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
        )}

        {/* Links */}
        {data.links &&
          Object.keys(data.links).some((k: string) => data.links[k]) && (
            <section>
              <SectionLabel>Links</SectionLabel>
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
          )}

        {/* Agent Preferences */}
        {data.preferences?.agent && (
          <section>
            <SectionLabel>Agent Preferences</SectionLabel>
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
    <div className="flex items-center gap-3">
      <h2 className="text-[10px] text-[hsl(var(--accent))] uppercase tracking-widest font-mono">
        &gt; {children}
      </h2>
      <div className="flex-1 h-px bg-[hsl(var(--border))]" />
    </div>
  );
}
