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

// Standard header for full-page (scrolling) views — Skills, Connections,
// Agents, Loops. Guarantees one consistent title/description/rhythm everywhere.
export function ViewHeader({
  title,
  description,
  right,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-mono text-xl font-semibold tracking-tight text-[hsl(var(--text-primary))]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]/80">{description}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

// Standard top bar for tool views with their own internal chrome — Graph,
// Tasks (and matching the Editor/Projects bar height/padding).
export function ViewBar({
  title,
  right,
}: {
  title: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-2.5 md:px-5">
      <div className="flex items-center gap-2 font-mono text-[13px] text-[hsl(var(--text-primary))]">{title}</div>
      {right}
    </div>
  );
}

// Segmented control shown in the workspace header for destinations that hold
// more than one sub-view (Brain: Vault/Graph · Runtime: Agents/…/Provision).
// This is what replaces the old shell's second tab row + query-param maze.
export function SegmentedHeader<T extends string>({
  segments,
  active,
  onSelect,
  right,
}: {
  segments: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-3 py-2 md:px-4">
      <div className="flex items-center gap-0.5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-0.5">
        {segments.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "rounded-sm px-2.5 py-1 font-mono text-[11.5px] transition-colors",
              active === s.id
                ? "bg-[hsl(var(--accent))] text-white"
                : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {right}
    </div>
  );
}

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
