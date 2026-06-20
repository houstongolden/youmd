"use client";

import { useEffect, useMemo, useRef } from "react";
import { PixelCharacter, type PixelCharacterStatus } from "@/components/ui/PixelCharacter";

export type LiveLogEntry = {
  id: string;
  at?: number | string | null;
  source: string;
  channel?: string;
  kind?: string;
  title: string;
  detail?: string;
  status?: "live" | "ok" | "warn" | "error" | "info";
  projectSlug?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  sourceHost?: string | null;
  sourceAgent?: string | null;
  sourceRuntime?: string | null;
};

type LiveBrainLogProps = {
  entries: LiveLogEntry[];
  className?: string;
  compact?: boolean;
  maxEntries?: number;
  showIntro?: boolean;
  emptyText?: string;
};

function formatLogTime(value?: number | string | null): string {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function logStatusClass(status: LiveLogEntry["status"] = "info") {
  if (status === "live") return "text-[hsl(var(--success))]";
  if (status === "ok") return "text-[hsl(var(--success))] opacity-80";
  if (status === "warn") return "text-[hsl(var(--accent))]";
  if (status === "error") return "text-red-400";
  return "text-[hsl(var(--text-secondary))] opacity-45";
}

function pixelStatus(status: LiveLogEntry["status"] = "info"): PixelCharacterStatus {
  if (status === "live") return "active";
  if (status === "ok") return "ready";
  if (status === "warn") return "warn";
  if (status === "error") return "blocked";
  return "idle";
}

function pixelKind(source: string): "machine" | "agent" | "shell" {
  const normalized = source.toLowerCase();
  if (normalized.includes("agent") || normalized === "bus") return "agent";
  if (normalized.includes("machine") || normalized.includes("daemon") || normalized.includes("proof")) return "machine";
  return "shell";
}

type ActivityTarget = {
  label: string;
  href?: string;
  title?: string;
};

function entityHref(entityType?: string | null, entityId?: string | null) {
  const normalized = (entityType ?? "").toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("agentstack") || normalized.includes("skill") || normalized.includes("inventory")) {
    return "/shell?tab=skills&view=mesh";
  }
  if (normalized.includes("machine") || normalized.includes("vault")) {
    return "/shell?tab=machine";
  }
  if (normalized.includes("task")) {
    return "/shell?tab=tasks";
  }
  if (normalized.includes("repo") || normalized.includes("github")) {
    return "/shell?tab=settings";
  }
  if (entityId) return "/shell?tab=home";
  return undefined;
}

function activityTargets(entry: LiveLogEntry): ActivityTarget[] {
  const targets: ActivityTarget[] = [];
  if (entry.projectSlug) {
    targets.push({
      label: entry.projectSlug,
      href: `/shell/projects/${encodeURIComponent(entry.projectSlug)}`,
      title: "open project",
    });
  }
  if (entry.entityType) {
    targets.push({
      label: entry.entityType,
      href: entityHref(entry.entityType, entry.entityId),
      title: entry.entityId ? `${entry.entityType}: ${entry.entityId}` : entry.entityType,
    });
  }
  if (entry.sourceHost) {
    targets.push({
      label: entry.sourceHost,
      href: "/shell?tab=machine",
      title: "open machine proof",
    });
  }
  if (entry.sourceAgent) {
    targets.push({
      label: entry.sourceAgent,
      href: "/shell?tab=agents",
      title: "open agent activity",
    });
  }
  return targets.slice(0, 3);
}

export function LiveBrainLog({
  entries,
  className = "",
  compact = false,
  maxEntries = 80,
  showIntro = true,
  emptyText = "waiting for the first brain event...",
}: LiveBrainLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const visibleEntries = useMemo(() => entries.slice(-maxEntries), [entries, maxEntries]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [visibleEntries.length]);

  return (
    <div
      className={[
        compact ? "max-h-72 overflow-y-auto px-1 py-1" : "h-full overflow-y-auto px-4 py-4",
        "font-mono text-[11px] leading-relaxed",
        className,
      ].join(" ")}
      role="log"
      aria-label="live You.md activity log"
    >
      {showIntro && (
        <div className="mb-4 border-l border-[hsl(var(--accent))]/60 bg-[hsl(var(--bg))]/35 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-80">
            central brain log
          </div>
          <div className="mt-1 text-[10px] text-[hsl(var(--text-secondary))] opacity-55">
            realtime agent messages, local daemon proof, skill syncs, vault status, repo sync, tasks, and chat activity belong here.
          </div>
        </div>
      )}

      {visibleEntries.length === 0 ? (
        <div className="text-[hsl(var(--text-secondary))] opacity-45">
          {emptyText}
        </div>
      ) : (
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          {visibleEntries.map((entry) => {
            const targets = activityTargets(entry);
            return (
              <div
                key={entry.id}
                className={[
                  "grid items-start gap-2",
                  compact ? "grid-cols-[20px_58px_58px_1fr]" : "grid-cols-[22px_72px_76px_1fr]",
                ].join(" ")}
              >
                <PixelCharacter
                  kind={pixelKind(entry.source)}
                  seed={`${entry.source}:${entry.channel ?? ""}:${entry.title}`}
                  status={pixelStatus(entry.status)}
                  size="xs"
                  className="mt-0.5 opacity-80"
                />
                <span className="text-[hsl(var(--text-secondary))] opacity-38 tabular-nums">
                  {formatLogTime(entry.at)}
                </span>
                <span className={["truncate uppercase tracking-[0.12em]", logStatusClass(entry.status)].join(" ")}>
                  {entry.source}
                </span>
                <span className="min-w-0">
                  <span className="text-[hsl(var(--text-primary))] opacity-88">{entry.title}</span>
                  {entry.detail && (
                    <span className="text-[hsl(var(--text-secondary))] opacity-48"> {entry.detail}</span>
                  )}
                  {(entry.channel || entry.kind) && (
                    <span className="ml-1 text-[hsl(var(--text-secondary))] opacity-32">
                      [{[entry.channel, entry.kind].filter(Boolean).join(" / ")}]
                    </span>
                  )}
                  {targets.length > 0 && (
                    <span className="ml-2 inline-flex max-w-full flex-wrap gap-1 align-middle">
                      {targets.map((target, targetIndex) => {
                        const className = "inline-flex max-w-[12rem] truncate border border-[hsl(var(--border))]/60 px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-48 transition-opacity hover:opacity-85";
                        return target.href ? (
                          <a
                            key={`${entry.id}:${targetIndex}:${target.label}`}
                            href={target.href}
                            title={target.title ?? target.label}
                            className={className}
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            {target.label}
                          </a>
                        ) : (
                          <span
                            key={`${entry.id}:${targetIndex}:${target.label}`}
                            title={target.title ?? target.label}
                            className={className}
                            style={{ borderRadius: "var(--radius)" }}
                          >
                            {target.label}
                          </span>
                        );
                      })}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
