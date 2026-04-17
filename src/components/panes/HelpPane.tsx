"use client";

import { PaneSectionLabel, PaneDivider, PaneHeader } from "./shared";
import { CopyableCommand } from "./CopyableCommand";

interface HelpPaneProps {
  username?: string;
}

interface ExplainerProps {
  term: string;
  children: React.ReactNode;
}

function Explainer({ term, children }: ExplainerProps) {
  return (
    <div className="border-l border-[hsl(var(--border))] pl-3 py-1">
      <p className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
        <span className="text-[hsl(var(--accent))]">{term}</span>
        <span className="text-[hsl(var(--text-secondary))] opacity-40"> -- </span>
        <span className="text-[hsl(var(--text-secondary))] opacity-70">{children}</span>
      </p>
    </div>
  );
}

interface DocLinkProps {
  href: string;
  label: string;
  hint?: string;
}

function DocLink({ href, label, hint }: DocLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block group font-mono text-[11px] py-1.5 px-2 border border-transparent hover:border-[hsl(var(--accent))]/30 hover:bg-[hsl(var(--bg))] transition-colors"
      style={{ borderRadius: "2px" }}
    >
      <span className="text-[hsl(var(--accent))] opacity-80 group-hover:opacity-100">
        &gt; {label}
      </span>
      {hint && (
        <span className="text-[hsl(var(--text-secondary))] opacity-40 ml-2">
          -- {hint}
        </span>
      )}
    </a>
  );
}

export function HelpPane({ username }: HelpPaneProps) {
  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>help</PaneHeader>

      <div className="px-6 py-6 space-y-0 max-w-xl">
        {/* Quick start */}
        <PaneSectionLabel>quick start</PaneSectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-3">
          new to you.md? try these commands in the terminal first.
        </p>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/profile" />
          <CopyableCommand command="/share" />
          <CopyableCommand command="/publish" />
          <CopyableCommand command="/status" />
        </div>

        <PaneDivider />

        {/* What is X? */}
        <PaneSectionLabel>what is...</PaneSectionLabel>
        <div className="space-y-2 mb-2">
          <Explainer term="vault">
            encrypted private context only you (and agents you grant access to) can read.
            think of it as a secret-tier section of your identity that never lands in the public bundle.
          </Explainer>
          <Explainer term="skills">
            identity-aware markdown templates with {`{{identity}}`} variables. install via the cli
            and an agent can scaffold projects pre-personalized to who you are.
          </Explainer>
          <Explainer term="MCP">
            model context protocol -- the standard way agents (claude, cursor, codex, etc.)
            talk to external tools. you.md exposes your identity over MCP so any compliant agent
            can read it.
          </Explainer>
          <Explainer term="context links">
            short, shareable URLs that hand an agent a snapshot of your identity (public, private,
            or scoped to a project). every read is logged in commits.
          </Explainer>
          <Explainer term="bundle">
            the compiled, published version of your identity. agents fetch the latest bundle when
            they read you.md/{username || "you"}.
          </Explainer>
          <Explainer term="commits">
            every publish is a commit on your identity. revert any time from the versions tab.
          </Explainer>
        </div>

        <PaneDivider />

        {/* Commands reference */}
        <PaneSectionLabel>commands reference</PaneSectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-3">
          slash commands you can run in the shell pane.
        </p>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">identity</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/profile" dimmed />
          <CopyableCommand command="/portrait" dimmed />
          <CopyableCommand command="/portrait show" dimmed />
          <CopyableCommand command="/portrait --regenerate" dimmed />
          <CopyableCommand command="/edit" dimmed />
          <CopyableCommand command="/json" dimmed />
          <CopyableCommand command="/files" dimmed />
          <CopyableCommand command="/sources" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">sharing</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/share" dimmed />
          <CopyableCommand command="/share --private" dimmed />
          <CopyableCommand command="/share --project {name}" dimmed />
          <CopyableCommand command="/publish" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">skills</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/skills" dimmed />
          <CopyableCommand command="/skill use {name}" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">account</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/vault" dimmed />
          <CopyableCommand command="/agents" dimmed />
          <CopyableCommand command="/settings" dimmed />
          <CopyableCommand command="/activity" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">data</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/analytics" dimmed />
          <CopyableCommand command="/history" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">memory</p>
        <div className="space-y-1 mb-3">
          <CopyableCommand command="/memory" dimmed />
          <CopyableCommand command="/recall" dimmed />
          <CopyableCommand command="/recall {query}" dimmed />
        </div>

        <p className="font-mono text-[9px] text-[hsl(var(--accent))] uppercase tracking-widest mb-1.5">system</p>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="/status" dimmed />
          <CopyableCommand command="/help" dimmed />
        </div>

        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30 mb-2">
          you can also type naturally -- the agent understands free-form input.
        </p>

        <PaneDivider />

        {/* Docs links */}
        <PaneSectionLabel>docs</PaneSectionLabel>
        <div className="space-y-1 mb-2">
          <DocLink
            href="https://you.md/docs"
            label="docs home"
            hint="overview + getting started"
          />
          <DocLink
            href="https://you.md/docs/cli"
            label="cli reference"
            hint="install, login, push, pull"
          />
          <DocLink
            href="https://you.md/docs/skills"
            label="skills"
            hint="identity-aware agent templates"
          />
          <DocLink
            href="https://you.md/docs/mcp"
            label="MCP integration"
            hint="connect claude, cursor, codex"
          />
          <DocLink
            href="https://you.md/docs/vault"
            label="vault"
            hint="private encrypted context"
          />
          <DocLink
            href="https://you.md/docs/api"
            label="HTTP API"
            hint="for custom integrations"
          />
        </div>

        <PaneDivider />

        {/* CLI snippets */}
        <PaneSectionLabel>cli quick reference</PaneSectionLabel>
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 mb-3">
          run these in your terminal (not the shell pane).
        </p>
        <div className="space-y-1 mb-2">
          <CopyableCommand command="curl -fsSL https://you.md/install.sh | bash" />
          <CopyableCommand command="youmd login" dimmed />
          <CopyableCommand command="youmd logout" dimmed />
          <CopyableCommand command="youmd push" dimmed />
          <CopyableCommand command="youmd pull" dimmed />
          <CopyableCommand command="youmd skill install all" dimmed />
          <CopyableCommand command="youmd skill init-project" dimmed />
        </div>

        <div className="mt-6 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-30">
          tip: type <span className="text-[hsl(var(--accent))] opacity-60">/help</span> in the
          terminal any time to jump back here.
        </div>
      </div>
    </div>
  );
}
