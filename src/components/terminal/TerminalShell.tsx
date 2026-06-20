"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DisplayMessage, ThinkingCategory, ProgressStep } from "@/hooks/useYouAgent";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { TerminalInput } from "./TerminalInput";
import { CommandPalette } from "./CommandPalette";
import { LiveBrainLog, type LiveLogEntry } from "./LiveBrainLog";
export type { LiveLogEntry } from "./LiveBrainLog";

type LiveLogFilter = "all" | "agents" | "ops" | "skills";

interface TerminalShellProps {
  displayMessages: DisplayMessage[];
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  thinkingPhrase: string;
  thinkingCategory?: ThinkingCategory;
  progressSteps?: ProgressStep[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  sendMessage: (pastedImageUrl?: string) => void;
  className?: string;
  /** One-off dim line rendered after the messages (e.g. staleness nudge). Not part of chat history. */
  staleNotice?: string | null;
  liveLogEntries?: LiveLogEntry[];
  liveLogStatus?: string;
}

const MAX_HISTORY = 50;
const LIVE_LOG_FILTERS: Array<{ key: LiveLogFilter; label: string }> = [
  { key: "all", label: "all" },
  { key: "agents", label: "agents" },
  { key: "ops", label: "ops" },
  { key: "skills", label: "skills" },
];

function liveLogFilterMatches(entry: LiveLogEntry, filter: LiveLogFilter) {
  if (filter === "all") return true;
  const source = entry.source.toLowerCase();
  const channel = (entry.channel ?? "").toLowerCase();
  const kind = (entry.kind ?? "").toLowerCase();
  const title = entry.title.toLowerCase();
  const haystack = `${source} ${channel} ${kind} ${title}`;

  if (filter === "agents") {
    return source === "agent" || source === "agents" || source === "bus" || haystack.includes("agent");
  }
  if (filter === "ops") {
    return (
      ["machine", "daemon", "vault", "proof", "local", "github", "stats"].includes(source) ||
      haystack.includes("daemon") ||
      haystack.includes("vault")
    );
  }
  return (
    source === "skills" ||
    source === "portfolio" ||
    source === "task" ||
    source === "brain" ||
    haystack.includes("skill") ||
    haystack.includes("project")
  );
}

export function TerminalShell({
  displayMessages,
  input,
  setInput,
  isThinking,
  thinkingPhrase,
  thinkingCategory,
  progressSteps,
  messagesEndRef,
  textareaRef,
  sendMessage,
  className = "",
  staleNotice,
  liveLogEntries = [],
  liveLogStatus = "brain mesh",
}: TerminalShellProps) {
  const [pastedImageUrl, setPastedImageUrl] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mode, setMode] = useState<"chat" | "log">("chat");
  const [liveLogFilter, setLiveLogFilter] = useState<LiveLogFilter>("all");

