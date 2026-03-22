"use client";

import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

export function HelpPane() {
  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>help</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Quick start */}
        <SectionLabel>quick start</SectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-2">
          try these to get started:
        </p>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/share" />
          <CopyableCommand command="/share --private" />
          <CopyableCommand command="/portrait --regenerate" />
          <CopyableCommand command="/publish" />
        </div>

        <Divider />

        {/* Navigation */}
        <SectionLabel>navigation</SectionLabel>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/preview" dimmed />
          <CopyableCommand command="/files" dimmed />
          <CopyableCommand command="/json" dimmed />
          <CopyableCommand command="/sources" dimmed />
          <CopyableCommand command="/portrait" dimmed />
          <CopyableCommand command="/publish" dimmed />
          <CopyableCommand command="/agents" dimmed />
          <CopyableCommand command="/activity" dimmed />
          <CopyableCommand command="/settings" dimmed />
          <CopyableCommand command="/tokens" dimmed />
          <CopyableCommand command="/billing" dimmed />
        </div>

        <Divider />

        {/* Sharing */}
        <SectionLabel>sharing</SectionLabel>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/share" />
          <CopyableCommand command="/share --private" />
          <CopyableCommand command="/share --project my-project" dimmed />
          <CopyableCommand command="create a share link for my openclaw agent" dimmed />
        </div>

        <Divider />

        {/* Identity */}
        <SectionLabel>identity</SectionLabel>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/portrait --regenerate" />
          <CopyableCommand command="/publish" />
          <CopyableCommand command="/status" />
          <CopyableCommand command="update my bio" dimmed />
          <CopyableCommand command="add a new project" dimmed />
          <CopyableCommand command="this is private" dimmed />
        </div>

        <Divider />

        {/* Memory */}
        <SectionLabel>memory</SectionLabel>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/memory" dimmed />
          <CopyableCommand command="/recall" dimmed />
          <CopyableCommand command="/recall what projects am i working on" dimmed />
        </div>

        <Divider />

        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 mt-4">
          you can also type naturally — the agent understands free-form input.
        </p>
      </div>
    </div>
  );
}
