"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ThinkingCategory, ProgressStep } from "@/hooks/useYouAgent";
import { ActivityLog } from "./ActivityLog";

interface ThinkingIndicatorProps {
  phrase: string;
  category?: ThinkingCategory;
  progressSteps?: ProgressStep[];
}

// Braille spinner frames — exactly like Claude Code
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function normalizePhrase(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function buildRotationPhrases(basePhrase: string, steps: ProgressStep[]) {
  const phrases: string[] = [];
  const seen = new Set<string>();

  const push = (value: string) => {
    const normalized = normalizePhrase(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    phrases.push(normalized);
  };

  push(basePhrase);

  const running = steps.filter((step) => step.status === "running");
  const completed = [...steps]
    .filter((step) => step.status === "done")
    .slice(-3)
    .reverse();

  for (const step of running) {
    push(step.detail ? `${step.label} — ${step.detail}` : step.label);
  }

  for (const step of completed) {
    push(step.detail ? `completed ${step.label} — ${step.detail}` : `completed ${step.label}`);
  }

  return phrases.length > 0 ? phrases : ["working"];
}

/**
 * Claude Code-style thinking indicator with real-time activity log.
 * Uses braille spinner, plain text phrases, and step-by-step progress.
 * No decorative borders or pulsing dots — just clean terminal output.
 */
export function ThinkingIndicator({ phrase, category, progressSteps = [] }: ThinkingIndicatorProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const startRef = useRef(Date.now());

  const rotationPhrases = useMemo(
    () => buildRotationPhrases(phrase, progressSteps.filter((step) => step.label !== "thinking")),
    [phrase, progressSteps]
  );

  useEffect(() => {
    setDisplayIndex(0);
  }, [rotationPhrases]);

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

  useEffect(() => {
    if (rotationPhrases.length <= 1) return;
    const rotationInterval = setInterval(() => {
      setDisplayIndex((prev) => (prev + 1) % rotationPhrases.length);
    }, 2200);
    return () => clearInterval(rotationInterval);
  }, [rotationPhrases]);

  const hasSteps = progressSteps.length > 0;
  const activePhrase = rotationPhrases[displayIndex] || phrase;

  return (
    <div className="space-y-1 animate-in fade-in duration-150">
      <style>{`
        @keyframes youmdTextSweep {
          0% { background-position: 140% 50%; }
          100% { background-position: -40% 50%; }
        }
        .youmd-sweep-text {
          background-image: linear-gradient(
            90deg,
            hsl(var(--text-secondary) / 0.52) 0%,
            hsl(var(--text-secondary) / 0.52) 32%,
            hsl(var(--accent) / 0.95) 50%,
            hsl(var(--text-secondary) / 0.6) 68%,
            hsl(var(--text-secondary) / 0.52) 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: youmdTextSweep 2.6s linear infinite;
        }
      `}</style>
      {/* Main thinking phrase — Claude Code style: spinner + text */}
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="text-[hsl(var(--accent))] shrink-0 w-3 text-center">
          {SPINNER_FRAMES[spinnerFrame]}
        </span>
        <span className="youmd-sweep-text truncate">
          {activePhrase}
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
