"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

interface DirectoryEntry {
  username: string;
  name: string | null;
  tagline: string | null;
  isClaimed: boolean;
  source: "profiles" | "legacy";
}

export function ProfilesDirectoryContent() {
  const profiles = useQuery(api.profiles.listAll);
  const legacyUsers = useQuery(api.users.listAllLegacy);

  // Merge profiles + legacy users into a unified directory list
  const entries: DirectoryEntry[] = [];

  if (profiles) {
    for (const p of profiles) {
      entries.push({
        username: p.username,
        name: p.name ?? null,
        tagline: p.tagline ?? null,
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
        isClaimed: true,
        source: "legacy",
      });
    }
  }

  const isLoading = profiles === undefined || legacyUsers === undefined;
  const claimedCount = entries.filter((e) => e.isClaimed).length;

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-2xl">
        {/* Section label */}
        <p className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-widest mb-2">
          -- identity directory --
        </p>
        <p className="text-muted-foreground text-[13px] font-body mb-10">
          All registered identities on the network. Claimed and maintained by
          humans and agents.
        </p>

        {/* Terminal panel */}
        <div className="terminal-panel">
          <div className="terminal-panel-header">
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <div className="terminal-dot" />
            <span className="ml-2 text-muted-foreground/60 font-mono text-[10px]">
              &gt; ls /profiles --active
            </span>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="px-5 py-8">
              <span className="text-accent/70 font-mono text-[12px] animate-pulse">
                loading profiles...
              </span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && entries.length === 0 && (
            <div className="px-5 py-8">
              <span className="text-muted-foreground/50 font-mono text-[12px]">
                no profiles found. be the first.
              </span>
            </div>
          )}

          {/* Profile rows */}
          {!isLoading && entries.length > 0 && (
            <div className="divide-y divide-border">
              {entries.map((entry, i) => (
                <motion.div
                  key={`${entry.source}-${entry.username}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <Link
                    href={`/${entry.username}`}
                    className="flex items-center gap-4 px-5 py-3.5 group hover:bg-accent-wash/40 transition-colors"
                  >
                    {/* Status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        entry.isClaimed
                          ? "bg-success/60 status-dot-pulse"
                          : "bg-[hsl(var(--text-secondary))]/20"
                      }`}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-accent/80 group-hover:text-accent font-mono text-[12px] transition-colors shrink-0">
                          @{entry.username}
                        </span>
                        {entry.name && (
                          <span className="text-[hsl(var(--text-primary))] font-mono text-[12px] font-medium truncate">
                            {entry.name}
                          </span>
                        )}
                      </div>
                      {entry.tagline && (
                        <p className="text-muted-foreground font-mono text-[10px] truncate mt-0.5">
                          {entry.tagline}
                        </p>
                      )}
                    </div>

                    {/* Badge */}
                    <span
                      className={`hidden sm:inline font-mono text-[9px] shrink-0 ${
                        entry.isClaimed
                          ? "text-[hsl(var(--success))]/60"
                          : "text-muted-foreground/30"
                      }`}
                    >
                      {entry.isClaimed ? "claimed" : "unclaimed"}
                    </span>

                    <ArrowRight
                      size={12}
                      className="text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0"
                    />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}

          {/* Footer */}
          {!isLoading && entries.length > 0 && (
            <div className="px-5 py-3 border-t border-[hsl(var(--border))] flex items-center justify-between">
              <span className="text-muted-foreground/50 font-mono text-[9px]">
                {entries.length} registered &middot; {claimedCount} claimed
              </span>
              <Link
                href="/create"
                className="text-accent/70 hover:text-accent font-mono text-[10px] transition-colors"
              >
                &gt; create yours
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
