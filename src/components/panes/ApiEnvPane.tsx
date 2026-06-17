"use client";

import { apiSurfaces, envProviderUsages, serviceAccounts } from "@/data/portfolioGraph";
import { CopyableCommand } from "./CopyableCommand";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";

function riskClass(risk: string) {
  if (risk === "high") return "text-[hsl(var(--accent))]";
  if (risk === "medium") return "text-yellow-500";
  return "text-[hsl(var(--success))]";
}

function categoryClass(category: string) {
  if (category === "llm") return "text-[hsl(var(--accent))]";
  if (category === "sms" || category === "email") return "text-yellow-500";
  return "text-[hsl(var(--text-secondary))] opacity-60";
}

export function ApiEnvPane() {
  const providerCount = envProviderUsages.length;
  const projectRefs = new Set(envProviderUsages.flatMap((usage) => usage.projects));
  const normalizedKeyCount = envProviderUsages.reduce((total, usage) => total + usage.normalizedNames.length, 0);
  const highRiskSurfaces = apiSurfaces.filter((surface) => surface.risk === "high").length;

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>apis + env intelligence</PaneHeader>
      <div className="max-w-6xl px-6 py-6">
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <PaneSectionLabel>secret-safe inventory</PaneSectionLabel>
            <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
              Track which projects use which APIs, providers, accounts, keys, and env names without shipping raw secrets to the browser.
            </h2>
            <p className="mt-3 max-w-3xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
              The local auditor scans key names and file paths, normalizes provider aliases, detects likely shared keys by local-only fingerprint,
              and stores account notes separately from encrypted secret material.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["providers", providerCount],
              ["projects", projectRefs.size],
              ["key aliases", normalizedKeyCount],
              ["high risk", highRiskSurfaces],
            ].map(([label, value]) => (
              <div key={label} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
                <div className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">{value}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>provider usage</PaneSectionLabel>
          <div className="space-y-2">
            {envProviderUsages.map((usage) => (
              <div key={usage.provider} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.8fr_1fr_1.1fr]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{usage.provider}</span>
                    <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${categoryClass(usage.category)}`}>{usage.category}</span>
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                    {usage.projectCount} projects / {usage.keyNameCount} key-name variants
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {usage.normalizedNames.map((name) => (
                    <span key={`${usage.provider}-${name}`} className="border border-[hsl(var(--border))]/70 px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50">
                      {name}
                    </span>
                  ))}
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                  {usage.policy}
                </p>
              </div>
            ))}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>api/mcp surfaces</PaneSectionLabel>
          <div className="grid gap-3 xl:grid-cols-2">
            {apiSurfaces.map((surface) => (
              <article key={surface.slug} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{surface.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">{surface.kind}</span>
                  <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${riskClass(surface.risk)}`}>{surface.risk}</span>
                </div>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">{surface.notes}</p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">owner</div>
                    <p className="mt-1 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-55">{surface.ownerProject} / {surface.ownerStack}</p>
                  </div>
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">auth</div>
                    <p className="mt-1 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-55">{surface.authMode}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {surface.features.slice(0, 5).map((feature) => (
                    <span key={`${surface.slug}-${feature}`} className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                      {feature}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>service account notes</PaneSectionLabel>
          <div className="space-y-2">
            {serviceAccounts.map((account) => (
              <div key={account.provider} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.7fr_1fr_1fr]">
                <div>
                  <div className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{account.provider}</div>
                  <div className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">{account.billingOwner}</div>
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">{account.loginHint}</p>
                <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">{account.separationPolicy}</p>
              </div>
            ))}
          </div>
        </section>

        <PaneDivider />

        <section>
          <PaneSectionLabel>local audit commands</PaneSectionLabel>
          <div className="space-y-2">
            <CopyableCommand command="~/.agent-shared/bin/env-key-audit.py --root ~/Desktop/CODE_2025" />
            <CopyableCommand command="youmd project portfolio-audit --root ~/Desktop/CODE_2025" dimmed />
            <CopyableCommand command="/skill use portfolio-graph-auditor" dimmed />
          </div>
          <p className="mt-4 max-w-3xl font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
            Browser-safe mode shows provider names, env key names, project paths, account notes, and redacted/fingerprinted identity.
            Full secret reveal/copy should require local vault unlock and should never be included in SSR payloads, API logs, or agent chat transcripts.
          </p>
        </section>
      </div>
    </div>
  );
}
