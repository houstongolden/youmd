"use client";

import { useState, useRef, useEffect } from "react";

interface TerminalAuthInputProps {
  prompt?: string;
  placeholder?: string;
  type?: "text" | "password";
  onSubmit: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function TerminalAuthInput({
  prompt = ">",
  placeholder = "",
  type = "text",
  onSubmit,
  autoFocus = true,
  disabled = false,
}: TerminalAuthInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-2 font-mono text-[16px]">
      <span className="text-[hsl(var(--accent))] select-none shrink-0">
        {prompt}
      </span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 bg-transparent border-none outline-none font-mono text-[16px] text-[hsl(var(--text-primary))] caret-[hsl(var(--accent))] placeholder:text-[hsl(var(--text-secondary))]/15"
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        enterKeyHint="send"
      />
      {/* Return/submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="shrink-0 h-7 w-9 flex items-center justify-center bg-[hsl(var(--accent))] text-white active:scale-95 transition-transform"
        style={{ borderRadius: "3px" }}
        aria-label="Submit"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 10 4 15 9 20" />
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        </svg>
      </button>
    </div>
  );
}
