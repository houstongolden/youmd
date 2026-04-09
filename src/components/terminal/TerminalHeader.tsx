"use client";

interface TerminalHeaderProps {
  title: string;
  /** Render the title as an h1 heading (for top-level pages — improves SEO and a11y). Default false. */
  asHeading?: boolean;
}

export function TerminalHeader({ title, asHeading = false }: TerminalHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
      <div className="flex gap-1.5" aria-hidden="true">
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "rgba(239, 68, 68, 0.6)" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "rgba(234, 179, 8, 0.6)" }}
        />
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: "rgba(34, 197, 94, 0.6)" }}
        />
      </div>
      {asHeading ? (
        <h1 className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2 font-normal">
          {title}
        </h1>
      ) : (
        <span className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2">
          {title}
        </span>
      )}
    </div>
  );
}
