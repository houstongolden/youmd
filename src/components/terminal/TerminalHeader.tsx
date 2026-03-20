"use client";

interface TerminalHeaderProps {
  title: string;
}

export function TerminalHeader({ title }: TerminalHeaderProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-[hsl(var(--border))]">
      <div className="flex gap-1.5">
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
      <span className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-60 ml-2">
        {title}
      </span>
    </div>
  );
}
