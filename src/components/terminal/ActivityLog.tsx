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

/**
 * Claude Code-style activity log showing real-time progress steps.
 * Each step shows a status icon, label, optional detail, and elapsed time.
 * Completed steps fade out to keep focus on active work.
 */
export function ActivityLog({ steps }: ActivityLogProps) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {steps.map((step) => (
        <ActivityStep key={step.id} step={step} />
      ))}
    </div>
  );
}

function ActivityStep({ step }: { step: ProgressStep }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (step.status !== "running") return;
    // Set initial elapsed immediately
    setElapsed(Math.floor((Date.now() - step.startedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - step.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [step.status, step.startedAt]);

  // Compute final elapsed for completed steps
  const displayElapsed =
    step.status === "running"
      ? elapsed
      : step.status === "done"
        ? Math.max(1, Math.floor((Date.now() - step.startedAt) / 1000))
        : 0;

  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-[12px]">
      {/* Status icon */}
      <span className="shrink-0 mt-px w-3.5 text-center">
        {step.status === "running" && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] animate-pulse" />
        )}
        {step.status === "done" && (
          <span className="text-[hsl(var(--success))] opacity-70">+</span>
        )}
        {step.status === "error" && (
          <span className="text-[hsl(var(--accent))] opacity-70">x</span>
        )}
      </span>

      {/* Label + detail */}
      <span className="flex-1 min-w-0">
        <span
          className={
            step.status === "running"
              ? "text-[hsl(var(--text-secondary))] opacity-80"
              : step.status === "done"
                ? "text-[hsl(var(--text-secondary))] opacity-40"
                : "text-[hsl(var(--accent))] opacity-60"
          }
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="text-[hsl(var(--text-secondary))] opacity-30 ml-1.5">
            {step.detail}
          </span>
        )}
      </span>

      {/* Elapsed time */}
      {step.status === "running" && elapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-25 tabular-nums">
          {displayElapsed}s
        </span>
      )}
      {step.status === "done" && displayElapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-20 tabular-nums">
          {displayElapsed}s
        </span>
      )}
    </div>
  );
}
