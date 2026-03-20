"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

interface Project {
  name: string;
  role: string;
  status: string;
  url: string;
  description: string;
}

export function ProfileContent() {
  const params = useParams();
  const username = params.username as string;
  const profile = useQuery(api.profiles.getPublicProfile, { username });
  const recordView = useMutation(api.profiles.recordView);
  const hasRecordedView = useRef(false);

  useEffect(() => {
    if (hasRecordedView.current) return;
    if (profile === undefined || profile === null) return;
    hasRecordedView.current = true;
    recordView({
      username,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      isAgentRead: false,
    }).catch(() => {});
  }, [profile, username, recordView]);

  if (profile === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))] p-4">
        <div className="w-full max-w-md">
          <div className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden" style={{ borderRadius: "8px" }}>
            <TerminalHeader title="you.md — error" />
            <div className="p-6 font-mono text-[14px] space-y-2">
              <p className="text-[hsl(var(--text-secondary))] opacity-60">
                &gt; lookup @{username}
              </p>
              <p className="text-[hsl(var(--accent))]">
                ERR: profile not found
              </p>
              <p className="text-[hsl(var(--text-secondary))] opacity-40 text-[13px] mt-3">
                this username has not been claimed yet.
              </p>
              <div className="border-t border-[hsl(var(--border))] pt-3 mt-4">
                <Link
                  href="/create"
                  className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
                >
                  &gt; claim it
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = profile.youJson;
  if (!data) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))] p-4">
        <div className="w-full max-w-md">
          <div className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden" style={{ borderRadius: "8px" }}>
            <TerminalHeader title={`you.md/${username}`} />
            <div className="p-6 font-mono text-[14px] space-y-2">
              <p className="text-[hsl(var(--text-secondary))] opacity-50">
                profile claimed but not yet published.
              </p>
              <Link
                href="/"
                className="block mt-4 text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; back to home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const name = data.identity?.name || profile.displayName || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";

  const sameAsLinks: string[] = [];
  if (data.links?.website) sameAsLinks.push(data.links.website);
  if (data.links?.linkedin) sameAsLinks.push(data.links.linkedin);
  if (data.links?.x) sameAsLinks.push(data.links.x);
  if (data.links?.github) sameAsLinks.push(data.links.github);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    url: `https://you.md/${username}`,
    ...(tagline ? { jobTitle: tagline } : {}),
    ...(location ? { address: { "@type": "PostalAddress", addressLocality: location } } : {}),
    ...(bio ? { description: bio } : {}),
    ...(sameAsLinks.length > 0 ? { sameAs: sameAsLinks } : {}),
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="border-b border-[hsl(var(--border))]">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={`/${username}`}
            className="font-mono text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            you.md/{username}
          </Link>
          <Link
            href="/"
            className="text-xs font-mono text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70 transition-opacity"
          >
            what is this?
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-12 pb-16">
        {/* Identity */}
        <section className="mb-12">
          <h1 className="text-2xl font-mono tracking-tight text-[hsl(var(--accent))]">
            {name}
          </h1>
          {tagline && (
            <p className="text-[hsl(var(--text-secondary))] text-sm mt-2 leading-relaxed">
              {tagline}
            </p>
          )}
          {location && (
            <p className="text-[hsl(var(--text-secondary))] opacity-40 text-xs mt-1 font-mono">
              {location}
            </p>
          )}
        </section>

        {/* Bio */}
        {bio && (
          <section className="mb-10">
            <p className="text-[hsl(var(--text-secondary))] leading-relaxed text-[15px]">
              {bio}
            </p>
          </section>
        )}

        {/* Now */}
        {data.now?.focus && data.now.focus.length > 0 && (
          <section className="mb-10">
            <SectionLabel>now</SectionLabel>
            <ul className="space-y-1.5 mt-3">
              {data.now.focus.map((item: string, i: number) => (
                <li key={i} className="text-[hsl(var(--text-secondary))] text-sm flex items-start gap-2">
                  <span className="text-[hsl(var(--accent))] mt-0.5 shrink-0 text-xs">{"\u203A"}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <section className="mb-10">
            <SectionLabel>projects</SectionLabel>
            <div className="grid gap-2 mt-3">
              {data.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))]"
                  style={{ borderRadius: "4px" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm text-[hsl(var(--text-primary))]">
                        {project.name}
                      </span>
                      {project.role && (
                        <span className="text-[hsl(var(--text-secondary))] opacity-40 text-xs font-mono">
                          {project.role}
                        </span>
                      )}
                    </div>
                    {project.status && (
                      <span className="text-[9px] px-2 py-0.5 bg-[hsl(var(--accent-wash))] text-[hsl(var(--accent-mid))] font-mono border border-[hsl(var(--accent))]/15">
                        {project.status}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-[hsl(var(--text-secondary))] opacity-60 text-sm mt-1.5">
                      {project.description}
                    </p>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[hsl(var(--accent-mid))] text-xs font-mono mt-2 inline-flex items-center gap-1 hover:text-[hsl(var(--accent))] transition-colors"
                    >
                      {"\u2192"} {project.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Values */}
        {data.values && data.values.length > 0 && (
          <section className="mb-10">
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
        )}

        {/* Links */}
        {data.links && Object.keys(data.links).some((k: string) => data.links[k]) && (
          <section className="mb-10">
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
        )}

        {/* Agent Preferences */}
        {data.preferences?.agent && (
          <section className="mb-10">
            <SectionLabel>agent preferences</SectionLabel>
            <div
              className="mt-3 border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-1.5"
              style={{ borderRadius: "4px" }}
            >
              {data.preferences.agent.tone && (
                <div className="flex gap-2">
                  <span className="text-[hsl(var(--text-secondary))] opacity-40">tone:</span>
                  <span className="text-[hsl(var(--text-secondary))]">{data.preferences.agent.tone}</span>
                </div>
              )}
              {data.preferences.agent.avoid?.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-[hsl(var(--text-secondary))] opacity-40">avoid:</span>
                  <span className="text-[hsl(var(--text-secondary))]">{data.preferences.agent.avoid.join(", ")}</span>
                </div>
              )}
              {data.preferences?.writing?.style && (
                <div className="flex gap-2">
                  <span className="text-[hsl(var(--text-secondary))] opacity-40">style:</span>
                  <span className="text-[hsl(var(--text-secondary))]">{data.preferences.writing.style}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Share */}
        <section className="mb-10">
          <SectionLabel>share</SectionLabel>
          <div className="flex items-center gap-2 mt-3">
            <CopyButton
              text={`https://you.md/${username}`}
              className="text-[10px] font-mono px-2.5 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
            />
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(`my identity file for the agent internet: https://you.md/${username}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-mono px-2.5 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
              style={{ borderRadius: "2px" }}
            >
              share on x
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))]">
        <div className="max-w-2xl mx-auto px-6 py-6 text-center">
          <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30 uppercase tracking-widest">
            powered by{" "}
            <Link href="/" className="text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity">
              you.md
            </Link>
            {" "}&mdash;{" "}
            <Link href="/create" className="text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors">
              claim yours
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-[hsl(var(--accent))] uppercase tracking-widest font-mono">
        {children}
      </span>
      <div className="flex-1 h-px bg-[hsl(var(--border))]" />
    </div>
  );
}
