"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, MapPin } from "lucide-react";
import AsciiAvatar from "@/components/AsciiAvatar";
import FadeUp from "@/components/landing/FadeUp";
// PixelYOU removed — too large for nav headers, use text logo instead

/* ── Types ────────────────────────────────────────────────── */

interface DirectoryEntry {
  username: string;
  name: string | null;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  isClaimed: boolean;
  source: "profiles" | "legacy";
  projectCount: number;
  nowItems: string[];
  links: Record<string, string>;
  updatedAt: number | null;
}

/* ── Profile Card ─────────────────────────────────────────── */

function ProfileCard({ entry, index }: { entry: DirectoryEntry; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
    >
      <Link
        href={`/${entry.username}`}
        className="block py-4 border-b border-[hsl(var(--border))] group hover:bg-[hsl(var(--accent))]/[0.03] transition-all duration-200 px-3 -mx-3"
        style={{ borderRadius: "2px" }}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className="w-10 h-10 overflow-hidden border border-[hsl(var(--border))] group-hover:border-[hsl(var(--accent))]/30 transition-colors shrink-0 bg-[hsl(var(--bg))] relative"
            style={{ borderRadius: "2px" }}
          >
            {entry.avatarUrl ? (
              <>
                <AsciiAvatar
                  src={entry.avatarUrl}
                  cols={30}
                  canvasWidth={40}
                  className="w-full h-full"
                />
                <img
                  src={entry.avatarUrl}
                  alt={entry.name || entry.username}
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  loading="lazy"
                />
              </>
            ) : (
              <span className="w-full h-full flex items-center justify-center font-mono text-[14px] text-[hsl(var(--accent))]/60">
                {(entry.name || entry.username).charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[hsl(var(--text-primary))] font-mono text-[13px] font-medium tracking-tight truncate">
                  {entry.name || `@${entry.username}`}
                </h3>
                {!entry.isClaimed && (
                  <span className="font-mono text-[8px] text-[hsl(var(--text-secondary))]/40 border border-[hsl(var(--border))] px-1 shrink-0" style={{ borderRadius: "2px" }}>
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
            {/* Meta line — location, projects, now */}
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
              {/* Social link icons */}
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

/* ── Main ─────────────────────────────────────────────────── */

export function ProfilesDirectoryContent() {
  const profiles = useQuery(api.profiles.listAll);
  const legacyUsers = useQuery(api.users.listAllLegacy);

  const entries: DirectoryEntry[] = [];

  if (profiles) {
    for (const p of profiles) {
      const youJson = p.youJson as Record<string, any> | undefined;
      const bio = youJson?.identity?.bio?.short || youJson?.identity?.bio?.medium || "";
      const projects = youJson?.projects as Array<Record<string, string>> | undefined;
      const now = youJson?.now?.focus as string[] | undefined;
      const links = (youJson?.links || {}) as Record<string, string>;
      entries.push({
        username: p.username,
        name: p.name ?? null,
        tagline: p.tagline ?? youJson?.identity?.tagline ?? null,
        bio: bio ? (bio.length > 120 ? bio.slice(0, 120) + "..." : bio) : null,
        location: p.location ?? youJson?.identity?.location ?? null,
        avatarUrl: p.avatarUrl ?? null,
        isClaimed: p.isClaimed,
        source: "profiles",
        projectCount: projects?.length ?? 0,
        nowItems: (now || []).slice(0, 2),
        links,
        updatedAt: ((p as Record<string, unknown>).updatedAt as number | undefined) ?? ((p as Record<string, unknown>).createdAt as number | undefined) ?? null,
      });
    }
  }

  if (legacyUsers) {
    for (const u of legacyUsers) {
      entries.push({
        username: u.username,
        name: u.displayName ?? null,
        tagline: null,
        bio: null,
        location: null,
        avatarUrl: null,
        isClaimed: true,
        source: "legacy",
        projectCount: 0,
        nowItems: [],
        links: {},
        updatedAt: null,
      });
    }
  }

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "has-projects">("all");
  const [sort, setSort] = useState<"recent" | "projects" | "alpha">("recent");

  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter
    if (filter === "verified") {
      result = result.filter((e) => e.isClaimed);
    } else if (filter === "has-projects") {
      result = result.filter((e) => e.projectCount > 0);
    }

    // Search across name, tagline, location, username
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          e.username.toLowerCase().includes(q) ||
          (e.name && e.name.toLowerCase().includes(q)) ||
          (e.tagline && e.tagline.toLowerCase().includes(q)) ||
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

  const isLoading = profiles === undefined || legacyUsers === undefined;
  const claimedCount = entries.filter((e) => e.isClaimed).length;

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))]">
      {/* Content — SiteNav handles navigation */}
      <main className="pt-8 pb-8 px-6">
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
                Identity surfaces published to the network. Each readable by any
                agent.
              </p>
              {!isLoading && (
                <p className="text-[hsl(var(--text-secondary))]/50 font-mono text-[10px] mt-3">
                  {entries.length} profiles {"\u00B7"} {claimedCount} claimed
                </p>
              )}
            </div>
          </FadeUp>

          {/* Search + Filter + Sort */}
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
                  placeholder="grep name, tagline, location..."
                  aria-label="search profiles by name, tagline, or location"
                  autoComplete="off"
                  spellCheck={false}
                  // Cycle 62: bumped from py-2 (38px tall) to min-h-[44px] for WCAG touch target
                  className="w-full bg-[hsl(var(--raised))] border border-[hsl(var(--border))] text-[hsl(var(--text-primary))] font-mono text-[12px] min-h-[44px] py-2 pl-7 pr-3 placeholder:text-[hsl(var(--text-secondary))]/30 focus:outline-none focus:border-[hsl(var(--accent))]/40 transition-colors caret-[hsl(var(--accent))]"
                  style={{ borderRadius: "2px" }}
                />
              </div>

              {/* Filter buttons + Sort dropdown */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  {([
                    { key: "all", label: "all" },
                    { key: "verified", label: "verified" },
                    { key: "has-projects", label: "has-projects" },
                  ] as const).map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      aria-pressed={filter === f.key}
                      // Cycle 62: bumped to min-h-[44px] (was 27px tall, half the WCAG min)
                      className={`font-mono text-[10px] inline-flex items-center justify-center min-h-[44px] px-3 border transition-colors ${
                        filter === f.key
                          ? "border-[hsl(var(--accent))]/60 text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                          : "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]/70 hover:border-[hsl(var(--accent))]/30 hover:text-[hsl(var(--accent))]"
                      }`}
                      style={{ borderRadius: "2px" }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[hsl(var(--text-secondary))]/40 font-mono text-[10px] uppercase tracking-wider">
                    sort
                  </span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as "recent" | "projects" | "alpha")}
                    aria-label="sort profiles"
                    // Cycle 62: bumped to min-h-[44px] (was 25px tall) + added aria-label
                    className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] font-mono text-[10px] min-h-[44px] px-2 focus:outline-none focus:border-[hsl(var(--accent))]/40 transition-colors hover:text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/30"
                    style={{ borderRadius: "2px" }}
                  >
                    <option value="recent">recently active</option>
                    <option value="projects">most projects</option>
                    <option value="alpha">alphabetical</option>
                  </select>
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
          {!isLoading && filteredEntries.length > 0 && (
            <div>
              {filteredEntries.map((entry, i) => (
                <ProfileCard
                  key={`${entry.source}-${entry.username}`}
                  entry={entry}
                  index={i}
                />
              ))}
            </div>
          )}

        </div>
      </main>

      {/* Page-level footer landmark — outside main so it gets contentinfo role */}
      {!isLoading && (
        <footer className="px-6 pb-20">
          <div className="max-w-[680px] mx-auto">
            <motion.div
              className="text-center mt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {/* Cycle 62: bumped both footer links from 14px tall to min-h-[44px] */}
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
