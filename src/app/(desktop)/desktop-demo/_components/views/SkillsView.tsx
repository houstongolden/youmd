"use client";

import { SKILLS, STACKS } from "../../_data/mock";
import { useAllowMockFallback, useRealData } from "../../_lib/RealDataContext";
import { Icon } from "../icons";
import { Chip, SectionLabel, ViewHeader } from "../primitives";

const VIS_TONE = { private: "default", scoped: "accent", public: "green" } as const;

export function SkillsView() {
  const real = useRealData();
  const allowMockFallback = useAllowMockFallback();
  const live = Boolean(real?.available);

  if (live) {
    // Auto-organize real skills into groups by prefix.
    const groups: Record<string, { name: string; source: string }[]> = {};
    for (const s of real!.skills) {
      const key = s.name.includes("-") ? s.name.split("-")[0] : "misc";
      (groups[key] ??= []).push(s);
    }
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

    return (
      <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <ViewHeader title="Skills & Stacks" description="Your synced agent capabilities — one definition, shared across every machine. Auto-organized." />

        <div className="mb-6 flex flex-wrap gap-2">
          <Chip tone="accent">{real!.skills.length} skills</Chip>
          <Chip>{real!.stacks.length} stacks</Chip>
          <Chip tone="green"><Icon name="sync" size={9} /> mesh-synced · 0 duplicated</Chip>
        </div>

        <SectionLabel className="mb-2">Stacks</SectionLabel>
        <div className="mb-7 flex flex-wrap gap-2">
          {real!.stacks.map((st) => (
            <span key={st} className="flex items-center gap-1.5 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-2.5 py-1.5 font-mono text-[12px]">
              <Icon name="stack" size={13} className="text-[hsl(var(--accent))]" /> {st}
            </span>
          ))}
        </div>

        <SectionLabel className="mb-2">Skills · auto-organized</SectionLabel>
        <div className="space-y-4">
          {sorted.map(([group, items]) => (
            <div key={group}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[11px] text-[hsl(var(--text-primary))]">{group === "misc" ? "misc" : `${group}-*`}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[hsl(var(--text-secondary))]/40">{items.length}</span>
                <div className="h-px flex-1 bg-[hsl(var(--border))]" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((s) => (
                  <span key={s.name} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--text-secondary))]" title={`source: ${s.source}`}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!allowMockFallback) {
    return (
      <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
        <ViewHeader title="Skills & Stacks" description="Waiting for real synced skills. No placeholder skills are shown." />
      </div>
    );
  }

  // ── mock fallback for /desktop-demo only ──
  const metaSkills = SKILLS.filter((s) => s.meta);
  const totalInstalls = SKILLS.reduce((a, s) => a + s.sharedAcross, 0);
  return (
    <div className="mx-auto h-full max-w-3xl overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <ViewHeader title="Skills & Stacks" description="One definition, shared everywhere — never duplicated." />
      <div className="mb-6 flex flex-wrap gap-2">
        <Chip tone="accent">{SKILLS.length} skills</Chip>
        <Chip>{STACKS.length} stacks</Chip>
        <Chip tone="green"><Icon name="sync" size={9} /> {totalInstalls} installs · 0 duplicated</Chip>
      </div>
      <SectionLabel className="mb-2">Stacks</SectionLabel>
      <div className="mb-7 space-y-3">
        {STACKS.map((st) => (
          <div key={st.name} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3.5">
            <div className="mb-2 flex items-center gap-2">
              <Icon name="stack" size={15} className="text-[hsl(var(--accent))]" />
              <span className="font-mono text-sm">{st.name}</span>
              <span className="ml-auto"><Chip tone={VIS_TONE[st.visibility]}>{st.visibility}</Chip></span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {st.skills.map((sk) => (
                <span key={sk} className="rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-1.5 py-0.5 font-mono text-[11px] text-[hsl(var(--text-secondary))]">{sk}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <SectionLabel className="mb-2">Meta-skills</SectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {metaSkills.map((s) => (
          <div key={s.name} className="flex items-start gap-3 rounded-sm border border-[hsl(var(--accent))]/30 bg-[hsl(var(--bg-raised))] p-3.5">
            <Icon name="sparkles" size={16} className="mt-0.5 text-[hsl(var(--accent))]" />
            <div className="font-mono text-[13px]">{s.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
