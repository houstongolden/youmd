"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";

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
  /** Prefill the input (e.g. a handle carried in from the landing funnel). Applied on mount — pass a `key` to remount when it should change. */
  initialValue?: string;
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
  initialValue,
  onSubmit,
  autoFocus = true,
  disabled = false,
}: TerminalAuthInputProps) {
  const [value, setValue] = useState(initialValue ?? "");
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
    <div className="flex min-h-11 items-center gap-2 font-mono text-[16px]">
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
        className="min-h-11 flex-1 min-w-0 border border-transparent bg-transparent px-2 font-mono text-[16px] text-foreground caret-accent placeholder:text-muted-foreground/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      <Button
        type="button"
        onClick={handleSubmit}
        variant="secondary"
        size="icon"
        aria-label="Submit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 10 4 15 9 20" />
          <path d="M20 4v7a4 4 0 0 1-4 4H4" />
        </svg>
      </Button>
    </div>
  );
}
