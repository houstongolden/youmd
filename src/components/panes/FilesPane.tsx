"use client";

import { useAction, useQuery, useMutation } from "convex/react";
import { useUser } from "@/lib/you-auth";
import { api } from "../../../convex/_generated/api";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { PaneHeader, PaneEmptyState } from "./shared";
import { decompileBundle, buildFileTree, generateMemoryFiles, type VirtualFile, type FileTreeNode } from "@/lib/decompile";
import { recompileYouJson } from "@/lib/recompile";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Form";

interface FilesPaneProps {
  userId: Id<"users">;
  isWritingFiles?: boolean;
}

type WorkspaceMode = "files" | "artifacts" | "reports";
type ViewerMode = "edit" | "preview" | "split";

type LoopReportDefinition = Doc<"loopReportDefinitions">;
type LoopReportRun = Doc<"loopReportRuns">;
type LoopReportArtifact = Doc<"loopReportArtifacts">;
type SourceSnapshot = Doc<"sourceSnapshots">;
type DsiComponent = Doc<"dsiComponents">;

type ArtifactTemplate = {
  id: string;
  title: string;
  path: string;
  description: string;
  content: string;
};

type MarkdownHeading = {
  id: string;
  level: number;
  text: string;
};

type MarkdownDocumentInfo = {
  title: string;
  kind: string;
  visibility: string;
  words: number;
  lines: number;
  readingMinutes: number;
  frontmatter: Record<string, string>;
  headings: MarkdownHeading[];
};

const WORKSPACE_MODES: Array<{ key: WorkspaceMode; label: string; detail: string }> = [
  { key: "files", label: "files", detail: "identity bundle" },
  { key: "artifacts", label: "artifacts", detail: "saved docs + source outputs" },
  { key: "reports", label: "reports", detail: "loop-generated briefings" },
];

const ARTIFACT_TEMPLATES: ArtifactTemplate[] = [
  {
    id: "daily-brief",
    title: "daily briefing",
    path: "reports/daily/briefing.md",
    description: "industry pulse, agenda, code carryover, connected apps, and body signal",
    content: `---
title: Daily Briefing
kind: loop_report
visibility: private
cadence: daily
sources:
  - perplexity:ai-industry-trends
  - google-calendar:today
  - github:active-projects
  - youmd:agent-activity
  - badapp:fitness
  - bamf:analytics
---

# Daily Briefing

## industry pulse
- biggest AI / agents / developer-tool updates:
- why it matters to my work:
- links / citations:

## agenda
- meetings:
- personal:
- follow-ups:

## code carryover
- shipped yesterday:
- active project focus:
- Codex / Claude Code kickstart prompts:

## connected app pulse
- BAMF / LinkedIn / X / agency:
- Bad.app health / fitness:
- school / family logistics:

## journal seed
- what mattered yesterday:
- what to write in my voice:
`,
  },
  {
    id: "project-carryover",
    title: "project carryover",
    path: "reports/daily/project-carryover.md",
    description: "per-project last state, repo activity, next action, and agent-start prompt",
    content: `---
title: Project Carryover
kind: loop_report
visibility: private
cadence: daily
sources:
  - github:repos
  - youmd:project_context
  - youmd:agent_activity
---

# Project Carryover

## active projects

### project name
- repo:
- url:
- recent updates:
- current objective:
- next focus:

\`\`\`text
Codex/Claude Code kickoff prompt:
Read AGENTS.md and project-context, summarize current state, then continue the next best scoped step for this project.
\`\`\`
`,
  },
  {
    id: "daily-journal",
    title: "daily journal article",
    path: "reports/journal/daily.md",
    description: "Houston-voice narrative article from work, body, social, research, and agent logs",
    content: `---
title: Daily Journal Article
kind: generated_article
visibility: private
cadence: daily
voice: bamfai-author
sources:
  - youmd:loop_reports
  - youmd:agent_activity
  - github:commits
  - bamf:creator_analytics
  - badapp:fitness
  - weather:home
  - surf:home_break
---

# Daily Journal Article

## build

## body

## social

## research

## tomorrow
`,
  },
  {
    id: "public-profile-chat",
    title: "public profile chat contract",
    path: "artifacts/public-profile-chat.md",
    description: "secure chat widget/API contract for talking to a person through public context",
    content: `---
title: Public Profile Chat Contract
kind: product_spec
visibility: private
surface:
  - public_profile_widget
  - api:/api/v1/profiles/:username/conversation
  - mcp:youmd.converse
---

# Public Profile Chat Contract

## goal
Let a visitor or connected app chat with a user's public You.md context in that person's voice, without leaking private context.

## response contract
- public profile facts
- public projects and links
- public voice/tone summary
- public YouStacks and source provenance
- optional live DSI facts the owner made public, such as weather, surf, GitHub project stats, social analytics, or fitness summaries

## owner controls
- adjust personality
- disable topics
- approve public DSI components
- review visitor questions
- connect app-specific chat experiences through scoped grants
`,
  },
];

function getExtLabel(path: string): string {
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "text";
}

function timeAgo(timestamp?: number): string {
  if (!timestamp) return "--";
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function reportArtifactPath(artifact: LoopReportArtifact): string {
  return `reports/generated/${artifact.definitionSlug}/${new Date(artifact.createdAt).toISOString().slice(0, 10)}-${artifact._id}.md`;
}

function dsiComponentPath(component: DsiComponent): string {
  return `dsi/${component.visibility}/${component.slug}.md`;
}

function dsiComponentMarkdown(component: DsiComponent): string {
  return [
    "---",
    `title: ${JSON.stringify(component.title)}`,
    `kind: "dsi_component"`,
    `component_type: ${JSON.stringify(component.componentType)}`,
    `visibility: ${JSON.stringify(component.visibility)}`,
    `status: ${JSON.stringify(component.status)}`,
    `trust_level: ${JSON.stringify(component.trustLevel)}`,
    `captured_at: ${JSON.stringify(new Date(component.capturedAt).toISOString())}`,
    `updated_at: ${JSON.stringify(new Date(component.updatedAt).toISOString())}`,
    "---",
    "",
    `# ${component.title}`,
    "",
    component.summary,
    "",
    "## access boundary",
    `- visibility: ${component.visibility}`,
    `- trust: ${component.trustLevel}`,
    `- source snapshots: ${component.sourceSnapshotIds.length}`,
    "",
    "## normalized data",
    "",
    "```json",
    JSON.stringify(component.data, null, 2),
    "```",
  ].join("\n");
}

function jsonPreview(value: unknown, maxLength = 900): string {
  const rendered = JSON.stringify(value, null, 2) ?? "null";
  return rendered.length > maxLength ? `${rendered.slice(0, maxLength - 3)}...` : rendered;
}

// ── Visibility helpers ──────────────────────────────────────────────────
//
// Public  = accessible by any agent that hits your you.md profile URL
// Private = requires a context link with token, or authenticated CLI access
//
// Public surfaces:
//   - root: you.json, you.md, manifest.json
//   - profile/ (and everything inside it)
// Everything else (sessions/, sources/, voice/, projects/, skills/,
// directives/, memory/, preferences/, private/, custom dirs) is private.

const PUBLIC_ROOT_FILES = new Set(["you.json", "you.md", "manifest.json"]);
const PUBLIC_DIRS = new Set(["profile"]);

function isPublicPath(path: string): boolean {
  if (!path) return false;
  // Strip a leading slash if it ever exists
  const p = path.startsWith("/") ? path.slice(1) : path;
  // Root-level files
  if (!p.includes("/")) return PUBLIC_ROOT_FILES.has(p);
  // Directory-rooted files
  const top = p.split("/")[0];
  return PUBLIC_DIRS.has(top);
}

function classifyWorkspace(path: string): WorkspaceMode {
  if (
    path.startsWith("reports/") ||
    path.startsWith("journal/") ||
    path.includes("/reports/") ||
    path.includes("/journal/")
  ) {
    return "reports";
  }
  if (
    path.startsWith("artifacts/") ||
    path.startsWith("sources/") ||
    path.startsWith("sessions/") ||
    path.startsWith("memory/") ||
    path.startsWith("private/") ||
    path.startsWith("dsi/") ||
    path.startsWith("custom/")
  ) {
    return "artifacts";
  }
  return "files";
}

const PUBLIC_TOOLTIP = "Public — accessible by any agent with your you.md profile URL";
const PRIVATE_TOOLTIP = "Private — requires context link with token or authenticated CLI access";

function VisibilityIcon({ isPublic }: { isPublic: boolean }) {
  // Globe for public, lock for private. Sized + colored to match the
  // monochrome + burnt orange terminal aesthetic.
  if (isPublic) {
    return (
      <span
        title={PUBLIC_TOOLTIP}
        aria-label="public"
        className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 shrink-0 leading-none select-none"
        style={{ width: "10px", display: "inline-flex", justifyContent: "center" }}
      >
        {"\u25CB"}
      </span>
    );
  }
  return (
    <span
      title={PRIVATE_TOOLTIP}
      aria-label="private"
      className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 shrink-0 leading-none select-none"
      style={{ width: "10px", display: "inline-flex", justifyContent: "center" }}
    >
      {"\u25CF"}
    </span>
  );
}

// ── Markdown Document Helpers ───────────────────────────────────────────

function stripYamlQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMarkdownFrontmatter(source: string): { frontmatter: Record<string, string>; body: string } {
  const lines = source.split("\n");
  const frontmatter: Record<string, string> = {};

  if (lines[0]?.trim() !== "---") {
    return { frontmatter, body: source };
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex <= 0) {
    return { frontmatter, body: source };
  }

  for (const line of lines.slice(1, endIndex)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      frontmatter[match[1]] = stripYamlQuotes(match[2]);
    }
  }

  return { frontmatter, body: lines.slice(endIndex + 1).join("\n") };
}

