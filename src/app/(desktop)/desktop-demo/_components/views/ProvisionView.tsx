"use client";

import { useState } from "react";
import { PROVISION_TARGETS, PROVISION_STEPS, type ProvisionStep } from "../../_data/mock";
import { ViewHeader, Chip, Dot } from "../primitives";
import { Icon } from "../icons";
import { cn } from "../../_lib/cn";

// A copyable command card (real install/setup commands).
function CmdCard({ label, cmd, note }: { label: string; cmd: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-3.5 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/70">{label}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(cmd);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="font-mono text-[10px] text-[hsl(var(--text-secondary))] transition-colors hover:text-[hsl(var(--accent))]"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[11.5px] leading-relaxed text-[hsl(var(--text-primary))]">
        {cmd}
        {note && (
          <>
            {"\n"}
            <span className="text-[hsl(var(--text-secondary))]/50"># {note}</span>
          </>
        )}
      </pre>
    </div>
  );
}

// The hero "spin up a whole synced agentic environment" flow — the visual
// front-end of machine-bootstrap. Pick a target → stream the setup → every
// step (identity, skills, MCP, repos, env vault, proof) lands, secrets local.
export function ProvisionView() {
  const [target, setTarget] = useState(PROVISION_TARGETS[0].id);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<ProvisionStep[]>(PROVISION_STEPS);

  const done = steps.filter((s) => s.state === "done").length;

  const run = () => {
    setRunning(true);
    // Demo: walk the pending steps forward on a timer so it feels alive.
    setSteps((prev) => {
      const next = [...prev];
      const i = next.findIndex((s) => s.state !== "done");
      if (i >= 0) next[i] = { ...next[i], state: "active" };
      return next;
    });
    let i = steps.findIndex((s) => s.state !== "done");
    const tick = () => {
      i += 1;
      setSteps((prev) => {
        const next = prev.map((s) => (s.state === "active" ? { ...s, state: "done" as const } : s));
        if (i < next.length) next[i] = { ...next[i], state: "active" };
        return next;
      });
      if (i < steps.length) setTimeout(tick, 900);
      else setRunning(false);
    };
    setTimeout(tick, 900);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
      <ViewHeader
        title={
          <>
            <Icon name="device" size={18} className="text-[hsl(var(--accent))]" />
            Provision
          </>
        }
        description="Spin up a new machine with your whole synced agentic environment — identity, skills, MCP, repos, and encrypted secrets — in one guided flow."
      />

      {/* target picker */}
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {PROVISION_TARGETS.map((t) => {
          const active = target === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTarget(t.id)}
              className={cn(
                "flex items-start gap-2.5 rounded-sm border p-3 text-left transition-colors",
                active
                  ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg-raised))]"
                  : "border-[hsl(var(--border))] hover:bg-[hsl(var(--bg-raised))]",
              )}
            >
              <Icon name={t.icon} size={16} className={active ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]"} />
              <div className="min-w-0">
                <div className="text-[13px] text-[hsl(var(--text-primary))]">{t.label}</div>
                <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/70">{t.detail}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* one-command card */}
      <div className="mb-5 space-y-2">
        <CmdCard
          label="1 · install the runtime"
          cmd="curl -fsSL https://you.md/install.sh | bash"
          note="installs the you.md CLI, then: you login"
        />
        <CmdCard
          label="2 · full machine setup (mints a 7-day key)"
          cmd="you machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault"
          note="prints the one-paste setup command: identity · skills · MCP · repos · env vault · proof"
        />
      </div>

      {/* run + progress */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--text-secondary))]/70">
            setup
          </span>
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">
            {done}/{steps.length}
          </span>
        </div>
        <button
          onClick={run}
          disabled={running || done === steps.length}
          className={cn(
            "rounded-sm px-3 py-1.5 font-mono text-[11px] transition-colors",
            running || done === steps.length
              ? "border border-[hsl(var(--border))] text-[hsl(var(--text-secondary))]/50"
              : "bg-[hsl(var(--accent))] text-white hover:opacity-90",
          )}
        >
          {done === steps.length ? "complete" : running ? "running…" : "run setup"}
        </button>
      </div>

      <div className="rounded-sm border border-[hsl(var(--border))]">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5",
              i !== steps.length - 1 && "border-b border-[hsl(var(--border))]",
            )}
          >
            <span className="shrink-0">
              {s.state === "done" ? (
                <Icon name="check" size={15} className="text-[hsl(var(--success))]" />
              ) : s.state === "active" ? (
                <Dot tone="orange" pulse size={8} />
              ) : (
                <Dot tone="dim" size={8} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "text-[13px]",
                  s.state === "pending" ? "text-[hsl(var(--text-secondary))]/50" : "text-[hsl(var(--text-primary))]",
                )}
              >
                {s.label}
              </div>
              <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/60">{s.detail}</div>
            </div>
            {s.state === "active" && <Chip tone="accent">running</Chip>}
            {s.state === "done" && <Chip tone="green">done</Chip>}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))]/70">
        Secrets never touch the browser or chat — the new machine registers as a trusted device and
        decrypts the env vault locally with its own key.
      </p>
    </div>
  );
}
