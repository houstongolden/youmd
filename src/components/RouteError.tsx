"use client";

import { useEffect } from "react";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** lowercase route label, e.g. "dashboard" */
  label?: string;
}

/**
 * Shared App Router error boundary body. Each route's error.tsx is a thin
 * wrapper around this so failures render a terminal panel instead of a blank
 * screen. No stack traces are ever rendered — only the opaque digest.
 */
export function RouteError({ error, reset, label = "this page" }: RouteErrorProps) {
  useEffect(() => {
    // Log for devtools/observability only — never rendered to the user
    console.error(`[route-error] ${label}:`, error);
  }, [error, label]);

  return (
    <div className="min-h-[70dvh] bg-[hsl(var(--bg))] flex items-center justify-center p-4">
      <div
        role="alert"
        className="w-full max-w-md bg-[hsl(var(--bg-raised))] border border-[hsl(var(--border))] overflow-hidden"
        style={{ borderRadius: "var(--radius)" }}
      >
        <TerminalHeader title={`you.md — ${label}`} />
        <div className="p-5 font-mono">
          <p className="text-[13px] text-[hsl(var(--text-primary))]">
            <span className="text-[hsl(var(--accent))]">ERR:</span> something broke
          </p>
          <p className="mt-1.5 text-[11px] text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed">
            {label} hit an unexpected error. your data is fine — try again.
          </p>
          <button
            onClick={reset}
            className="mt-4 px-3 py-1.5 text-[12px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))]/40 hover:bg-[hsl(var(--accent))]/10 transition-colors cursor-pointer"
            style={{ borderRadius: "var(--radius)" }}
          >
            [retry]
          </button>
          {error.digest && (
            <p className="mt-4 text-[10px] text-[hsl(var(--text-secondary))] opacity-30">
              digest: {error.digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
