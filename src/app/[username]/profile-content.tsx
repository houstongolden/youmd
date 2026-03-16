"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";

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

  if (profile === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-foreground-secondary font-mono text-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="font-mono text-foreground-secondary text-sm">
          you.md/{username}
        </div>
        <h1 className="text-xl font-semibold">Profile not found</h1>
        <p className="text-foreground-secondary text-sm">
          This username hasn&apos;t been claimed yet.
        </p>
        <Link
          href="/claim"
          className="mt-4 px-4 py-2 text-sm bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Claim it
        </Link>
      </div>
    );
  }

  const data = profile.youJson;
  if (!data) return null;

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Beam glow behind identity section */}
      <div className="absolute inset-0 beam-glow pointer-events-none opacity-50" />

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-16 relative z-10 space-y-10">
        {/* Identity header */}
        <header className="space-y-3">
          <div className="font-mono text-sm text-mist">
            you.md/{username}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {data.identity?.name}
          </h1>
          {data.identity?.tagline && (
            <p className="text-foreground-secondary text-lg">
              {data.identity.tagline}
            </p>
          )}
          {data.identity?.location && (
            <p className="text-mist text-sm">{data.identity.location}</p>
          )}
        </header>

        {/* Bio */}
        {data.identity?.bio?.long && (
          <section>
            <p className="text-foreground-secondary leading-relaxed">
              {data.identity.bio.long}
            </p>
          </section>
        )}

        {/* Now */}
        {data.now?.focus?.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-coral uppercase tracking-wider">
              Now
            </h2>
            <ul className="space-y-1">
              {data.now.focus.map((item: string, i: number) => (
                <li
                  key={i}
                  className="text-foreground-secondary text-sm flex items-start gap-2"
                >
                  <span className="text-mist mt-0.5">-</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Projects */}
        {data.projects?.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-coral uppercase tracking-wider">
              Projects
            </h2>
            <div className="space-y-3">
              {data.projects.map((project: Project, i: number) => (
                <div
                  key={i}
                  className="border border-border rounded-md p-4 bg-background-secondary/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {project.name}
                    </span>
                    {project.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky/10 text-sky font-mono">
                        {project.status}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-foreground-secondary text-sm mt-1">
                      {project.description}
                    </p>
                  )}
                  {project.role && (
                    <p className="text-mist text-xs mt-1">{project.role}</p>
                  )}
                  {project.url && (
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky text-xs font-mono mt-1 inline-block hover:underline"
                    >
                      {project.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Values */}
        {data.values?.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-coral uppercase tracking-wider">
              Values
            </h2>
            <ul className="space-y-1">
              {data.values.map((value: string, i: number) => (
                <li
                  key={i}
                  className="text-foreground-secondary text-sm flex items-start gap-2"
                >
                  <span className="text-mist mt-0.5">-</span>
                  {value}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Links */}
        {data.links && Object.keys(data.links).some((k: string) => data.links[k]) && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-coral uppercase tracking-wider">
              Links
            </h2>
            <div className="space-y-1">
              {Object.entries(data.links)
                .filter(([, url]) => url)
                .map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-sky font-mono hover:underline"
                  >
                    {platform}: {url as string}
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* Agent Preferences */}
        {data.preferences?.agent && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-coral uppercase tracking-wider">
              Agent Preferences
            </h2>
            <div className="text-foreground-secondary text-sm space-y-1 font-mono">
              {data.preferences.agent.tone && (
                <p>
                  <span className="text-mist">tone:</span>{" "}
                  {data.preferences.agent.tone}
                </p>
              )}
              {data.preferences.agent.avoid?.length > 0 && (
                <p>
                  <span className="text-mist">avoid:</span>{" "}
                  {data.preferences.agent.avoid.join(", ")}
                </p>
              )}
              {data.preferences.writing?.style && (
                <p>
                  <span className="text-mist">style:</span>{" "}
                  {data.preferences.writing.style}
                </p>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border text-center relative z-10">
        <p className="text-xs text-mist">
          Powered by{" "}
          <Link
            href="/"
            className="font-mono text-sky hover:underline"
          >
            you.md
          </Link>
          {" "}&mdash;{" "}
          <Link
            href="/claim"
            className="text-coral hover:underline"
          >
            Claim yours
          </Link>
        </p>
      </footer>
    </div>
  );
}
