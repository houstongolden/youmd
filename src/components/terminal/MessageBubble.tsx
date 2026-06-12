"use client";

import { useState, useEffect, useRef } from "react";
import type { DisplayMessage } from "@/hooks/useYouAgent";
import { RichTerminalContent } from "./TerminalBlocks";

interface MessageBubbleProps {
  message: DisplayMessage;
  isLatest?: boolean;
}

export function MessageBubble({ message, isLatest = false }: MessageBubbleProps) {
  if (message.role === "system-notice") {
    const content = message.content;
    const isUpdate = content.startsWith("[updated:") || content.startsWith("[saved") || content.startsWith("[published");
    const isScraping = content.startsWith("[scraping:");
    const isError = content.includes("failed") || content.includes("ERR");
    const isShareBlock = content.includes("context link created") && content.includes("---");

    // Share artifact — special rendering with copy CTA button
    if (isShareBlock) {
      return <ShareArtifact content={content} />;
    }

    return (
      <div
        className={`px-3 py-1.5 text-xs font-mono whitespace-pre-wrap ${
          isUpdate
            ? "text-[hsl(var(--success))] bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/15"
            : isScraping
              ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent-wash))] border border-[hsl(var(--accent))]/15 animate-pulse"
              : isError
                ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/5 border border-[hsl(var(--accent))]/15"
                : "text-[hsl(var(--accent-mid))] bg-[hsl(var(--accent-wash))] border border-[hsl(var(--accent))]/15"
        }`}
        style={{ borderRadius: "var(--radius)" }}
      >
        {content}
      </div>
    );
  }

  if (message.role === "user") {
    const hasImage = message.content.includes("![");
    return (
      <div className="flex items-start gap-2">
        <span className="text-[hsl(var(--accent))] font-mono text-xs mt-0.5 shrink-0 select-none">
          &gt;
        </span>
        <div className="text-[12px] font-mono whitespace-pre-wrap leading-relaxed text-[hsl(var(--text-primary))]">
          {hasImage ? <RichTerminalContent content={message.content} /> : message.content}
        </div>
      </div>
    );
  }

  // assistant — rich terminal content with streaming cursor for latest
  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/25">
      <div className="text-[12px] font-mono leading-relaxed text-[hsl(var(--text-secondary))]">
        <RichTerminalContent content={message.content} />
        {isLatest && message.content.length > 0 && (
          <span className="inline-block w-1.5 h-3.5 bg-[hsl(var(--accent))] opacity-70 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

/**
 * Share artifact card with copy-to-clipboard button.
 * Shows a "copied!" state for 2s after the user clicks copy.
 */
function ShareArtifact({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const shareMatch = content.match(/---\n([\s\S]*?)\n---/);
  const shareContent = shareMatch?.[1] || "";
  const headerText = content.split("---")[0].trim();
  const footerText = content.split("---").slice(2).join("---").trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(shareContent).then(
      () => {
        setCopied(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      },
      () => {
        // fallback for non-clipboard environments
        try {
          const ta = document.createElement("textarea");
          ta.value = shareContent;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          setCopied(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch {
          // give up silently
        }
      }
    );
  };

  return (
    <div className="space-y-2">
      <div
        className="px-3 py-1.5 text-xs font-mono text-[hsl(var(--success))] bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/15"
        style={{ borderRadius: "var(--radius)" }}
      >
        {headerText}
      </div>
      {shareContent && (
        <div className="border border-[hsl(var(--accent))]/20 bg-[hsl(var(--bg))]" style={{ borderRadius: "var(--radius)" }}>
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--border))]">
            <span className="font-mono text-[9px] text-[hsl(var(--accent))]/60 uppercase tracking-wider">
              agent prompt + context link
            </span>
            <button
              onClick={handleCopy}
              className={`font-mono text-[10px] border px-2.5 py-1 transition-all cursor-pointer ${
                copied
                  ? "text-[hsl(var(--success))] border-[hsl(var(--success))]/50 bg-[hsl(var(--success))]/10"
                  : "text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30 hover:bg-[hsl(var(--accent))]/10"
              }`}
            >
              {copied ? "copied!" : "copy prompt"}
            </button>
          </div>
          <div className="px-3 py-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-70 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {shareContent}
          </div>
        </div>
      )}
      {footerText && (
        <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 px-1">
          {footerText}
        </div>
      )}
    </div>
  );
}