  // --- Cmd+K / Ctrl+K command palette ---
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handlePaletteSelect = useCallback(
    (command: string) => {
      setInput(command);
      // Focus the textarea so user can hit enter or edit
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [setInput, textareaRef]
  );

  // --- Input History (Up/Down arrow) ---
  const [, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Stash the current in-progress input when navigating history
  const draftRef = useRef<string>("");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (trimmed || pastedImageUrl) {
          // Save to history before sending
          if (trimmed) {
            setInputHistory((prev) => {
              const updated = [...prev, trimmed];
              return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
            });
          }
          setHistoryIndex(-1);
          draftRef.current = "";
        }
        sendMessage(pastedImageUrl || undefined);
        setPastedImageUrl(null);
        return;
      }

      // Up arrow — navigate backward in history
      if (e.key === "ArrowUp") {
        const textarea = e.currentTarget;
        // Only intercept when cursor is at the very start of the input
        if (textarea.selectionStart !== 0 || textarea.selectionEnd !== 0) return;

        e.preventDefault();
        setInputHistory((currentHistory) => {
          if (currentHistory.length === 0) return currentHistory;
          const newIndex = historyIndex === -1
            ? currentHistory.length - 1
            : Math.max(0, historyIndex - 1);

          // Stash the current draft when first entering history
          if (historyIndex === -1) {
            draftRef.current = input;
          }

          setHistoryIndex(newIndex);
          setInput(currentHistory[newIndex]);
          return currentHistory;
        });
        return;
      }

      // Down arrow — navigate forward in history
      if (e.key === "ArrowDown") {
        const textarea = e.currentTarget;
        // Only intercept when cursor is at the very end of the input
        if (textarea.selectionStart !== textarea.value.length || textarea.selectionEnd !== textarea.value.length) return;

        if (historyIndex === -1) return; // not in history mode

        e.preventDefault();
        setInputHistory((currentHistory) => {
          const newIndex = historyIndex + 1;
          if (newIndex >= currentHistory.length) {
            // Past the end of history — restore draft
            setHistoryIndex(-1);
            setInput(draftRef.current);
          } else {
            setHistoryIndex(newIndex);
            setInput(currentHistory[newIndex]);
          }
          return currentHistory;
        });
        return;
      }
    },
    [sendMessage, pastedImageUrl, input, historyIndex, setInput]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (trimmed) {
      setInputHistory((prev) => {
        const updated = [...prev, trimmed];
        return updated.length > MAX_HISTORY ? updated.slice(-MAX_HISTORY) : updated;
      });
    }
    setHistoryIndex(-1);
    draftRef.current = "";
    sendMessage(pastedImageUrl || undefined);
    setPastedImageUrl(null);
  }, [sendMessage, pastedImageUrl, input]);

  // Find the last assistant message — id drives the typewriter cursor,
  // content drives the screen-reader live region below.
  const latestAssistant = useMemo(() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === "assistant") return displayMessages[i];
    }
    return null;
  }, [displayMessages]);
  const latestAssistantId = latestAssistant?.id ?? null;
  const latestAssistantContent = latestAssistant?.content ?? "";
  const filteredLiveLogEntries = useMemo(
    () => liveLogEntries.filter((entry) => liveLogFilterMatches(entry, liveLogFilter)),
    [liveLogEntries, liveLogFilter]
  );
  const filteredLiveLogStatus =
    liveLogFilter === "all"
      ? liveLogStatus
      : `${filteredLiveLogEntries.length}/${liveLogEntries.length} ${liveLogFilter}`;

  // --- a11y: announce completed agent messages (not per streamed token) ---
  // There is no explicit streaming flag on DisplayMessage, so completion is
  // detected by quiescence: a message that GREW (streamed) and then stopped
  // changing for SETTLE_MS is considered done and announced once. Messages
  // that arrive fully formed in a single snapshot (restored history) are
  // never announced.
  const [announcement, setAnnouncement] = useState("");
  const [streamSettled, setStreamSettled] = useState(true);
  const announcedIdRef = useRef<string | null>(null);
  const streamTrackRef = useRef<{ id: string | null; length: number; active: boolean }>({
    id: null,
    length: 0,
    active: false,
  });

  useEffect(() => {
    const SETTLE_MS = 1200;
    if (!latestAssistantId || announcedIdRef.current === latestAssistantId) return;
    const track = streamTrackRef.current;
    if (track.id !== latestAssistantId) {
      // First snapshot of this message: an empty placeholder means a stream
      // is starting (announce when it settles); full content means restored
      // history (never announce).
      streamTrackRef.current = {
        id: latestAssistantId,
        length: latestAssistantContent.length,
        active: latestAssistantContent.length === 0,
      };
      return;
    }
    if (latestAssistantContent.length !== track.length) {
      track.active = true;
      track.length = latestAssistantContent.length;
    }
    if (!track.active || latestAssistantContent.length === 0) return;
    // Mark busy asynchronously (synchronous setState in effects is banned);
    // each new token re-runs the effect, clearing both timers, so the settle
    // timer only fires once the stream has been quiet for SETTLE_MS.
    const busyTimer = setTimeout(() => setStreamSettled(false), 0);
    const settleTimer = setTimeout(() => {
      announcedIdRef.current = latestAssistantId;
      setAnnouncement(latestAssistantContent);
      setStreamSettled(true);
    }, SETTLE_MS);
    return () => {
      clearTimeout(busyTimer);
      clearTimeout(settleTimer);
    };
  }, [latestAssistantId, latestAssistantContent]);

  // Scroll-up indicator: show when user has scrolled away from top
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      setHasScrolledDown(el.scrollTop > 32);
    }
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex min-h-10 items-center gap-1 border-b border-[hsl(var(--border))]/70 bg-[hsl(var(--shell-chrome))] px-3">
        {(["chat", "log"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            className={[
              "h-7 px-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-[background,color,opacity]",
              mode === nextMode
                ? "bg-[hsl(var(--shell-active))] text-[hsl(var(--text-primary))]"
                : "text-[hsl(var(--text-secondary))] opacity-45 hover:bg-[hsl(var(--shell-chrome-hover))] hover:opacity-80",
            ].join(" ")}
            style={{ borderRadius: "var(--radius)" }}
          >
            {nextMode === "chat" ? "chat" : "live log"}
          </button>
        ))}
        {mode === "log" && (
          <div className="ml-1 flex min-w-0 items-center gap-1 overflow-x-auto">
            {LIVE_LOG_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setLiveLogFilter(filter.key)}
                className={[
                  "h-6 shrink-0 px-2 font-mono text-[8.5px] uppercase tracking-[0.13em] transition-[background,color,opacity]",
                  liveLogFilter === filter.key
                    ? "bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))]"
                    : "text-[hsl(var(--text-secondary))] opacity-40 hover:bg-[hsl(var(--shell-chrome-hover))] hover:opacity-75",
                ].join(" ")}
                style={{ borderRadius: "var(--radius)" }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto hidden truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-35 sm:block">
          {mode === "log" ? filteredLiveLogStatus : "you agent"}
        </span>
      </div>

      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
        {/* Scroll-up indicator — dim gradient at top when scrolled */}
        {mode === "chat" && hasScrolledDown && (
          <div
            className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, hsl(var(--bg-raised)) 0%, transparent 100%)",
            }}
          />
        )}
        {mode === "chat" ? (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-5 py-5"
            role="group"
            aria-label="conversation"
            aria-busy={isThinking || !streamSettled}
          >
            <div className="space-y-3">
              {displayMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isLatest={msg.id === latestAssistantId} />
              ))}
              {staleNotice && (
                <div className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-50">
                  {staleNotice}
                </div>
              )}
              {isThinking && <ThinkingIndicator phrase={thinkingPhrase} category={thinkingCategory} progressSteps={progressSteps} />}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <LiveBrainLog
            entries={filteredLiveLogEntries}
            emptyText={liveLogFilter === "all" ? undefined : `no ${liveLogFilter} events in this window`}
          />
        )}
      </div>

      {/* Screen-reader live region — announces each agent message once it has
          finished streaming. Visually hidden; never announces per-token. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Input area */}
      <TerminalInput
        input={input}
        setInput={setInput}
        isThinking={isThinking}
        textareaRef={textareaRef}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        onImagePaste={setPastedImageUrl}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* Command palette */}
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={handlePaletteSelect}
      />
    </div>
  );
}
