"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, MapPin, LayoutGrid, List } from "lucide-react";
import type { PreRenderedPortrait } from "@/components/AsciiAvatar";
import ProfilePortrait from "@/components/ProfilePortrait";
import FadeUp from "@/components/landing/FadeUp";
import { hasRenderableAsciiPortrait } from "@/lib/profilePortrait";

/* ── Types ────────────────────────────────────────────────── */

interface DirectoryEntry {
  username: string;
  name: string | null;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  asciiPortrait: PreRenderedPortrait | null;
  hasPortrait: boolean;
  isClaimed: boolean;
  source: "profiles" | "legacy" | "ssr";
  projectCount: number;
  nowItems: string[];
  links: Record<string, string>;
  updatedAt: number | null;
}

interface InitialDirectoryProfile {
  username: string;
  name?: string | null;
  tagline?: string | null;
  bio?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
  isClaimed?: boolean;
  updatedAt?: number | null;
}

function canonicalUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isSuppressedDirectoryUsername(username: string) {
  return /^(qaprune|qarepro|qaclean|qastale|qalocal|qaweb|websignin|youmdqa|youmdreg)[a-z0-9-]*/i.test(username);
}

function sanitizeImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  if (raw.startsWith("/")) return raw;
  try {
    const url = new URL(raw);
    for (const param of ["apiKey", "apikey", "api_key", "access_token", "token"]) {
      url.searchParams.delete(param);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function normalizeLinks(...sources: unknown[]): Record<string, string> {
  const links: Record<string, string> = {};
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (typeof value !== "string" || !value.trim()) continue;
      const lower = key.trim().toLowerCase();
      const canonical =
        lower === "twitter" || lower === "x/twitter"
          ? "x"
          : lower.includes("github")
            ? "github"
            : lower.includes("linkedin")
              ? "linkedin"
              : lower;
      links[key.trim()] = value.trim();
      if (!links[canonical]) links[canonical] = value.trim();
    }
  }
  return links;
}

function handleFromUrl(value: string | undefined, host: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!url.hostname.toLowerCase().includes(host)) return null;
    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    const match = value.match(new RegExp(`${host.replace(".", "\\.")}/([^/?#]+)`, "i"));
    return match?.[1] ?? null;
  }
}

function resolveAvatarUrl(profile: Record<string, unknown>, youJson: Record<string, unknown> | undefined): string | null {
  const socialImages = {
    ...((youJson?.social_images ?? {}) as Record<string, string>),
    ...((profile.socialImages ?? {}) as Record<string, string>),
  };
  const primaryImage = profile.primaryImage as string | undefined;
  if (primaryImage && socialImages[primaryImage]) return sanitizeImageUrl(socialImages[primaryImage]);

  const direct = sanitizeImageUrl(
    profile.avatarUrl ??
      (youJson?._profile as Record<string, unknown> | undefined)?.avatarUrl ??
      (youJson?.identity as Record<string, unknown> | undefined)?.avatarUrl ??
      (youJson?.identity as Record<string, unknown> | undefined)?.avatar_url
  );
  if (direct) return direct;

  const social = sanitizeImageUrl(socialImages.github ?? socialImages.x ?? socialImages.linkedin ?? socialImages.custom);
  if (social) return social;

  const links = normalizeLinks(profile.links, youJson?.links);
  const github = handleFromUrl(links.github, "github.com");
  if (github) return `https://github.com/${github}.png`;
  const x = handleFromUrl(links.x, "x.com") ?? handleFromUrl(links.x, "twitter.com");
  if (x) return `https://unavatar.io/x/${x}`;
  const linkedin = handleFromUrl(links.linkedin, "linkedin.com");
  if (linkedin) return `https://unavatar.io/linkedin/${linkedin}`;
  return null;
}

/* ── List Card ────────────────────────────────────────────── */

