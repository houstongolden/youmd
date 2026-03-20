import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]">
      {/* Nav */}
      <nav className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border))]">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight hover:text-[hsl(var(--accent))] transition-colors"
        >
          you.md
        </Link>
        <div className="flex items-center gap-3 text-xs font-mono text-[hsl(var(--text-secondary))]">
          <Link
            href="/sign-in"
            className="hover:text-[hsl(var(--text-primary))] transition-colors"
          >
            sign in
          </Link>
          <span className="text-[hsl(var(--border))]">|</span>
          <Link
            href="/sign-up"
            className="text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
          >
            &gt; initialize
          </Link>
        </div>
      </nav>

      {/* Terminal body */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* Beam glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-full beam-glow pointer-events-none" />

        <div className="relative z-10 max-w-md w-full">
          {/* Terminal panel */}
          <div className="terminal-panel">
            <div className="terminal-panel-header">
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <div className="terminal-dot" />
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 ml-2">
                error
              </span>
            </div>
            <div className="p-6 space-y-3 font-mono text-[13px]">
              <p className="text-[hsl(var(--text-secondary))] opacity-60">
                &gt; navigating...
              </p>
              <p className="text-[hsl(var(--accent))]">&gt; 404: page not found</p>
              <div className="h-2" />
              <p className="text-[hsl(var(--text-secondary))] opacity-50 text-xs leading-relaxed">
                the page you are looking for does not exist. if you were looking
                for a profile, the username may not have been claimed yet.
              </p>
              <div className="section-divider my-4" />
              <div className="space-y-1.5 text-xs">
                <Link
                  href="/"
                  className="block text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] transition-colors"
                >
                  &gt; cd /home
                </Link>
                <Link
                  href="/sign-up"
                  className="block text-[hsl(var(--accent))] hover:text-[hsl(var(--accent-light))] transition-colors"
                >
                  &gt; initialize
                </Link>
                <Link
                  href="/sign-in"
                  className="block text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--accent))] transition-colors"
                >
                  &gt; authenticate
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-[hsl(var(--border))] text-center">
        <p className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30 uppercase tracking-widest">
          identity as code -- open spec -- you-md/v1
        </p>
      </footer>
    </div>
  );
}
