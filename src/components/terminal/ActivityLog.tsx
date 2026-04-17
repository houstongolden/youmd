"use client";

import { useEffect, useMemo, useState } from "react";

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

  const orderedSteps = useMemo(() => {
    const running = steps.filter((step) => step.status === "running");
    const errors = steps.filter((step) => step.status === "error");
    const done = steps.filter((step) => step.status === "done");
    return [...running, ...errors, ...done];
  }, [steps]);

  return (
    <div className="space-y-0">
      <style>{`
        @keyframes youmdActivitySweep {
          0% { background-position: 150% 50%; }
          100% { background-position: -50% 50%; }
        }
        .youmd-activity-sweep {
          background-image: linear-gradient(
            90deg,
            hsl(var(--accent) / 0.52) 0%,
            hsl(var(--accent) / 0.7) 35%,
            hsl(var(--text-primary) / 0.98) 50%,
            hsl(var(--accent) / 0.7) 65%,
            hsl(var(--accent) / 0.52) 100%
          );
          background-size: 230% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: youmdActivitySweep 2.2s linear infinite;
        }
      `}</style>
      {orderedSteps.map((step) => (
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
    <div
      className={`flex items-center gap-2 py-px font-mono text-[10px] leading-5 transition-opacity duration-300 ${
        step.status === "done" ? "opacity-40" : step.status === "error" ? "opacity-60" : "opacity-100"
      }`}
    >
      {/* Status icon */}
      <span className="shrink-0 w-3 text-center">
        {step.status === "running" && (
          <span className="text-[hsl(var(--accent))]">
            {SPINNER_FRAMES[spinnerFrame]}
          </span>
        )}
        {step.status === "done" && (
          <span className="text-[hsl(var(--success))]">✓</span>
        )}
        {step.status === "error" && (
          <span className="text-[hsl(var(--accent))]">✗</span>
        )}
      </span>

      {/* Label + detail */}
      <span className="flex-1 min-w-0">
        <span
          className={
            step.status === "running"
              ? "youmd-activity-sweep"
              : step.status === "done"
                ? "text-[hsl(var(--text-secondary))]"
                : "text-[hsl(var(--accent))]"
          }
        >
          {step.label}
        </span>
        {step.detail && (
          <span className={`ml-1.5 ${
            step.status === "running"
              ? "text-[hsl(var(--text-secondary))] opacity-50"
              : "text-[hsl(var(--text-secondary))] opacity-30"
          }`}>
            {step.detail}
          </span>
        )}
      </span>

      {/* Elapsed time */}
      {step.status === "running" && elapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-40 tabular-nums">
          {displayElapsed}s
        </span>
      )}
      {step.status === "done" && displayElapsed >= 1 && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--text-secondary))] opacity-30 tabular-nums">
          {displayElapsed}s
        </span>
      )}
    </div>
  );
}