function fileTitleFromPath(path: string): string {
  const basename = path.split("/").pop() ?? path;
  return basename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

function analyzeMarkdownDocument(source: string, path: string): MarkdownDocumentInfo {
  const { frontmatter, body } = parseMarkdownFrontmatter(source);
  const lines = source.split("\n");
  const bodyLines = body.split("\n");
  const headings: MarkdownHeading[] = [];

  bodyLines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) return;
    const text = match[2].replace(/[#`*_]/g, "").trim();
    if (!text) return;
    headings.push({
      id: `${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      level: match[1].length,
      text,
    });
  });

  const firstHeading = headings[0]?.text;
  const wordMatches = body.trim().match(/\b[\w'-]+\b/g);
  const words = wordMatches ? wordMatches.length : 0;

  return {
    title: frontmatter.title || firstHeading || fileTitleFromPath(path),
    kind: frontmatter.kind || getExtLabel(path).toLowerCase(),
    visibility: frontmatter.visibility || (isPublicPath(path) ? "public" : "private"),
    words,
    lines: lines.length,
    readingMinutes: Math.max(1, Math.ceil(words / 220)),
    frontmatter,
    headings,
  };
}

function workspaceLabelForPath(path: string): string {
  if (path.startsWith("reports/generated/")) return "generated report";
  if (path.startsWith("reports/")) return "report template";
  if (path.startsWith("artifacts/")) return "artifact";
  if (path.startsWith("dsi/")) return "dsi component";
  if (path.startsWith("memories/")) return "memory";
  if (path.startsWith("private/")) return "private context";
  if (path.startsWith("profile/")) return "public profile";
  return "bundle file";
}

// ── Simple Markdown Renderer ────────────────────────────────────────────

function renderMarkdown(source: string): string {
  const lines = source.split("\n");
  const html: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inCode = false;
  const codeLines: string[] = [];

  const closeLists = () => {
    if (inList) { html.push("</ul>"); inList = false; }
    if (inOrderedList) { html.push("</ol>"); inOrderedList = false; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^```([A-Za-z0-9_-]*)\s*$/);

    if (fenceMatch) {
      if (inCode) {
        html.push(`<pre class="md-pre"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines.length = 0;
        inCode = false;
      } else {
        closeLists();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      closeLists();
      html.push('<hr class="md-hr" />');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      const level = headingMatch[1].length;
      html.push(`<h${level} class="md-h${level}">${escapeAndInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    const quoteMatch = line.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      closeLists();
      html.push(`<blockquote class="md-quote">${escapeAndInline(quoteMatch[1])}</blockquote>`);
      continue;
    }

    // Task list items
    const taskMatch = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
    if (taskMatch) {
      if (inOrderedList) { html.push("</ol>"); inOrderedList = false; }
      if (!inList) { html.push('<ul class="md-ul md-task-ul">'); inList = true; }
      const checked = taskMatch[1].toLowerCase() === "x";
      html.push(`<li class="md-li md-task-li"><span class="md-check">${checked ? "x" : " "}</span>${escapeAndInline(taskMatch[2])}</li>`);
      continue;
    }

    // Bullet list items
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inOrderedList) { html.push("</ol>"); inOrderedList = false; }
      if (!inList) { html.push('<ul class="md-ul">'); inList = true; }
      html.push(`<li class="md-li">${escapeAndInline(bulletMatch[1])}</li>`);
      continue;
    }

    // Ordered list items
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch) {
      if (inList) { html.push("</ul>"); inList = false; }
      if (!inOrderedList) { html.push('<ol class="md-ol">'); inOrderedList = true; }
      html.push(`<li class="md-oli">${escapeAndInline(orderedMatch[1])}</li>`);
      continue;
    }

    // Close list if we're leaving it
    closeLists();

    // Blank line
    if (line.trim() === "") {
      html.push('<div class="md-blank">&nbsp;</div>');
      continue;
    }

    // Paragraph
    html.push(`<p class="md-p">${escapeAndInline(line)}</p>`);
  }

  if (inCode) {
    html.push(`<pre class="md-pre"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  closeLists();
  return html.join("\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAndInline(text: string): string {
  let s = escapeHtml(text);
  // Links: [label](https://example.com)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a class="md-link" href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  // Bold: **text**
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');
  // Italic: *text*
  s = s.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');
  // Inline code: `text`
  s = s.replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
  return s;
}

function MarkdownPreview({ content, className = "" }: { content: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(content), [content]);
  return (
    <div
      className={`flex-1 overflow-auto p-3 md:p-4 font-mono text-[11px] leading-relaxed text-[hsl(var(--text-primary))] md-preview ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        // Scoped styles for the preview via CSS custom properties
        ["--md-accent" as string]: "hsl(var(--accent))",
        ["--md-muted" as string]: "hsl(var(--text-secondary))",
        ["--md-border" as string]: "hsl(var(--border))",
        ["--md-bg" as string]: "hsl(var(--bg))",
      }}
    />
  );
}

// Injected once — scoped preview styles
function MarkdownStyles() {
  return (
    <style>{`
      .md-preview .md-h1 { font-size: 16px; font-weight: 600; margin: 0 0 8px 0; opacity: 0.9; }
      .md-preview .md-h2 { font-size: 14px; font-weight: 600; margin: 12px 0 6px 0; opacity: 0.85; color: var(--md-accent); }
      .md-preview .md-h3 { font-size: 12px; font-weight: 600; margin: 10px 0 4px 0; opacity: 0.8; }
      .md-preview .md-h4, .md-preview .md-h5, .md-preview .md-h6 { font-size: 11px; font-weight: 600; margin: 8px 0 4px 0; opacity: 0.7; }
      .md-preview .md-p { margin: 0 0 4px 0; opacity: 0.8; }
      .md-preview .md-blank { height: 8px; }
      .md-preview .md-hr { border: none; border-top: 1px solid var(--md-border); margin: 12px 0; opacity: 0.3; }
      .md-preview .md-ul { list-style: none; padding-left: 12px; margin: 4px 0; }
      .md-preview .md-ol { list-style: decimal; padding-left: 20px; margin: 4px 0; }
      .md-preview .md-li { opacity: 0.8; margin: 2px 0; }
      .md-preview .md-oli { opacity: 0.8; margin: 2px 0; }
      .md-preview .md-li::before { content: "- "; opacity: 0.4; }
      .md-preview .md-task-li::before { content: ""; }
      .md-preview .md-check {
        display: inline-flex;
        width: 13px;
        height: 13px;
        align-items: center;
        justify-content: center;
        margin-right: 6px;
        border: 1px solid var(--md-border);
        border-radius: 2px;
        color: var(--md-accent);
        font-size: 9px;
        line-height: 1;
      }
      .md-preview .md-quote {
        border-left: 2px solid var(--md-accent);
        margin: 6px 0;
        padding: 4px 0 4px 10px;
        color: var(--md-muted);
        opacity: 0.85;
      }
      .md-preview .md-pre {
        overflow: auto;
        margin: 8px 0;
        padding: 10px;
        border: 1px solid var(--md-border);
        border-radius: 2px;
        background: var(--md-bg);
        color: var(--md-muted);
        white-space: pre;
      }
      .md-preview .md-bold { font-weight: 600; opacity: 0.9; }
      .md-preview .md-italic { font-style: italic; opacity: 0.7; }
      .md-preview .md-link { color: var(--md-accent); text-decoration: underline; text-underline-offset: 3px; }
      .md-preview .md-code {
        background: var(--md-bg);
        border: 1px solid var(--md-border);
        border-radius: 2px;
        padding: 1px 4px;
        font-size: 10px;
        opacity: 0.8;
      }
    `}</style>
  );
}

function WorkspaceTabs({
  mode,
  onChange,
  counts,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  counts: Record<WorkspaceMode, number>;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
      {WORKSPACE_MODES.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`shrink-0 border-b px-2 py-1 text-left font-mono text-[10px] transition-colors ${
            mode === item.key
              ? "border-[hsl(var(--accent))] text-[hsl(var(--accent))]"
              : "border-transparent text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-80"
          }`}
          title={item.detail}
        >
          {item.label}
          <span className="ml-1 opacity-40">{counts[item.key]}</span>
        </button>
      ))}
    </div>
  );
}

