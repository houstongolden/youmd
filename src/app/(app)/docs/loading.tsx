/**
 * Route-level loading boundary for /docs. Matches the docs shell: top bar,
 * desktop sidebar, and a content column of pulse blocks.
 */
export default function DocsLoading() {
  return (
    <main aria-busy="true" className="min-h-[100dvh] bg-[hsl(var(--bg))]">
      {/* Top bar */}
      <div className="border-b border-[hsl(var(--border))]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <div className="w-24 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm animate-pulse" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-[hsl(var(--border))]">
          <div className="py-8 px-4 space-y-3 animate-pulse">
            <div className="w-32 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
            <div className="w-24 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            <div className="w-28 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            <div className="w-20 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            <div className="w-28 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          </div>
        </aside>
        {/* Content column */}
        <div className="flex-1 min-w-0 px-6 md:px-12 py-10 md:py-12">
          <div className="max-w-3xl space-y-4 animate-pulse">
            <div className="w-28 h-3 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
            <div className="w-56 h-6 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
            <div className="w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            <div className="w-5/6 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
            <div className="w-full h-32 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] rounded-sm" />
            <div className="w-2/3 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          </div>
        </div>
      </div>
    </main>
  );
}
