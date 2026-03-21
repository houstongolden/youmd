"use client";

import { PaneSectionLabel as SectionLabel, PaneDivider as Divider, PaneHeader } from "./shared";

interface BillingPaneProps {
  plan: string;
  username: string;
}

export function BillingPane({ plan, username }: BillingPaneProps) {
  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>billing</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        <SectionLabel>current plan</SectionLabel>
        <div
          className="border border-[hsl(var(--border))] p-4 bg-[hsl(var(--bg-raised))] font-mono text-xs space-y-2"
          style={{ borderRadius: "2px" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">
              plan
            </span>
            <span
              className={
                plan === "pro"
                  ? "text-[hsl(var(--accent))]"
                  : "text-[hsl(var(--text-primary))] opacity-70"
              }
            >
              {plan}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[hsl(var(--text-secondary))] opacity-60">
              username
            </span>
            <span className="text-[hsl(var(--text-primary))] opacity-70">
              @{username}
            </span>
          </div>
        </div>

        <Divider />

        <SectionLabel>features</SectionLabel>
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

        <Divider />

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
