import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight">
          you.md
        </Link>
        <Link
          href="/claim"
          className="text-sm px-4 py-2 bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          Claim your username
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 beam-glow pointer-events-none opacity-30" />

        <div className="relative z-10 text-center space-y-6 max-w-md mx-auto">
          <div className="font-mono text-6xl font-normal tracking-tight text-mist">
            404
          </div>
          <h1 className="text-xl font-semibold">
            Page not found
          </h1>
          <p className="text-foreground-secondary text-sm leading-relaxed">
            This page does not exist. If you were looking for a profile,
            the username may not have been claimed yet.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/"
              className="px-5 py-2.5 text-sm border border-border rounded-md hover:border-sky transition-colors text-foreground-secondary hover:text-foreground"
            >
              Back to home
            </Link>
            <Link
              href="/claim"
              className="px-5 py-2.5 text-sm bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Claim a username
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