function ProfileListCard({ entry, index }: { entry: DirectoryEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
    >
      <Link
        href={`/${entry.username}`}
        className="block py-4 border-b border-[hsl(var(--border))] group hover:bg-[hsl(var(--accent))]/[0.03] transition-all duration-200 px-3 -mx-3"
      >
        <div className="flex items-center gap-4">
          <ProfilePortrait
            username={entry.username}
            name={entry.name}
            avatarUrl={entry.avatarUrl}
            asciiPortrait={entry.asciiPortrait}
            className="h-10 w-10"
            cols={30}
            canvasWidth={40}
            showPhotoOnHover
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[hsl(var(--text-primary))] font-mono text-[13px] font-medium tracking-tight truncate">
                  {entry.name || `@${entry.username}`}
                </h3>
                {!entry.isClaimed && (
                  <span className="font-mono text-[8px] text-[hsl(var(--text-secondary))]/40 border border-[hsl(var(--border))] px-1 shrink-0" style={{ borderRadius: "var(--radius)" }}>
                    unclaimed
                  </span>
                )}
                <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.isClaimed ? "bg-[hsl(var(--success))]/60" : "bg-[hsl(var(--text-secondary))]/20"
                }`} />
              </div>
              <ArrowRight
                size={12}
                className="text-[hsl(var(--text-secondary))]/30 group-hover:text-[hsl(var(--accent))] group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </div>
            {entry.name && (
              <p className="text-[hsl(var(--text-secondary))] opacity-50 font-mono text-[10px] mt-0.5">
                @{entry.username}
              </p>
            )}
            {entry.tagline && (
              <p className="text-[hsl(var(--text-secondary))] text-[12px] mt-0.5 truncate">
                {entry.tagline}
              </p>
            )}
            {!entry.tagline && entry.bio && (
              <p className="text-[hsl(var(--text-secondary))] opacity-60 text-[11px] mt-0.5 truncate">
                {entry.bio}
              </p>
            )}
            {/* Meta line */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {entry.location && (
                <span className="flex items-center gap-1 text-[hsl(var(--text-secondary))]/60 font-mono text-[10px]">
                  <MapPin size={9} /> {entry.location}
                </span>
              )}
              {entry.projectCount > 0 && (
                <span className="text-[hsl(var(--accent))]/60 font-mono text-[9px]">
                  {entry.projectCount} project{entry.projectCount !== 1 ? "s" : ""}
                </span>
              )}
              {entry.nowItems.length > 0 && (
                <span className="text-[hsl(var(--text-secondary))]/40 font-mono text-[9px] truncate max-w-[200px]">
                  now: {entry.nowItems[0]}
                </span>
              )}
              {Object.entries(entry.links).filter(([, url]) => url).length > 0 && (
                <span className="flex items-center gap-1.5">
                  {entry.links.github && (
                    <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[9px]">gh</span>
                  )}
                  {(entry.links.x || entry.links["x/twitter"]) && (
                    <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[9px]">x</span>
                  )}
                  {entry.links.linkedin && (
                    <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[9px]">li</span>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Grid Card ────────────────────────────────────────────── */

function ProfileGridCard({ entry, index }: { entry: DirectoryEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 + index * 0.03 }}
    >
      <Link
        href={`/${entry.username}`}
        className="flex flex-col bg-[hsl(var(--raised))] border border-[hsl(var(--border))] group hover:border-[hsl(var(--accent))]/30 transition-all duration-200 p-3 h-full"
      >
        {/* Avatar + status row */}
        <div className="flex items-start justify-between mb-3">
          <ProfilePortrait
            username={entry.username}
            name={entry.name}
            avatarUrl={entry.avatarUrl}
            asciiPortrait={entry.asciiPortrait}
            className="h-12 w-12"
            cols={30}
            canvasWidth={48}
            showPhotoOnHover
          />
          <div className="flex flex-col items-end gap-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              entry.isClaimed ? "bg-[hsl(var(--success))]/60" : "bg-[hsl(var(--text-secondary))]/20"
            }`} />
            {!entry.isClaimed && (
              <span className="font-mono text-[7px] text-[hsl(var(--text-secondary))]/40 border border-[hsl(var(--border))] px-1" style={{ borderRadius: "var(--radius)" }}>
                unclaimed
              </span>
            )}
          </div>
        </div>

        {/* Name + username */}
        <h3 className="text-[hsl(var(--text-primary))] font-mono text-[12px] font-medium tracking-tight truncate mb-0.5">
          {entry.name || `@${entry.username}`}
        </h3>
        {entry.name && (
          <p className="text-[hsl(var(--text-secondary))] opacity-40 font-mono text-[9px] truncate mb-1">
            @{entry.username}
          </p>
        )}

        {/* Tagline or bio */}
        {(entry.tagline || entry.bio) && (
          <p className="text-[hsl(var(--text-secondary))] text-[11px] leading-snug line-clamp-2 mb-2 flex-1">
            {entry.tagline || entry.bio}
          </p>
        )}
        {!entry.tagline && !entry.bio && <div className="flex-1" />}

        {/* Footer meta */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-[hsl(var(--border))]/50">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.location && (
              <span className="flex items-center gap-0.5 text-[hsl(var(--text-secondary))]/50 font-mono text-[9px]">
                <MapPin size={8} /> {entry.location}
              </span>
            )}
            {entry.projectCount > 0 && (
              <span className="text-[hsl(var(--accent))]/60 font-mono text-[9px]">
                {entry.projectCount}p
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {entry.links.github && (
              <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[8px]">gh</span>
            )}
            {(entry.links.x || entry.links["x/twitter"]) && (
              <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[8px]">x</span>
            )}
            {entry.links.linkedin && (
              <span className="text-[hsl(var(--text-secondary))]/30 font-mono text-[8px]">li</span>
            )}
            <ArrowRight
              size={10}
              className="text-[hsl(var(--text-secondary))]/20 group-hover:text-[hsl(var(--accent))] transition-colors ml-0.5"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */

export function ProfilesDirectoryContent({
  initialProfiles = [],
}: {
  initialProfiles?: InitialDirectoryProfile[];
}) {
  const profiles = useQuery(api.profiles.listAll);
  const legacyUsers = useQuery(api.users.listAllLegacy);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "has-projects" | "has-portrait">("all");
  const [sort, setSort] = useState<"recent" | "projects" | "alpha">("recent");
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

  // Build entries — dedup by canonical username (profiles source wins over legacy)
  const entries: DirectoryEntry[] = useMemo(() => {
    const seen = new Set<string>();
    const result: DirectoryEntry[] = [];

    const primaryProfiles = profiles ?? initialProfiles;

    if (primaryProfiles) {
      for (const p of primaryProfiles) {
        const username = canonicalUsername(p.username);
        if (!username || isSuppressedDirectoryUsername(username) || seen.has(username)) continue;
        seen.add(username);

        const profileRecord = p as Record<string, unknown>;
        const youJson = profileRecord.youJson as Record<string, unknown> | undefined;
        const identity = (youJson?.identity ?? {}) as Record<string, unknown>;
        const bioRecord = (identity.bio ?? {}) as Record<string, unknown>;
        const bio =
          (typeof bioRecord.short === "string" && bioRecord.short) ||
          (typeof bioRecord.medium === "string" && bioRecord.medium) ||
          "";
        const projects = youJson?.projects as Array<Record<string, string>> | undefined;
        const nowRecord = (youJson?.now ?? {}) as Record<string, unknown>;
        const now = nowRecord.focus as string[] | undefined;
        const links = normalizeLinks(profileRecord.links, youJson?.links);
        const avatarUrl = resolveAvatarUrl(profileRecord, youJson);
        const rawPortrait =
          profileRecord.asciiPortrait ?? (youJson?._profile as Record<string, unknown> | undefined)?.asciiPortrait;
        const asciiPortrait = hasRenderableAsciiPortrait(rawPortrait)
          ? (rawPortrait as PreRenderedPortrait)
          : null;

        result.push({
          username,
          name:
            (typeof p.name === "string" && p.name) ||
            (typeof identity.name === "string" && identity.name) ||
            null,
          tagline:
            (typeof p.tagline === "string" && p.tagline) ||
            (typeof identity.tagline === "string" && identity.tagline) ||
            null,
          bio: bio ? (bio.length > 160 ? bio.slice(0, 160) + "..." : bio) : null,
          location:
            (typeof p.location === "string" && p.location) ||
            (typeof identity.location === "string" && identity.location) ||
            null,
          avatarUrl,
          asciiPortrait,
          hasPortrait: Boolean(avatarUrl || asciiPortrait),
          isClaimed: Boolean(p.isClaimed),
          source: profiles ? "profiles" : "ssr",
          projectCount: projects?.length ?? 0,
          nowItems: (now || []).slice(0, 2),
          links,
          updatedAt: ((p as Record<string, unknown>).updatedAt as number | undefined) ?? ((p as Record<string, unknown>).createdAt as number | undefined) ?? null,
        });
      }
    }

    if (legacyUsers) {
      for (const u of legacyUsers) {
        const username = canonicalUsername(u.username);
        if (!username || isSuppressedDirectoryUsername(username) || seen.has(username)) continue;
        seen.add(username);

        result.push({
          username,
          name: u.displayName ?? null,
          tagline: null,
          bio: null,
          location: null,
          avatarUrl: null,
          asciiPortrait: null,
          hasPortrait: false,
          isClaimed: true,
          source: "legacy",
          projectCount: 0,
          nowItems: [],
          links: {},
          updatedAt: null,
        });
      }
    }

    return result;
  }, [profiles, initialProfiles, legacyUsers]);

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter
    if (filter === "verified") {
      result = result.filter((e) => e.isClaimed);
    } else if (filter === "has-projects") {
      result = result.filter((e) => e.projectCount > 0);
    } else if (filter === "has-portrait") {
      result = result.filter((e) => e.hasPortrait);
    }

    // Search across name, username, tagline, bio, location
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.username.toLowerCase().includes(q) ||
          (e.name && e.name.toLowerCase().includes(q)) ||
          (e.tagline && e.tagline.toLowerCase().includes(q)) ||
          (e.bio && e.bio.toLowerCase().includes(q)) ||
          (e.location && e.location.toLowerCase().includes(q))
      );
    }

    // Sort
    if (sort === "recent") {
      result.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    } else if (sort === "projects") {
      result.sort((a, b) => b.projectCount - a.projectCount);
    } else if (sort === "alpha") {
      result.sort((a, b) => {
        const an = (a.name || a.username).toLowerCase();
        const bn = (b.name || b.username).toLowerCase();
        return an.localeCompare(bn);
      });
    }

    return result;
  }, [entries, search, filter, sort]);

  const isLoading = entries.length === 0 && (profiles === undefined || legacyUsers === undefined);
  const claimedCount = entries.filter((e) => e.isClaimed).length;
  const portraitCount = entries.filter((e) => e.hasPortrait).length;

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))]">
      <main className="px-4 pb-8 pt-7 sm:px-6 sm:pt-8">
        <div className="max-w-[680px] mx-auto">
          {/* Header */}
          <FadeUp>
            <div className="mb-10">
              <p className="text-[hsl(var(--text-secondary))]/60 font-mono text-[10px] uppercase tracking-widest mb-2">
                directory
              </p>
              <h1 className="text-[hsl(var(--text-primary))] font-mono text-xl md:text-2xl font-light tracking-tight mb-3">
                &gt; ls /profiles
              </h1>
              <p className="text-[hsl(var(--text-secondary))] text-[13px] leading-relaxed max-w-md">
                Identity surfaces published to the network. Each readable by any agent.
              </p>
              {!isLoading && (
                <p className="text-[hsl(var(--text-secondary))]/50 font-mono text-[10px] mt-3">
                  {entries.length} profiles {"\u00B7"} {claimedCount} claimed {"\u00B7"} {portraitCount} with portrait
                </p>
              )}
            </div>
          </FadeUp>

          {/* Controls */}
          {!isLoading && entries.length > 0 && (
            <div className="mb-6 space-y-3">
              {/* Search input */}
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--accent))]/50 font-mono text-[12px] pointer-events-none select-none"
                >
                  &gt;
                </span>
                <input
                  type="search"
                  name="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="grep name, bio, tagline, location..."
                  aria-label="search profiles"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-11 w-full border border-[hsl(var(--border))] bg-[hsl(var(--raised))] py-2 pl-7 pr-3 font-mono text-[12px] text-[hsl(var(--text-primary))] caret-[hsl(var(--accent))] transition-colors placeholder:text-[hsl(var(--text-secondary))]/30 focus:border-[hsl(var(--accent))]/50 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[hsl(var(--accent))]/20"
                  style={{ borderRadius: "var(--radius)" }}
                />
              </div>

              {/* Filters + Sort + View toggle */}
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
                {/* Filter buttons */}
                <div className="grid grid-cols-2 gap-2 min-[460px]:grid-cols-4 sm:flex sm:flex-wrap sm:gap-1.5">
                  {([
                    { key: "all", label: "all", ariaLabel: "show all profiles" },
                    { key: "verified", label: "claimed", ariaLabel: "show claimed profiles" },
                    { key: "has-projects", label: "projects", ariaLabel: "profiles with projects" },
                    { key: "has-portrait", label: "portrait", ariaLabel: "profiles with portraits" },
                  ] as const).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={filter === f.key}
                      aria-label={f.ariaLabel}
                      className={`inline-flex h-10 items-center justify-center border px-2.5 font-mono text-[10px] transition-colors sm:h-9 sm:px-3 ${
                        filter === f.key
                          ? "border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]/70 hover:border-[hsl(var(--accent))]/30 hover:text-[hsl(var(--accent))]"
                      }`}
                      style={{ borderRadius: "var(--radius)" }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Sort + view toggle */}
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-end">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">
                    sort
                  </span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "recent" | "projects" | "alpha")}
                    aria-label="sort profiles"
                    className="h-10 min-w-0 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] transition-colors hover:border-[hsl(var(--accent))]/30 hover:text-[hsl(var(--accent))] focus:border-[hsl(var(--accent))]/50 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[hsl(var(--accent))]/20 sm:h-9 sm:w-auto"
                    style={{ borderRadius: "var(--radius)" }}
                  >
                    <option value="recent">recently active</option>
                    <option value="projects">most projects</option>
                    <option value="alpha">alphabetical</option>
                  </select>

                  {/* View mode toggle */}
                  <div className="flex h-10 items-stretch border border-[hsl(var(--border))] sm:h-9" style={{ borderRadius: "var(--radius)" }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      aria-pressed={viewMode === "list"}
                      aria-label="list view"
                      className={`inline-flex w-10 items-center justify-center transition-colors ${
                        viewMode === "list"
                          ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "text-[hsl(var(--text-secondary))]/40 hover:text-[hsl(var(--accent))]"
                      }`}
                    >
                      <List size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-pressed={viewMode === "grid"}
                      aria-label="grid view"
                      className={`inline-flex w-10 items-center justify-center border-l border-[hsl(var(--border))] transition-colors ${
                        viewMode === "grid"
                          ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "text-[hsl(var(--text-secondary))]/40 hover:text-[hsl(var(--accent))]"
                      }`}
                    >
                      <LayoutGrid size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {(search.trim() || filter !== "all") && (
                <p className="text-[hsl(var(--text-secondary))]/40 font-mono text-[10px] ml-1">
                  {filteredEntries.length} {filteredEntries.length === 1 ? "match" : "matches"}
                </p>
              )}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="py-12">
              <span className="text-[hsl(var(--accent))]/70 font-mono text-[12px] animate-pulse">
                loading profiles...
              </span>
            </div>
          )}

          {/* Empty */}
          {!isLoading && entries.length === 0 && (
            <div className="py-12">
              <span className="text-[hsl(var(--text-secondary))]/50 font-mono text-[12px]">
                no profiles found. be the first.
              </span>
            </div>
          )}

          {/* No search results */}
          {!isLoading && entries.length > 0 && filteredEntries.length === 0 && (
            <div className="py-12">
              <p className="text-[hsl(var(--text-secondary))]/50 font-mono text-[12px]">
                no matches for &quot;{search}&quot;
              </p>
              <Link
                href="/create"
                className="text-[hsl(var(--accent))] font-mono text-[11px] hover:opacity-80 transition-opacity mt-3 inline-block"
              >
                &gt; create your own
              </Link>
            </div>
          )}

          {/* Profile list */}
          {!isLoading && filteredEntries.length > 0 && viewMode === "list" && (
            <div>
              {filteredEntries.map((entry, i) => (
                <ProfileListCard
                  key={entry.username}
                  entry={entry}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Profile grid */}
          {!isLoading && filteredEntries.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredEntries.map((entry, i) => (
                <ProfileGridCard
                  key={entry.username}
                  entry={entry}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      {!isLoading && (
        <footer className="px-6 pb-20">
          <div className="max-w-[680px] mx-auto">
            <motion.div
              className="text-center mt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/create"
                className="inline-flex items-center min-h-[44px] px-3 text-[hsl(var(--accent))] font-mono text-[11px] hover:opacity-80 transition-opacity mr-2"
              >
                &gt; create your profile
              </Link>
              <Link
                href="/"
                className="inline-flex items-center min-h-[44px] px-3 text-[hsl(var(--text-secondary))]/50 font-mono text-[11px] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; cd ~/you.md
              </Link>
            </motion.div>
          </div>
        </footer>
      )}
    </div>
  );
}
