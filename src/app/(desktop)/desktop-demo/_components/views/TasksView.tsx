"use client";

import { type Task } from "../../_data/mock";
import { Dot, Chip, SectionLabel } from "../primitives";
import { Icon } from "../icons";
import { cn } from "../../_lib/cn";

const COLUMNS: { id: Task["status"]; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export function TasksView({ tasks, onAdvance }: { tasks: Task[]; onAdvance: (id: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-2.5 md:px-5">
        <SectionLabel>Tasks</SectionLabel>
        <span className="truncate font-mono text-[11px] text-[hsl(var(--text-secondary))]/70">
          {tasks.filter((t) => t.status !== "done").length} open · tap a card to advance
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="flex min-h-0 flex-col">
              <div className="mb-2 flex items-center gap-2 px-1">
                <SectionLabel>{col.label}</SectionLabel>
                <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))]/50">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onAdvance(t.id)}
                    className="w-full rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 text-left transition-colors hover:border-[hsl(var(--accent))]/40"
                  >
                    <div className={cn("text-[13px] leading-snug", t.status === "done" && "text-[hsl(var(--text-secondary))] line-through")}>
                      {t.title}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Chip tone={t.owner === "agent" ? "accent" : "default"}>
                        {t.owner === "agent" ? (
                          <>
                            <Icon name="agent" size={9} /> agent
                          </>
                        ) : (
                          "you"
                        )}
                      </Chip>
                      <span className="flex items-center gap-1">
                        <Dot
                          tone={t.priority === "high" ? "orange" : t.priority === "med" ? "green" : "dim"}
                          size={6}
                        />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/60">
                          {t.project}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-sm border border-dashed border-[hsl(var(--border))] px-3 py-6 text-center font-mono text-[11px] text-[hsl(var(--text-secondary))]/40">
                    empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
