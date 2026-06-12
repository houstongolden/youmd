"use client";

import { KeyboardEvent, ClipboardEvent, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";

/** mac/iOS → ⌘k, everything else → ctrl+k. SSR defaults to mac; the hint
 *  is suppressHydrationWarning'd so other platforms correct on hydration. */
function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") return true;
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");
}

interface TerminalInputProps {
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  /** Called when an image is pasted — receives the data URL */
  onImagePaste?: (dataUrl: string) => void;
  /** Opens the command palette (cmd+k hint on desktop, /help chip on mobile) */
  onOpenPalette?: () => void;
}

export function TerminalInput({
  input,
  setInput,
  textareaRef,
  onKeyDown,
  onSend,
  onImagePaste,
  onOpenPalette,
}: TerminalInputProps) {
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const isMac = detectMacPlatform();

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setPastedImage(dataUrl);
          onImagePaste?.(dataUrl);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }, [onImagePaste]);

  const clearImage = useCallback(() => {
    setPastedImage(null);
  }, []);

  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] terminal-input-sticky bg-[hsl(var(--bg-raised))]">
      {/* Pasted image preview */}
      {pastedImage && (
        <div className="mb-2 ml-5 flex items-start gap-2">
          <div className="border border-[hsl(var(--border))] overflow-hidden shrink-0" style={{ borderRadius: "var(--radius)" }}>
            <img
              src={pastedImage}
              alt="pasted"
              className="w-16 h-16 object-cover"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40">
              image attached
            </span>
            <button
              onClick={clearImage}
              className="text-[10px] font-mono text-[hsl(var(--accent))] opacity-60 hover:opacity-100 transition-opacity text-left"
            >
              remove
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <span aria-hidden="true" className="text-[hsl(var(--accent))] font-mono text-[12px] pb-1.5 select-none shrink-0">
          &gt;
        </span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={pastedImage ? "add a message with this image..." : "ask anything, or type /help for commands"}
          aria-label="chat message"
          name="chat-message"
          rows={1}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          className="min-h-11 flex-1 resize-none border border-transparent bg-transparent px-2 py-3 font-mono text-[13px] text-foreground caret-accent placeholder:text-muted-foreground/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ maxHeight: "160px" }}
        />
        <Button
          type="button"
          onClick={() => {
            onSend();
            setPastedImage(null);
          }}
          disabled={!input.trim() && !pastedImage}
          variant="primary"
          size="icon"
          aria-label="Send"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </Button>
      </div>
      <div className="flex items-center gap-3 mt-1 ml-5">
        <span className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
          enter to send
        </span>
        <span className="hidden sm:inline text-[hsl(var(--text-secondary))] opacity-10">|</span>
        {/* Mobile: tappable /help chip — opens the command palette */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="show commands"
          className="sm:hidden text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50 active:opacity-80 transition-opacity py-2 -my-2 px-1.5 -mx-1.5"
        >
          /help
        </button>
        {/* Desktop: platform-aware shortcut hint — clicking also opens the palette */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="open command palette"
          className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-60 transition-opacity"
          suppressHydrationWarning
        >
          {isMac ? "⌘k" : "ctrl+k"} commands
        </button>
        <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
          paste images
        </span>
      </div>
    </div>
  );
}
