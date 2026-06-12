/**
 * Route-level loading boundary for /initialize. Matches the page's own
 * centered loading state so the transition is seamless.
 */
export default function InitializeLoading() {
  return (
    <main
      aria-busy="true"
      className="min-h-[100dvh] flex items-center justify-center bg-[hsl(var(--bg))]"
    >
      <p className="text-[hsl(var(--text-secondary))] font-mono text-sm animate-pulse">
        loading...
      </p>
    </main>
  );
}
