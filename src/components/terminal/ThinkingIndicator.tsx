"use client";

import { useState, useEffect, useRef } from "react";
import type { ThinkingCategory, ProgressStep } from "@/hooks/useYouAgent";
import { ActivityLog } from "./ActivityLog";

interface ThinkingIndicatorProps {
  phrase: string;
  category?: ThinkingCategory;
  progressSteps?: ProgressStep[];
}

/**
 * Claude Code-style thinking indicator with real-time activity log.
 * Shows the current thinking phrase with animated dots,
 * plus a step-by-step progress log of what the agent is doing.
 */
export function ThinkingIndicator({ phrase, category, progressSteps = [] }: ThinkingIndicatorProps) {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
    setDots("");
  }, [phrase]);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev === "..." ? "" : prev + "."));
    }, 350);
    const timeInterval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(dotInterval);
      clearInterval(timeInterval);
    };
  }, []);

  const categoryIcon = getCategoryIcon(category);
  const hasSteps = progressSteps.length > 0;

  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/30 space-y-2">
      {/* Thinking phrase header */}
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-mono text-[hsl(var(--text-secondary))] opacity-60">
            {categoryIcon && (
              <span className="text-[hsl(var(--accent))] opacity-70 mr-1.5">{categoryIcon}</span>
            )}
            {phrase}
            <span className="inline-block w-5 text-[hsl(var(--accent))] opacity-40">{dots}</span>
          </p>
          {/* Elapsed time — shows after 2s only when no steps visible */}
          {!hasSteps && elapsed >= 2 && (
            <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25 mt-0.5">
              {elapsed}s
            </p>
          )}
        </div>
      </div>

      {/* Activity log — real-time progress steps */}
      {hasSteps && (
        <div className="ml-5">
          <ActivityLog steps={progressSteps} />
        </div>
      )}
    </div>
  );
}

function getCategoryIcon(category?: ThinkingCategory): string | null {
  switch (category) {
    case "discovery": return "~";
    case "analysis": return "%";
    case "identity": return "#";
    case "portrait": return "@";
    case "sync": return "&";
    default: return null;
  }
}
