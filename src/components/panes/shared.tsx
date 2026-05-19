/**
 * Shared pane primitives for consistent UI across all dashboard panes.
 */

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function PaneSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
      &gt; {children}
    </h3>
  );
}

export function PaneDivider() {
  return <div className="my-6 h-px bg-border" />;
}

export function PaneHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-border px-6 py-3">
      <span className="font-mono text-[12px] text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function PaneEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <p className="font-mono text-[13px] text-muted-foreground/45">
          {children}
        </p>
      </div>
    </div>
  );
}

export function PaneCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border border-border bg-card p-4", className)}>
      {children}
    </div>
  );
}

export function PaneButton({ className, ...props }: ButtonProps) {
  return <Button size="sm" className={cn("text-[10px]", className)} {...props} />;
}
