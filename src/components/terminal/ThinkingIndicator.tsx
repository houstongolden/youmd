"use client";

import { useState, useEffect, useRef } from "react";
import type { ThinkingCategory, ProgressStep } from "@/hooks/useYouAgent";
import { ActivityLog } from "./ActivityLog";

interface ThinkingIndicatorProps {
  phrase: string;
  category?: ThinkingCategory;
  progressSteps?: ProgressStep[];
}

// Braille spinner frames — exactly like Claude Code
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Claude Code-style thinking indicator with real-time activity log.
 * Uses braille spinner, plain text phrases, and step-by-step progress.
 * No decorative borders or pulsing dots — just clean terminal output.
 */
export function ThinkingIndicator({ phrase, category, progressSteps = [] }: ThinkingIndicatorProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  // Reset elapsed on phrase change
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [phrase]);

  useEffect(() => {
    const spinnerInterval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    const timeInterval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(spinnerInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const hasSteps = progressSteps.length > 0;

  return (
    <div className="space-y-1 animate-in fade-in duration-150">
      {/* Main thinking phrase — Claude Code style: spinner + text */}
      <div className="flex items-center gap-2 font-mono text-[13px]">
        <span className="text-[hsl(var(--accent))] shrink-0 w-3 text-center">
          {SPINNER_FRAMES[spinnerFrame]}
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-70">
          {phrase}
        </span>
        {elapsed >= 2 && (
          <span className="text-[10px] text-[hsl(var(--text-secondary))] opacity-25 tabular-nums ml-auto shrink-0">
            {elapsed}s
          </span>
        )}
      </div>

      {/* Activity log — only show real operational steps, not generic "thinking" */}
      {hasSteps && (
        <div className="ml-5">
          <ActivityLog steps={progressSteps.filter((s) => s.label !== "thinking")} />
        </div>
      )}
    </div>
  );
}
