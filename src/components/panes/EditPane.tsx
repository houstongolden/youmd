"use client";

import { useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { FilesPane } from "./FilesPane";
import { JsonPane } from "./JsonPane";
import { SourcesPane } from "./SourcesPane";

type EditSubTab = "files" | "json" | "sources";

interface EditPaneProps {
  userId: Id<"users">;
  username: string;
}

const SUB_TABS: { key: EditSubTab; label: string }[] = [
  { key: "files", label: "files" },
  { key: "json", label: "json" },
  { key: "sources", label: "sources" },
];

export function EditPane({ userId, username }: EditPaneProps) {
  const [subTab, setSubTab] = useState<EditSubTab>("files");

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Sub-tab bar */}
      <div className="flex items-center px-4 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-3">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={`relative px-1 py-2 text-[10px] font-mono transition-colors whitespace-nowrap ${
                subTab === tab.key
                  ? "text-[hsl(var(--text-primary))]"
                  : "text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
              }`}
            >
              {tab.label}
              {subTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[hsl(var(--accent))]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Active sub-pane */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === "files" && <FilesPane userId={userId} />}
        {subTab === "json" && <JsonPane userId={userId} />}
        {subTab === "sources" && <SourcesPane userId={userId} username={username} />}
      </div>
    </div>
  );
}
