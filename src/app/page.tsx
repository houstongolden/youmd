import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="font-mono text-lg tracking-tight">
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
            className="text-sm px-4 py-2 bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Claim your username
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* Beam of light background effect */}
        <div className="absolute inset-0 beam-glow pointer-events-none" />

        <div className="max-w-2xl mx-auto text-center relative z-10 space-y-8">
          {/* Monospace brand mark */}
          <div className="inline-block">
            <span className="font-mono text-5xl sm:text-7xl font-normal tracking-tight brand-gradient-text">
              you.md
            </span>
          </div>

          {/* Tagline */}
          <h1 className="text-xl sm:text-2xl font-light text-foreground-secondary leading-relaxed max-w-lg mx-auto">
            Your identity file for the agent internet.
            <br />
            <span className="text-foreground font-normal">
              Onboard any AI in seconds.
            </span>
          </h1>

          {/* Value prop */}
          <p className="text-foreground-secondary text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            A structured, portable identity bundle that gives every agent
            context about who you are, how you work, and what you&apos;re building.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/claim"
              className="px-6 py-3 bg-coral text-void rounded-md font-medium hover:opacity-90 transition-opacity text-sm"
            >
              Claim your username
            </Link>
            <code className="text-foreground-secondary text-sm font-mono px-4 py-3 border border-border rounded-md bg-background-secondary">
              npx create-youmd
            </code>
          </div>

          {/* Symmetry visual */}
          <div className="pt-12 space-y-3 text-sm font-mono text-foreground-secondary">
            <div className="flex items-center justify-center gap-3">
              <span className="text-mist">agent.md</span>
              <span className="text-mist/50">&mdash;</span>
              <span className="text-mist/70">the agent&apos;s instructions</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-mist">soul.md</span>
              <span className="text-mist/50">&mdash;</span>
              <span className="text-mist/70">the agent&apos;s identity</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-coral font-medium">you.md</span>
              <span className="text-mist/50">&mdash;</span>
              <span className="text-foreground-secondary">
                the human&apos;s identity
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border text-center">
        <p className="text-xs text-mist">
          Identity as code. Open spec.{" "}
          <span className="font-mono">you-md/v1</span>
        </p>
      </footer>
    </div>
  );
}
