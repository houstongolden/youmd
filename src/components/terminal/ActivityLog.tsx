"use client";

import { useState, useEffect } from "react";

export interface ProgressStep {
  id: string;
  label: string;
  status: "running" | "done" | "error";
  detail?: string;
  startedAt: number;
}

interface ActivityLogProps {
  steps: ProgressStep[];
}

// Braille spinner — same as ThinkingIndicator
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Claude Code-style activity log.
 * Running: braille spinner + label + elapsed time
 * Done: dimmed checkmark + label + final time
 * Error: x + label in accent color
 */
export function ActivityLog({ steps }: ActivityLogProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-0">
      {steps.map((step) => (
        <ActivityStep key={step.id} step={step} />
      ))}
    </div>
  );
}

function ActivityStep({ step }: { step: ProgressStep }) {
  const [elapsed, setElapsed] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  useEffect(() => {
    if (step.status !== "running") return;
    setElapsed(Math.floor((Date.now() - step.startedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - step.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [step.status, step.startedAt]);

  useEffect(() => {
    if (step.status !== "running") return;
    const interval = setInterval(() => {
      setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [step.status]);

  const displayElapsed =
    step.status === "running"
      ? elapsed
      : step.status === "done"
        ? Math.max(1, Math.floor((Date.now() - step.startedAt) / 1000))
        : 0;

  return (
    <div className="flex items-center gap-2 py-px font-mono text-[12px] leading-5">
      {/* Status icon */}
      <span className="shrink-0 w-3 text-center">
        {step.status === "running" && (
          <span className="text-[hsl(var(--accent))]">
            {SPINNER_FRAMES[spinnerFrame]}
          </span>
        )}
        {step.status === "done" && (
          <span className="text-[hsl(var(--success))] opacity-50">✓</span>
        )}
        {step.status === "error" && (
          <span className="text-[hsl(var(--accent))] opacity-60">✗</span>
        )}
      </span>

      {/* Label + detail */}
      <span className="flex-1 min-w-0">
        <span
          className={
            step.status === "running"
              ? "text-[hsl(var(--text-secondary))] opacity-70"
              : step.status === "done"
                ? "text-[hsl(var(--text-secondary))] opacity-30"
                : "text-[hsl(var(--accent))] opacity-50"
          }
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="text-[hsl(var(--text-secondary))] opacity-20 ml-1.5">
            {step.detail}
          </span>
        )}
      </span>

      {/* Elapsed time */}
      {step.status === "running" && elapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-20 tabular-nums">
          {displayElapsed}s
        </span>
      )}
      {step.status === "done" && displayElapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-15 tabular-nums">
          {displayElapsed}s
        </span>
      )}
    </div>
  );
}
