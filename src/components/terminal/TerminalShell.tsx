"use client";

import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DisplayMessage, ThinkingCategory, ProgressStep } from "@/hooks/useYouAgent";
import { MessageBubble } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { TerminalInput } from "./TerminalInput";
import { CommandPalette } from "./CommandPalette";

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
}

const MAX_HISTORY = 50;

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
}: TerminalShellProps) {
  const [pastedImageUrl, setPastedImageUrl] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
  const [inputHistory, setInputHistory] = useState<string[]>([]);
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

  // Find the ID of the last assistant message for typewriter effect
  const latestAssistantId = useMemo(() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === "assistant") return displayMessages[i].id;
    }
    return null;
  }, [displayMessages]);

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
      {/* Messages area */}
      <div className="relative flex-1 min-h-0">
        {/* Scroll-up indicator — dim gradient at top when scrolled */}
        {hasScrolledDown && (
          <div
            className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to bottom, hsl(var(--bg-raised)) 0%, transparent 100%)",
            }}
          />
        )}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-4 py-4"
        >
          <div className="space-y-3">
            {displayMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isLatest={msg.id === latestAssistantId} />
            ))}
            {isThinking && <ThinkingIndicator phrase={thinkingPhrase} category={thinkingCategory} progressSteps={progressSteps} />}
            <div ref={messagesEndRef} />
          </div>
        </div>
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
