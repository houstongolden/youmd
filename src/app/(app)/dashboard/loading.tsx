import { TerminalHeader } from "@/components/terminal/TerminalHeader";

/**
 * Route-level loading boundary for /dashboard. Mirrors the in-page skeleton
 * in dashboard-content.tsx (terminal header, status bar, 35/65 split) so the
 * route transition and the convex-loading state look identical.
 */
export default function DashboardLoading() {
  return (
    <main aria-busy="true" className="h-[calc(100dvh-2.25rem)] bg-[hsl(var(--bg))] flex flex-col">
      <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full p-0 md:p-4 min-h-0">
        <div className="flex-1 flex flex-col bg-[hsl(var(--bg-raised))] md:border md:border-[hsl(var(--border))] overflow-hidden min-h-0">
          <div className="hidden md:block">
            <TerminalHeader title="you.md — shell" />
          </div>
          {/* Skeleton status bar */}
          <div className="hidden md:flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))]">
            <div className="w-48 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm animate-pulse" />
          </div>
          {/* Skeleton split layout */}
          <div className="flex-1 flex min-h-0">
            {/* Left: terminal skeleton */}
            <div className="w-full md:w-[35%] md:border-r md:border-[hsl(var(--border))] flex flex-col p-4 gap-3 animate-pulse">
              <div className="w-32 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
              <div className="w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              <div className="w-3/4 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              <div className="flex-1" />
              <div className="w-full h-8 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            </div>
            {/* Right: pane skeleton */}
            <div className="hidden md:flex md:w-[65%] flex-col">
              <div className="flex items-center px-4 py-1.5 border-b border-[hsl(var(--border))] gap-2 animate-pulse">
                <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="w-14 h-5 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              </div>
              <div className="flex-1 p-4 space-y-4 animate-pulse">
                <div className="w-40 h-4 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
                <div className="w-full h-24 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
                <div className="w-2/3 h-4 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
