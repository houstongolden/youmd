"use client";

import { GithubRepoSection } from "./GithubRepoSection";
import { PaneHeader } from "./shared";

interface GithubPaneProps {
  clerkId: string;
}

export function GithubPane({ clerkId }: GithubPaneProps) {
  return (
    <div className="flex flex-col h-full">
      <PaneHeader>github</PaneHeader>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <GithubRepoSection clerkId={clerkId} />
      </div>
    </div>
  );
}
