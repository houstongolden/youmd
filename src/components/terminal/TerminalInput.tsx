"use client";

import { KeyboardEvent } from "react";

interface TerminalInputProps {
  input: string;
  setInput: (v: string) => void;
  isThinking: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
}

export function TerminalInput({
  input,
  setInput,
  isThinking,
  textareaRef,
  onKeyDown,
  onSend,
}: TerminalInputProps) {
  return (
    <div className="shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-4 py-3">
      <div className="flex items-end gap-2">
        <span className="text-[hsl(var(--accent))] font-mono text-sm pb-2.5 select-none">
          &gt;
        </span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="say something..."
          rows={1}
          disabled={isThinking}
          className="flex-1 px-0 py-2 text-sm font-mono bg-transparent border-none outline-none resize-none text-[hsl(var(--text-primary))] placeholder:text-[hsl(var(--text-secondary))]/20 disabled:opacity-50"
          style={{ maxHeight: "160px" }}
        />
        <button
          onClick={onSend}
          disabled={isThinking || !input.trim()}
          className="px-3 py-1.5 text-xs font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/25 hover:bg-[hsl(var(--accent))]/10 transition-colors disabled:opacity-15 disabled:cursor-not-allowed shrink-0 mb-0.5"
          style={{ borderRadius: "2px" }}
        >
          send
        </button>
      </div>
      <div className="flex items-center gap-3 mt-1 ml-4">
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
          enter to send, shift+enter for newline
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-15">|</span>
        <span className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
          /help for commands
        </span>
      </div>
    </div>
  );
}
