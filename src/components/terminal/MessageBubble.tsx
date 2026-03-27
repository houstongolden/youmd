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
      const shareMatch = content.match(/---\n([\s\S]*?)\n---/);
      const shareContent = shareMatch?.[1] || "";
      const headerText = content.split("---")[0].trim();
      const footerText = content.split("---").slice(2).join("---").trim();

      return (
        <div className="space-y-2">
          <div
            className="px-3 py-1.5 text-xs font-mono text-[hsl(var(--success))] bg-[hsl(var(--success))]/5 border border-[hsl(var(--success))]/15"
            style={{ borderRadius: "2px" }}
          >
            {headerText}
          </div>
          {shareContent && (
            <div className="border border-[hsl(var(--accent))]/20 bg-[hsl(var(--bg))]" style={{ borderRadius: "2px" }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--border))]">
                <span className="font-mono text-[9px] text-[hsl(var(--accent))]/60 uppercase tracking-wider">
                  agent prompt + context link
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareContent).catch(() => {});
                  }}
                  className="font-mono text-[10px] text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/30 px-2.5 py-1 hover:bg-[hsl(var(--accent))]/10 transition-colors cursor-pointer"
                  style={{ borderRadius: "2px" }}
                >
                  copy prompt
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
        style={{ borderRadius: "2px" }}
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
 * Typewriter effect for the most recent assistant message.
 * Streams text in at ~20ms per character for a natural feel.
 */
function TypewriterMessage({ content }: { content: string }) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();
    setDisplayedLength(0);
    setIsComplete(false);

    const charsPerMs = 0.06; // ~60 chars/second, fast but readable

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const targetLength = Math.min(
        Math.floor(elapsed * charsPerMs),
        content.length
      );
      setDisplayedLength(targetLength);

      if (targetLength < content.length) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [content]);

  const visibleText = content.slice(0, displayedLength);

  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/25">
      <div className="text-[14px] font-mono whitespace-pre-wrap leading-relaxed text-[hsl(var(--text-secondary))]">
        {renderTerminalContent(visibleText)}
        {!isComplete && (
          <span className="inline-block w-1.5 h-3.5 bg-[hsl(var(--accent))] opacity-70 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}

/**
 * Renders assistant message content with basic terminal-style formatting:
 * - *text* becomes italic (emphasized)
 * - **text** becomes accent-colored (bold highlights)
 * - `code` becomes inline code styled
 * - Lines starting with "- " get bullet styling
 */
function renderTerminalContent(content: string) {
  const lines = content.split("\n");

  return lines.map((line, i) => {
    // Blank lines
    if (!line.trim()) {
      return <br key={i} />;
    }

    // Bullet points
    if (line.match(/^\s*[-*]\s/)) {
      const text = line.replace(/^\s*[-*]\s/, "");
      return (
        <div key={i} className="flex items-start gap-2 ml-1">
          <span className="text-[hsl(var(--accent))] opacity-50 shrink-0 mt-px">{"\u203A"}</span>
          <span>{formatInline(text)}</span>
        </div>
      );
    }

    return <div key={i}>{formatInline(line)}</div>;
  });
}

/**
 * Handles inline formatting: **bold** → accent, *italic* → dim italic, `code` → code style
 * Also parses [text](url) markdown links and bare https:// URLs into clickable <a> tags.
 */
function formatInline(text: string) {
  // Split by formatting markers
  const parts: (string | { type: "bold" | "italic" | "code" | "link" | "bare-link"; text: string; href?: string })[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Match [text](url), **bold**, *italic*, `code`, or bare URLs
    const match = remaining.match(/(\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|(https?:\/\/[^\s<>)]+))/);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    // Text before the match
    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    if (match[2] && match[3]) {
      // [text](url)
      parts.push({ type: "link", text: match[2], href: match[3] });
    } else if (match[4]) {
      // **bold**
      parts.push({ type: "bold", text: match[4] });
    } else if (match[5]) {
      // *italic*
      parts.push({ type: "italic", text: match[5] });
    } else if (match[6]) {
      // `code`
      parts.push({ type: "code", text: match[6] });
    } else if (match[7]) {
      // bare URL
      parts.push({ type: "bare-link", text: match[7], href: match[7] });
    }

    remaining = remaining.slice(match.index + match[0].length);
  }

  if (parts.length === 1 && typeof parts[0] === "string") {
    return <>{parts[0]}</>;
  }

  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") return <span key={i}>{part}</span>;
        if (part.type === "bold") {
          return (
            <span key={i} className="text-[hsl(var(--text-primary))]">
              {part.text}
            </span>
          );
        }
        if (part.type === "italic") {
          return (
            <span key={i} className="italic opacity-70">
              {part.text}
            </span>
          );
        }
        if (part.type === "code") {
          return (
            <code
              key={i}
              className="px-1 py-0.5 text-[13px] bg-[hsl(var(--bg))]/50 text-[hsl(var(--accent-mid))] border border-[hsl(var(--border))]"
              style={{ borderRadius: "2px" }}
            >
              {part.text}
            </code>
          );
        }
        if (part.type === "link" || part.type === "bare-link") {
          return (
            <a
              key={i}
              href={part.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--accent))] hover:underline"
            >
              {part.text}
            </a>
          );
        }
        return null;
      })}
    </>
  );
}
