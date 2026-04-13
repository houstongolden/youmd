"use client";

import { useState, useRef, useEffect } from "react";

interface TerminalAuthInputProps {
  prompt?: string;
  placeholder?: string;
  type?: "text" | "password" | "email" | "tel";
  /** Native autocomplete hint — "email", "current-password", "new-password", "username", "one-time-code", etc */
  autoComplete?: string;
  /** Mobile keyboard hint */
  inputMode?: "text" | "email" | "tel" | "url" | "numeric" | "decimal" | "search";
  /** Form field name (for password managers) */
  name?: string;
  /** Accessible label — falls back to placeholder if not provided */
  ariaLabel?: string;
  onSubmit: (value: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function TerminalAuthInput({
  prompt = ">",
  placeholder = "",
  type = "text",
  autoComplete = "off",
  inputMode,
  name,
  ariaLabel,
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
    <div className="flex items-center gap-2 font-mono text-[16px] min-h-[44px]">
      <span className="text-[hsl(var(--accent))] select-none shrink-0" aria-hidden="true">
        {prompt}
      </span>
      <input
        ref={inputRef}
        type={type}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        // Cycle 64: bumped to min-h-[44px] (was 26px tall — well under WCAG min)
        className="flex-1 min-w-0 min-h-[44px] bg-transparent border-none outline-none font-mono text-[16px] text-[hsl(var(--text-primary))] caret-[hsl(var(--accent))] placeholder:text-[hsl(var(--text-secondary))]/15"
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={false}
        placeholder={placeholder}
        aria-label={ariaLabel || placeholder || "input"}
        enterKeyHint="send"
      />
      {/* Return/submit button */}
      <button
        type="button"
        onClick={handleSubmit}
        className="shrink-0 h-11 w-11 flex items-center justify-center bg-[hsl(var(--bg))] border border-[hsl(var(--border))] hover:border-[hsl(var(--accent))]/40 active:scale-95 transition-all"
        style={{ borderRadius: "3px" }}
        aria-label="Submit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 10 4 15 9 20" />
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        </svg>
      </button>
    </div>
  );
}
