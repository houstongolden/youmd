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
      <div className="flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))] shrink-0">
        <div className="flex items-center gap-0.5">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={`px-2.5 py-1 text-[10px] font-mono transition-colors whitespace-nowrap ${
                subTab === tab.key
                  ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border border-[hsl(var(--border))]"
                  : "text-[hsl(var(--text-secondary))] opacity-30 hover:opacity-60"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active sub-pane */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {subTab === "files" && <FilesPane userId={userId} />}
        {subTab === "json" && <JsonPane userId={userId} />}
        {subTab === "sources" && <SourcesPane username={username} />}
      </div>
    </div>
  );
}
