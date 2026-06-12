/**
 * Route-level loading boundary for the public profile. Matches the profile
 * column shape (portrait block + name + section blocks) with pulse skeletons.
 */
export default function ProfileLoading() {
  return (
    <main aria-busy="true" className="min-h-[100dvh] bg-[hsl(var(--bg))]">
      <div className="max-w-[680px] mx-auto w-full px-4 md:px-6 pt-12 pb-20 animate-pulse">
        {/* Portrait + name row */}
        <div className="flex items-end gap-4 mb-8">
          <div className="h-16 w-16 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm shrink-0" />
          <div className="flex-1 space-y-2 pb-1">
            <div className="w-44 h-4 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
            <div className="w-24 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          </div>
        </div>
        {/* Section blocks */}
        <div className="space-y-6">
          <div className="w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          <div className="w-5/6 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          <div className="w-2/3 h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
          <div className="w-full h-28 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] rounded-sm" />
          <div className="w-full h-28 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] rounded-sm" />
        </div>
      </div>
    </main>
  );
}
