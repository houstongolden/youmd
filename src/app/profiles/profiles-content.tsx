"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

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

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Terminal panel */}
        <div
          className="bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
          style={{ borderRadius: "2px" }}
        >
          <TerminalHeader title="you.md -- directory" />

          {/* Terminal body */}
          <div className="p-6 md:p-8 min-h-[300px] max-h-[80dvh] overflow-y-auto font-mono text-[14px] leading-relaxed">
            {/* Header lines */}
            <div className="text-[hsl(var(--accent))]">you.md v0.1.0</div>
            <div className="text-[hsl(var(--text-secondary))] opacity-60">
              identity context protocol for the agent internet
            </div>
            <div>&nbsp;</div>
            <div className="text-[hsl(var(--text-secondary))] opacity-50">
              listing all registered identities...
            </div>
            <div>&nbsp;</div>

            {/* Loading state */}
            {isLoading && (
              <div className="text-[hsl(var(--accent-mid))] animate-pulse">
                loading profiles...
              </div>
            )}

            {/* Empty state */}
            {!isLoading && entries.length === 0 && (
              <div className="text-[hsl(var(--text-secondary))] opacity-50">
                no profiles found. be the first.
              </div>
            )}

            {/* Profile list */}
            {!isLoading && entries.length > 0 && (
              <>
                {/* Column header */}
                <div className="flex items-center gap-4 text-[hsl(var(--text-secondary))] opacity-40 text-[12px] mb-2 border-b border-[hsl(var(--border))] pb-2">
                  <span className="w-[140px] shrink-0">username</span>
                  <span className="flex-1 min-w-0">name</span>
                  <span className="w-[80px] shrink-0 text-right">status</span>
                </div>

                {entries.map((entry) => (
                  <Link
                    key={`${entry.source}-${entry.username}`}
                    href={`/${entry.username}`}
                    className="flex items-center gap-4 py-1.5 group hover:bg-[hsl(var(--border)/0.15)] px-1 -mx-1 transition-colors"
                    style={{ borderRadius: "2px" }}
                  >
                    <span className="w-[140px] shrink-0 text-[hsl(var(--accent))] group-hover:opacity-100 opacity-80 transition-opacity truncate">
                      {entry.username}
                    </span>
                    <span className="flex-1 min-w-0 truncate">
                      {entry.name ? (
                        <span className="text-[hsl(var(--text-primary))] opacity-70">
                          {entry.name}
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--text-secondary))] opacity-30">
                          --
                        </span>
                      )}
                      {entry.tagline && (
                        <span className="text-[hsl(var(--text-secondary))] opacity-40 ml-2">
                          {entry.tagline}
                        </span>
                      )}
                    </span>
                    <span className="w-[80px] shrink-0 text-right text-[12px]">
                      {entry.isClaimed ? (
                        <span className="text-[hsl(var(--success))] opacity-60">
                          claimed
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--text-secondary))] opacity-30">
                          unclaimed
                        </span>
                      )}
                    </span>
                  </Link>
                ))}

                <div className="mt-4 text-[hsl(var(--text-secondary))] opacity-40 text-[12px]">
                  {entries.length} {entries.length === 1 ? "identity" : "identities"} registered
                </div>
              </>
            )}
          </div>
        </div>

        {/* Link below terminal */}
        <div className="mt-4 text-center">
          <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
            ready to initialize?{" "}
            <Link
              href="/initialize"
              className="text-[hsl(var(--accent))] opacity-70 hover:opacity-100 transition-opacity"
            >
              create yours
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
