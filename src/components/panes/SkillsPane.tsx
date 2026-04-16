"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneSectionLabel, PaneDivider } from "./shared";

interface SkillEntry {
  name: string;
  description: string;
  version: string;
  scope: "shared" | "project" | "private";
  identityFields: string[];
  downloads?: number;
}

const BUNDLED_SKILLS: SkillEntry[] = [
  {
    name: "claude-md-generator",
    description: "Generate CLAUDE.md from identity + project detection",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["preferences.agent", "directives.agent", "voice.overall"],
  },
  {
    name: "project-context-init",
    description: "Scaffold project-context/ directory with PRD, TODO, features, changelog",
    version: "1.0.0",
    scope: "project",
    identityFields: ["preferences.agent", "profile.about"],
  },
  {
    name: "voice-sync",
    description: "Sync voice profile across all agent tools",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["voice.overall", "voice.writing", "voice.speaking"],
  },
  {
    name: "meta-improve",
    description: "Self-improvement protocol — review effectiveness, propose identity updates",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["preferences.agent", "directives.agent"],
  },
];

function ScopeTag({ scope }: { scope: SkillEntry["scope"] }) {
  const colors = {
    shared: "text-[hsl(var(--text-secondary))] opacity-50",
    project: "text-[hsl(var(--accent))]",
    private: "text-yellow-500",
  };
  return (
    <span className={`text-[9px] font-mono uppercase tracking-wider ${colors[scope]}`}>
      {scope}
    </span>
  );
}

function IdentityFieldTag({ field }: { field: string }) {
  return (
    <span
      className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30 bg-[hsl(var(--bg))] px-1.5 py-0.5 border border-[hsl(var(--border))]"
      style={{ borderRadius: "2px" }}
    >
      {`{{${field}}}`}
    </span>
  );
}

function SkillCard({
  skill,
  isInstalled,
  useCount,
}: {
  skill: SkillEntry;
  isInstalled: boolean;
  useCount?: number;
}) {
  const [useCopied, setUseCopied] = useState(false);
  const useCmd = `/skill use ${skill.name}`;

  const handleUse = async () => {
    try {
      await navigator.clipboard.writeText(useCmd);
      setUseCopied(true);
      setTimeout(() => setUseCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div
      className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))] p-4 space-y-3"
      style={{ borderRadius: "2px" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isInstalled && (
            <span className="text-[hsl(var(--success))] text-[10px]">{"\u2713"}</span>
          )}
          <span className="text-xs font-mono text-[hsl(var(--text-primary))]">
            {skill.name}
          </span>
          <span className="text-[9px] font-mono text-[hsl(var(--text-secondary))] opacity-30">
            v{skill.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {useCount !== undefined && useCount > 0 && (
            <span className="text-[9px] font-mono text-[hsl(var(--accent))]">
              {useCount} uses
            </span>
          )}
          <ScopeTag scope={skill.scope} />
        </div>
      </div>

      <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-60 leading-relaxed">
        {skill.description}
      </p>

      {skill.identityFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.identityFields.map((field) => (
            <IdentityFieldTag key={field} field={field} />
          ))}
        </div>
      )}

      {/* Use in shell */}
      <div className="pt-1 border-t border-[hsl(var(--border))]/50">
        <button
          onClick={handleUse}
          className="text-[9px] font-mono text-[hsl(var(--accent))]/60 hover:text-[hsl(var(--accent))] transition-colors"
          title={`copy "${useCmd}" to paste in shell`}
        >
          {useCopied ? (
            <span className="text-[hsl(var(--success))]">copied — paste in shell</span>
          ) : (
            <span>{useCmd}</span>
          )}
        </button>
      </div>
    </div>
  );
}

interface SkillsPaneProps {
  userId: Id<"users">;
}

