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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // Delay focus slightly for mobile keyboard
      setTimeout(() => {
        inputRef.current?.focus();
        // Scroll input into view on mobile when keyboard opens
        containerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  const handleFocus = () => {
    // On mobile, scroll into view when keyboard opens
    setTimeout(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 300);
  };

  const displayValue = type === "password" ? "\u2022".repeat(value.length) : value;

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-2 font-mono text-[14px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      <span className="text-[hsl(var(--accent))] select-none shrink-0">
        {prompt}
      </span>
      <span className="relative flex-1 min-h-[1.5em]">
        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          className="absolute inset-0 opacity-0 w-full h-full"
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        {/* Visible display */}
        <span className="text-[hsl(var(--text-primary))]">{displayValue}</span>
        {!disabled && (
          <span className="cursor-blink text-[hsl(var(--accent))]">
            {"\u2588"}
          </span>
        )}
        {!value && placeholder && (
          <span className="text-[hsl(var(--text-secondary))] opacity-20 absolute left-0">
            {placeholder}
          </span>
        )}
      </span>
      {/* Submit button */}
      <button
        type="button"
        onClick={() => { if (value.trim()) { onSubmit(value.trim()); setValue(""); } }}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-[hsl(var(--accent))] text-white active:scale-95 transition-transform"
        aria-label="Submit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
