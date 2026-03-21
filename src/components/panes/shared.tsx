/**
 * Shared pane primitives for consistent UI across all dashboard panes.
 */

export function PaneSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-widest mb-3">
      &gt; {children}
    </h3>
  );
}

export function PaneDivider() {
  return <div className="h-px bg-[hsl(var(--border))] my-6" />;
}

export function PaneHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
      <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
        {children}
      </span>
    </div>
  );
}

export function PaneEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <p className="text-sm font-mono text-[hsl(var(--text-secondary))] opacity-40">
          {children}
        </p>
      </div>
    </div>
  );
}
