"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GithubRepoSection } from "./GithubRepoSection";
import { GithubOnboarding } from "./GithubOnboarding";
import { PaneHeader } from "./shared";

interface GithubPaneProps {
  clerkId: string;
}

export function GithubPane({ clerkId }: GithubPaneProps) {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();

  const connection = useQuery(
    api.github.getConnection,
    isAuthenticated && clerkId ? { clerkId } : "skip"
  );

  // Show onboarding when:
  // (a) the user just completed OAuth (?integration=github), OR
  // (b) they are connected but have no repo yet (first-time experience).
  const isPostOAuth = searchParams.get("integration") === "github";
  const isConnected = connection !== null && connection !== undefined;
  const hasRepo = isConnected && !!connection?.repoFullName;
  const showOnboarding = isConnected && (isPostOAuth || !hasRepo);

  return (
    <div className="flex flex-col h-full">
      <PaneHeader>github</PaneHeader>
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Loading */}
        {connection === undefined && (
          <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
            loading...
          </p>
        )}

        {/* Not connected — GithubRepoSection handles the connect CTA */}
        {connection === null && (
          <GithubRepoSection clerkId={clerkId} />
        )}

        {/* Connected: show onboarding flow first, then repo management below */}
        {isConnected && (
          <>
            {showOnboarding && (
              <GithubOnboarding clerkId={clerkId} connection={connection} />
            )}

            {/* Always keep repo management available; separate it with a divider
                when onboarding is also visible so the pane reads cleanly. */}
            {showOnboarding && hasRepo && (
              <div className="h-px bg-[hsl(var(--border))]" />
            )}

            {/* Show GithubRepoSection once onboarding is complete (repo exists),
                or always so users can reconfigure. */}
            {hasRepo && (
              <GithubRepoSection clerkId={clerkId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
