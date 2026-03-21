"use client";

import { useState, useEffect, useRef } from "react";
import type { ThinkingCategory } from "@/hooks/useYouAgent";

interface ThinkingIndicatorProps {
  phrase: string;
  category?: ThinkingCategory;
}

/**
 * Claude Code-style thinking indicator.
 * Shows the current thinking phrase with animated processing dots,
 * an elapsed timer, and a subtle progress feel.
 */
export function ThinkingIndicator({ phrase, category }: ThinkingIndicatorProps) {
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

  return (
    <div className="pl-3 border-l-2 border-[hsl(var(--accent))]/30">
      <div className="flex items-start gap-2">
        {/* Pulsing indicator */}
        <span className="mt-1 shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
        </span>
        <div className="min-w-0">
          {/* Main thinking phrase */}
          <p className="text-[13px] font-mono text-[hsl(var(--text-secondary))] opacity-60">
            {categoryIcon && (
              <span className="text-[hsl(var(--accent))] opacity-70 mr-1.5">{categoryIcon}</span>
            )}
            {phrase}
            <span className="inline-block w-5 text-[hsl(var(--accent))] opacity-40">{dots}</span>
          </p>
          {/* Elapsed time — shows after 2s */}
          {elapsed >= 2 && (
            <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-25 mt-0.5">
              {elapsed}s
            </p>
          )}
        </div>
      </div>
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
