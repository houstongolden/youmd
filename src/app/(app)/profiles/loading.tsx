/**
 * Route-level loading boundary for /profiles. Matches the directory column:
 * header lines + a stack of profile-row blocks.
 */
export default function ProfilesLoading() {
  return (
    <main aria-busy="true" className="min-h-[100dvh] bg-[hsl(var(--bg))] px-4 pb-8 pt-7 sm:px-6 sm:pt-8">
      <div className="max-w-[680px] mx-auto animate-pulse">
        {/* Header */}
        <div className="mb-10 space-y-3">
          <div className="w-20 h-2.5 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
          <div className="w-48 h-6 bg-[hsl(var(--text-secondary))] opacity-10 rounded-sm" />
          <div className="w-72 max-w-full h-3 bg-[hsl(var(--text-secondary))] opacity-[0.06] rounded-sm" />
        </div>
        {/* Profile rows */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-full h-16 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] rounded-sm"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
