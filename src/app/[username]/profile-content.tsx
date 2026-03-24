"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { CopyButton } from "@/components/ui/CopyButton";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import AsciiAvatar from "@/components/AsciiAvatar";
import { generateYouJson, generateYouMd, downloadFile } from "@/lib/exportProfile";

/* ── Types ────────────────────────────────────────────────── */

interface Project {
  name: string;
  role: string;
  status: string;
  url: string;
  description: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

const statusColor = (s: string) => {
  switch (s) {
    case "active": return "text-[hsl(var(--success))]";
    case "building": return "text-[hsl(var(--accent))]";
    case "shipped": return "text-[hsl(var(--success))]";
    default: return "text-[hsl(var(--text-secondary))]";
  }
};

const delay = (i: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.3, delay: i * 0.06 },
});

/* ── Main Component ───────────────────────────────────────── */

interface ProfileContentProps {
  ssrData?: Record<string, any> | null;
}

export function ProfileContent({ ssrData }: ProfileContentProps) {
  const params = useParams();
  const username = params.username as string;
  const profile = useQuery(api.profiles.getPublicProfile, { username });
  const recordView = useMutation(api.profiles.recordView);
  const hasRecordedView = useRef(false);
  const [copied, setCopied] = useState(false);

  // SSR fallback shape matching the Convex query return type
  const ssrProfile = ssrData ? {
    youJson: ssrData,
    displayName: ssrData.identity?.name || username,
    avatarUrl: ssrData.meta?.avatarUrl as string | undefined,
    isClaimed: (ssrData.meta?.isClaimed as boolean) ?? true,
  } : null;

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

  const handleCopy = () => {
    navigator.clipboard.writeText(`you.md/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Not found — only trust the live Convex response
  if (profile === null) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))] p-4">
        <div className="w-full max-w-md">
          <div className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden" style={{ borderRadius: "2px" }}>
            <TerminalHeader title="you.md -- error" />
            <div className="p-6 font-mono text-[14px] space-y-2">
              <p className="text-[hsl(var(--text-secondary))] opacity-60">
                &gt; lookup @{username}
              </p>
              <p className="text-[hsl(var(--accent))]">ERR: profile not found</p>
              <p className="text-[hsl(var(--text-secondary))] opacity-40 text-[13px] mt-3">
                this username has not been claimed yet.
              </p>
              <div className="border-t border-[hsl(var(--border))] pt-3 mt-4 flex gap-4">
                <Link href="/create" className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors">
                  &gt; create profile
                </Link>
                <Link href="/profiles" className="text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80 transition-opacity">
                  &gt; ls /profiles
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use live Convex data when available, fall back to SSR data for instant first paint
  const resolvedProfile = profile ?? ssrProfile;

  // Loading — only show spinner if no data at all (neither SSR nor Convex)
  if (!resolvedProfile) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]">
        <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
          loading...
        </p>
      </div>
    );
  }

  const data = resolvedProfile.youJson as Record<string, any> | null;

  // Profile exists but no youJson yet
  if (!data) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
        <ProfileHeader username={username} />
        <main className="flex-1 max-w-[680px] mx-auto w-full px-4 md:px-6 pt-8 md:pt-12 pb-16">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            {resolvedProfile.avatarUrl && (
              <PortraitFrame src={resolvedProfile.avatarUrl} />
            )}
            <div className="min-w-0 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-mono tracking-tight text-[hsl(var(--accent))]">
                {resolvedProfile.displayName || `@${username}`}
              </h1>
              {resolvedProfile.displayName && (
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-xs font-mono mt-1">@{username}</p>
              )}
            </div>
          </div>
          <div className="mt-8 border border-[hsl(var(--border))] p-5 bg-[hsl(var(--bg-raised))]" style={{ borderRadius: "2px" }}>
            <p className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[13px]">
              this identity is being built. check back soon.
            </p>
            {!resolvedProfile.isClaimed && (
              <Link href="/sign-up" className="block mt-3 text-[hsl(var(--accent-mid))] hover:text-[hsl(var(--accent))] transition-colors font-mono text-[13px]">
                &gt; claim this identity
              </Link>
            )}
          </div>
        </main>
        <ProfileFooter username={username} />

        {/* Claim banner */}
        {!resolvedProfile.isClaimed && <ClaimBanner username={username} />}
      </div>
    );
  }

  // Full profile
  const name = data.identity?.name || resolvedProfile.displayName || username;
  const tagline = data.identity?.tagline || "";
  const location = data.identity?.location || "";
  const bio = data.identity?.bio?.long || data.identity?.bio?.medium || data.identity?.bio?.short || "";
  const topics: string[] = data.analysis?.topics || [];
  const voice = data.analysis?.voice_summary || "";
  const preferences = data.preferences || {};

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">

      <ProfileHeader username={username} />

      <main className="flex-1 max-w-[680px] mx-auto w-full px-4 md:px-6 pt-8 md:pt-12 pb-20">

        {/* ═══ SYSTEM HEADER ═══ */}
        <motion.section {...delay(0)} className="mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-4">
            {resolvedProfile.avatarUrl && (
              <PortraitFrame src={resolvedProfile.avatarUrl} />
            )}
            <div className="min-w-0 text-center sm:text-left flex-1">
              <h1 className="text-xl sm:text-2xl font-mono tracking-tight text-[hsl(var(--text-primary))]">{name}</h1>
              {tagline && <p className="text-[hsl(var(--text-secondary))] text-[13px] mt-1 leading-relaxed">{tagline}</p>}
            </div>
          </div>

          {/* Status panel */}
          <div className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] space-y-1.5" style={{ borderRadius: "2px" }}>
            <div className="flex items-center justify-between">
              <button onClick={handleCopy} className="flex items-center gap-1.5 text-[hsl(var(--accent))] font-mono text-[12px] hover:opacity-80 transition-opacity">
                you.md/{username}
                <span className="text-[9px]">{copied ? "copied" : ""}</span>
              </button>
              <span className="font-mono text-[10px] text-[hsl(var(--success))] uppercase tracking-wider flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
                active
              </span>
            </div>
            {location && (
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">{location}</p>
            )}
            <p className="font-mono text-[11px]">
              <span className="text-[hsl(var(--text-secondary))] opacity-50">@{username}</span>
            </p>
          </div>
        </motion.section>

        <Divider />

        {/* ═══ IDENTITY ═══ */}
        <motion.section {...delay(1)}>
          <SectionLabel>identity</SectionLabel>
          {bio && <p className="text-[hsl(var(--text-secondary))] text-[14px] leading-[1.7] mt-3 mb-4">{bio}</p>}
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {topics.map((t: string) => (
                <span key={t} className="font-mono text-[10px] px-2 py-0.5 border border-[hsl(var(--accent))]/20 text-[hsl(var(--accent))]/70" style={{ borderRadius: "2px" }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </motion.section>

        {/* ═══ NOW ═══ */}
        {data.now?.focus && data.now.focus.length > 0 && (
          <>
            <Divider />
            <motion.section {...delay(2)}>
              <SectionLabel>current activity</SectionLabel>
              <div className="mt-3">
                {data.now.focus.map((item: string, i: number) => (
                  <p key={i} className="text-[hsl(var(--text-secondary))] font-mono text-[12px] leading-relaxed">- {item}</p>
                ))}
              </div>
            </motion.section>
          </>
        )}

        {/* ═══ PROJECTS ═══ */}
        {data.projects && data.projects.length > 0 && (
          <>
            <Divider />
            <motion.section {...delay(3)}>
              <SectionLabel>projects</SectionLabel>
              <div className="grid gap-2 mt-3">
                {data.projects.map((project: Project, i: number) => (
                  <div
                    key={i}
                    className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] hover:border-[hsl(var(--accent))]/20 transition-colors group"
                    style={{ borderRadius: "2px" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[13px] text-[hsl(var(--text-primary))]">{project.name}</span>
                        {project.status && (
                          <span className={`font-mono text-[9px] uppercase tracking-wider ${statusColor(project.status)}`}>
                            {project.status}
                          </span>
                        )}
                      </div>
                      {project.url && (
                        <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--text-secondary))] opacity-30 group-hover:text-[hsl(var(--accent))] transition-colors shrink-0 text-xs">
                          {"\u2197"}
                        </a>
                      )}
                    </div>
                    {project.role && (
                      <span className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[10px]">{project.role}</span>
                    )}
                    {project.description && (
                      <p className="text-[hsl(var(--text-secondary))] opacity-60 text-[12px] mt-1.5 leading-relaxed">{project.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          </>
        )}

        {/* ═══ VALUES ═══ */}
        {data.values && data.values.length > 0 && (
          <>
            <Divider />
            <motion.section {...delay(4)}>
              <SectionLabel>values</SectionLabel>
              <div className="space-y-0.5 mt-3">
                {data.values.map((value: string, i: number) => (
                  <p key={i} className="text-[hsl(var(--text-secondary))] opacity-60 font-mono text-[11px]">{"\u203A"} {value}</p>
                ))}
              </div>
            </motion.section>
          </>
        )}

        {/* ═══ LINKS ═══ */}
        {data.links && Object.keys(data.links).some((k: string) => data.links[k]) && (
          <>
            <Divider />
            <motion.section {...delay(5)}>
              <SectionLabel>links</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-3">
                {Object.entries(data.links)
                  .filter(([, url]) => url)
                  .map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[hsl(var(--accent))]/80 hover:text-[hsl(var(--accent))] font-mono text-[11px] transition-colors border border-[hsl(var(--border))] px-3 py-1.5 hover:border-[hsl(var(--accent))]/30"
                      style={{ borderRadius: "2px" }}
                    >
                      <LinkFavicon url={url as string} />
                      {platform}
                      <span className="text-[9px] opacity-50">{"\u2197"}</span>
                    </a>
                  ))}
              </div>
            </motion.section>
          </>
        )}

        {/* ═══ FOR AGENTS ═══ */}
        <Divider />
        <motion.section {...delay(6)}>
          <SectionLabel>for agents</SectionLabel>
          <div className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] mt-3 space-y-2 font-mono text-[11px]" style={{ borderRadius: "2px" }}>
            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px]">direct endpoints (no JS required):</p>
            <p className="text-[hsl(var(--accent))]">GET you.md/{username}/you.json</p>
            <p className="text-[hsl(var(--accent))] opacity-70">GET you.md/{username}/you.txt</p>
            <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">preferred retrieval order:</p>
            <p className="text-[hsl(var(--text-secondary))] opacity-70">1. /{username}/you.json -- structured identity bundle</p>
            <p className="text-[hsl(var(--text-secondary))] opacity-70">2. /{username}/you.txt -- plain text markdown</p>
            <p className="text-[hsl(var(--text-secondary))] opacity-70">3. /{username} -- HTML profile (requires JS)</p>
            {voice && (
              <>
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">voice:</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">{voice}</p>
              </>
            )}
            {preferences?.agent?.tone && (
              <>
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">tone:</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">{preferences.agent.tone}</p>
              </>
            )}
            {preferences?.agent?.avoid?.length > 0 && (
              <>
                <p className="text-[hsl(var(--text-secondary))] opacity-50 text-[10px] mt-3">avoid:</p>
                <p className="text-[hsl(var(--text-secondary))] opacity-70">{preferences.agent.avoid.join(", ")}</p>
              </>
            )}
          </div>
        </motion.section>

        {/* ═══ EXPORT ═══ */}
        <Divider />
        <motion.section {...delay(7)}>
          <SectionLabel>export</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => {
                const json = generateYouJson({
                  username,
                  name: name as string,
                  youJson: data,
                  isClaimed: resolvedProfile.isClaimed,
                  avatarUrl: resolvedProfile.avatarUrl,
                });
                downloadFile(JSON.stringify(json, null, 2), `${username}.you.json`, "application/json");
              }}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
              style={{ borderRadius: "2px" }}
            >
              {"\u2193"} you.json
            </button>
            <button
              onClick={() => {
                const md = generateYouMd({ username, name: name as string, youJson: data });
                downloadFile(md, `${username}.you.md`, "text/markdown");
              }}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] opacity-70 hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30 transition-colors"
              style={{ borderRadius: "2px" }}
            >
              {"\u2193"} you.md
            </button>
          </div>
        </motion.section>

        {/* ═══ SHARE ═══ */}
        <Divider />
        <motion.section {...delay(8)}>
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
        </motion.section>

        {/* Footer tagline */}
        <motion.div {...delay(9)} className="text-center mt-16 space-y-2">
          <p className="text-[hsl(var(--text-secondary))] opacity-30 font-mono text-[9px]">
            updated by the human. maintained by the system.
          </p>
        </motion.div>
      </main>

      <ProfileFooter username={username} />

      {/* Claim banner for unclaimed profiles */}
      {!resolvedProfile.isClaimed && <ClaimBanner username={username} />}
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────── */

function ProfileHeader({ username }: { username: string }) {
  return (
    <header className="border-b border-[hsl(var(--border))] shrink-0">
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
        <Link
          href={`/${username}`}
          className="font-mono text-[12px] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] transition-colors"
        >
          you.md/{username}
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/profiles" className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[10px] hover:text-[hsl(var(--accent))] transition-colors">
            /profiles
          </Link>
          <Link href="/" className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[10px] hover:opacity-70 transition-opacity">
            what is this?
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProfileFooter({ username }: { username: string }) {
  return (
    <footer className="border-t border-[hsl(var(--border))] shrink-0">
      <div className="max-w-[680px] mx-auto px-6 py-6 text-center flex items-center justify-center gap-4">
        <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30 uppercase tracking-widest">
          powered by{" "}
          <Link href="/" className="text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity">
            you.md
          </Link>
        </p>
        <Link href="/create" className="text-[hsl(var(--text-secondary))] opacity-30 font-mono text-[10px] hover:text-[hsl(var(--accent))] transition-colors">
          &gt; create yours
        </Link>
      </div>
    </footer>
  );
}

function ClaimBanner({ username }: { username: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3">
      <div className="max-w-[680px] mx-auto">
        <div className="border border-[hsl(var(--accent))]/30 bg-[hsl(var(--bg-raised))] p-3 sm:p-4" style={{ borderRadius: "2px" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[12px] text-[hsl(var(--text-primary))] opacity-80">
                this profile is unclaimed
              </p>
              <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mt-0.5">
                sign in to claim @{username} and unlock editing + private context
              </p>
            </div>
            <Link
              href="/sign-up"
              className="shrink-0 font-mono text-[11px] px-3 py-1.5 bg-[hsl(var(--accent))] text-[hsl(var(--bg))] hover:opacity-90 transition-opacity"
              style={{ borderRadius: "2px" }}
            >
              claim profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortraitFrame({ src }: { src: string }) {
  return (
    <div className="shrink-0 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] overflow-hidden" style={{ borderRadius: "2px" }}>
      <AsciiAvatar src={src} cols={120} canvasWidth={240} className="hidden sm:block" />
      <AsciiAvatar src={src} cols={60} canvasWidth={120} className="block sm:hidden" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[hsl(var(--accent))] font-mono text-[11px] uppercase tracking-wider">
      &gt; {children}
    </h2>
  );
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] my-8" />;
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
      alt={`${domain} favicon`}
      width={16}
      height={16}
      className="shrink-0"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
