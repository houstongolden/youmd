"use client";

import { useState } from "react";

interface CopyableCommandProps {
  command: string;
  dimmed?: boolean;
}

export function CopyableCommand({ command, dimmed = false }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={`w-full flex items-center justify-between font-mono text-[11px] bg-[hsl(var(--bg))] px-3 py-2 group hover:border-[hsl(var(--accent))]/30 border border-transparent transition-colors text-left ${
        dimmed
          ? "text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70"
          : "text-[hsl(var(--accent))]"
      }`}
      style={{ borderRadius: "2px" }}
    >
      <span className="truncate">&gt; {command}</span>
      <span className="shrink-0 ml-2 text-[9px] opacity-0 group-hover:opacity-60 transition-opacity">
        {copied ? (
          <span className="text-[hsl(var(--success))]">{"\u2713"}</span>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </span>
    </button>
  );
}

interface CopyableLinkProps {
  url: string;
  label?: string;
  withPrompt?: string;
}

export function CopyableLink({ url, label, withPrompt }: CopyableLinkProps) {
  const [copiedType, setCopiedType] = useState<"link" | "prompt" | null>(null);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopiedType("link");
    setTimeout(() => setCopiedType(null), 1500);
  };

  const copyWithPrompt = () => {
    const text = withPrompt || `Read my identity context before we start:\n${url}\n\nThis is my you.md profile — it contains my bio, projects, values,\npreferences, and how I like to communicate. Use it to understand\nwho I am so we can skip the intro and get straight to work.`;
    navigator.clipboard.writeText(text);
    setCopiedType("prompt");
    setTimeout(() => setCopiedType(null), 1500);
  };

  return (
    <div className="flex items-center gap-1.5">
      <code className="text-[10px] font-mono text-[hsl(var(--accent-mid))] truncate flex-1 min-w-0">
        {label || url}
      </code>
      <button
        onClick={copyLink}
        className="shrink-0 px-1.5 py-0.5 text-[8px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
        style={{ borderRadius: "2px" }}
      >
        {copiedType === "link" ? "\u2713" : "copy link"}
      </button>
      <button
        onClick={copyWithPrompt}
        className="shrink-0 px-1.5 py-0.5 text-[8px] font-mono border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))]/40 transition-colors"
        style={{ borderRadius: "2px" }}
      >
        {copiedType === "prompt" ? "\u2713" : "copy w/ prompt"}
      </button>
    </div>
  );
}
