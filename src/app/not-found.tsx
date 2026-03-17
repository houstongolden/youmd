import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight hover:text-coral transition-colors">
          you.md
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/claim"
            className="text-sm px-4 py-2 bg-coral text-void rounded-md font-medium hover:opacity-90 transition-all"
          >
            Claim your username
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden animate-fade-in">
        {/* Beam glow background */}
        <div className="absolute inset-0 beam-glow pointer-events-none opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-coral/[0.03] blur-[80px] pointer-events-none" />

        <div className="relative z-10 text-center space-y-6 max-w-md mx-auto">
          <div className="font-mono text-7xl font-normal tracking-tight text-mist/60">
            404
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            This page doesn&apos;t exist
          </h1>
          <p className="text-foreground-secondary text-sm leading-relaxed max-w-sm mx-auto">
            The page you&apos;re looking for couldn&apos;t be found. If you were looking for
            a profile, the username may not have been claimed yet.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/"
              className="px-5 py-2.5 text-sm border border-border rounded-lg hover:border-accent-secondary transition-all text-foreground-secondary hover:text-foreground"
            >
              Back to home
            </Link>
            <Link
              href="/claim"
              className="px-5 py-2.5 text-sm bg-coral text-void rounded-lg font-medium hover:opacity-90 transition-all"
            >
              Claim a username
            </Link>
            <Link
              href="/sign-in"
              className="px-5 py-2.5 text-sm border border-border rounded-lg hover:border-accent-secondary transition-all text-foreground-secondary hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>

      <footer className="px-6 py-8 border-t border-border text-center">
        <p className="text-xs text-mist">
          Identity as code. Open spec.{" "}
          <span className="font-mono">you-md/v1</span>
        </p>
      </footer>
    </div>
  );
}
