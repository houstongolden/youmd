"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    <div className={`border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/55">
          {title}
        </span>
        <div className="flex items-center gap-1">
          {(Object.keys(INSTALL_COMMANDS) as InstallMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`h-8 px-2.5 font-mono text-[10px] border transition-colors ${
                mode === key
                  ? "text-foreground bg-background border-border"
                  : "text-muted-foreground/55 border-transparent hover:text-foreground"
              }`}
            >
              {INSTALL_COMMANDS[key].label}
            </button>
          ))}
        </div>
      </div>

      <Button
        type="button"
        onClick={copy}
        variant="secondary"
        size="lg"
        className="h-auto min-h-12 w-full justify-start px-4 py-3 text-left text-[11px] text-accent md:text-[12px]"
        aria-label={`copy ${selected.label} install command`}
      >
        <span className="flex items-center gap-3">
          <span className="text-muted-foreground/55">$</span>
          <span className="flex-1 break-all">{selected.command}</span>
          <span className="shrink-0 text-muted-foreground/50">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </span>
        </span>
      </Button>

      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px]">
        <span className="text-muted-foreground/45">
          {selected.description}
        </span>
        <span className="text-muted-foreground/35 text-right">
          {copied ? "copied to clipboard" : helperText}
        </span>
      </div>
    </div>
  );
}
