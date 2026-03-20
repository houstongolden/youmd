"use client";

import type { DisplayMessage } from "@/hooks/useYouAgent";

export function MessageBubble({ message }: { message: DisplayMessage }) {
  if (message.role === "system-notice") {
    return (
      <div className="px-3 py-1.5 text-xs font-mono text-[hsl(var(--accent-mid))] bg-[hsl(var(--accent-wash))] border border-[hsl(var(--accent))]/15 whitespace-pre-wrap" style={{ borderRadius: "2px" }}>
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex items-start gap-2">
        <span className="text-[hsl(var(--accent))] font-mono text-xs mt-0.5 shrink-0 select-none">
          &gt;
        </span>
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-[hsl(var(--text-primary))]">
          {message.content}
        </p>
      </div>
    );
  }

  // assistant
  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/20">
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-[hsl(var(--text-secondary))]">
        {message.content}
      </p>
    </div>
  );
}
