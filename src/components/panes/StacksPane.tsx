"use client";

import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

type StackVisibility = "private" | "scoped-link" | "public-open";

interface StackCard {
  name: string;
  slug: string;
  domain: string;
  visibility: StackVisibility;
  status: string;
  description: string;
  install?: string;
  skills: string[];
  update: string;
}

const STACKS: StackCard[] = [
  {
    name: "Personal Agent Start",
    slug: "personal-agent-start",
    domain: "personal-agent-ops",
    visibility: "private",
    status: "default",
    description: "Your private starter stack for Claude Code, Codex, and Cursor: identity, project context, startup workflow, protected memory boundary, and host adapters.",
    install: "curl -fsSL https://you.md/install.sh | bash",
    skills: ["youstack-start", "youstack-maintainer", "project-context-init"],
    update: "auto-upgrade helper + stack doctor + smoke",
  },
  {
    name: "BAMFStack Public Lighthouse",
    slug: "bamfstack-public",
    domain: "creator-growth",
    visibility: "public-open",
    status: "example",
    description: "Open-source proof that a useful YouStack can package skills, commands, workflows, helper CLI behavior, API/MCP routing, smoke checks, and docs without leaking secrets.",
    install: "curl -fsSL https://you.md/install.sh | bash",
    skills: ["bamf-api", "bamf-context", "bamf-draft", "bamf-smoke"],
    update: "BAMF-style hosted auto-upgrade preamble",
  },
  {
    name: "Coding Copilot Stack",
    slug: "coding-copilot",
    domain: "software-engineering",
    visibility: "private",
    status: "template",
    description: "Architecture, code review, debugging, tests, release flow, repo startup, and your personal engineering taste.",
    skills: ["review", "investigate", "health", "ship"],
    update: "proposal-only until evals pass",
  },
  {
    name: "Scientific Research Stack",
    slug: "scientific-research",
    domain: "research",
    visibility: "private",
    status: "template",
    description: "Paper triage, math checks, source quality, experiment design, research memory retrieval, and reproducibility rules.",
    skills: ["paper-triage", "experiment-plan", "source-audit"],
    update: "proposal-only; citations required",
  },
  {
    name: "Content Studio Stack",
    slug: "content-studio",
    domain: "content",
    visibility: "private",
    status: "template",
    description: "Voice, hooks, editorial review, repurposing, media prompts, examples, and publishing boundaries.",
    skills: ["voice-sync", "content-review", "media-plan"],
    update: "local examples + review before publish",
  },
];

function visibilityClass(visibility: StackVisibility) {
  if (visibility === "public-open") return "text-[hsl(var(--success))]";
  if (visibility === "scoped-link") return "text-[hsl(var(--accent))]";
  return "text-[hsl(var(--text-secondary))] opacity-60";
}

function StackCardView({ stack }: { stack: StackCard }) {
  return (
    <div className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
            {stack.name}
          </p>
          <p className="mt-1 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
            {stack.slug} / {stack.domain}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider">
          <span className={visibilityClass(stack.visibility)}>{stack.visibility}</span>
          <span className="text-[hsl(var(--text-secondary))] opacity-20">|</span>
          <span className="text-[hsl(var(--accent))] opacity-70">{stack.status}</span>
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-65">
        {stack.description}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {stack.skills.map((skill) => (
          <span
            key={skill}
            className="border border-[hsl(var(--border))] px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-55"
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="mt-3 border-t border-[hsl(var(--border))]/60 pt-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
        update: <span className="text-[hsl(var(--text-primary))] opacity-70">{stack.update}</span>
      </div>

      {stack.install && (
        <div className="mt-3">
          <CopyableCommand command={stack.install} dimmed />
        </div>
      )}
    </div>
  );
}

export function StacksPane() {
  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>youstacks</PaneHeader>
      <div className="px-6 py-6 max-w-3xl">
        <PaneSectionLabel>stack portfolio</PaneSectionLabel>
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-60">
          Name separate stacks for separate expertise lanes. The user-facing
          install is one curl command; the CLI is the helper under the hood.
          Stacks start private, can be shared with scoped links, and only become
          public after the owner asks for that exact visibility change.
        </p>

        <div className="space-y-3">
          {STACKS.map((stack) => (
            <StackCardView key={stack.slug} stack={stack} />
          ))}
        </div>

        <PaneDivider />

        <PaneSectionLabel>agent commands</PaneSectionLabel>
        <div className="space-y-1">
          <CopyableCommand command="/stacks" />
          <CopyableCommand command="/skill use youstack-maintainer" dimmed />
          <CopyableCommand command="youmd stack doctor --path cli/examples/youstack-bamfstack-public" dimmed />
          <CopyableCommand command="make my BAMFStack public after redacting secrets and running smoke checks" dimmed />
          <CopyableCommand command="create a private scientific research stack from my research workflow" dimmed />
        </div>

        <PaneDivider />

        <PaneSectionLabel>rules</PaneSectionLabel>
        <div className="space-y-2 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
          <p>1. Local files can hold skills, workflows, docs, examples, prompts, evals, and host adapters.</p>
          <p>2. Private memories, private context, tokens, connected tools, and sensitive actions stay behind You.md API/MCP grants.</p>
          <p>3. Doctor diagnostics and smoke checks run before self-improvement so route drift, stale adapters, and public-readiness gaps are visible.</p>
          <p>4. Self-improvement is policy-bound: auto-apply safe local updates only when the manifest allows it; remote writes need approval.</p>
          <p>5. BAMFStack is the lighthouse case study: one curl install, env-only auth, capability discovery, deterministic routing, read-only diagnostics/smoke, and auto-upgrade.</p>
        </div>
      </div>
    </div>
  );
}