export function SkillsPane({ userId }: SkillsPaneProps) {
  const { user } = useUser();
  const clerkId = user?.id;
  // Query user's installed skills from Convex
  const installs = useQuery(api.skills.listInstalls, clerkId ? { clerkId, userId } : "skip");
  // Query published skills from registry
  const registrySkills = useQuery(api.skills.listPublished, { limit: 20 });

  const isLoading = installs === undefined || registrySkills === undefined;
  const installMap = new Map((installs ?? []).map((i: any) => [i.skillName, i]));
  const installedNames = new Set(installMap.keys());

  const [showAllSkills, setShowAllSkills] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);

  // Merge bundled + registry skills, deduplicating by name
  const allSkills: SkillEntry[] = [...BUNDLED_SKILLS];
  if (registrySkills) {
    for (const rs of registrySkills) {
      if (!allSkills.some((s) => s.name === rs.name)) {
        allSkills.push({
          name: rs.name,
          description: rs.description,
          version: rs.version,
          scope: rs.scope as SkillEntry["scope"],
          identityFields: rs.identityFields,
          downloads: rs.downloads,
        });
      }
    }
  }

  const installedSkills = allSkills.filter((s) => installedNames.has(s.name));
  const availableSkills = allSkills.filter((s) => !installedNames.has(s.name));

  const handleInstallMcp = async () => {
    const installCommand = "npx --yes youmd@latest mcp --install claude --auto";
    try {
      await navigator.clipboard.writeText(installCommand);
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* ── Always-visible explainer ─────────────────────────── */}
      <div
        className="border border-[hsl(var(--accent))] border-opacity-40 bg-[hsl(var(--accent))] bg-opacity-[0.03] p-4 space-y-3"
        style={{ borderRadius: "2px" }}
      >
        <div className="text-[11px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider">
          skills
        </div>
        <p className="text-[11px] font-mono text-[hsl(var(--text-primary))] opacity-80 leading-relaxed">
          Identity-aware agent instructions that get rendered with YOUR data
          and shipped to your AI tools (Claude Code, Cursor, etc.)
        </p>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider opacity-80">
            what they do
          </div>
          <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed">
            Templates with {`{{var}}`} placeholders that get filled with your
            real identity. Each tool reads them automatically.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-[hsl(var(--accent))] uppercase tracking-wider opacity-80">
            examples
          </div>
          <ul className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-70 leading-relaxed space-y-1 pl-3">
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">voice-sync</span>:
              keeps your tone preferences consistent across every agent
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">claude-md-generator</span>:
              auto-creates CLAUDE.md for new repos with your context
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">proactive-context-fill</span>:
              agents detect empty sections and offer to fill them
            </li>
          </ul>
        </div>

        <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed pt-1 border-t border-[hsl(var(--accent))] border-opacity-20">
          Most skills work AUTOMATICALLY once you install youmd MCP. Manual
          install only needed for special skills.
        </p>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleInstallMcp}
            className="text-[10px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))] px-3 py-1.5 hover:bg-[hsl(var(--accent))] hover:bg-opacity-10 transition-colors"
            style={{ borderRadius: "2px" }}
            title="copy install command"
          >
            {mcpCopied ? "copied Claude MCP install command" : "install MCP"}
          </button>
          <button
            onClick={() => setShowAllSkills((v) => !v)}
            className="text-[10px] font-mono text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] px-3 py-1.5 hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors"
            style={{ borderRadius: "2px" }}
          >
            {showAllSkills ? "hide all skills" : "view all skills"}
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-40 animate-pulse">
          loading skill data...
        </p>
      )}

      {/* Install summary */}
      {installs && installs.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-[hsl(var(--success))]">
            {installs.length} installed
          </span>
          <span className="text-[hsl(var(--text-secondary))] opacity-20">|</span>
          <span className="text-[hsl(var(--text-secondary))] opacity-40">
            {installs.reduce((sum: number, i: any) => sum + i.useCount, 0)} total uses
          </span>
        </div>
      )}

      <PaneDivider />

      {/* Installed skills (prominent) */}
      <div>
        <PaneSectionLabel>
          installed ({installedSkills.length})
        </PaneSectionLabel>
        {installedSkills.length === 0 ? (
          <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-40 leading-relaxed">
            no skills installed yet. click &quot;install MCP&quot; above to get
            started — most skills install automatically.
          </p>
        ) : (
          <div className="space-y-3">
            {installedSkills.map((skill) => (
              <SkillCard
                key={skill.name}
                skill={skill}
                isInstalled={true}
                useCount={(installMap.get(skill.name) as any)?.useCount}
              />
            ))}
          </div>
        )}
      </div>

      {/* Available skills (collapsible) */}
      {availableSkills.length > 0 && (
        <div>
          <PaneSectionLabel>
            available ({availableSkills.length})
            {registrySkills && registrySkills.length > BUNDLED_SKILLS.length && (
              <span className="text-[hsl(var(--text-secondary))] opacity-30 normal-case tracking-normal ml-2">
                + {registrySkills.length - BUNDLED_SKILLS.length} from registry
              </span>
            )}
          </PaneSectionLabel>
          {showAllSkills ? (
            <div className="space-y-3">
              {availableSkills.map((skill) => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  isInstalled={false}
                  useCount={(installMap.get(skill.name) as any)?.useCount}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-40 leading-relaxed">
              {availableSkills.length} more skills available — click &quot;view
              all skills&quot; above to expand.
            </p>
          )}
        </div>
      )}

      <PaneDivider />

      {/* CLI Quick Commands */}
      <div>
        <PaneSectionLabel>cli quick start</PaneSectionLabel>
        <div className="space-y-2">
          <CommandRow command="youmd skill install all" description="install all bundled skills" />
          <CommandRow command="youmd skill init-project" description="CLAUDE.md + project-context/ + .claude/skills/" />
          <CommandRow command="youmd skill link claude" description="link skills to Claude Code" />
          <CommandRow command="youmd skill sync" description="re-render skills with latest identity" />
          <CommandRow command="youmd skill create" description="scaffold a new custom skill" />
          <CommandRow command="youmd skill improve" description="review metrics, find gaps" />
        </div>
      </div>

      <PaneDivider />

      {/* How It Works */}
      <div>
        <PaneSectionLabel>how skills work</PaneSectionLabel>
        <div className="space-y-4 text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed">
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">1. install</p>
            <p>
              skills live in ~/.youmd/skills/ as SKILL.md files with {`{{var}}`} template variables.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">2. interpolate</p>
            <p>
              when you run <span className="text-[hsl(var(--accent))]">youmd skill use</span>, template
              variables resolve against your live identity data — voice, preferences, directives.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">3. sync</p>
            <p>
              when your identity changes (via chat, push, or pull), installed skills auto re-interpolate.
              shared skills propagate everywhere. project skills stay local.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">4. link</p>
            <p>
              <span className="text-[hsl(var(--accent))]">youmd skill link claude</span> writes rendered
              skills to .claude/skills/youmd/ — every coding agent knows who you are.
            </p>
          </div>
        </div>
      </div>

      <PaneDivider />

      {/* Scope Explanation */}
      <div>
        <PaneSectionLabel>scope isolation</PaneSectionLabel>
        <div className="space-y-2 text-[11px] font-mono">
          <div className="flex items-center gap-3">
            <ScopeTag scope="shared" />
            <span className="text-[hsl(var(--text-secondary))] opacity-40">
              voice, preferences, directives — propagates to all projects
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ScopeTag scope="project" />
            <span className="text-[hsl(var(--text-secondary))] opacity-40">
              PRD, TODO, decisions — stays in project
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ScopeTag scope="private" />
            <span className="text-[hsl(var(--text-secondary))] opacity-40">
              API keys, vault, internal links — never leaves the device
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandRow({ command, description }: { command: string; description: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div className="flex items-center gap-3 text-[11px] font-mono group">
      <button
        onClick={handleCopy}
        className="text-[hsl(var(--accent))] bg-[hsl(var(--bg))] px-2 py-1 border border-[hsl(var(--border))] shrink-0 hover:bg-[hsl(var(--border))] transition-colors cursor-pointer text-left"
        style={{ borderRadius: "2px" }}
        title="click to copy"
      >
        {copied ? (
          <span className="text-[hsl(var(--success))]">copied</span>
        ) : (
          <code>{command}</code>
        )}
      </button>
      <span className="text-[hsl(var(--text-secondary))] opacity-30 truncate">
        {description}
      </span>
    </div>
  );
}
