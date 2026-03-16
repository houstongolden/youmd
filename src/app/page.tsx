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

      {/* How It Works */}
      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-coral uppercase tracking-wider mb-12">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background-secondary font-mono text-sm text-sky">
                1
              </div>
              <h3 className="font-medium text-sm">Claim</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Pick your username. Your identity lives at you.md/yourname -- permanent and portable.
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background-secondary font-mono text-sm text-sky">
                2
              </div>
              <h3 className="font-medium text-sm">Build</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Fill in your identity bundle: bio, projects, values, agent preferences. Structured data, not a wall of text.
              </p>
            </div>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border bg-background-secondary font-mono text-sm text-sky">
                3
              </div>
              <h3 className="font-medium text-sm">Share</h3>
              <p className="text-foreground-secondary text-sm leading-relaxed">
                Publish your bundle. Any agent, app, or human can read your you.json and instantly know how to work with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Value Prop */}
      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-3xl mx-auto grid sm:grid-cols-2 gap-12">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-sky uppercase tracking-wider">
              For your agents
            </h2>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              Stop re-explaining yourself every session. Your you.md bundle gives your AI assistants persistent context -- your tone, your preferences, your current projects. They onboard in seconds, not minutes.
            </p>
            <ul className="space-y-2 text-sm text-foreground-secondary">
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                Consistent voice across every AI tool you use
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                No more copy-pasting your bio into system prompts
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                Agent preferences travel with you, not with the app
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gold uppercase tracking-wider">
              For everyone else&apos;s agents
            </h2>
            <p className="text-foreground-secondary text-sm leading-relaxed">
              When someone else&apos;s agent needs to reference you -- for outreach, scheduling, collaboration -- your you.md is the canonical source. Structured, verified, and under your control.
            </p>
            <ul className="space-y-2 text-sm text-foreground-secondary">
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                Control how other people&apos;s AI sees you
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                Replace stale LinkedIn scrapes with live, structured data
              </li>
              <li className="flex items-start gap-2">
                <span className="text-mist mt-0.5">-</span>
                One source of truth for the entire agent ecosystem
              </li>
            </ul>
          </div>
        </div>
      </section>

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
