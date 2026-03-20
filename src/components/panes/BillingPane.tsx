"use client";

interface BillingPaneProps {
  plan: string;
  username: string;
}

export function BillingPane({ plan, username }: BillingPaneProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-3 border-b border-[hsl(var(--border))]">
        <span className="text-xs font-mono text-[hsl(var(--text-secondary))]">
          billing
        </span>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-xl">
        <section className="space-y-3">
          <h3 className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 uppercase tracking-widest">
            current plan
          </h3>
          <div
            className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-2"
            style={{ borderRadius: "2px" }}
          >
            <div className="flex gap-2">
              <span className="text-[hsl(var(--text-secondary))] opacity-40 w-20">
                plan
              </span>
              <span
                className={
                  plan === "pro"
                    ? "text-[hsl(var(--accent))]"
                    : "text-[hsl(var(--text-primary))]"
                }
              >
                {plan}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="text-[hsl(var(--text-secondary))] opacity-40 w-20">
                username
              </span>
              <span className="text-[hsl(var(--text-primary))]">
                @{username}
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 uppercase tracking-widest">
            features
          </h3>
          <div
            className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-[10px] space-y-1.5 text-[hsl(var(--text-secondary))]"
            style={{ borderRadius: "2px" }}
          >
            <p>-- public profile at you.md/{username}</p>
            <p>-- cli access (youmd)</p>
            <p>-- web agent chat</p>
            <p>-- api keys</p>
            <p>-- context links</p>
            {plan === "pro" && (
              <p className="text-[hsl(var(--accent))]">-- priority pipeline</p>
            )}
            {plan === "pro" && (
              <p className="text-[hsl(var(--accent))]">-- custom domain</p>
            )}
          </div>
        </section>

        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))]"
          style={{ borderRadius: "2px" }}
        >
          <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
            billing management coming soon. you.md is free during beta.
          </p>
        </div>
      </div>
    </div>
  );
}
