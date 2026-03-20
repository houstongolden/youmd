"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { CopyButton } from "@/components/ui/CopyButton";
import type { Id } from "../../../convex/_generated/dataModel";

interface JsonPaneProps {
  userId: Id<"users">;
}

export function JsonPane({ userId }: JsonPaneProps) {
  const latestBundle = useQuery(
    api.bundles.getLatestBundle,
    userId ? { userId } : "skip"
  );

  const json = latestBundle?.youJson;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          you.json
        </span>
        {json && (
          <CopyButton
            text={JSON.stringify(json, null, 2)}
            className="text-[10px] font-mono px-2 py-1 border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
          />
        )}
      </div>

      <div className="p-4">
        {json ? (
          <pre className="text-[11px] font-mono text-[hsl(var(--text-secondary))] leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(json, null, 2)}
          </pre>
        ) : (
          <p className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 font-mono">
            no bundle yet. talk to the agent to build your profile.
          </p>
        )}
      </div>
    </div>
  );
}
