"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    name: "Default YouStack",
    slug: "youstack",
    domain: "personal-agent-ops",
    visibility: "private",
    status: "default",
    description: "Your private default stack for Claude Code, Codex, Cursor, and any agent you authorize: identity, project context, personal API routes, MCP tools, protected memory boundary, and host adapters.",
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

function stackSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/shell\/stacks\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function stackDetailHref(stackSlug: string) {
  return `/shell/stacks/${encodeURIComponent(stackSlug)}`;
}

function StackRow({ stack, onOpen }: { stack: StackCard; onOpen: () => void }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/40 px-4 py-3 transition-colors hover:border-[hsl(var(--accent))]/80"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
          {stack.name}
        </p>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-60">
          {stack.slug}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
          {stack.domain}
        </span>
        <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${visibilityClass(stack.visibility)}`}>
          {stack.visibility}
        </span>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
          {stack.status}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
        {stack.description}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {stack.skills.slice(0, 4).map((skill) => (
          <span
            key={skill}
            className="border border-[hsl(var(--border))]/55 px-2 py-1 font-mono text-[8.5px] text-[hsl(var(--text-secondary))] opacity-55"
            style={{ borderRadius: "var(--radius)" }}
          >
            {skill}
          </span>
        ))}
        <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-40">
          open detail
        </span>
      </div>
    </article>
  );
}

function StackDetailView({
  stack,
  onBack,
}: {
  stack: StackCard;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-[hsl(var(--border))]/55 py-3 font-mono text-[9px] uppercase tracking-[0.14em]">
        <button
          type="button"
          onClick={onBack}
          className="text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
        >
          {"<<"} back to stacks
        </button>
        <span className="text-[hsl(var(--text-secondary))] opacity-35">/</span>
        <span className="text-[hsl(var(--text-primary))] opacity-85">{stack.name}</span>
      </div>

      <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">
                {stack.name}
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                {stack.slug}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
                {stack.domain}
              </span>
            </div>
            <p className="mt-3 max-w-3xl font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">
              {stack.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em]">
            <span className={visibilityClass(stack.visibility)}>{stack.visibility}</span>
            <span className="text-[hsl(var(--text-secondary))] opacity-25">/</span>
            <span className="text-[hsl(var(--accent))] opacity-70">{stack.status}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <PaneSectionLabel>skills in stack</PaneSectionLabel>
            <div className="space-y-1.5">
              {stack.skills.map((skill) => (
                <div key={skill} className="flex items-center gap-2 border-t border-[hsl(var(--border))]/35 pt-2 font-mono text-[10px]">
                  <span className="text-[hsl(var(--text-primary))]">{skill}</span>
                  <span className="ml-auto text-[hsl(var(--text-secondary))] opacity-35">skill</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <PaneSectionLabel>operating contract</PaneSectionLabel>
            <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
              update: <span className="text-[hsl(var(--text-primary))] opacity-75">{stack.update}</span>
            </p>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-48">
              Keep the stack private by default, smoke it before agent use, route self-improvements through policy, and expose only the public-safe commands/docs for external agents.
            </p>
          </div>
        </div>

        {stack.install && (
          <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
            <PaneSectionLabel>install</PaneSectionLabel>
            <CopyableCommand command={stack.install} dimmed />
          </div>
        )}
      </section>

      <PaneDivider />

      <section>
        <PaneSectionLabel>agent commands</PaneSectionLabel>
        <div className="space-y-1">
          <CopyableCommand command={`/skill use youstack-maintainer`} dimmed />
          <CopyableCommand command={`youmd stack inspect --path stacks/${stack.slug}`} dimmed />
          <CopyableCommand command={`youmd stack doctor --path stacks/${stack.slug}`} dimmed />
          <CopyableCommand command={`youmd stack smoke --path stacks/${stack.slug}`} dimmed />
        </div>
      </section>
    </div>
  );
}

export function StacksPane() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedStackSlug = stackSlugFromPath(pathname) ?? searchParams.get("stack");
  const selectedStack = selectedStackSlug
    ? STACKS.find((stack) => stack.slug === selectedStackSlug)
    : undefined;

  const openStack = (stackSlug: string) => {
    router.push(stackDetailHref(stackSlug), { scroll: false });
  };

  const returnToStacks = () => {
    router.push("/shell?tab=stacks", { scroll: false });
  };

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>youstacks</PaneHeader>
      <div className="px-6 py-6 max-w-4xl">
        {selectedStack ? (
          <StackDetailView stack={selectedStack} onBack={returnToStacks} />
        ) : selectedStackSlug ? (
          <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
            <button
              type="button"
              onClick={returnToStacks}
              className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
            >
              {"<<"} back to stacks
            </button>
            <h2 className="mt-3 font-mono text-[14px] text-[hsl(var(--text-primary))]">stack not found</h2>
            <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
              No stack is saved as <code className="text-[hsl(var(--text-primary))]">{selectedStackSlug}</code>.
            </p>
          </div>
        ) : (
          <>
        <PaneSectionLabel>stack names</PaneSectionLabel>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {[
            ["ystack", "built-in base", "You.md runtime, docs, API/MCP defaults, install path, and protected platform behavior."],
            ["youstack", "your default", "The owner-controlled personal stack every authorized agent can learn how to use."],
            ["{name}stack", "custom", "Optional named stacks for a project, domain, client, lab, or workflow."],
          ].map(([name, status, detail]) => (
            <div key={name} className="border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/45 px-3 py-3">
              <div className="flex items-center gap-2 font-mono text-[11px] text-[hsl(var(--text-primary))]">
                <span>{name}</span>
                <span className="ml-auto text-[8px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-55">
                  {status}
                </span>
              </div>
              <p className="mt-2 font-mono text-[9.5px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                {detail}
              </p>
            </div>
          ))}
        </div>

        <PaneSectionLabel>stack portfolio</PaneSectionLabel>
        <p className="mb-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-60">
          You.md has four layers: brain, ystack runtime, user-owned youstacks,
          and protected API/MCP. Keep coding, research, content, and
          BAMFStack-style workflows separate, private by default, and safe to
          install into any agent.
        </p>

        <div className="space-y-2">
          {STACKS.map((stack) => (
            <StackRow
              key={stack.slug}
              stack={stack}
              onOpen={() => openStack(stack.slug)}
            />
          ))}
        </div>

        <PaneDivider />

        <PaneSectionLabel>agent commands</PaneSectionLabel>
        <div className="space-y-1">
          <CopyableCommand command="/stacks" />
          <CopyableCommand command="/skill use youstack-maintainer" dimmed />
          <CopyableCommand command="youmd stack doctor --path cli/examples/youstack-bamfstack-public" dimmed />
          <CopyableCommand command="propose the personal API endpoints my youstack should expose for other agents" dimmed />
          <CopyableCommand command="make my BAMFStack public after redacting secrets and running smoke checks" dimmed />
          <CopyableCommand command="create a private scientific research stack from my research workflow" dimmed />
        </div>

        <PaneDivider />

        <PaneSectionLabel>rules</PaneSectionLabel>
        <div className="space-y-2 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
          <p>1. Brain stores identity, memory, preferences, project context, and trust rules.</p>
          <p>2. ystack is the base runtime; youstack is the user&apos;s default personal stack.</p>
          <p>3. Custom stacks hold skills, workflows, docs, examples, prompts, evals, host adapters, and API/MCP extensions.</p>
          <p>4. Runtime is the one curl install plus auto-upgrade, doctor, smoke, and host linking.</p>
          <p>5. Protected API/MCP gates private memories, tokens, connected tools, sync, and sensitive actions.</p>
          <p>6. Self-improvement is policy-bound: doctor first, smoke before use, and remote writes only with approval.</p>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