function ArtifactHome({
  mode,
  files,
  onSelect,
  onCreateTemplate,
  loopDefinitions,
  loopRuns,
  loopArtifacts,
  dsiComponents,
  loopBusy,
  loopStatus,
  dsiBusy,
  dsiStatus,
  onSeedLoopDefaults,
  onRunDailyBriefing,
  onRefreshWeatherSurf,
  onRefreshProjectCatalog,
  onRefreshSchoolLogistics,
  onRefreshAgenda,
  onRefreshTaskQueue,
  onRefreshBadFitness,
  onRefreshBamfPulse,
  onToggleLoopDefinition,
  selectedRunId,
  loopSnapshots,
  onSelectRun,
}: {
  mode: WorkspaceMode;
  files: VirtualFile[];
  onSelect: (path: string) => void;
  onCreateTemplate: (template: ArtifactTemplate) => void;
  loopDefinitions: LoopReportDefinition[];
  loopRuns: LoopReportRun[];
  loopArtifacts: LoopReportArtifact[];
  dsiComponents: DsiComponent[];
  loopBusy: boolean;
  loopStatus: string | null;
  dsiBusy: boolean;
  dsiStatus: string | null;
  onSeedLoopDefaults: () => void;
  onRunDailyBriefing: () => void;
  onRefreshWeatherSurf: () => void;
  onRefreshProjectCatalog: () => void;
  onRefreshSchoolLogistics: () => void;
  onRefreshAgenda: () => void;
  onRefreshTaskQueue: () => void;
  onRefreshBadFitness: () => void;
  onRefreshBamfPulse: () => void;
  onToggleLoopDefinition: (definition: LoopReportDefinition) => void;
  selectedRunId: Id<"loopReportRuns"> | null;
  loopSnapshots: SourceSnapshot[] | undefined;
  onSelectRun: (runId: Id<"loopReportRuns">) => void;
}) {
  const recent = files.slice(0, 8);
  const showTemplates = mode === "reports" || mode === "artifacts";

  return (
    <div className="flex-1 overflow-auto px-5 py-5">
      <div className="max-w-3xl space-y-6">
        <div>
          <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
            {mode === "reports" ? "loop reports" : mode === "artifacts" ? "saved artifacts" : "identity files"}
          </p>
          <h2 className="mt-1 font-mono text-base text-[hsl(var(--text-primary))] opacity-90">
            {mode === "reports"
              ? "daily brain outputs live here"
              : mode === "artifacts"
                ? "markdown, sources, journals, and generated docs"
                : "your portable identity bundle"}
          </h2>
        </div>

        {mode === "reports" && (
          <LoopReportsControlPanel
            definitions={loopDefinitions}
            runs={loopRuns}
            artifacts={loopArtifacts}
            dsiComponents={dsiComponents}
            busy={loopBusy}
            status={loopStatus}
            dsiBusy={dsiBusy}
            dsiStatus={dsiStatus}
            onSeedDefaults={onSeedLoopDefaults}
            onRunDailyBriefing={onRunDailyBriefing}
            onRefreshWeatherSurf={onRefreshWeatherSurf}
            onRefreshProjectCatalog={onRefreshProjectCatalog}
            onRefreshSchoolLogistics={onRefreshSchoolLogistics}
            onRefreshAgenda={onRefreshAgenda}
            onRefreshTaskQueue={onRefreshTaskQueue}
            onRefreshBadFitness={onRefreshBadFitness}
            onRefreshBamfPulse={onRefreshBamfPulse}
            onToggleDefinition={onToggleLoopDefinition}
            onSelectArtifact={onSelect}
            selectedRunId={selectedRunId}
            snapshots={loopSnapshots}
            onSelectRun={onSelectRun}
          />
        )}

        {showTemplates && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
              quick starts
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {ARTIFACT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onCreateTemplate(template)}
                  className="group min-h-[92px] border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] px-3 py-3 text-left transition-colors hover:border-[hsl(var(--accent))]/50"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-85">
                        {template.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                        {template.description}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[12px] text-[hsl(var(--accent))] opacity-50 group-hover:opacity-90">
                      +
                    </span>
                  </div>
                  <p className="mt-2 truncate font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                    {template.path}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
            {recent.length ? "available docs" : "empty"}
          </p>
          {recent.length ? (
            <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
              {recent.map((file) => (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => onSelect(file.path)}
                  className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-[hsl(var(--bg-raised))]"
                >
                  <span className="min-w-0 truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-75">
                    {file.path}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                    {getExtLabel(file.path)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
              no files in this workspace yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoopReportsControlPanel({
  definitions,
  runs,
  artifacts,
  dsiComponents,
  busy,
  status,
  dsiBusy,
  dsiStatus,
  onSeedDefaults,
  onRunDailyBriefing,
  onRefreshWeatherSurf,
  onRefreshProjectCatalog,
  onRefreshSchoolLogistics,
  onRefreshAgenda,
  onRefreshTaskQueue,
  onRefreshBadFitness,
  onRefreshBamfPulse,
  onToggleDefinition,
  onSelectArtifact,
  selectedRunId,
  snapshots,
  onSelectRun,
}: {
  definitions: LoopReportDefinition[];
  runs: LoopReportRun[];
  artifacts: LoopReportArtifact[];
  dsiComponents: DsiComponent[];
  busy: boolean;
  status: string | null;
  dsiBusy: boolean;
  dsiStatus: string | null;
  onSeedDefaults: () => void;
  onRunDailyBriefing: () => void;
  onRefreshWeatherSurf: () => void;
  onRefreshProjectCatalog: () => void;
  onRefreshSchoolLogistics: () => void;
  onRefreshAgenda: () => void;
  onRefreshTaskQueue: () => void;
  onRefreshBadFitness: () => void;
  onRefreshBamfPulse: () => void;
  onToggleDefinition: (definition: LoopReportDefinition) => void;
  onSelectArtifact: (path: string) => void;
  selectedRunId: Id<"loopReportRuns"> | null;
  snapshots: SourceSnapshot[] | undefined;
  onSelectRun: (runId: Id<"loopReportRuns">) => void;
}) {
  const activeCount = definitions.filter((definition) => definition.status === "active").length;
  const latestRun = runs[0];
  const selectedRun = runs.find((run) => run._id === selectedRunId) ?? latestRun ?? null;
  const shownSnapshots = selectedRunId ? snapshots : undefined;
  const latestDsiAt = dsiComponents.length ? Math.max(...dsiComponents.map((component) => component.updatedAt)) : undefined;

  return (
    <div className="space-y-4">
      <div className="border-y border-[hsl(var(--border))] py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
              loop engine
            </p>
            <h3 className="mt-1 font-mono text-sm text-[hsl(var(--text-primary))] opacity-90">
              private cron reports and source snapshots
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
              Definitions decide what runs, runs capture the time window, snapshots preserve the source facts, and artifacts become markdown files in this workspace.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onSeedDefaults}
              disabled={busy}
              className="h-8 text-[10px]"
            >
              seed defaults
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={onRunDailyBriefing}
              disabled={busy}
              className="h-8 text-[10px]"
            >
              {busy ? "running..." : "run daily now"}
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] md:grid-cols-4">
          <div>
            <span className="opacity-35">definitions</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">{definitions.length}</span>
          </div>
          <div>
            <span className="opacity-35">active</span>
            <span className="ml-2 text-[hsl(var(--success))] opacity-80">{activeCount}</span>
          </div>
          <div>
            <span className="opacity-35">runs</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">{runs.length}</span>
          </div>
          <div>
            <span className="opacity-35">latest</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">{latestRun ? timeAgo(latestRun.startedAt) : "--"}</span>
          </div>
        </div>
        {status && (
          <p className={`mt-2 font-mono text-[10px] ${status.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"} opacity-80`}>
            {status}
          </p>
        )}
      </div>

      <div className="border-y border-[hsl(var(--border))] py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
              DSI catalog
            </p>
            <h3 className="mt-1 font-mono text-sm text-[hsl(var(--text-primary))] opacity-90">
              private live components for your personal API/MCP
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
              Components are normalized source-backed objects agents can read. Weather, surf, and project catalog adapters are the first h.computer patterns ported into You.md.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshProjectCatalog}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh projects"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshSchoolLogistics}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh school"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshAgenda}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh agenda"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshTaskQueue}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh tasks"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshBadFitness}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh bad.app"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshBamfPulse}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh bamf"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={onRefreshWeatherSurf}
              disabled={dsiBusy}
              className="h-8 self-start text-[10px]"
            >
              {dsiBusy ? "refreshing..." : "refresh weather/surf"}
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] md:grid-cols-4">
          <div>
            <span className="opacity-35">components</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">{dsiComponents.length}</span>
          </div>
          <div>
            <span className="opacity-35">private</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">
              {dsiComponents.filter((component) => component.visibility === "private").length}
            </span>
          </div>
          <div>
            <span className="opacity-35">active</span>
            <span className="ml-2 text-[hsl(var(--success))] opacity-80">
              {dsiComponents.filter((component) => component.status === "active").length}
            </span>
          </div>
          <div>
            <span className="opacity-35">latest</span>
            <span className="ml-2 text-[hsl(var(--text-primary))] opacity-80">{timeAgo(latestDsiAt)}</span>
          </div>
        </div>
        {dsiStatus && (
          <p className={`mt-2 font-mono text-[10px] ${dsiStatus.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"} opacity-80`}>
            {dsiStatus}
          </p>
        )}
        {dsiComponents.length ? (
          <div className="mt-3 divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
            {dsiComponents.slice(0, 6).map((component) => (
              <button
                key={component._id}
                type="button"
                onClick={() => onSelectArtifact(dsiComponentPath(component))}
                className="flex w-full flex-col gap-1 px-1 py-2 text-left hover:bg-[hsl(var(--bg-raised))]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
                    {component.title}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                    {component.componentType} / {component.visibility} / {component.trustLevel}
                  </span>
                </div>
                <p className="truncate text-[11px] text-[hsl(var(--text-secondary))] opacity-55">
                  {component.summary}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
            no DSI components yet. refresh weather/surf to create the first source-backed private components.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
          definitions
        </p>
        {definitions.length ? (
          <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
            {definitions.map((definition) => (
              <div key={definition._id} className="flex flex-col gap-2 px-1 py-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
                      {definition.title}
                    </span>
                    <span className={`font-mono text-[9px] ${definition.status === "active" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))]"} opacity-70`}>
                      {definition.status}
                    </span>
                    <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                      {definition.cadence} / {definition.sourceSelectors.length} sources
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[hsl(var(--text-secondary))] opacity-45">
                    {definition.description ?? definition.slug}
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                    last {timeAgo(definition.lastRunAt)} / next {timeAgo(definition.nextRunAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleDefinition(definition)}
                  disabled={busy}
                  className="self-start font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 disabled:opacity-25 md:self-center"
                >
                  {definition.status === "active" ? "pause" : "resume"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
            no loop definitions yet. seed defaults to install the daily briefing, project carryover, and journal loops.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
            recent runs
          </p>
          {runs.length ? (
            <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
              {runs.slice(0, 5).map((run) => (
                <button
                  key={run._id}
                  type="button"
                  onClick={() => onSelectRun(run._id)}
                  className={`w-full px-1 py-2 text-left hover:bg-[hsl(var(--bg-raised))] ${
                    selectedRunId === run._id ? "bg-[hsl(var(--bg-raised))]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-75">
                      {run.definitionSlug}
                    </span>
                    <span className={`shrink-0 font-mono text-[9px] ${run.status === "completed" ? "text-[hsl(var(--success))]" : run.status === "failed" ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))]"} opacity-75`}>
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                    {run.windowStart.slice(0, 10)} / {run.sourceSnapshotIds.length} snapshots / started {timeAgo(run.startedAt)}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
              no report runs yet.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
            generated artifacts
          </p>
          {artifacts.length ? (
            <div className="divide-y divide-[hsl(var(--border))] border-y border-[hsl(var(--border))]">
              {artifacts.slice(0, 5).map((artifact) => (
                <button
                  key={artifact._id}
                  type="button"
                  onClick={() => onSelectArtifact(reportArtifactPath(artifact))}
                  className="w-full px-1 py-2 text-left hover:bg-[hsl(var(--bg-raised))]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-75">
                      {artifact.title}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                      {artifact.status}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-[hsl(var(--text-secondary))] opacity-45">
                    {artifact.summary}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
              no generated markdown artifacts yet.
            </p>
          )}
        </div>
      </div>

      {selectedRun && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase text-[hsl(var(--text-secondary))] opacity-40">
            source snapshots
          </p>
          <div className="border-y border-[hsl(var(--border))]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-75">
                  {selectedRun.definitionSlug} / {selectedRun.windowStart.slice(0, 10)}
                </p>
                <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                  {selectedRun.sourceSnapshotIds.length} expected snapshots / status {selectedRun.status}
                </p>
              </div>
              {!selectedRunId && (
                <button
                  type="button"
                  onClick={() => onSelectRun(selectedRun._id)}
                  className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100"
                >
                  inspect
                </button>
              )}
            </div>

            {selectedRunId && shownSnapshots === undefined ? (
              <p className="px-1 py-3 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40">
                loading source snapshots...
              </p>
            ) : selectedRunId && shownSnapshots && shownSnapshots.length > 0 ? (
              <div className="divide-y divide-[hsl(var(--border))]">
                {shownSnapshots.map((snapshot) => (
                  <div key={snapshot._id} className="px-1 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
                        {snapshot.sourceKey}
                      </span>
                      <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                        {snapshot.connectorKind} / {snapshot.sourceType}
                      </span>
                      <span className="font-mono text-[9px] text-[hsl(var(--success))] opacity-70">
                        {snapshot.trustLevel}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                      {snapshot.windowStart.slice(0, 10)} / {snapshot.windowEnd.slice(0, 10)} / hash {snapshot.rawHash.slice(0, 16)} / captured {timeAgo(snapshot.capturedAt)}
                    </p>
                    <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words bg-[hsl(var(--bg))] px-2 py-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-70">
                      {jsonPreview(snapshot.normalized)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : selectedRunId ? (
              <p className="px-1 py-3 text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
                no source snapshots found for this run.
              </p>
            ) : (
              <p className="px-1 pb-3 text-[12px] text-[hsl(var(--text-secondary))] opacity-50">
                select a run to inspect the source facts behind the report.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── File Tree Item ──────────────────────────────────────────────────────

function FileTreeItem({
  node,
  selectedPath,
  onSelect,
  depth = 0,
}: {
  node: FileTreeNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = depth * 12;

  if (node.type === "directory") {
    // A directory's visibility is determined by checking a synthetic file
    // path inside it. profile/ is public; everything else is private.
    const dirPublic = isPublicPath(`${node.path}/_`);
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          title={dirPublic ? PUBLIC_TOOLTIP : PRIVATE_TOOLTIP}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-[hsl(var(--bg))] transition-colors"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 w-3">
            {expanded ? "v" : ">"}
          </span>
          <VisibilityIcon isPublic={dirPublic} />
          <span className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-70">
            {node.name}/
          </span>
        </button>
        {expanded && node.children?.map((child) => (
          <FileTreeItem
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const filePublic = isPublicPath(node.path);
  return (
    <button
      onClick={() => onSelect(node.path)}
      title={filePublic ? PUBLIC_TOOLTIP : PRIVATE_TOOLTIP}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-left transition-colors ${
        node.path === selectedPath
          ? "bg-[hsl(var(--bg))] text-[hsl(var(--text-primary))]"
          : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-80 hover:bg-[hsl(var(--bg))]"
      }`}
      style={{ paddingLeft: `${20 + indent}px` }}
    >
      <VisibilityIcon isPublic={filePublic} />
      <span className="font-mono text-[10px] opacity-30">-</span>
      <span className="font-mono text-[10px] truncate">{node.name}</span>
    </button>
  );
}

// ── File Viewer ─────────────────────────────────────────────────────────

function FileViewer({
  file,
  onContentChange,
  editedContent,
  onBack,
  isCustomDir,
  onAddFileInDir,
}: {
  file: VirtualFile;
  onContentChange: (path: string, content: string) => void;
  editedContent: string | undefined;
  onBack?: () => void;
  isCustomDir: boolean;
  onAddFileInDir?: () => void;
}) {
  const content = editedContent ?? file.content;
  const isModified = editedContent !== undefined && editedContent !== file.content;
  const isMarkdown = file.path.endsWith(".md");
  const defaultViewerMode: ViewerMode = isMarkdown ? "split" : "edit";
  const [viewerState, setViewerState] = useState<{ path: string; mode: ViewerMode }>({
    path: file.path,
    mode: defaultViewerMode,
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const documentInfo = useMemo(() => analyzeMarkdownDocument(content, file.path), [content, file.path]);
  const activeMode: ViewerMode = isMarkdown
    ? viewerState.path === file.path
      ? viewerState.mode
      : defaultViewerMode
    : "edit";
  const workspaceLabel = workspaceLabelForPath(file.path);

  const copyToClipboard = useCallback(async (label: string, value: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyStatus("copy unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied`);
      window.setTimeout(() => setCopyStatus(null), 1500);
    } catch {
      setCopyStatus("copy failed");
    }
  }, []);

  const sourcePane = file.editable ? (
    <Textarea
      value={content}
      onChange={(e) => onContentChange(file.path, e.target.value)}
      className="h-full min-h-[280px] resize-none border-0 bg-background p-3 text-[11px] leading-relaxed focus-visible:outline-offset-[-2px] md:p-4"
      spellCheck={false}
      aria-label={`edit ${file.path}`}
      name={file.path}
      data-artifact-source
    />
  ) : (
    <pre
      className="h-full min-h-[280px] overflow-auto bg-[hsl(var(--bg))] text-[hsl(var(--text-secondary))] font-mono text-[11px] leading-relaxed p-3 md:p-4 whitespace-pre-wrap break-words"
      data-artifact-source
    >
      {content}
    </pre>
  );

  const hasFrontmatter = Object.keys(documentInfo.frontmatter).length > 0;

  return (
    <div className="flex h-full flex-col" data-file-viewer-mode={activeMode}>
      <div className="shrink-0 border-b border-[hsl(var(--border))]">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5">
          <div className="flex min-w-0 items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="mr-1 shrink-0 font-mono text-[10px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100"
              >
                {"<"} back
              </button>
            )}
            <VisibilityIcon isPublic={isPublicPath(file.path)} />
            <span className="truncate font-mono text-[11px] text-[hsl(var(--text-primary))] opacity-80">
              {file.path}
            </span>
            {isModified && (
              <span className="shrink-0 font-mono text-[9px] uppercase text-[hsl(var(--accent))]">modified</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isMarkdown && (
              <div
                className="flex items-center border border-[hsl(var(--border))]"
                style={{ borderRadius: "var(--radius)" }}
                aria-label="markdown viewer mode"
              >
                {(["edit", "preview", "split"] as ViewerMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewerState({ path: file.path, mode })}
                    className={`font-mono text-[9px] px-1.5 py-0.5 transition-colors ${
                      activeMode === mode
                        ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))]/10"
                        : "text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-70"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => copyToClipboard("path", file.path)}
              className="hidden font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35 transition-opacity hover:text-[hsl(var(--accent))] hover:opacity-80 sm:inline"
            >
              copy path
            </button>
            <button
              type="button"
              onClick={() => copyToClipboard("content", content)}
              className="hidden font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35 transition-opacity hover:text-[hsl(var(--accent))] hover:opacity-80 sm:inline"
            >
              copy
            </button>
            {copyStatus && (
              <span className="hidden font-mono text-[9px] text-[hsl(var(--success))] opacity-70 sm:inline">
                {copyStatus}
              </span>
            )}
            <span className="hidden font-mono text-[9px] uppercase text-[hsl(var(--text-secondary))] opacity-30 sm:inline">
              {getExtLabel(file.path)}
            </span>
            {!file.editable && (
              <span
                className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-30 uppercase border border-[hsl(var(--border))] px-1.5 py-0.5"
                style={{ borderRadius: "var(--radius)" }}
              >
                read-only
              </span>
            )}
            {isCustomDir && onAddFileInDir && (
              <button
                onClick={onAddFileInDir}
                className="font-mono text-[9px] text-[hsl(var(--accent))] opacity-70 hover:opacity-100 border border-[hsl(var(--accent))]/40 px-1.5 py-0.5 hover:bg-[hsl(var(--accent))]/10 transition-colors"
                title="add a new markdown file inside this custom directory"
              >
                + new file in dir
              </button>
            )}
          </div>
        </div>

        {isMarkdown && (
          <div className="border-t border-[hsl(var(--border))] px-3 py-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <div className="truncate font-mono text-[13px] text-[hsl(var(--text-primary))] opacity-90">
                  {documentInfo.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">
                  <span>{workspaceLabel}</span>
                  <span>{documentInfo.kind}</span>
                  <span>{documentInfo.visibility}</span>
                  <span>{documentInfo.words} words</span>
                  <span>{documentInfo.lines} lines</span>
                  <span>{documentInfo.readingMinutes} min</span>
                  {hasFrontmatter && <span>{Object.keys(documentInfo.frontmatter).length} yaml keys</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                {documentInfo.frontmatter.cadence && <span>cadence: {documentInfo.frontmatter.cadence}</span>}
                {documentInfo.frontmatter.status && <span>status: {documentInfo.frontmatter.status}</span>}
                {documentInfo.frontmatter.created_at && <span>created: {documentInfo.frontmatter.created_at.slice(0, 10)}</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {isMarkdown ? (
        <div className="flex min-h-0 flex-1 flex-col 2xl:flex-row">
          {activeMode !== "preview" && (
            <div
              className={`min-h-0 ${activeMode === "split" ? "h-1/2 border-b border-[hsl(var(--border))] 2xl:h-auto 2xl:w-1/2 2xl:border-b-0 2xl:border-r" : "flex-1"} border-[hsl(var(--border))]`}
            >
              {sourcePane}
            </div>
          )}
          {activeMode !== "edit" && (
            <div className={`${activeMode === "split" ? "h-1/2 2xl:h-auto 2xl:w-1/2" : "flex-1"} min-h-0`}>
              <MarkdownPreview content={content} />
            </div>
          )}
          {documentInfo.headings.length > 0 && (
            <aside
              className="hidden w-[190px] shrink-0 overflow-auto border-l border-[hsl(var(--border))] px-3 py-3 2xl:block"
              data-artifact-outline
            >
              <div className="font-mono text-[9px] uppercase text-[hsl(var(--text-secondary))] opacity-35">outline</div>
              <div className="mt-2 space-y-1">
                {documentInfo.headings.slice(0, 18).map((heading) => (
                  <div
                    key={heading.id}
                    className="truncate font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60"
                    style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 8}px` }}
                    title={heading.text}
                  >
                    {heading.text}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          {sourcePane}
        </div>
      )}
    </div>
  );
}

// ── New File Input ──────────────────────────────────────────────────────

function NewFileInput({
  onCreateFile,
  onCancel,
}: {
  onCreateFile: (path: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    let path = value.trim();
    if (!path) { onCancel(); return; }
    // Ensure .md extension
    if (!path.endsWith(".md")) path += ".md";
    // Remove leading slash
    if (path.startsWith("/")) path = path.slice(1);
    onCreateFile(path);
  };

  return (
    <div className="px-2 py-1.5 border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 shrink-0">+</span>
        <Input
          ref={inputRef}
          type="text"
          name="new-file-path"
          aria-label="new file path"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={() => { if (!value.trim()) onCancel(); }}
          placeholder="custom/my-notes.md"
          autoComplete="off"
          spellCheck={false}
          className="h-9 flex-1 border-accent/40 text-[11px]"
        />
      </div>
      <div className="font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-30 mt-0.5 pl-3">
        enter to create / esc to cancel
      </div>
    </div>
  );
}

// ── New Directory Input ─────────────────────────────────────────────────

function NewDirectoryInput({
  onCreateDirectory,
  onCancel,
  busy,
  error,
}: {
  onCreateDirectory: (dirName: string) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const name = value.trim().toLowerCase();
    if (!name) { onCancel(); return; }
    if (busy) return;
    onCreateDirectory(name);
  };

  // Live validation hint
  const validName = /^[a-z0-9-]+$/.test(value.trim()) && value.trim().length > 0 && value.trim().length <= 30;

  return (
    <div className="px-2 py-1.5 border-t border-[hsl(var(--border))]">
      <div className="flex items-center gap-1">
        <span aria-hidden="true" className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-60 shrink-0">+</span>
        <Input
          ref={inputRef}
          type="text"
          name="new-directory-name"
          aria-label="new directory name (lowercase letters, numbers, dashes only)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
          disabled={busy}
          placeholder="my-notes"
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
          className="h-9 flex-1 border-accent/40 text-[11px]"
        />
      </div>
      <div className="font-mono text-[8px] mt-0.5 pl-3">
        {error ? (
          <span className="text-[hsl(var(--accent))] opacity-80">{error}</span>
        ) : value.trim() && !validName ? (
          <span className="text-[hsl(var(--accent))] opacity-60">lowercase, hyphens only, max 30 chars</span>
        ) : (
          <span className="text-[hsl(var(--text-secondary))] opacity-30">
            {busy ? "creating..." : "new private directory / enter to create / esc to cancel"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────

export function FilesPane({ userId, isWritingFiles }: FilesPaneProps) {
  const { user } = useUser();
  const clerkId = user?.id;
  const latestBundle = useQuery(api.bundles.getLatestBundle, clerkId && userId ? { clerkId, userId } : "skip");
  const saveYouJson = useMutation(api.me.saveYouJsonDirect);
  const createCustomDirectory = useMutation(api.me.createCustomDirectory);
  const seedLoopDefaults = useMutation(api.loopReports.seedDefaultDefinitions);
  const runDailyBriefingNow = useMutation(api.loopReports.runDailyBriefingNow);
  const updateLoopDefinitionStatus = useMutation(api.loopReports.updateDefinitionStatus);
  const refreshProjectCatalogFallback = useMutation(api.dsi.refreshProjectCatalog);
  const refreshTaskQueue = useMutation(api.dsi.refreshTaskQueue);
  const refreshBadFitnessFromContext = useMutation(api.dsi.refreshBadFitnessFromContext);
  const refreshBamfPulseFromContext = useMutation(api.dsi.refreshBamfPulseFromContext);
  const refreshProjectCatalog = useAction(api.githubProjects.refreshProjectCatalogDsi);
  const refreshWeatherSurf = useAction(api.dsi.refreshWeatherSurf);
  const refreshSchoolLogistics = useAction(api.dsi.refreshSchoolLogistics);
  const refreshAgenda = useAction(api.dsi.refreshAgenda);
  const refreshBadFitness = useAction(api.dsi.refreshBadFitness);
  const refreshBamfPulse = useAction(api.dsi.refreshBamfPulse);
  const memories = useQuery(api.memories.listMemories, clerkId && userId ? { clerkId, userId } : "skip");
  const sessions = useQuery(api.memories.listSessions, clerkId && userId ? { clerkId, userId, limit: 20 } : "skip");
  const loopReportDefinitions = useQuery(
    api.loopReports.listDefinitions,
    clerkId && userId ? { clerkId, userId } : "skip"
  );
  const loopReportRuns = useQuery(
    api.loopReports.listRuns,
    clerkId && userId ? { clerkId, userId, limit: 20 } : "skip"
  );
  const loopReportArtifacts = useQuery(
    api.loopReports.listArtifacts,
    clerkId && userId ? { clerkId, userId, limit: 40 } : "skip"
  );
  const dsiComponents = useQuery(
    api.dsi.listComponents,
    clerkId && userId ? { clerkId, userId, limit: 40 } : "skip"
  );
  const userProfile = useQuery(
    api.profiles.getByOwnerId,
    userId ? { ownerId: userId } : "skip"
  );
  const privateContext = useQuery(
    api.private.getPrivateContext,
    user?.id && userProfile?._id
      ? { clerkId: user.id, profileId: userProfile._id }
      : "skip"
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editedFiles, setEditedFiles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("files");
  const [creatingFile, setCreatingFile] = useState(false);
  const [creatingDirectory, setCreatingDirectory] = useState(false);
  const [creatingDirError, setCreatingDirError] = useState<string | null>(null);
  const [creatingDirBusy, setCreatingDirBusy] = useState(false);
  const [customFiles, setCustomFiles] = useState<VirtualFile[]>([]);
  const [loopBusy, setLoopBusy] = useState(false);
  const [loopStatus, setLoopStatus] = useState<string | null>(null);
  const [dsiBusy, setDsiBusy] = useState(false);
  const [dsiStatus, setDsiStatus] = useState<string | null>(null);
  const [selectedLoopRunId, setSelectedLoopRunId] = useState<Id<"loopReportRuns"> | null>(null);
  const loopSnapshots = useQuery(
    api.loopReports.listSnapshotsForRun,
    clerkId && selectedLoopRunId ? { clerkId, runId: selectedLoopRunId } : "skip"
  );

  // Convert privateContext table data into virtual files under private/
  const privateContextFiles = useMemo<VirtualFile[]>(() => {
    if (!privateContext) return [];
    const out: VirtualFile[] = [];
    const pc = privateContext as Record<string, unknown>;

    if (pc.privateNotes && typeof pc.privateNotes === "string") {
      out.push({
        path: "private/notes.md",
        content: `---\ntitle: Private Notes\nvisibility: private\n---\n\n# Private Notes\n\n${pc.privateNotes}\n`,
        section: "private.notes",
        editable: true,
      });
    }
    if (Array.isArray(pc.privateProjects) && pc.privateProjects.length > 0) {
      const lines = ["---", "title: Private Projects", "visibility: private", "---", "", "# Private Projects", ""];
      for (const p of pc.privateProjects as Array<Record<string, string>>) {
        lines.push(`## ${p.name || "Untitled"}`);
        if (p.status) lines.push(`**Status:** ${p.status}`);
        if (p.description) lines.push("", p.description);
        lines.push("");
      }
      out.push({
        path: "private/projects.md",
        content: lines.join("\n"),
        section: "private.projects",
        editable: true,
      });
    }
    if (pc.internalLinks && typeof pc.internalLinks === "object") {
      const entries = Object.entries(pc.internalLinks as Record<string, string>).filter(
        ([, v]) => v
      );
      if (entries.length > 0) {
        const lines = [
          "---",
          "title: Internal Links",
          "visibility: private",
          "---",
          "",
          "# Internal Links",
          "",
        ];
        for (const [k, v] of entries) lines.push(`- **${k}:** ${v}`);
        out.push({
          path: "private/internal-links.md",
          content: lines.join("\n"),
          section: "private.links",
          editable: true,
        });
      }
    }
    if (pc.calendarContext && typeof pc.calendarContext === "string") {
      out.push({
        path: "private/calendar.md",
        content: `---\ntitle: Calendar Context\nvisibility: private\n---\n\n# Calendar Context\n\n${pc.calendarContext}\n`,
        section: "private.calendar",
        editable: true,
      });
    }
    if (pc.investmentThesis && typeof pc.investmentThesis === "string") {
      out.push({
        path: "private/investment-thesis.md",
        content: `---\ntitle: Investment Thesis\nvisibility: private\n---\n\n# Investment Thesis\n\n${pc.investmentThesis}\n`,
        section: "private.investmentThesis",
        editable: true,
      });
    }
    return out;
  }, [privateContext]);

  const files = useMemo(() => {
    const bundleFiles = latestBundle?.youJson
      ? decompileBundle(latestBundle.youJson, latestBundle.youMd ?? "")
      : [];
    const memoryFiles = generateMemoryFiles(memories ?? [], sessions ?? []);
    const reportFiles: VirtualFile[] = (loopReportArtifacts ?? []).map((artifact) => ({
      path: reportArtifactPath(artifact),
      content: [
        "---",
        `title: ${JSON.stringify(artifact.title)}`,
        `kind: ${JSON.stringify(artifact.definitionSlug)}`,
        `visibility: ${JSON.stringify(artifact.visibility)}`,
        `status: ${JSON.stringify(artifact.status)}`,
        `created_at: ${JSON.stringify(new Date(artifact.createdAt).toISOString())}`,
        "---",
        "",
        artifact.bodyMarkdown,
      ].join("\n"),
      section: `loop_report_artifacts.${artifact._id}`,
      editable: false,
    }));
    const dsiFiles: VirtualFile[] = (dsiComponents ?? []).map((component) => ({
      path: dsiComponentPath(component),
      content: dsiComponentMarkdown(component),
      section: `dsi_components.${component._id}`,
      editable: false,
    }));

    // Dedupe by path: real content beats scaffold placeholders, customFiles win all.
    const seen = new Map<string, VirtualFile>();
    for (const f of bundleFiles) seen.set(f.path, f);
    for (const f of memoryFiles) seen.set(f.path, f);
    for (const f of privateContextFiles) seen.set(f.path, f); // real private data
    for (const f of reportFiles) seen.set(f.path, f);
    for (const f of dsiFiles) seen.set(f.path, f);
    for (const f of customFiles) seen.set(f.path, f);
    return Array.from(seen.values());
  }, [latestBundle, memories, sessions, loopReportArtifacts, dsiComponents, privateContextFiles, customFiles]);

  // ── Custom directories ──
  // A "custom directory" is any directory backed by a youJson.custom_files entry,
  // OR any unsaved customFiles entry that lives 2+ levels deep.
  const customDirSet = useMemo(() => {
    const set = new Set<string>();
    // From persisted bundle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persisted = (latestBundle?.youJson as any)?.custom_files as Array<{ path?: string }> | undefined;
    if (Array.isArray(persisted)) {
      for (const cf of persisted) {
        if (cf?.path && typeof cf.path === "string") {
          const parts = cf.path.split("/");
          if (parts.length >= 2) {
            // Strip the filename, keep the dir path
            set.add(parts.slice(0, -1).join("/"));
          }
        }
      }
    }
    // From in-memory unsaved files
    for (const cf of customFiles) {
      const parts = cf.path.split("/");
      if (parts.length >= 2) set.add(parts.slice(0, -1).join("/"));
    }
    return set;
  }, [latestBundle, customFiles]);

  const workspaceCounts = useMemo<Record<WorkspaceMode, number>>(() => {
    const counts: Record<WorkspaceMode, number> = { files: 0, artifacts: 0, reports: 0 };
    for (const file of files) counts[classifyWorkspace(file.path)] += 1;
    return counts;
  }, [files]);

  const modeFiles = useMemo(() => {
    return files.filter((file) => classifyWorkspace(file.path) === workspaceMode);
  }, [files, workspaceMode]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return modeFiles;
    const q = searchQuery.toLowerCase();
    return modeFiles.filter((f) => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q));
  }, [modeFiles, searchQuery]);

  const tree = useMemo(() => buildFileTree(filteredFiles), [filteredFiles]);
  const selectedFile = useMemo(() => files.find((f) => f.path === selectedPath) ?? null, [files, selectedPath]);

  useEffect(() => {
    if (selectedPath && classifyWorkspace(selectedPath) !== workspaceMode) {
      setSelectedPath(null);
    }
  }, [selectedPath, workspaceMode]);

  const handleContentChange = useCallback((path: string, content: string) => {
    setEditedFiles((prev) => ({ ...prev, [path]: content }));
  }, []);

  const modifiedCount = useMemo(() => {
    return Object.entries(editedFiles).filter(([path, content]) => {
      const original = files.find((f) => f.path === path);
      return original && content !== original.content;
    }).length;
  }, [editedFiles, files]);

  const handleSave = useCallback(async () => {
    if (!latestBundle?.youJson || !user?.id || modifiedCount === 0) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const modified: Record<string, string> = {};
      for (const [path, content] of Object.entries(editedFiles)) {
        const original = files.find((f) => f.path === path);
        if (original && content !== original.content) modified[path] = content;
      }
      const patchedYouJson = recompileYouJson(latestBundle.youJson, modified);
      const result = await saveYouJson({ clerkId: user.id, youJson: patchedYouJson });
      setSaveStatus(`saved as v${result.version}`);
      setEditedFiles({});
      // Clear custom files that were saved (they'll come back from the bundle)
      setCustomFiles((prev) => prev.filter((f) => !modified[f.path]));
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus(`error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setSaving(false);
    }
  }, [latestBundle, user, modifiedCount, editedFiles, files, saveYouJson]);

  const handleDiscard = useCallback(() => {
    setEditedFiles({});
    setSaveStatus(null);
  }, []);

  // ── Create new file ───────────────────────────────────────────────────

  const handleCreateFile = useCallback((path: string) => {
    // Check if file already exists
    const exists = files.some((f) => f.path === path);
    if (exists) {
      setSelectedPath(path);
      setCreatingFile(false);
      return;
    }

    // Determine section from path
    const section = path.split("/")[0] || "custom";

    const newFile: VirtualFile = {
      path,
      content: `---\ntitle: ${path.split("/").pop()?.replace(".md", "") || "Untitled"}\n---\n\n`,
      section,
      editable: true,
    };

    setCustomFiles((prev) => [...prev, newFile]);
    setEditedFiles((prev) => ({ ...prev, [path]: newFile.content }));
    setSelectedPath(path);
    setCreatingFile(false);
  }, [files]);

  const handleCreateTemplate = useCallback((template: ArtifactTemplate) => {
    const exists = files.some((f) => f.path === template.path);
    if (exists) {
      setSelectedPath(template.path);
      setWorkspaceMode(classifyWorkspace(template.path));
      return;
    }

    const newFile: VirtualFile = {
      path: template.path,
      content: template.content,
      section: `custom_files.${template.path}`,
      editable: true,
    };
    setCustomFiles((prev) => [...prev, newFile]);
    setEditedFiles((prev) => ({ ...prev, [template.path]: template.content }));
    setSelectedPath(template.path);
    setWorkspaceMode(classifyWorkspace(template.path));
    setSaveStatus("template staged — cmd+s to save");
    setTimeout(() => setSaveStatus(null), 3000);
  }, [files]);

  const handleSeedLoopDefaults = useCallback(async () => {
    if (!user?.id || !userId) return;
    setLoopBusy(true);
    setLoopStatus(null);
    try {
      const rows = await seedLoopDefaults({ clerkId: user.id, userId });
      setLoopStatus(`seeded ${rows.length} loop definitions`);
      setTimeout(() => setLoopStatus(null), 3000);
    } catch (err) {
      setLoopStatus(`error: ${err instanceof Error ? err.message : "failed to seed loops"}`);
    } finally {
      setLoopBusy(false);
    }
  }, [user, userId, seedLoopDefaults]);

  const handleRunDailyBriefing = useCallback(async () => {
    if (!user?.id || !userId) return;
    setLoopBusy(true);
    setLoopStatus(null);
    try {
      const result = await runDailyBriefingNow({ clerkId: user.id, userId, force: true });
      setWorkspaceMode("reports");
      setLoopStatus(result.reused ? "daily briefing already exists" : "daily briefing generated");
      setTimeout(() => setLoopStatus(null), 3000);
    } catch (err) {
      setLoopStatus(`error: ${err instanceof Error ? err.message : "failed to run briefing"}`);
    } finally {
      setLoopBusy(false);
    }
  }, [user, userId, runDailyBriefingNow]);

  const handleRefreshWeatherSurf = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshWeatherSurf({ clerkId: user.id, userId });
      setWorkspaceMode("artifacts");
      setDsiStatus(`refreshed ${result.snapshotIds.length} source snapshots`);
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh DSI"}`);
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshWeatherSurf]);

  const handleRefreshProjectCatalog = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshProjectCatalog({ clerkId: user.id });
      setWorkspaceMode("artifacts");
      setDsiStatus(`refreshed projects: ${result.languageMetricCount} language metrics`);
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      try {
        const fallback = await refreshProjectCatalogFallback({ clerkId: user.id, userId });
        setWorkspaceMode("artifacts");
        setDsiStatus(`refreshed project catalog snapshot ${String(fallback.snapshotId).slice(-6)} without GitHub languages`);
        setTimeout(() => setDsiStatus(null), 3000);
      } catch {
        setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh project catalog"}`);
      }
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshProjectCatalog, refreshProjectCatalogFallback]);

  const handleRefreshSchoolLogistics = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshSchoolLogistics({ clerkId: user.id, userId });
      setWorkspaceMode("artifacts");
      setDsiStatus(`refreshed school logistics: ${result.eventCount} upcoming events`);
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh school logistics"}`);
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshSchoolLogistics]);

  const handleRefreshAgenda = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshAgenda({ clerkId: user.id, userId, daysAhead: 7 });
      setWorkspaceMode("artifacts");
      setDsiStatus(result.configured
        ? `refreshed agenda: ${result.eventCount} kept events`
        : "agenda saved: calendar connector missing"
      );
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh agenda"}`);
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshAgenda]);

  const handleRefreshTaskQueue = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshTaskQueue({ clerkId: user.id, userId });
      setWorkspaceMode("artifacts");
      setDsiStatus(result.configured
        ? `refreshed tasks: ${result.openCount} open`
        : "tasks saved: private task source missing"
      );
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh tasks"}`);
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshTaskQueue]);

  const handleRefreshBadFitness = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshBadFitness({ clerkId: user.id, userId });
      setWorkspaceMode("artifacts");
      setDsiStatus(result.configured ? `refreshed bad.app: ${result.summary}` : "bad.app saved: connector missing");
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      try {
        const fallback = await refreshBadFitnessFromContext({ clerkId: user.id, userId });
        setWorkspaceMode("artifacts");
        setDsiStatus(fallback.configured ? `refreshed bad.app from private context: ${fallback.summary}` : "bad.app saved: connector missing");
        setTimeout(() => setDsiStatus(null), 3000);
      } catch {
        setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh bad.app"}`);
      }
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshBadFitness, refreshBadFitnessFromContext]);

  const handleRefreshBamfPulse = useCallback(async () => {
    if (!user?.id || !userId) return;
    setDsiBusy(true);
    setDsiStatus(null);
    try {
      const result = await refreshBamfPulse({ clerkId: user.id, userId });
      setWorkspaceMode("artifacts");
      setDsiStatus(result.configured ? `refreshed bamf: ${result.summary}` : "bamf saved: connector missing");
      setTimeout(() => setDsiStatus(null), 3000);
    } catch (err) {
      try {
        const fallback = await refreshBamfPulseFromContext({ clerkId: user.id, userId });
        setWorkspaceMode("artifacts");
        setDsiStatus(fallback.configured ? `refreshed bamf from private context: ${fallback.summary}` : "bamf saved: connector missing");
        setTimeout(() => setDsiStatus(null), 3000);
      } catch {
        setDsiStatus(`error: ${err instanceof Error ? err.message : "failed to refresh bamf"}`);
      }
    } finally {
      setDsiBusy(false);
    }
  }, [user, userId, refreshBamfPulse, refreshBamfPulseFromContext]);

  const handleToggleLoopDefinition = useCallback(async (definition: LoopReportDefinition) => {
    if (!user?.id) return;
    setLoopBusy(true);
    setLoopStatus(null);
    try {
      const nextStatus = definition.status === "active" ? "paused" : "active";
      await updateLoopDefinitionStatus({
        clerkId: user.id,
        definitionId: definition._id,
        status: nextStatus,
      });
      setLoopStatus(`${definition.title} ${nextStatus}`);
      setTimeout(() => setLoopStatus(null), 3000);
    } catch (err) {
      setLoopStatus(`error: ${err instanceof Error ? err.message : "failed to update loop"}`);
    } finally {
      setLoopBusy(false);
    }
  }, [user, updateLoopDefinitionStatus]);

  const handleSelectLoopRun = useCallback((runId: Id<"loopReportRuns">) => {
    setSelectedLoopRunId((current) => current === runId ? null : runId);
  }, []);

  // ── Create new custom directory ───────────────────────────────────────

  const handleCreateDirectory = useCallback(async (dirName: string) => {
    if (!user?.id) {
      setCreatingDirError("not signed in");
      return;
    }
    setCreatingDirBusy(true);
    setCreatingDirError(null);
    try {
      const result = await createCustomDirectory({
        clerkId: user.id,
        dirName,
        // default = private
      });
      setCreatingDirectory(false);
      setSaveStatus(`created /${result.filePath}`);
      setSelectedPath(result.filePath);
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setCreatingDirError(err instanceof Error ? err.message : "failed to create directory");
    } finally {
      setCreatingDirBusy(false);
    }
  }, [user, createCustomDirectory]);

  // ── Add a new file inside the directory of the currently-selected file ─

  const handleAddFileInCurrentDir = useCallback(() => {
    if (!selectedPath) return;
    const parts = selectedPath.split("/");
    if (parts.length < 2) return;
    const dirPath = parts.slice(0, -1).join("/");

    // Find an unused filename
    let idx = 1;
    let candidate = `${dirPath}/note.md`;
    const taken = new Set(files.map((f) => f.path));
    while (taken.has(candidate)) {
      idx += 1;
      candidate = `${dirPath}/note-${idx}.md`;
    }

    const newFile: VirtualFile = {
      path: candidate,
      content: `---\ntitle: ${candidate.split("/").pop()?.replace(".md", "") || "Note"}\n---\n\n`,
      section: `custom_files.${candidate}`,
      editable: true,
    };
    setCustomFiles((prev) => [...prev, newFile]);
    setEditedFiles((prev) => ({ ...prev, [candidate]: newFile.content }));
    setSelectedPath(candidate);
  }, [selectedPath, files]);

  // Helper: is the currently selected file inside a custom directory?
  const selectedFileIsInCustomDir = useMemo(() => {
    if (!selectedPath) return false;
    const parts = selectedPath.split("/");
    if (parts.length < 2) return false;
    const dirPath = parts.slice(0, -1).join("/");
    return customDirSet.has(dirPath);
  }, [selectedPath, customDirSet]);

  // ── Keyboard shortcut: Cmd+S / Ctrl+S ────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (modifiedCount > 0 && !saving) {
          handleSave();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modifiedCount, saving, handleSave]);

  if (files.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <PaneHeader>files</PaneHeader>
        <PaneEmptyState>no bundle yet. talk to the agent to build your profile.</PaneEmptyState>
      </div>
    );
  }

  // Mobile: show file viewer full-width when a file is selected
  const showMobileViewer = selectedFile !== null;

  return (
    <div className="h-full flex flex-col">
      <MarkdownStyles />

      {/* Header */}
      <div className="border-b border-[hsl(var(--border))] px-4 py-3 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="flex items-center gap-2 font-mono text-xs text-[hsl(var(--text-secondary))]">
              artifact workspace
              {modifiedCount > 0 && (
                <span className="text-[hsl(var(--accent))]">({modifiedCount} modified)</span>
              )}
              {saveStatus && (
                <span className={`text-[9px] ${saveStatus.startsWith("error") ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}`}>
                  {saveStatus}
                </span>
              )}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modifiedCount > 0 && (
              <>
                <Button
                  onClick={handleDiscard}
                  disabled={saving}
                  variant="secondary"
                  size="sm"
                  className="text-[10px]"
                >
                  discard
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant="primary"
                  size="sm"
                  className="text-[10px]"
                >
                  {saving ? "saving..." : "save"}
                </Button>
              </>
            )}
            {/* Keyboard shortcut hint */}
            {modifiedCount > 0 && (
              <span className="hidden font-mono text-[8px] text-[hsl(var(--text-secondary))] opacity-30 md:inline">
                {typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "cmd" : "ctrl"}+s
              </span>
            )}
          </div>
        </div>
        <div className="mt-3">
          <WorkspaceTabs mode={workspaceMode} onChange={setWorkspaceMode} counts={workspaceCounts} />
        </div>
      </div>

      {/* Agent writing indicator */}
      {isWritingFiles && (
        <div className="px-4 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] flex items-center gap-2 shrink-0">
          <span className="flex gap-[3px] items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-[4px] h-[4px] rounded-full bg-[hsl(var(--accent))]"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </span>
          <span className="font-mono text-[10px] text-[hsl(var(--accent))] opacity-80">
            agent writing files...
          </span>
        </div>
      )}

      {/* Mobile: full-width file viewer when selected */}
      <div className={`flex-1 min-h-0 ${showMobileViewer ? "hidden md:flex" : "flex"} md:flex`}>
        {/* Sidebar — full width on mobile, fixed width on desktop */}
        <div className="w-full md:w-[180px] md:shrink-0 md:border-r border-[hsl(var(--border))] overflow-y-auto flex flex-col">
          <div className="px-2 py-1.5 border-b border-[hsl(var(--border))]">
            <Input
              type="search"
              name="file-search"
              aria-label="search files by name or path"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search..."
              autoComplete="off"
              spellCheck={false}
              className="h-9 text-[11px]"
            />
          </div>
          <div className="px-3 py-1.5 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
              <span>{searchQuery ? `${filteredFiles.length}/${modeFiles.length}` : modeFiles.length} files</span>
              <span>{latestBundle ? `v${latestBundle.version}` : ""}{memories?.length ? ` / ${memories.length} mem` : ""}</span>
            </div>
          </div>
          <div className="py-1 flex-1 overflow-y-auto">
            {tree.length > 0 ? (
              tree.map((node) => (
                <FileTreeItem key={node.path} node={node} selectedPath={selectedPath} onSelect={setSelectedPath} />
              ))
            ) : (
              <p className="px-3 py-4 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-35">
                no {workspaceMode} matched.
              </p>
            )}
          </div>
          {/* New file button / input */}
          {creatingFile ? (
            <NewFileInput
              onCreateFile={handleCreateFile}
              onCancel={() => setCreatingFile(false)}
            />
          ) : (
            <button
              onClick={() => { setCreatingFile(true); setCreatingDirectory(false); }}
              className="min-h-9 w-full border-t border-[hsl(var(--border))] px-3 text-left font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 transition-colors hover:text-[hsl(var(--accent))] hover:opacity-70"
            >
              + new file
            </button>
          )}

          {/* New directory button / input */}
          {creatingDirectory ? (
            <NewDirectoryInput
              onCreateDirectory={handleCreateDirectory}
              onCancel={() => { setCreatingDirectory(false); setCreatingDirError(null); }}
              busy={creatingDirBusy}
              error={creatingDirError}
            />
          ) : (
            <button
              onClick={() => { setCreatingDirectory(true); setCreatingFile(false); setCreatingDirError(null); }}
              className="min-h-9 w-full border-t border-[hsl(var(--border))] px-3 text-left font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 transition-colors hover:text-[hsl(var(--accent))] hover:opacity-70"
              title="create a custom directory (private by default)"
            >
              + new directory
            </button>
          )}
        </div>

        {/* Desktop editor */}
        <div className="hidden md:flex flex-1 min-w-0">
          {selectedFile ? (
            <div className="flex-1">
              <FileViewer
                file={selectedFile}
                onContentChange={handleContentChange}
                editedContent={editedFiles[selectedFile.path]}
                isCustomDir={selectedFileIsInCustomDir}
                onAddFileInDir={handleAddFileInCurrentDir}
              />
            </div>
          ) : (
            <ArtifactHome
              mode={workspaceMode}
              files={filteredFiles}
              onSelect={setSelectedPath}
              onCreateTemplate={handleCreateTemplate}
              loopDefinitions={loopReportDefinitions ?? []}
              loopRuns={loopReportRuns ?? []}
              loopArtifacts={loopReportArtifacts ?? []}
              dsiComponents={dsiComponents ?? []}
              loopBusy={loopBusy}
              loopStatus={loopStatus}
              dsiBusy={dsiBusy}
              dsiStatus={dsiStatus}
              onSeedLoopDefaults={handleSeedLoopDefaults}
              onRunDailyBriefing={handleRunDailyBriefing}
              onRefreshWeatherSurf={handleRefreshWeatherSurf}
              onRefreshProjectCatalog={handleRefreshProjectCatalog}
              onRefreshSchoolLogistics={handleRefreshSchoolLogistics}
              onRefreshAgenda={handleRefreshAgenda}
              onRefreshTaskQueue={handleRefreshTaskQueue}
              onRefreshBadFitness={handleRefreshBadFitness}
              onRefreshBamfPulse={handleRefreshBamfPulse}
              onToggleLoopDefinition={handleToggleLoopDefinition}
              selectedRunId={selectedLoopRunId}
              loopSnapshots={loopSnapshots}
              onSelectRun={handleSelectLoopRun}
            />
          )}
        </div>
      </div>

      {/* Mobile: full-width file viewer */}
      {showMobileViewer && (
        <div className="flex-1 min-h-0 flex md:hidden">
          <div className="flex-1">
            <FileViewer
              file={selectedFile!}
              onContentChange={handleContentChange}
              editedContent={editedFiles[selectedFile!.path]}
              onBack={() => setSelectedPath(null)}
              isCustomDir={selectedFileIsInCustomDir}
              onAddFileInDir={handleAddFileInCurrentDir}
            />
          </div>
        </div>
      )}
    </div>
  );
}
