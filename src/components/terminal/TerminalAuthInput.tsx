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
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  const displayValue = type === "password" ? "\u2022".repeat(value.length) : value;

  return (
    <div
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
    </div>
  );
}
