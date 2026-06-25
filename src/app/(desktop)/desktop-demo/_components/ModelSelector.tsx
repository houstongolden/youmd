"use client";

import { useState } from "react";
import { MODELS, type ModelId } from "../_data/mock";
import { Icon } from "./icons";
import { cn } from "../_lib/cn";

export function ModelMark({ id, size = 16 }: { id: ModelId; size?: number }) {
  const m = MODELS.find((x) => x.id === id) ?? MODELS[0];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-sm font-mono"
      style={{ width: size, height: size, background: `${m.color}22`, color: m.color, fontSize: size * 0.62 }}
    >
      {m.mark}
    </span>
  );
}

// Compact agent/model picker — a dropdown so it never eats a horizontal tab row.
export function ModelSelector({ value, onChange }: { value: ModelId; onChange: (id: ModelId) => void }) {
  const [open, setOpen] = useState(false);
  const m = MODELS.find((x) => x.id === value) ?? MODELS[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2 py-1 font-mono text-[11px] text-[hsl(var(--text-primary))] transition-colors hover:border-[hsl(var(--accent))]/40"
      >
        <ModelMark id={m.id} size={14} />
        <span>{m.label}</span>
        <Icon name="chevronDown" size={12} className="text-[hsl(var(--text-secondary))]/60" />
      </button>
      {open && (
        <>
          <button aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] py-1 shadow-2xl">
            {MODELS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[11.5px] transition-colors hover:bg-[hsl(var(--bg))]",
                  opt.id === value ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]",
                )}
              >
                <ModelMark id={opt.id} size={15} />
                <span>{opt.label}</span>
                {opt.id === value && <Icon name="check" size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
