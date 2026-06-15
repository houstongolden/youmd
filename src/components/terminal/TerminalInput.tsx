"use client";

import { KeyboardEvent, ClipboardEvent, useState, useCallback } from "react";
import { CornerDownLeft } from "lucide-react";

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
    <div className="shrink-0 border-t border-[hsl(var(--border))] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] terminal-input-sticky bg-[hsl(var(--bg-raised))]">
      {/* Pasted image preview */}
      {pastedImage && (
        <div className="mb-2 flex items-start gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-2" style={{ borderRadius: "var(--radius)" }}>
          <div className="border border-[hsl(var(--border))] overflow-hidden shrink-0" style={{ borderRadius: "var(--radius)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pasted data URLs are local previews, not optimizable assets */}
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

      <div
        className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))] transition-colors focus-within:border-[hsl(var(--accent))]/55"
        style={{ borderRadius: "var(--radius)" }}
      >
        <div className="flex items-end gap-2 px-3 py-2">
          <span aria-hidden="true" className="text-[hsl(var(--accent))] font-mono text-[13px] pb-2 select-none shrink-0">
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
            className="min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-3 font-mono text-[13px] leading-5 text-foreground caret-accent placeholder:text-muted-foreground/30 focus-visible:outline-none"
            style={{ maxHeight: "160px" }}
          />
          <button
            type="button"
            onClick={() => {
              onSend();
              setPastedImage(null);
            }}
            disabled={!input.trim() && !pastedImage}
            className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center border border-[hsl(var(--accent))]/45 bg-[hsl(var(--accent))] text-white transition-colors hover:bg-[hsl(var(--accent-dark))] disabled:cursor-not-allowed disabled:border-[hsl(var(--border))] disabled:bg-[hsl(var(--bg-raised))] disabled:text-[hsl(var(--text-secondary))] disabled:opacity-35"
            style={{ borderRadius: "var(--radius)" }}
            aria-label="Send"
          >
            <CornerDownLeft size={15} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-3 border-t border-[hsl(var(--border))] px-8 py-2">
          <span className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25">
            enter to send
          </span>
          <span className="hidden sm:inline text-[hsl(var(--text-secondary))] opacity-10">|</span>
          {/* Mobile: tappable /help chip — opens the command palette */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="show commands"
            className="sm:hidden text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-55 active:opacity-85 transition-opacity py-2 -my-2 px-1.5 -mx-1.5"
          >
            /help
          </button>
          {/* Desktop: platform-aware shortcut hint — clicking also opens the palette */}
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="open command palette"
            className="hidden sm:inline text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-45 hover:opacity-70 transition-opacity"
            suppressHydrationWarning
          >
            {isMac ? "cmd k" : "ctrl k"} commands
          </button>
          <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
          <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25">
            paste images
          </span>
        </div>
      </div>
    </div>
  );
}
