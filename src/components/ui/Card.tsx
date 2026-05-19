import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CardPadding = "compact" | "default" | "large";

const paddingClasses: Record<CardPadding, string> = {
  compact: "p-4",
  default: "p-5 md:p-6",
  large: "p-6 md:p-8",
};

export function Card({
  children,
  className,
  padding = "default",
}: {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
}) {
  return (
    <div className={cn("rounded-[2px] border border-border bg-card", paddingClasses[padding], className)}>
      {children}
    </div>
  );
}

export function TerminalCard({
  children,
  title,
  className,
  bodyClassName,
}: {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[2px] border border-border bg-card", className)}>
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/18" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/18" />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/18" />
        {title && (
          <span className="ml-2 font-mono text-[10px] text-muted-foreground/55">
            {title}
          </span>
        )}
      </div>
      <div className={cn("p-4 md:p-5", bodyClassName)}>{children}</div>
    </div>
  );
}
