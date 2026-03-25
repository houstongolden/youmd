"use client";

import { KeyboardEvent, ClipboardEvent, useState, useCallback } from "react";

interface TerminalInputProps {
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  /** Called when an image is pasted — receives the data URL */
  onImagePaste?: (dataUrl: string) => void;
}

export function TerminalInput({
  input,
  setInput,
  isThinking,
  textareaRef,
  onKeyDown,
  onSend,
  onImagePaste,
}: TerminalInputProps) {
  const [pastedImage, setPastedImage] = useState<string | null>(null);

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
          <div className="border border-[hsl(var(--border))] overflow-hidden shrink-0" style={{ borderRadius: "2px" }}>
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
        <span className="text-[hsl(var(--accent))] font-mono text-[16px] pb-2 select-none shrink-0">
          &gt;
        </span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={pastedImage ? "add a message with this image..." : "say something..."}
          rows={1}
          disabled={isThinking}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          className="flex-1 px-0 py-1.5 text-[16px] font-mono bg-transparent border-none outline-none resize-none text-[hsl(var(--text-primary))] caret-[hsl(var(--accent))] placeholder:text-[hsl(var(--text-secondary))]/15 disabled:opacity-50"
          style={{ maxHeight: "160px" }}
        />
        <button
          type="button"
          onClick={() => {
            onSend();
            setPastedImage(null);
          }}
          disabled={isThinking || (!input.trim() && !pastedImage)}
          className="shrink-0 h-7 w-9 flex items-center justify-center bg-[hsl(var(--accent))] text-white active:scale-95 transition-transform disabled:opacity-30"
          style={{ borderRadius: "3px" }}
          aria-label="Send"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
      </div>
      <div className="flex items-center gap-3 mt-1 ml-5">
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
          enter to send
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
          /help
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-10">|</span>
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20 hidden sm:inline">
          cmd+k commands
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-10 hidden sm:inline">|</span>
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-20">
          paste images
        </span>
      </div>
    </div>
  );
}
