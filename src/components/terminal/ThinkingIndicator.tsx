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
 * Terminal-style thinking indicator with real-time activity log.
 * Shows an animated cursor, rotating thinking phrases,
 * and a step-by-step progress log of what the agent is doing.
 * Designed to never feel static — always showing live activity.
 */
export function ThinkingIndicator({ phrase, category, progressSteps = [] }: ThinkingIndicatorProps) {
  const [dots, setDots] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const startRef = useRef(Date.now());

  // Reset elapsed on phrase change but keep animation smooth
  useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [phrase]);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev === "..." ? "" : prev + "."));
    }, 350);
    const timeInterval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    const cursorInterval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 530);
    return () => {
      clearInterval(dotInterval);
      clearInterval(timeInterval);
      clearInterval(cursorInterval);
    };
  }, []);

  const categoryIcon = getCategoryIcon(category);
  const hasSteps = progressSteps.length > 0;
  const totalElapsed = Math.floor((Date.now() - startRef.current) / 1000);

  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/40 space-y-2 animate-in fade-in duration-200">
      {/* Thinking phrase header */}
      <div className="flex items-start gap-2">
        <span className="mt-1 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-mono text-[hsl(var(--text-secondary))] opacity-70">
            {categoryIcon && (
              <span className="text-[hsl(var(--accent))] opacity-80 mr-1.5">{categoryIcon}</span>
            )}
            {phrase}
            <span className="inline-block w-5 text-[hsl(var(--accent))] opacity-50">{dots}</span>
            <span
              className="inline-block w-[6px] h-[13px] ml-0.5 align-middle transition-opacity duration-100"
              style={{
                backgroundColor: "hsl(var(--accent))",
                opacity: cursorVisible ? 0.6 : 0,
              }}
            />
          </p>
          {/* Elapsed time — always show after 2s */}
          {elapsed >= 2 && (
            <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25 mt-0.5 tabular-nums">
              {totalElapsed}s
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
