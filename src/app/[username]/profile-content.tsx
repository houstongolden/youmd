"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { CopyButton } from "@/components/ui/CopyButton";

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

  // Record a page view on mount
  useEffect(() => {
    if (hasRecordedView.current) return;
    if (profile === undefined || profile === null) return;
    hasRecordedView.current = true;
    recordView({
      username,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
      isAgentRead: false,
    }).catch(() => {
      // silently ignore view tracking errors
    });
  }, [profile, username, recordView]);

  if (profile === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        {/* Skeleton header */}
        <div className="w-full border-b border-border">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-mist/10 animate-pulse" />
            <div className="h-3 w-20 rounded bg-mist/10 animate-pulse" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto w-full px-6 pt-16 pb-20">
          {/* Skeleton identity */}
          <div className="mb-16 space-y-4">
            <div className="h-10 w-64 rounded-lg bg-mist/10 animate-pulse" />
            <div className="h-5 w-80 rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-32 rounded bg-mist/10 animate-pulse" />
          </div>
          {/* Skeleton bio */}
          <div className="mb-14 space-y-3">
            <div className="h-4 w-full rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-full rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-mist/10 animate-pulse" />
          </div>
          {/* Skeleton section */}
          <div className="mb-14 space-y-3">
            <div className="h-3 w-16 rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-48 rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-56 rounded bg-mist/10 animate-pulse" />
            <div className="h-4 w-40 rounded bg-mist/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="font-mono text-foreground-secondary text-sm">
          you.md/{username}
        </div>
        <h1 className="text-xl font-semibold text-foreground">Profile not found</h1>
        <p className="text-foreground-secondary text-sm">
          This username hasn&apos;t been claimed yet.
        </p>
        <Link
          href="/claim"
          className="mt-4 px-5 py-2.5 text-sm bg-coral text-void rounded-md font-medium hover:opacity-90 transition-all"
        >
          Claim it
        </Link>
      </div>
    );
  }

  const data = profile.youJson;
  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="font-mono text-foreground-secondary text-sm">
          you.md/{username}
        </div>
        <h1 className="text-xl font-semibold text-foreground">Not yet published</h1>
        <p className="text-foreground-secondary text-sm max-w-xs text-center">
          This profile has been claimed but hasn&apos;t published a bundle yet. Check back soon.
        </p>
        <Link
          href="/"
          className="mt-4 px-5 py-2.5 text-sm border border-border rounded-lg text-foreground-secondary hover:text-foreground hover:border-accent-secondary transition-all"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const name = data.identity?.name || profile.displayName || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";

  // Collect sameAs links for JSON-LD
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

  // Capitalize first letter helper
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Beam glow — vertical light behind identity */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(232,133,122,0.07) 0%, rgba(122,190,208,0.05) 40%, rgba(244,215,140,0.03) 70%, transparent 100%)",
        }}
      />

      {/* Header bar */}
      <header className="w-full border-b border-border relative z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={`/${username}`}
            className="font-mono text-sm text-mist hover:text-foreground transition-colors"
          >
            you.md/{username}
          </Link>
          <Link
            href="/"
            className="text-xs text-mist hover:text-foreground-secondary transition-colors"
          >
            What is this?
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 pt-16 pb-20 relative z-10 animate-fade-in">
        {/* ── Identity ── */}
        <section className="mb-16">
          <h1 className="text-4xl font-semibold tracking-tight text-coral">
            {name}
          </h1>
          {tagline && (
            <p className="text-foreground-secondary text-lg mt-3 leading-relaxed">
              {tagline}
            </p>
          )}
          {location && (
            <p className="text-mist text-sm mt-2 font-mono">{location}</p>
          )}
        </section>

        {/* ── Bio ── */}
        {bio && (
          <section className="mb-14">
            <p className="text-foreground-secondary leading-relaxed text-[15px]">
              {bio}
            </p>
          </section>
        )}

        {/* ── Now ── */}
        {data.now?.focus && data.now.focus.length > 0 && (
          <section className="mb-14">
            <SectionLabel>Now</SectionLabel>
            <ul className="space-y-2 mt-4">
              {data.now.focus.map((item: string, i: number) => (
                <li
                  key={i}
                  className="text-foreground-secondary text-sm flex items-start gap-3"
                >
                  <span className="text-coral mt-0.5 shrink-0">&bull;</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {data.now.status && (
              <p className="text-mist text-xs font-mono mt-3">
                status: {data.now.status}
              </p>
            )}
          </section>
        )}

        {/* ── Projects ── */}
        {data.projects && data.projects.length > 0 && (
          <section className="mb-14">
            <SectionLabel>Projects</SectionLabel>
            <div className="grid gap-3 mt-4">
              {data.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="border border-border rounded-lg p-5 bg-background-secondary/50 hover:border-mist/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-sm text-foreground truncate">
                        {project.name}
                      </span>
                      {project.role && (
                        <span className="text-mist text-xs font-mono shrink-0">
                          {project.role}
                        </span>
                      )}
                    </div>
                    {project.status && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-sky/10 text-sky font-mono shrink-0 border border-sky/20">
                        {project.status}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-foreground-secondary text-sm mt-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky text-xs font-mono mt-3 inline-flex items-center gap-1 hover:underline"
                    >
                      <span className="text-mist">&rarr;</span> {project.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Values ── */}
        {data.values && data.values.length > 0 && (
          <section className="mb-14">
            <SectionLabel>Values</SectionLabel>
            <div className="flex flex-wrap gap-2 mt-4">
              {data.values.map((value: string, i: number) => (
                <span
                  key={i}
                  className="text-sm px-3 py-1.5 rounded-full border border-border text-foreground-secondary bg-background-secondary/50"
                >
                  {value}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Links ── */}
        {data.links && Object.keys(data.links).some((k: string) => data.links[k]) && (
          <section className="mb-14">
            <SectionLabel>Links</SectionLabel>
            <div className="grid gap-2 mt-4">
              {Object.entries(data.links)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm font-mono py-2 px-3 -mx-3 rounded-md hover:bg-background-secondary/80 transition-colors group"
                  >
                    <span className="text-mist text-xs w-20 shrink-0">
                      {capitalize(platform)}
                    </span>
                    <span className="text-sky group-hover:underline truncate">
                      {url as string}
                    </span>
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* ── Agent Preferences ── */}
        {data.preferences?.agent && (
          <section className="mb-14">
            <SectionLabel>Agent Preferences</SectionLabel>
            <div className="mt-4 border border-border rounded-lg p-5 bg-background-secondary/50 font-mono text-sm space-y-2">
              {data.preferences.agent.tone && (
                <div className="flex gap-2">
                  <span className="text-mist shrink-0">tone:</span>
                  <span className="text-foreground-secondary">
                    {data.preferences.agent.tone}
                  </span>
                </div>
              )}
              {data.preferences.agent.avoid?.length > 0 && (
                <div className="flex gap-2">
                  <span className="text-mist shrink-0">avoid:</span>
                  <span className="text-foreground-secondary">
                    {data.preferences.agent.avoid.join(", ")}
                  </span>
                </div>
              )}
              {data.preferences?.writing?.style && (
                <div className="flex gap-2">
                  <span className="text-mist shrink-0">style:</span>
                  <span className="text-foreground-secondary">
                    {data.preferences.writing.style}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
        {/* ── Share ── */}
        <section className="mb-14">
          <SectionLabel>Share</SectionLabel>
          <div className="flex items-center gap-3 mt-4">
            <CopyButton
              text={`https://you.md/${username}`}
              label="Copy profile URL"
              className="text-xs px-3 py-1.5 border border-border rounded-md text-foreground-secondary hover:text-foreground hover:border-accent-secondary transition-colors"
            />
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(`Check out my identity file on the agent internet: https://you.md/${username}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 border border-border rounded-md text-foreground-secondary hover:text-foreground hover:border-accent-secondary transition-colors"
            >
              Share on X
            </a>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border relative z-10">
        <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col items-center gap-3">
          {/* Subtle brand gradient line */}
          <div className="w-12 h-px brand-gradient rounded-full opacity-60" />
          <p className="text-xs text-mist">
            Powered by{" "}
            <Link
              href="/"
              className="font-mono brand-gradient-text hover:opacity-80 transition-opacity"
            >
              you.md
            </Link>
            {" "}&mdash;{" "}
            <Link
              href="/claim"
              className="text-coral hover:underline transition-colors"
            >
              Claim yours
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Section Label Component ── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-semibold text-gold uppercase tracking-widest font-mono">
        {children}
      </h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
