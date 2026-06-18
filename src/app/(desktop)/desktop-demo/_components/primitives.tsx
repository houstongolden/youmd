"use client";

import React from "react";
import { cn } from "../_lib/cn";

// Uppercase mono section label, per the brand system.
export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  green: "hsl(var(--success))",
  orange: "hsl(var(--accent))",
  dim: "hsl(var(--muted-foreground) / 0.4)",
};

// Small status dot. Uses an inline 50% border-radius (allowed by the design
// system) so we never need to touch the circular-class lint allowlist.
export function Dot({
  tone = "green",
  pulse = false,
  size = 7,
}: {
  tone?: keyof typeof STATUS_COLOR;
  pulse?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className={pulse ? "status-dot-pulse" : undefined}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "50%",
        background: STATUS_COLOR[tone],
      }}
    />
  );
}

// Generic terminal-style panel with a thin header. Lighter than the marketing
// terminal-panel — softer, more "Notion card" feel while keeping 1px borders.
export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]",
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-2.5">
          <SectionLabel>{title}</SectionLabel>
          {right}
        </div>
      )}
      <div className={cn("p-3.5", bodyClassName)}>{children}</div>
    </div>
  );
}

// A tiny pill / chip.
export function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "green";
}) {
  const tones = {
    default: "border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]",
    accent: "border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))]",
    green: "border-[hsl(var(--success))]/40 text-[hsl(var(--success))]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
