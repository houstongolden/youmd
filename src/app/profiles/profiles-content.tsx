"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, MapPin } from "lucide-react";
import AsciiAvatar from "@/components/AsciiAvatar";
import FadeUp from "@/components/landing/FadeUp";
import PixelYOU from "@/components/PixelYOU";

/* ── Types ────────────────────────────────────────────────── */

interface DirectoryEntry {
  username: string;
  name: string | null;
  tagline: string | null;
  location: string | null;
  avatarUrl: string | null;
  isClaimed: boolean;
  source: "profiles" | "legacy";
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
            {entry.location && (
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-[hsl(var(--text-secondary))]/60 font-mono text-[10px]">
                  <MapPin size={9} /> {entry.location}
                </span>
              </div>
            )}
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
      entries.push({
        username: p.username,
        name: p.name ?? null,
        tagline: p.tagline ?? youJson?.identity?.tagline ?? null,
        location: p.location ?? youJson?.identity?.location ?? null,
        avatarUrl: p.avatarUrl ?? null,
        isClaimed: p.isClaimed,
        source: "profiles",
      });
    }
  }

  if (legacyUsers) {
    for (const u of legacyUsers) {
      entries.push({
        username: u.username,
        name: u.displayName ?? null,
        tagline: null,
        location: null,
        avatarUrl: null,
        isClaimed: true,
        source: "legacy",
      });
    }
  }

  const isLoading = profiles === undefined || legacyUsers === undefined;
  const claimedCount = entries.filter((e) => e.isClaimed).length;

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 md:pt-4">
        <div className="max-w-[680px] mx-auto flex items-center justify-between px-4 py-2 glass-nav rounded">
          <Link href="/" className="inline-block">
            <PixelYOU />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/create"
              className="text-[hsl(var(--accent))] font-mono text-[10px] hover:opacity-80 transition-opacity"
            >
              + create
            </Link>
            <span className="text-[hsl(var(--text-secondary))]/60 font-mono text-[10px]">
              /profiles
            </span>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-20 pb-20 px-6">
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

          {/* Profile list */}
          {!isLoading && entries.length > 0 && (
            <div>
              {entries.map((entry, i) => (
                <ProfileCard
                  key={`${entry.source}-${entry.username}`}
                  entry={entry}
                  index={i}
                />
              ))}
            </div>
          )}

          {/* Bottom CTAs */}
          {!isLoading && (
            <motion.div
              className="text-center mt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link
                href="/create"
                className="text-[hsl(var(--accent))] font-mono text-[11px] hover:opacity-80 transition-opacity mr-4"
              >
                &gt; create your profile
              </Link>
              <Link
                href="/"
                className="text-[hsl(var(--text-secondary))]/50 font-mono text-[11px] hover:text-[hsl(var(--accent))] transition-colors"
              >
                &gt; cd ~/you.md
              </Link>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
