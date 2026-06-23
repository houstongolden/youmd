"use client";

import { useState } from "react";
import { APPS, type AppConn } from "../../_data/mock";
import { Icon } from "../icons";
import { Dot, Chip, SectionLabel, ViewHeader } from "../primitives";
import { cn } from "../../_lib/cn";

function Favicon({ domain, dim = false }: { domain: string; dim?: boolean }) {
  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))]",
        dim && "opacity-50",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4"
      />
    </span>
  );
}

function Row({ app }: { app: AppConn }) {
  const [open, setOpen] = useState(false);
  const available = app.status === "available";
  return (
    <div className="border-b border-[hsl(var(--border))] last:border-b-0">
      <button
        onClick={() => !available && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[hsl(var(--bg-raised))]"
      >
        <Favicon domain={app.domain} dim={available} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-[13px]", available ? "text-[hsl(var(--text-secondary))]" : "text-[hsl(var(--text-primary))]")}>{app.name}</span>
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">{app.category}</span>
          </div>
          <div className="truncate text-[12px] text-[hsl(var(--text-secondary))]/65">{app.detail}</div>
        </div>
        {available ? (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">
            <Icon name="plus" size={12} /> connect
          </span>
        ) : (
          <>
            <Dot tone={app.status === "syncing" ? "orange" : "green"} pulse={app.status === "syncing"} size={6} />
            <Icon name="chevronDown" size={14} className={cn("text-[hsl(var(--text-secondary))]/50 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>
      {open && !available && (
        <div className="space-y-1 px-3.5 pb-3 pl-[58px]">
          {app.account && (
            <div className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">account</span>
              <span className="text-[12px] text-[hsl(var(--text-primary))]">{app.account}</span>
            </div>
          )}
          {app.lastSync && (
            <div className="flex items-baseline justify-between gap-3 py-0.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/55">last sync</span>
              <span className="text-[12px] text-[hsl(var(--text-primary))]">{app.lastSync}</span>
            </div>
          )}
          {app.scopes && (
            <div className="flex flex-wrap items-center gap-1 pt-1">
              {app.scopes.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button className="rounded-sm border border-[hsl(var(--border))] px-2.5 py-1 font-mono text-[10px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--text-primary))]">
              sync now
            </button>
            <button className="rounded-sm border border-[hsl(var(--border))] px-2.5 py-1 font-mono text-[10px] text-[hsl(var(--text-secondary))]/70 transition-colors hover:text-[hsl(var(--destructive))]">
              disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppsView() {
  const active = APPS.filter((a) => a.status !== "available");
  const available = APPS.filter((a) => a.status === "available");
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader
        title="Connections"
        description="Every connected app feeds your brain — agents read the context and act on it. Click a connection for details."
      />

      <SectionLabel className="mb-2">Connected · {active.length}</SectionLabel>
      <div className="mb-6 rounded-sm border border-[hsl(var(--border))]">
        {active.map((a) => (
          <Row key={a.id} app={a} />
        ))}
      </div>

      <SectionLabel className="mb-2">Available</SectionLabel>
      <div className="rounded-sm border border-[hsl(var(--border))]">
        {available.map((a) => (
          <Row key={a.id} app={a} />
        ))}
      </div>
    </div>
  );
}
