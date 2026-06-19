"use client";

import { SKILLS, STACKS } from "../../_data/mock";
import { Icon } from "../icons";
import { Chip, SectionLabel, ViewHeader } from "../primitives";

const VIS_TONE = { private: "default", scoped: "accent", public: "green" } as const;

export function SkillsView() {
  const metaSkills = SKILLS.filter((s) => s.meta);
  const totalInstalls = SKILLS.reduce((a, s) => a + s.sharedAcross, 0);

  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader
        title="Skills & Stacks"
        description="One definition, shared everywhere — never duplicated. Grouped into stacks by project and domain, with meta-skills that create and improve the rest."
      />

      {/* DRY proof strip */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip tone="accent">{SKILLS.length} skills</Chip>
        <Chip>{STACKS.length} stacks</Chip>
        <Chip tone="green">
          <Icon name="sync" size={9} /> {totalInstalls} installs · 0 duplicated
        </Chip>
      </div>

      {/* Stacks */}
      <SectionLabel className="mb-2">Stacks</SectionLabel>
      <div className="mb-7 space-y-3">
        {STACKS.map((st) => (
          <div key={st.name} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="stack" size={15} className="text-[hsl(var(--accent))]" />
              <span className="font-mono text-sm">{st.name}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/50">
                {st.domain}
              </span>
              <span className="ml-auto">
                <Chip tone={VIS_TONE[st.visibility]}>{st.visibility}</Chip>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {st.skills.map((sk) => (
                <span
                  key={sk}
                  className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--text-secondary))]"
                >
                  {sk}
                </span>
              ))}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
              {st.projects.join(" · ")}
            </div>
          </div>
        ))}
      </div>

      {/* Meta-skills */}
      <SectionLabel className="mb-2">Meta-skills</SectionLabel>
      <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metaSkills.map((s) => (
          <div key={s.name} className="flex items-start gap-3 rounded-sm border border-[hsl(var(--accent))]/30 bg-[hsl(var(--bg-raised))] p-3.5">
            <Icon name="sparkles" size={16} className="mt-0.5 text-[hsl(var(--accent))]" />
            <div className="min-w-0">
              <div className="font-mono text-[13px]">{s.name}</div>
              <div className="text-[12px] text-[hsl(var(--text-secondary))]/70">
                {s.name === "meta-improve" ? "Improves any installed skill from usage." : "Drafts new skills from your patterns."}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Shared skills (DRY) */}
      <SectionLabel className="mb-2">Shared skills</SectionLabel>
      <div className="divide-y divide-[hsl(var(--border))] rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]">
        {SKILLS.map((s) => (
          <div key={s.name} className="flex items-center gap-3 px-3.5 py-2.5">
            <Icon name={s.meta ? "sparkles" : "layers"} size={14} className="text-[hsl(var(--text-secondary))]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px]">{s.name}</span>
                {s.meta && <Chip tone="accent">meta</Chip>}
              </div>
              <div className="truncate font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/45">
                {s.category} · {s.projects.join(", ")}
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))]">
              <Icon name="sync" size={10} /> {s.sharedAcross}×
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
