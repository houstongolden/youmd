"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

type InstallMode = "curl" | "npm";

interface CliInstallTabsProps {
  className?: string;
  helperText?: string;
  defaultMode?: InstallMode;
  title?: string;
}

const INSTALL_COMMANDS: Record<InstallMode, { label: string; command: string; description: string }> = {
  curl: {
    label: "curl",
    command: "curl -fsSL https://you.md/install.sh | bash",
    description: "one-step installer",
  },
  npm: {
    label: "npm",
    command: "npm install -g youmd@latest",
    description: "direct global install",
  },
};

export function CliInstallTabs({
  className = "",
  helperText = "then run youmd login or youmd init",
  defaultMode = "curl",
  title = "CLI install",
}: CliInstallTabsProps) {
  const [mode, setMode] = useState<InstallMode>(defaultMode);
  const [copied, setCopied] = useState(false);
  const selected = useMemo(() => INSTALL_COMMANDS[mode], [mode]);

  const copy = async () => {
    await navigator.clipboard.writeText(selected.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 md:p-4 ${className}`}
      style={{ borderRadius: "2px" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--text-secondary))] opacity-55">
          {title}
        </span>
        <div className="flex items-center gap-1">
          {(Object.keys(INSTALL_COMMANDS) as InstallMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`px-2.5 py-1 font-mono text-[10px] border transition-colors ${
                mode === key
                  ? "text-[hsl(var(--text-primary))] bg-[hsl(var(--bg))] border-[hsl(var(--border))]"
                  : "text-[hsl(var(--text-secondary))] opacity-50 border-transparent hover:opacity-80"
              }`}
              style={{ borderRadius: "2px" }}
            >
              {INSTALL_COMMANDS[key].label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
        className="w-full text-left border border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-4 py-3 font-mono text-[11px] md:text-[12px] text-[hsl(var(--accent))] hover:border-[hsl(var(--accent))]/40 transition-colors"
        style={{ borderRadius: "2px" }}
        aria-label={`copy ${selected.label} install command`}
      >
        <span className="flex items-center gap-3">
          <span className="text-[hsl(var(--text-secondary))] opacity-55">$</span>
          <span className="flex-1 break-all">{selected.command}</span>
          <span className="shrink-0 text-[hsl(var(--text-secondary))] opacity-50">
            {copied ? <Check size={14} className="text-[hsl(var(--success))]" /> : <Copy size={14} />}
          </span>
        </span>
      </button>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px]">
        <span className="text-[hsl(var(--text-secondary))] opacity-45">
          {selected.description}
        </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-35 text-right">
          {copied ? "copied to clipboard" : helperText}
        </span>
      </div>
    </div>
  );
}
