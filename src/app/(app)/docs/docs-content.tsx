"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { docsReference } from "@/generated/docs-reference";
import type {
  DocsCliCommand,
  DocsEndpoint,
  DocsHostedMcpTool,
  DocsMcpTool,
} from "@/generated/docs-reference";

/* ── Navigation structure ────────────────────────────────── */

interface NavItem {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

const navigation: NavItem[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    children: [
      { id: "docs-map", label: "Docs Map" },
      { id: "web-quickstart", label: "Web Quickstart" },
      { id: "github-auth", label: "GitHub Sign-In" },
      { id: "cli-quickstart", label: "Runtime Quickstart" },
    ],
  },
  {
    id: "core-concepts",
    label: "Core Concepts",
    children: [
      { id: "simple-model", label: "Simple Model" },
      { id: "brain-architecture", label: "Brain" },
      { id: "identity-protocol", label: "Protocol" },
      { id: "open-standard", label: "Open Standard" },
      { id: "context-surfaces", label: "Context Surfaces" },
      { id: "docs-standard", label: "API/MCP/Stack Standard" },
      { id: "reference-intelligence", label: "Reference Intelligence" },
      { id: "source-of-truth", label: "Source of Truth" },
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code Integration",
    children: [
      { id: "cc-setup", label: "Setup" },
      { id: "cc-commands", label: "Commands" },
      { id: "cc-workflow", label: "Workflow" },
    ],
  },
  {
    id: "share",
    label: "Share Your Brain",
    children: [
      { id: "share-command", label: "/share Command" },
      { id: "context-links", label: "Context Links" },
    ],
  },
  {
    id: "sync",
    label: "Sync",
    children: [
      { id: "web-cli-sync", label: "Web + CLI" },
      { id: "file-structure", label: "File Structure" },
    ],
  },
  {
    id: "sync-across-machines",
    label: "Sync Across Machines",
    children: [
      { id: "sync-planes", label: "Four Sync Planes" },
      { id: "sync-new-machine", label: "New Machine Setup" },
    ],
  },
  { id: "cli", label: "CLI Reference" },
  {
    id: "skills",
    label: "Skills",
    children: [
      { id: "skills-overview", label: "Overview" },
      { id: "skills-cli", label: "CLI Commands" },
      { id: "skills-bundled", label: "Bundled Skills" },
      { id: "skills-init-project", label: "init-project" },
      { id: "skills-sync", label: "Skill Sync" },
    ],
  },
  {
    id: "youstacks",
    label: "YouStacks",
    children: [
      { id: "youstacks-overview", label: "Overview" },
      { id: "youstacks-named", label: "Named Stacks" },
      { id: "youstacks-contents", label: "What Goes In" },
      { id: "youstacks-improvement", label: "Self-Improvement" },
      { id: "youstacks-proposals-consent", label: "Proposals + Consent" },
      { id: "youstacks-reference-loop", label: "Reference Loop" },
      { id: "youstacks-use-cases", label: "Use Cases" },
      { id: "youstacks-runtime", label: "Runtime" },
      { id: "youstacks-management", label: "Management" },
      { id: "youstacks-install-flow", label: "Install Flow" },
      { id: "youstacks-auto-update", label: "Auto-Update" },
      { id: "youstacks-bamfstack", label: "BAMFStack" },
      { id: "youstacks-manifest", label: "Manifest" },
      { id: "youstacks-examples", label: "Examples" },
      { id: "youstacks-threshold", label: "API/MCP Threshold" },
      { id: "youstacks-api-mcp", label: "API + MCP" },
    ],
  },
  {
    id: "directives",
    label: "Agent Directives",
  },
  {
    id: "agent-workflows",
    label: "Agent Workflows",
    children: [
      { id: "workflow-golden-path", label: "Golden Path" },
      { id: "playbooks", label: "Playbooks" },
      { id: "examples", label: "Examples" },
      { id: "agent-docs", label: "Agent Docs" },
    ],
  },
  {
    id: "api",
    label: "API",
    children: [
      { id: "public-endpoints", label: "Public Endpoints" },
      { id: "authenticated-endpoints", label: "Authenticated" },
      { id: "skills-api", label: "Skills API" },
      { id: "mcp-server", label: "MCP Server" },
      { id: "schema-reference", label: "Schema" },
      { id: "docs-automation", label: "Docs Automation" },
    ],
  },
  { id: "errors-troubleshooting", label: "Errors + Troubleshooting" },
  { id: "privacy", label: "Privacy" },
  { id: "telemetry", label: "Telemetry" },
  { id: "commands", label: "Dashboard Commands" },
];

/* ── Primitives ──────────────────────────────────────────── */

function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-[28px] md:text-[32px] font-medium text-[hsl(var(--text-primary))] tracking-normal mb-2">
      {children}
    </h1>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-[20px] md:text-[22px] font-medium text-[hsl(var(--text-primary))] tracking-normal mt-12 mb-4 scroll-mt-20 border-b border-[hsl(var(--border))] pb-3"
    >
      {children}
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="text-[16px] font-medium text-[hsl(var(--text-primary))] mt-8 mb-3 scroll-mt-20"
    >
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] text-[hsl(var(--text-secondary))] leading-[1.7] mb-4">
      {children}
    </p>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-1.5 py-0.5 rounded-sm text-[13px] font-mono text-[hsl(var(--accent))]">
      {children}
    </code>
  );
}

function CodeBlock({ title, children }: { title?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Cycle 61: touch target sizes were 24x17 (way under WCAG 2.5.5 44x44 min).
  // Bumped to min-h/min-w 44px and added aria-label so screen readers know
  // what's being copied (the title or "code block" if no title).
  const copyAriaLabel = title ? `copy ${title}` : "copy code";

  return (
    <div className="my-4 rounded-sm border border-[hsl(var(--border))] overflow-hidden">
      {title && (
        <div className="bg-[hsl(var(--bg))] border-b border-[hsl(var(--border))] px-2 py-1 flex items-center justify-between">
          <span className="font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-60 px-2">
            {title}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={copyAriaLabel}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 transition-opacity"
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      )}
      <div className="relative">
        {!title && (
          <button
            type="button"
            onClick={copy}
            aria-label={copyAriaLabel}
            className="absolute top-1 right-1 inline-flex items-center justify-center min-h-[44px] min-w-[44px] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-40 hover:opacity-80 transition-opacity"
          >
            {copied ? "copied" : "copy"}
          </button>
        )}
        <pre className="bg-[hsl(var(--bg))] p-4 font-mono text-[13px] text-[hsl(var(--text-secondary))] leading-relaxed overflow-x-auto">
          {children}
        </pre>
      </div>
    </div>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const colors = {
    info: "border-l-[hsl(var(--accent))] bg-[hsl(var(--accent))/0.05]",
    tip: "border-l-[hsl(var(--success))] bg-[hsl(var(--success))/0.05]",
    warning: "border-l-amber-500 bg-amber-500/5",
  };

  return (
    <div
      className={`border-l-2 ${colors[type]} rounded-r-sm px-4 py-3 my-4 text-[14px] text-[hsl(var(--text-secondary))] leading-relaxed`}
    >
      {children}
    </div>
  );
}

function StepList({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 my-4 list-none">{children}</ol>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px] text-[hsl(var(--text-secondary))] leading-relaxed">
      <span className="shrink-0 w-6 h-6 rounded-sm bg-[hsl(var(--accent))/0.12] text-[hsl(var(--accent))] text-[12px] font-mono flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/* ── Quick-start (30-second guide) ─────────────────────── */
function QuickStart() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const steps: { key: string; cmd: string; desc: string }[] = [
    { key: "install", cmd: "curl -fsSL https://you.md/install.sh | bash", desc: "install the You.md runtime globally" },
    { key: "you", cmd: "you", desc: "build and sync your brain" },
    { key: "stacks", cmd: "you skill use youstack-maintainer", desc: "organize or improve named stacks" },
    { key: "doctor", cmd: "you stack doctor --path stacks/<name>", desc: "check a stack before agents use it" },
    { key: "mcp", cmd: "you mcp --install codex --auto", desc: "wire protected brain access into Codex" },
  ];

  return (
    <div
      className="my-6 border-2 border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/[0.04] overflow-hidden"
      style={{ borderRadius: "var(--radius)" }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/[0.06]">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[hsl(var(--accent))] flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--accent))] status-dot-pulse" />
          30-second guide
        </span>
        <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-60">
          fastest path to first agent read
        </span>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-[hsl(var(--accent))]/15">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3 px-4 py-3">
            <span className="shrink-0 w-5 h-5 rounded-sm bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] text-[11px] font-mono flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="font-mono text-[13px] text-[hsl(var(--accent))] bg-[hsl(var(--bg))] border border-[hsl(var(--border))] px-2 py-0.5 rounded-sm">
                  $ {s.cmd}
                </code>
                <button
                  type="button"
                  onClick={() => copy(s.cmd, s.key)}
                  aria-label={`copy command: ${s.cmd}`}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50 hover:opacity-100 hover:text-[hsl(var(--accent))] transition-colors"
                >
                  {copied === s.key ? "copied" : "copy"}
                </button>
              </div>
              <p className="text-[12px] text-[hsl(var(--text-secondary))] mt-1 leading-relaxed">
                {s.desc}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Resulting URL */}
      <div className="px-4 py-3 border-t border-[hsl(var(--accent))]/30 bg-[hsl(var(--bg))]/40">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-50 mb-1">
          you ship at
        </p>
        <p className="font-mono text-[13px] text-[hsl(var(--accent))]">
          https://you.md/&lt;your-username&gt;
        </p>
      </div>
    </div>
  );
}

function CommandTable({
  commands,
}: {
  commands: { cmd: string; desc: string }[];
}) {
  return (
    <div className="my-4 border border-[hsl(var(--border))] rounded-sm overflow-hidden">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
            <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Command
            </th>
            <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {commands.map(({ cmd, desc }, i) => (
            <tr
              key={cmd}
              className={
                i < commands.length - 1
                  ? "border-b border-[hsl(var(--border))]"
                  : ""
              }
            >
              <td className="px-4 py-2.5 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap">
                {cmd}
              </td>
              <td className="px-4 py-2.5 text-[14px] text-[hsl(var(--text-secondary))]">
                {desc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SystemPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-5 border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] overflow-hidden rounded-sm">
      <div className="flex items-center gap-1.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]/80" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--text-secondary))]/30" />
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--text-secondary))]/20" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-60">
          {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ReferenceStats() {
  const stats = [
    { label: "documented endpoints", value: docsReference.counts.endpoints },
    { label: "local MCP tools", value: docsReference.counts.mcpTools },
    { label: "hosted MCP tools", value: docsReference.counts.hostedMcpTools },
    { label: "CLI commands", value: docsReference.counts.cliCommands },
    { label: "CLI", value: `v${docsReference.cli.version}` },
    { label: "manifest", value: docsReference.sourceHash.slice(0, 8) },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 my-5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 rounded-sm"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-50">
            {stat.label}
          </div>
          <div className="mt-1 font-mono text-[18px] text-[hsl(var(--accent))]">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocsSurfaceMap() {
  const surfaces = [
    {
      label: "Start",
      href: "#getting-started",
      title: "Install + first context read",
      body: "Use the 30-second guide, claim a brain, install the runtime, and smoke-test one agent read before adding complexity.",
    },
    {
      label: "API",
      href: "#api",
      title: "HTTP contracts",
      body: "Generated endpoint inventory, Bearer auth, public profile reads, context links, skills, stacks, docs manifests, and schema discovery.",
    },
    {
      label: "MCP",
      href: "#mcp-server",
      title: "Agent-native tools",
      body: "Local stdio and same-origin JSON-RPC surfaces for identity, project context, memory, section edits, docs, and stack routing.",
    },
    {
      label: "Stacks",
      href: "#youstacks",
      title: "Portable expertise packages",
      body: "Named skills, prompts, workflows, examples, adapter files, evals, update policy, and protected brain scopes.",
    },
    {
      label: "Workflows",
      href: "#agent-workflows",
      title: "How agents should act",
      body: "Golden paths, playbooks, starter prompts, read-before-write rules, post-session capture, and audit trails.",
    },
    {
      label: "Reference",
      href: "#docs-automation",
      title: "Generated docs surfaces",
      body: "Machine-readable docs reference, OpenAPI-style inventory, CLI/MCP manifest generation, and docs drift checks.",
    },
  ];

  return (
    <div id="docs-map" className="my-6 scroll-mt-20">
      <div className="grid gap-2 md:grid-cols-2">
        {surfaces.map((surface) => (
          <Link
            key={surface.label}
            href={surface.href}
            className="group border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4 rounded-sm transition-colors hover:border-[hsl(var(--accent))]/60"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--accent))]">
                {surface.label}
              </span>
              <span className="font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-35 transition-opacity group-hover:opacity-80">
                #
              </span>
            </div>
            <h3 className="mt-2 font-mono text-[14px] text-[hsl(var(--text-primary))]">
              {surface.title}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
              {surface.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DocsStandard() {
  return (
    <SystemPanel title="you.md docs contract">
      <div className="grid gap-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-[hsl(var(--accent))]">
            every capability gets five surfaces
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            {["guide", "api", "mcp", "stack", "smoke"].map((label) => (
              <div
                key={label}
                className="border border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-3 py-2 rounded-sm"
              >
                <span className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <FeatureMatrix
          items={[
            {
              title: "Read before write",
              body: "Agents start with public identity, project context, stack manifest, and capability discovery before requesting private memory or mutations.",
            },
            {
              title: "Route before action",
              body: "Stacks expose capabilities so a host can route intent to the right skill, workflow, prompt, or protected MCP tool instead of guessing.",
            },
            {
              title: "Smallest scoped mutation",
              body: "Memory writes, section edits, stack updates, visibility changes, and connected-tool actions stay narrow, auditable, and approval-aware.",
            },
            {
              title: "Smoke before publish",
              body: "Every public or shared stack needs doctor, smoke, docs, manifest, adapter, and route checks before it becomes someone else's starting context.",
            },
          ]}
        />
      </div>
    </SystemPanel>
  );
}

function FeatureMatrix({
  items,
}: {
  items: { title: string; body: string }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3 my-5">
      {items.map((item) => (
        <div
          key={item.title}
          className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-4 rounded-sm"
        >
          <h4 className="font-mono text-[12px] text-[hsl(var(--text-primary))] mb-2">
            {item.title}
          </h4>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
            {item.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="inline-flex min-w-12 justify-center border border-[hsl(var(--border))] bg-[hsl(var(--bg))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--accent))] rounded-sm">
      {method}
    </span>
  );
}

function EndpointReference({
  categories,
  limit,
}: {
  categories?: string[];
  limit?: number;
}) {
  // Internal/retired routes are excluded at generation time
  // (scripts/generate-docs-reference.mjs INTERNAL_ROUTES), so every endpoint
  // in the manifest is documentable and the published count stays honest.
  const rows = (docsReference.endpoints as readonly DocsEndpoint[])
    .filter((endpoint) => !categories || categories.includes(endpoint.category))
    .slice(0, limit ?? 999);

  return (
    <div className="my-4 overflow-x-auto border border-[hsl(var(--border))] rounded-sm">
      <table className="w-full min-w-[680px] text-[13px]">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Method
            </th>
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Path
            </th>
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Auth
            </th>
            <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--text-secondary))] opacity-60 font-normal">
              Notes
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((endpoint) => (
            <tr key={`${endpoint.method}-${endpoint.path}`} className="border-b border-[hsl(var(--border))]/70 last:border-b-0">
              <td className="px-3 py-2 align-top">
                <MethodBadge method={endpoint.method} />
              </td>
              <td className="px-3 py-2 align-top font-mono text-[12px] text-[hsl(var(--text-primary))] whitespace-nowrap">
                {endpoint.path}
              </td>
              <td className="px-3 py-2 align-top text-[12px] text-[hsl(var(--text-secondary))] whitespace-nowrap">
                {endpoint.auth}
              </td>
              <td className="px-3 py-2 align-top text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
                {endpoint.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function McpToolReference({
  limit,
  names,
}: {
  limit?: number;
  names?: string[];
}) {
  const tools = (docsReference.mcpTools as readonly DocsMcpTool[])
    .filter((tool) => !names || names.includes(tool.name))
    .slice(0, limit ?? 999);

  return (
    <div className="my-4 grid gap-2">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 rounded-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-[hsl(var(--accent))]">
              {tool.name}
            </span>
            {tool.required.length > 0 && (
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
                required: {tool.required.join(", ")}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
            {tool.description}
          </p>
          {tool.inputFields.length > 0 && (
            <p className="mt-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
              input: {tool.inputFields.join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function HostedMcpToolReference() {
  const tools = docsReference.hostedMcpTools as readonly DocsHostedMcpTool[];

  return (
    <div className="my-4 grid gap-2">
      {tools.map((tool) => (
        <div
          key={tool.name}
          className="border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))] p-3 rounded-sm"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-[hsl(var(--accent))]">
              {tool.name}
            </span>
            <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
              {tool.requiresAuth ? "Bearer API key required" : "public"}
            </span>
            {tool.required.length > 0 && (
              <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
                required: {tool.required.join(", ")}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-80">
            {tool.description}
          </p>
          {tool.inputFields.length > 0 && (
            <p className="mt-2 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
              input: {tool.inputFields.join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// CLI command tables generated from the commander registrations in
// cli/src/index.ts (via scripts/generate-docs-reference.mjs), grouped the
// same way as `you --help`. Hand-maintained command tables drift; this
// one fails docs:check when a command is added without regenerating.
function CliCommandReference() {
  const commands = docsReference.cliCommands as readonly DocsCliCommand[];
  const groups: { title: string; rows: { cmd: string; desc: string }[] }[] = [];
  for (const command of commands) {
    let group = groups.find((entry) => entry.title === command.group);
    if (!group) {
      group = { title: command.group, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      cmd: `you ${command.usage}`,
      desc: command.description,
    });
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.title}>
          <P>
            <strong className="text-[hsl(var(--text-primary))]">
              {group.title}
            </strong>
          </P>
          <CommandTable commands={group.rows} />
        </div>
      ))}
    </>
  );
}

/* ── Sidebar ─────────────────────────────────────────────── */

function Sidebar({
  activeId,
  onNav,
}: {
  activeId: string;
  onNav: (id: string) => void;
}) {
  // Wrapper that handles smooth scroll on click while letting middle-click,
  // ctrl+click, and copy-link work like a normal anchor (browser handles those)
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    // Let the browser handle modified clicks (new tab, copy, etc)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNav(id);
    // Update URL hash without jumping (smooth scroll handles the actual scroll)
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <nav aria-label="Documentation table of contents" className="space-y-1">
      {navigation.map((item) => (
        <div key={item.id}>
          <a
            href={`#${item.id}`}
            onClick={(e) => handleClick(e, item.id)}
            aria-current={activeId === item.id ? "location" : undefined}
            className={`block w-full text-left px-3 py-1.5 rounded-sm text-[13px] transition-colors ${
              activeId === item.id
                ? "text-[hsl(var(--accent))] bg-[hsl(var(--accent))/0.08]"
                : "text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-raised))]"
            }`}
          >
            {item.label}
          </a>
          {item.children && (
            <div className="ml-3 mt-0.5 space-y-0.5">
              {item.children.map((child) => (
                <a
                  key={child.id}
                  href={`#${child.id}`}
                  onClick={(e) => handleClick(e, child.id)}
                  aria-current={activeId === child.id ? "location" : undefined}
                  className={`block w-full text-left px-3 py-1 rounded-sm text-[12px] transition-colors ${
                    activeId === child.id
                      ? "text-[hsl(var(--accent))]"
                      : "text-[hsl(var(--text-secondary))] opacity-60 hover:opacity-100 hover:text-[hsl(var(--text-primary))]"
                  }`}
                >
                  {child.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

/* ── Main ────────────────────────────────────────────────── */

export default function DocsContent() {
  const [activeId, setActiveId] = useState("getting-started");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
      setMobileNavOpen(false);
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const allIds = navigation.flatMap((item) => [
      item.id,
      ...(item.children?.map((c) => c.id) ?? []),
    ]);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--bg))]">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))/0.9] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-[hsl(var(--accent))] font-mono text-[13px] tracking-tight hover:opacity-80 transition-opacity">
              you
            </Link>
            <span className="hidden sm:inline text-[13px] text-[hsl(var(--text-secondary))] opacity-50">
              /
            </span>
            <span className="hidden sm:inline text-[13px] text-[hsl(var(--text-primary))]">
              Documentation
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/create"
              className="text-[12px] font-mono text-[hsl(var(--accent))] hover:opacity-80 transition-opacity"
            >
              Get Started
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              aria-label={mobileNavOpen ? "close docs navigation" : "open docs navigation"}
              aria-expanded={mobileNavOpen}
              aria-controls="docs-mobile-nav"
              // Cycle 61: bumped to min-h/min-w 44px for WCAG 2.5.5 / Apple HIG
              // touch target compliance. Was 31x21 (way too small).
              className="md:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 px-3 text-[hsl(var(--text-secondary))] text-[13px] font-mono"
            >
              {mobileNavOpen ? "close" : "menu"}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-[hsl(var(--border))]">
          <div className="sticky top-14 py-8 px-4 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <Sidebar activeId={activeId} onNav={scrollTo} />
          </div>
        </aside>

        {/* Sidebar — mobile overlay */}
        {mobileNavOpen && (
          <div
            id="docs-mobile-nav"
            className="fixed inset-0 top-14 z-40 bg-[hsl(var(--bg))] md:hidden p-6 overflow-y-auto"
          >
            <Sidebar activeId={activeId} onNav={scrollTo} />
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 px-6 md:px-12 py-10 md:py-12">
          <div className="max-w-3xl">
            {/* Page header */}
            <div className="mb-8">
              <p className="text-[12px] font-mono text-[hsl(var(--accent))] mb-2 uppercase tracking-wider">
                Documentation
              </p>
              <H1>you.md</H1>
              <P>
                An MCP where the context is you: your agent brain, named
                expertise stacks, one installable runtime, and protected
                API/MCP for private memory, sync, tokens, and connected tools.
              </P>
            </div>

            <ReferenceStats />
            <DocsSurfaceMap />

            {/* ── 30-second guide (quick-start) ────────────── */}
            <QuickStart />

            {/* ── Getting Started ──────────────────────────── */}
            <H2 id="getting-started">Getting Started</H2>
            <P>
              you.md gives every AI agent the context it should already have:
              your brain, your named expertise stacks, and the protected access
              layer needed for private memory or connected tools.
            </P>

            <Callout type="tip">
              Create an account in seconds. Your data is encrypted and you
              control who sees what.
            </Callout>

            <H3 id="web-quickstart">Web Quickstart</H3>
            <StepList>
              <Step n={1}>
                Sign up at{" "}
                <Link
                  href="/sign-up"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  you.md/sign-up
                </Link>{" "}
                -- takes 30 seconds
              </Step>
              <Step n={2}>
                Pick a username and claim your profile
              </Step>
              <Step n={3}>
                U builds your brain through conversation: identity, preferences,
                memory, projects, and trust rules
              </Step>
              <Step n={4}>
                Open the{" "}
                <Link
                  href="/shell"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  shell
                </Link>
                , type <InlineCode>/stacks</InlineCode> to organize named
                expertise stacks, or <InlineCode>/share</InlineCode> to get a
                scoped context link
              </Step>
            </StepList>

            <H3 id="github-auth">GitHub Sign-In</H3>
            <P>
              You.md supports GitHub OAuth as a zero-friction sign-up and
              sign-in path alongside the default email-code flow. Both methods
              are equally first-class; use whichever fits your workflow.
            </P>
            <StepList>
              <Step n={1}>
                Go to{" "}
                <Link
                  href="/sign-up"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  you.md/sign-up
                </Link>{" "}
                (new user) or{" "}
                <Link
                  href="/sign-in"
                  className="text-[hsl(var(--accent))] hover:opacity-80"
                >
                  you.md/sign-in
                </Link>{" "}
                (returning user) and click{" "}
                <InlineCode>continue with github</InlineCode>
              </Step>
              <Step n={2}>
                Authorize the You.md GitHub app. Requested scopes are{" "}
                <InlineCode>read:user</InlineCode>,{" "}
                <InlineCode>user:email</InlineCode>, and{" "}
                <InlineCode>repo</InlineCode>. The{" "}
                <InlineCode>repo</InlineCode> scope lets You.md create and read
                your private identity repo for stack sync.
              </Step>
              <Step n={3}>
                New accounts land on{" "}
                <InlineCode>/initialize</InlineCode> to run the onboarding boot
                sequence. Returning accounts land directly on{" "}
                <InlineCode>/shell</InlineCode>.
              </Step>
            </StepList>
            <Callout type="info">
              Email-code auth is still available as an alternative. If you
              already have an account via email, GitHub sign-in will link to
              the same account as long as the email addresses match.
            </Callout>

            <H3 id="cli-quickstart">Runtime Quickstart</H3>
            <CodeBlock title="terminal">{`$ curl -fsSL https://you.md/install.sh | bash`}</CodeBlock>
            <StepList>
              <Step n={1}>
                Install the You.md runtime with the curl bootstrapper. The
                installer delivers the CLI, all bundled native skills, and
                auto-configures MCP for any detected agent host (Claude Code,
                Codex, Cursor). The CLI is the helper under the hood for files,
                MCP, smoke checks, host adapters, and sync.
              </Step>
              <Step n={2}>
                Run <InlineCode>you</InlineCode>. U will guide login or setup
                if needed, then build and sync your brain.
              </Step>
              <Step n={3}>
                Type <InlineCode>/stacks</InlineCode> in the shell or ask your
                agent to create a private coding, research, content, or
                BAMFStack-style stack.
              </Step>
              <Step n={4}>
                Run <InlineCode>you stack doctor --path stacks/&lt;name&gt;</InlineCode>{" "}
                before an agent improves, shares, or publishes that stack.
              </Step>
              <Step n={5}>
                Use <InlineCode>you mcp --install codex --auto</InlineCode>{" "}
                when the agent needs protected brain retrieval, tokens, sync,
                or connected tools.
              </Step>
            </StepList>

            {/* ── Core Concepts ───────────────────────────── */}
            <H2 id="core-concepts">Core Concepts</H2>
            <P>
              You.md is easiest to understand as four layers: the brain,
              YouStacks, the runtime, and protected API/MCP. The identity
              protocol still exists under the hood, but it should not be the
              first thing a user has to understand.
            </P>

            <ReferenceStats />

            <H3 id="simple-model">Simple Model</H3>
            <FeatureMatrix
              items={[
                {
                  title: "Brain",
                  body: "Identity, memory, preferences, private context, project context, sources, provenance, and trust rules. This is durable and personal.",
                },
                {
                  title: "Stacks",
                  body: "Named packages of expertise: skills, workflows, prompts, examples, docs, tests, host adapters, improvement policy, and update policy.",
                },
                {
                  title: "Runtime",
                  body: "The curl-installed helper layer that makes Claude Code, Codex, Cursor, and other hosts read the brain, install stacks, run doctor/smoke, and stay updated.",
                },
                {
                  title: "Protected API/MCP",
                  body: "The authenticated boundary for private memory, scoped brain retrieval, tokens, repo sync, connected tools, visibility changes, and sensitive actions.",
                },
              ]}
            />

            <H3 id="identity-protocol">Protocol</H3>
            <P>
              The protocol is the machine-readable format underneath the brain.
              Users should not have to think about it first, but agents and
              builders can rely on it for stable JSON, markdown, context links,
              and schema discovery.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "you-md/v1",
                  body: "The structured JSON contract agents fetch, validate, cache, and reason over. Public responses advertise the schema with a Link header.",
                },
                {
                  title: "Markdown source",
                  body: "Local files in .you/ stay human-editable: profile/about.md, preferences/agent.md, voice/voice.md, directives/agent.md, and project context. Legacy .youmd/ folders are read during migration.",
                },
                {
                  title: "Compiled bundle",
                  body: "The CLI compiles markdown into you.json + you.md, preserves raw preference text, hashes the bundle, and publishes the latest version.",
                },
                {
                  title: "Agent memory",
                  body: "Durable facts, preferences, goals, decisions, and project context can be saved by the user, CLI, web shell, API, or MCP tools.",
                },
              ]}
            />

            <H3 id="open-standard">Open Standard: you-md/v1</H3>
            <P>
              <InlineCode>you-md/v1</InlineCode> is an open, versioned schema
              for portable identity context: the structured document an AI
              agent reads to understand who someone is — identity, current
              focus, projects, values, voice, and agent-interaction
              preferences — before doing work for them. You.md publishes the
              schema as JSON Schema (draft 2020-12) and serves it publicly.
              Anyone can implement it; no account or permission is required.
            </P>
            <CodeBlock title="schema discovery">{`# canonical JSON Schema for the format
GET https://you.md/schema/you-md/v1.json

# every public profile response advertises it
Link: <https://you.md/schema/you-md/v1.json>; rel="describedby"; type="application/schema+json"`}</CodeBlock>
            <P>
              Core sections of a <InlineCode>you-md/v1</InlineCode> document,
              exactly as defined by the published schema (only{" "}
              <InlineCode>schema</InlineCode> and{" "}
              <InlineCode>identity</InlineCode> are required):
            </P>
            <CommandTable
              commands={[
                { cmd: "schema", desc: "required. the literal string 'you-md/v1'" },
                { cmd: "identity", desc: "required. name, tagline, location, and a bio at three detail levels (short / medium / long)" },
                { cmd: "now", desc: "current focus areas plus the date they were last updated" },
                { cmd: "projects", desc: "active projects: name (required), role, status, description, url" },
                { cmd: "values", desc: "core values as short phrases, one per item" },
                { cmd: "links", desc: "map of link name to url (e.g. twitter, github, website)" },
                { cmd: "preferences", desc: "agent preferences (tone, formality, things to avoid) and writing preferences (style, format)" },
                { cmd: "voice", desc: "overall voice summary plus per-platform variations (linkedin, x, blog, ...)" },
                { cmd: "agent_directives", desc: "behavioral instructions: communication style, default stack, current goal, negative prompts" },
                { cmd: "agent_guide", desc: "navigation guide telling agents which fields to read for coding, writing, and research tasks" },
              ]}
            />
            <SystemPanel title="versioning policy">
              <div className="grid gap-3 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]">
                <p>
                  additive within v1: new optional fields may be added over
                  time, but existing v1 fields are never removed, renamed, or
                  repurposed. a document that validates today keeps validating.
                </p>
                <p>
                  extensible by design: the schema sets{" "}
                  <InlineCode>additionalProperties: true</InlineCode>, so
                  implementations can carry their own extra fields without
                  failing validation.
                </p>
                <p>
                  breaking changes go to v2: anything incompatible ships as{" "}
                  <InlineCode>you-md/v2</InlineCode> at a new schema URL, and{" "}
                  <InlineCode>/schema/you-md/v1.json</InlineCode> stays served
                  for existing documents.
                </p>
              </div>
            </SystemPanel>
            <P>To implement the format on your own site or product:</P>
            <StepList>
              <Step n={1}>
                Serve a <InlineCode>you.json</InlineCode> document with{" "}
                <InlineCode>&quot;schema&quot;: &quot;you-md/v1&quot;</InlineCode>{" "}
                and an <InlineCode>identity</InlineCode> object, and validate
                it against the published schema with any JSON Schema validator.
              </Step>
              <Step n={2}>
                Optionally serve a companion <InlineCode>you.md</InlineCode>{" "}
                markdown render of the same content for agents that prefer
                plain text.
              </Step>
              <Step n={3}>
                Advertise the schema on your responses with the{" "}
                <InlineCode>Link ... rel=&quot;describedby&quot;</InlineCode>{" "}
                header shown above so agents can discover and validate the
                format.
              </Step>
            </StepList>
            <Callout type="info">
              honest framing: you-md/v1 is an open schema that You.md publishes
              and invites implementations of. it is versioned and stable — not
              a ratified industry standard, and we do not claim adoption beyond
              what actually ships.
            </Callout>

            <H3 id="brain-architecture">Brain Architecture</H3>
            <P>
              You.md&apos;s brain layer should be intentionally guided by GBrain:
              a shared, durable agent brain that can be read by many hosts
              without leaking the entire private life of the user. The brain is
              not a stack. It is the identity, memory, project context,
              provenance, retrieval policy, and permission layer that stacks can
              safely call into.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "Durable context graph",
                  body: "Profiles, preferences, directives, memories, sources, private notes, projects, and sessions need stable ids, timestamps, provenance, and update history.",
                },
                {
                  title: "Scoped retrieval",
                  body: "Agents should ask for the smallest useful brain scope: public identity, project context, private notes, memories, or connected-tool state.",
                },
                {
                  title: "Local cache + hosted copy",
                  body: "Local files keep agents fast and inspectable. The hosted DB copy keeps context available to links, API, MCP, and web sessions.",
                },
                {
                  title: "Self-improving memory",
                  body: "Usage, corrections, failed recalls, duplicate memories, stale facts, and successful retrievals should become evals and improvement tasks for the brain.",
                },
              ]}
            />

            <H3 id="context-surfaces">Context Surfaces</H3>
            <P>
              The same identity can be consumed through multiple surfaces
              depending on what the receiving agent supports.
            </P>
            <CommandTable
              commands={[
                { cmd: "https://you.md/{username}", desc: "Human-readable public profile with JSON-LD, OG cards, and profile sections" },
                { cmd: "GET /api/v1/profiles?username=", desc: "Public agent-readable JSON or markdown with ETag and schema link headers" },
                { cmd: "GET /ctx/{username}/{token}", desc: "Scoped context link, optionally including private context" },
                { cmd: "you mcp", desc: "Local stdio MCP server for Claude Code, Codex, Cursor, and similar tools" },
                { cmd: "POST /api/v1/mcp", desc: "Same-origin JSON-RPC endpoint for web-capable MCP clients" },
                { cmd: "GET /api/v1/docs/reference", desc: "Machine-readable docs manifest generated from routes and MCP tools" },
                { cmd: "GET /api/v1/docs/openapi.json", desc: "Generated OpenAPI-style inventory for API reference tooling" },
              ]}
            />

            <H3 id="docs-standard">API/MCP/Stack Standard</H3>
            <P>
              You.md docs should match the standard of the best agent-platform
              docs: every important capability needs a human guide, an HTTP
              contract, an MCP surface when agents need it, a local stack/runtime
              path, and a smoke check.
            </P>
            <DocsStandard />
            <CommandTable
              commands={[
                { cmd: "GET /api/v1/docs/reference", desc: "Machine-readable inventory of docs, API routes, MCP tools, CLI metadata, and source hash" },
                { cmd: "GET /api/v1/docs/openapi.json", desc: "OpenAPI-style route inventory for API reference generators and docs agents" },
                { cmd: "GET /api/v1/stacks/capabilities", desc: "Default YouStacks capability map used by products and local agents" },
                { cmd: "POST /api/v1/stacks/route", desc: "Deterministic route scoring for stack capability selection before action" },
                { cmd: "you stack doctor --path stacks/<name>", desc: "Local static readiness check before sharing, improving, or publishing a stack" },
                { cmd: "you stack smoke --path stacks/<name>", desc: "Local runtime smoke test for manifest, docs, adapter, capability, and route health" },
              ]}
            />

            <H3 id="reference-intelligence">Reference Intelligence</H3>
            <P>
              You.md keeps GStack, GBrain, Agent Scripts, and The Library as
              local reference repos and turns upstream changes into reviewable
              tasks. GStack informs YouStacks: installable skills, specialist
              workflows, host adapters, upgrade behavior, QA/review/release
              loops, and local-first magic. GBrain informs the You.md brain:
              durable memory, retrieval, sync, provenance, privacy, and startup
              context. Agent Scripts and The Library sharpen the shared
              scripts, prompts, skills, slash commands, catalogs, and bootstrap
              patterns that make agent stacks easier to start and maintain.
            </P>
            <P>
              Houston&apos;s local workspace also runs a daily reference sync
              automation, so upstream movement becomes a reviewed task queue
              instead of vague inspiration.
            </P>
            <CodeBlock title="daily reference sync">{`npm run references:sync

# outputs:
# project-context/reference-intelligence/LATEST.md
# project-context/reference-intelligence/TASKS.md`}</CodeBlock>
            <Callout type="info">
              The reference repos live in <InlineCode>.reference-repos/</InlineCode>{" "}
              and are ignored by git. The generated task list is a review queue,
              not a mandate: promote only the upstream ideas that make You.md
              simpler, more powerful, or safer.
            </Callout>

            <H3 id="source-of-truth">Source of Truth</H3>
            <SystemPanel title="source map">
              <div className="grid gap-3 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]">
                <p>
                  <InlineCode>convex/</InlineCode> owns the server data model,
                  HTTP routes, auth, memory, context links, activity logs, and
                  MCP JSON-RPC bridge.
                </p>
                <p>
                  <InlineCode>cli/</InlineCode> owns local bundle compilation,
                  the <InlineCode>you</InlineCode> launcher, stdio MCP tools,
                  skills, sync, keys, links, memories, and project context.
                </p>
                <p>
                  <InlineCode>src/app/(app)/docs</InlineCode> owns the human
                  docs, while <InlineCode>src/generated/docs-reference.ts</InlineCode>{" "}
                  is regenerated from source so endpoint and MCP inventories do
                  not rot quietly.
                </p>
              </div>
            </SystemPanel>

            {/* ── Claude Code Integration ────────────────── */}
            <H2 id="claude-code">Claude Code Integration</H2>
            <P>
              Most you.md users work inside Claude Code, Cursor, or similar AI
              coding tools. Here&apos;s how to use you.md directly from your coding
              environment.
            </P>

            <Callout type="tip">
              The <InlineCode>you</InlineCode> CLI works in any terminal,
              including Claude Code&apos;s shell. Use <InlineCode>you</InlineCode>{" "}
              in a regular terminal for the live U conversation. Non-interactive
              commands work inside your coding agent.
            </Callout>

            <H3 id="cc-setup">Setup</H3>
            <StepList>
              <Step n={1}>
                Open a regular terminal (not inside Claude Code) and run{" "}
                <InlineCode>curl -fsSL https://you.md/install.sh | bash</InlineCode>{" "}
                once, then <InlineCode>you</InlineCode> to let U guide login,
                pull, or identity setup
              </Step>
              <Step n={2}>
                Run <InlineCode>you login</InlineCode> to authenticate
              </Step>
              <Step n={3}>
                Run <InlineCode>you push</InlineCode> to publish your profile
              </Step>
              <Step n={4}>
                Now switch to Claude Code — all non-interactive commands work
                from here
              </Step>
            </StepList>

            <H3 id="cc-commands">Commands That Work Inside Claude Code</H3>
            <P>
              These commands are non-interactive and work perfectly in Claude
              Code, Cursor, Copilot, and any AI coding tool:
            </P>
            <CommandTable
              commands={[
                { cmd: "you status", desc: "Check your bundle status and version" },
                { cmd: "you whoami", desc: "See who you're logged in as" },
                { cmd: "you pull", desc: "Download your profile from cloud" },
                { cmd: "you push", desc: "Upload local changes and publish" },
                { cmd: "you sync", desc: "Pull + push in one command" },
                { cmd: "you private", desc: "View your private context" },
                { cmd: "you private notes append \"text\"", desc: "Add to private notes" },
                { cmd: "you private projects add name desc", desc: "Add a private project" },
                { cmd: "you memories list", desc: "See saved memories" },
                { cmd: "you memories add fact \"content\"", desc: "Add a memory manually" },
                { cmd: "you link create", desc: "Create a shareable context link" },
                { cmd: "you keys list", desc: "List your API keys" },
                { cmd: "you build", desc: "Compile local bundle" },
                { cmd: "you publish", desc: "Publish to you.md" },
              ]}
            />
            <Callout type="info">
              <InlineCode>you</InlineCode> and <InlineCode>you init</InlineCode>{" "}
              are interactive and need a regular terminal. Run those first, then
              switch to Claude Code for everything else.
            </Callout>

            <H3 id="cc-workflow">Recommended Workflow</H3>
            <P>
              The most powerful workflow: let your coding agent update your
              brain context as you work together.
            </P>
            <StepList>
              <Step n={1}>
                Tell Claude Code: &quot;add my preference for terminal-native UI to
                my you.md private context&quot; — it can run{" "}
                <InlineCode>
                  you private notes append &quot;prefers terminal-native UI&quot;
                </InlineCode>
              </Step>
              <Step n={2}>
                After a coding session, tell your agent: &quot;extract any
                preferences or facts about me from this conversation and save
                them to my you.md&quot; — it can run{" "}
                <InlineCode>you memories add</InlineCode> commands
              </Step>
              <Step n={3}>
                Edit your <InlineCode>.you/</InlineCode> files directly (they&apos;re
                just markdown) and run{" "}
                <InlineCode>you push</InlineCode> to sync
              </Step>
              <Step n={4}>
                Use <InlineCode>you sync --watch</InlineCode> in a regular
                terminal to auto-push on every file save
              </Step>
              <Step n={5}>
                Share your context with any new agent:{" "}
                <InlineCode>you link create</InlineCode> generates a URL you
                can paste into any AI conversation
              </Step>
            </StepList>
            <P>
              Your identity stays up to date across every tool. Every agent
              knows who you are from the first message.
            </P>

            {/* ── Share ────────────────────────────────────── */}
            <H2 id="share">Share Your Brain</H2>
            <P>
              The core feature. Once your public brain is built, share it with any AI
              agent in seconds. The <InlineCode>/share</InlineCode> command works
              in both the web shell and the CLI.
            </P>

            <H3 id="share-command">/share Command</H3>
            <P>
              Type <InlineCode>/share</InlineCode> in either the web shell
              terminal or inside <InlineCode>you</InlineCode> on the CLI.
              Both generate the same copyable block:
            </P>
            <CodeBlock title="output">{`> /share

--- BEGIN YOU.MD CONTEXT ---
name: Houston Golden
role: Founder & builder
projects: you.md, ...
values: ship fast, build in public
preferences: terminal-native, monochrome
--- END YOU.MD CONTEXT ---

[copied to clipboard]`}</CodeBlock>
            <P>
              Paste this into any AI conversation -- Claude, ChatGPT, Cursor,
              Copilot, or any agent. It instantly knows your bio, projects,
              values, and preferences.
            </P>
            <P>
              Use <InlineCode>/share --private</InlineCode> to include your
              private layer (contact info, internal notes, sensitive
              preferences). Only share this with agents you trust.
            </P>

            <H3 id="context-links">Context Links</H3>
            <P>
              Shareable context links look like{" "}
              <InlineCode>https://www.you.md/ctx/[username]/[token]</InlineCode>.
              Any agent can fetch that scoped URL directly to load your context
              into its conversation.
            </P>

            {/* ── Sync ─────────────────────────────────────── */}
            <H2 id="sync">Sync</H2>
            <P>
              You.md works across web and CLI. Create your profile on either
              platform and keep them in sync.
            </P>

            <H3 id="web-cli-sync">Connecting Web + CLI</H3>
            <P>
              The CLI uses the same email and verification-code flow as the web
              app -- no separate API token needed for your own account.
            </P>
            <StepList>
              <Step n={1}>Create your profile on either web or CLI</Step>
              <Step n={2}>
                <InlineCode>you login</InlineCode> -- press Enter to open
                browser sign-in, or type the same email you use on the web and
                paste the verification code in-terminal
              </Step>
              <Step n={3}>
                <InlineCode>you pull</InlineCode> downloads your web profile to
                local files
              </Step>
              <Step n={4}>Edit files in any editor (Cursor, Obsidian, VS Code)</Step>
              <Step n={5}>
                <InlineCode>you push</InlineCode> compiles and publishes back
                to you.md
              </Step>
              <Step n={6}>
                <InlineCode>you sync --watch</InlineCode> auto-syncs on every
                file save
              </Step>
            </StepList>
            <Callout type="tip">
              API keys are for giving OTHER agents and apps access to your data,
              not for authenticating yourself. Your own CLI uses passwordless email-code auth.
            </Callout>

            <H3 id="file-structure">Local File Structure</H3>
            <CodeBlock title=".you/">{`.you/
  profile/
    about.md
    now.md
    projects.md
    values.md
    links.md
  preferences/
    agent.md
    writing.md
  voice/
    voice.md
    voice.linkedin.md
  you.json
  you.md
  manifest.json`}</CodeBlock>

            {/* ── Sync Across Machines ─────────────────────── */}
            <H2 id="sync-across-machines">Sync Across Machines</H2>
            <P>
              You.md is designed to follow you across every machine you work on.
              Four distinct sync planes cover everything: your identity, your
              secrets, your skills, and your named stacks. Each plane uses the
              right transport for its sensitivity level.
            </P>

            <H3 id="sync-planes">Four Sync Planes</H3>
            <div className="my-4 border border-[hsl(var(--border))] rounded-sm overflow-hidden">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--bg))]">
                    <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">Plane</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">What it covers</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[12px] text-[hsl(var(--text-secondary))] opacity-60 font-normal">How</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap align-top">Identity</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">Profile, preferences, project-context, memory, directives</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">
                      <InlineCode>you sync</InlineCode> (Convex-backed).
                      Supports <InlineCode>--watch</InlineCode> for continuous
                      auto-push on file saves.
                    </td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap align-top">Secrets</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">All <InlineCode>.env.local</InlineCode> files across your projects</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">
                      Encrypted vault.{" "}
                      <InlineCode>you env backup</InlineCode> walks a root
                      directory, encrypts every <InlineCode>.env.local</InlineCode>{" "}
                      into one openssl-encrypted portable file plus a
                      values-free manifest.{" "}
                      <InlineCode>you env backup --preflight</InlineCode>{" "}
                      checks readiness without writing a vault. Secrets never
                      auto-sync over the network — you carry the vault (AirDrop, USB, secure
                      cloud file) and restore on the new machine with{" "}
                      <InlineCode>you env restore &lt;vault&gt; --list</InlineCode>{" "}
                      first, then <InlineCode>you env restore &lt;vault&gt;</InlineCode>,
                      which decrypts and writes each file back after the
                      secret-safe list step passes.
                    </td>
                  </tr>
                  <tr className="border-b border-[hsl(var(--border))]">
                    <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap align-top">Skills</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">Authored agent skills and the shared agent layer (<InlineCode>~/.agent-shared</InlineCode>)</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">
                      Private git repo, synced by{" "}
                      <InlineCode>you stack sync</InlineCode>. A background
                      daemon (<InlineCode>you stack daemon install</InlineCode>)
                      runs via launchd every ~5 minutes — it auto-commits local
                      changes and pulls remote changes so editing a skill on
                      one machine updates the others.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-[13px] text-[hsl(var(--accent))] whitespace-nowrap align-top">Stacks</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">Named YouStacks and skill stacks</td>
                    <td className="px-4 py-3 text-[13px] text-[hsl(var(--text-secondary))] align-top">
                      Each stack syncs via its own git remote. The resident
                      runtime covers stacks that are part of the shared agent
                      layer and runs a slower project-context sync for
                      AGENTS/CLAUDE/project-context files; standalone stacks
                      use their configured remote.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <H3 id="sync-new-machine">Set Up a New Machine</H3>
            <P>
              From the You.md dashboard, ask the shell for{" "}
              <InlineCode>/new computer</InlineCode>. It mints a short-lived
              bootstrap key and returns one copyable command for Claude Code or
              Codex on the fresh machine. Terminal-only users can generate the
              same runbook with <InlineCode>you machine prompt</InlineCode>.
            </P>
            <CodeBlock title="new machine setup">{`# Web shell
/new computer

# CLI-only
you machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80

# Bounded proof run before cloning the full set
you machine prompt --root /tmp/you-clean-host-CODE_YOU --days 30 --limit 80 --max-clone-projects 2`}</CodeBlock>
            <P>
              The generated command installs You.md, authenticates, pulls and
              syncs your identity bundle, restores shared skills/stacks/agent
              host config, hydrates the portfolio graph from You.md and GitHub,
              creates <InlineCode>~/Desktop/CODE_YOU</InlineCode>, clones truly
              active 30-day project repos first, asks before expanding to the
              active 90-day project set, checks env-vault readiness, optionally lists and
              restores an encrypted env vault, then rehydrates local
              README/project-context/env-key evidence and syncs a secret-safe
              machine proof report.
              For clean-host proof runs, add{" "}
              <InlineCode>--max-clone-projects</InlineCode> or set{" "}
              <InlineCode>YOU_MAX_CLONE_PROJECTS</InlineCode>; legacy <InlineCode>YOUMD_MAX_CLONE_PROJECTS</InlineCode> still works. Omit it on the
              real new machine to clone the full selected graph-backed set.
            </P>
            <CommandTable
              commands={[
                { cmd: "you stack daemon install", desc: "Register resident identity, skillstack, and project-context sync daemons" },
                { cmd: "you stack daemon status", desc: "Check loaded state, intervals, recent activity, and current warnings" },
                { cmd: "you stack daemon uninstall", desc: "Remove the daemon from launchd without deleting synced files" },
              ]}
            />
            <Callout type="tip">
              The generated prompt may contain a bootstrap API key, so treat it
              as secret-bearing setup material. Raw <InlineCode>.env.local</InlineCode>{" "}
              values are never embedded in the browser prompt; move the
              encrypted env vault separately and restore it locally. Vault list
              mode prints target paths plus variable names/counts only. The
              project-context sync is intentionally context-only: it refuses to
              merge upstream app-code changes.
            </Callout>

            {/* ── CLI ──────────────────────────────────────── */}
            <H2 id="cli">CLI Reference</H2>
            <P>
              Install with{" "}
              <InlineCode>curl -fsSL https://you.md/install.sh | bash</InlineCode>{" "}
              as the recommended path. The curl installer delivers the full
              package in one step: the <InlineCode>you</InlineCode> CLI,
              all bundled native skills, and automatic MCP configuration for
              any detected agent host (Claude Code, Codex, Cursor). Use{" "}
              <InlineCode>npm i -g youmd@latest</InlineCode> only if you
              prefer to manage the binary yourself; you will need to run{" "}
              <InlineCode>you mcp --install &lt;host&gt; --auto</InlineCode>{" "}
              separately. The CLI covers the full identity lifecycle --
              identity, auth, sync, sharing, memory, projects, and skills.
            </P>

            <P>
              The {docsReference.counts.cliCommands} commands below are
              generated from the commander registrations in{" "}
              <InlineCode>cli/src/index.ts</InlineCode> and grouped the same
              way as <InlineCode>you --help</InlineCode>. Namespaces like{" "}
              <InlineCode>skill</InlineCode>, <InlineCode>stack</InlineCode>,{" "}
              <InlineCode>memories</InlineCode>, <InlineCode>private</InlineCode>,{" "}
              <InlineCode>project</InlineCode>, <InlineCode>link</InlineCode>,
              and <InlineCode>keys</InlineCode> take subcommands — run{" "}
              <InlineCode>you &lt;command&gt; --help</InlineCode> for
              per-command options, and see the{" "}
              <a href="#skills-cli" className="text-[hsl(var(--accent))] hover:underline">
                skill subcommand reference
              </a>{" "}
              for the full <InlineCode>you skill ...</InlineCode> surface.
            </P>

            <CliCommandReference />

            <Callout type="info">
              The <InlineCode>init</InlineCode> and <InlineCode>chat</InlineCode>{" "}
              commands are interactive and use a conversational AI agent. They
              need a regular terminal (not inside Claude Code). All other
              commands are non-interactive.
            </Callout>

            {/* ── Skills ──────────────────────────────────── */}
            <H2 id="skills">Skills</H2>
            <P>
              Skills are brain-aware markdown templates that turn your you.md
              brain and stacks into actionable outputs. They use{" "}
              <InlineCode>{"{{var}}"}</InlineCode> interpolation to inject your
              brain data at runtime -- so the output is always personalized
              to you.
            </P>

            <H3 id="skills-overview">Overview</H3>
            <P>
              A skill is a <InlineCode>.md</InlineCode> file with template
              variables. When you run a skill, the CLI resolves each{" "}
              <InlineCode>{"{{var}}"}</InlineCode> against your you.json bundle
              and renders the final output. Skills can generate CLAUDE.md files,
              project scaffolding, cover letters, outreach messages, or anything
              else that benefits from knowing who you are.
            </P>
            <CodeBlock title="example skill template">{`# {{name}}'s Project Context

## Who You Are
{{bio}}

## Your Stack
{{preferences.tools}}

## Communication Style
{{voice.style}}

## Current Focus
{{now}}`}</CodeBlock>
            <P>
              Install skills from the public registry, create your own, or
              publish them for others. The skill system is fully local-first --
              installed skills live in <InlineCode>.you/skills/</InlineCode>{" "}
              and sync with push/pull.
            </P>

            <H3 id="skills-cli">CLI Commands</H3>
            <P>
              The <InlineCode>you skill</InlineCode> namespace has 18 core
              subcommands covering the full skill lifecycle:
            </P>
            <CommandTable
              commands={[
                { cmd: "skill list", desc: "List all installed skills" },
                { cmd: "skill install NAME", desc: "Install from the registry" },
                { cmd: "skill remove NAME", desc: "Uninstall a skill" },
                { cmd: "skill use NAME", desc: "Run a skill -- resolves {{vars}} and outputs the result" },
                { cmd: "skill sync", desc: "Sync installed skills with your cloud bundle" },
                { cmd: "skill create", desc: "Scaffold a new skill template" },
                { cmd: "skill add NAME SOURCE", desc: "Register a new skill in your local catalog" },
                { cmd: "skill push NAME", desc: "Push local skill changes back to their source" },
                { cmd: "skill publish", desc: "Publish to the public registry" },
                { cmd: "skill browse", desc: "Browse available skills in the registry" },
                { cmd: "skill remote NAME", desc: "Preview a remote skill before installing" },
                { cmd: "skill link NAME PATH", desc: "Symlink a local skill for dev iteration" },
                { cmd: "skill init-project", desc: "Bootstrap AGENTS/CLAUDE + project-context/ + .you/ + host links" },
                { cmd: "skill improve NAME", desc: "AI-powered template improvement" },
                { cmd: "skill metrics NAME", desc: "View installs and usage stats" },
                { cmd: "skill search QUERY", desc: "Search registry by keyword" },
                { cmd: "skill export NAME", desc: "Export as standalone markdown" },
                { cmd: "skill info NAME", desc: "Full metadata for an installed skill" },
              ]}
            />

            <H3 id="skills-bundled">Bundled Skills</H3>
            <P>
              Every you.md install ships with eight built-in skills. These are
              always available and kept in sync with CLI updates.
            </P>
            <CommandTable
              commands={[
                { cmd: "youstack-start", desc: "Start local agents with brain context, project state, active requests, installed skills, and next moves" },
                { cmd: "youstack-maintainer", desc: "Organize, update, safely improve, and publish private-by-default named YouStacks" },
                { cmd: "claude-md-generator", desc: "Bootstrap repo-visible agent instructions from your brain -- persona, preferences, coding style, all baked in" },
                { cmd: "project-context-init", desc: "Scaffold a project-context/ directory with TODO.md, FEATURES.md, ARCHITECTURE.md, and more" },
                { cmd: "voice-sync", desc: "Export your voice profile as agent instructions for consistent tone across tools" },
                { cmd: "meta-improve", desc: "Feed a skill back through the LLM to improve its template quality" },
                { cmd: "proactive-context-fill", desc: "Detect thin brain context and propose safe additive improvements" },
                { cmd: "you-logs", desc: "Show recent agent activity and brain access inline" },
              ]}
            />

            <H3 id="skills-init-project">init-project</H3>
            <P>
              The <InlineCode>you skill init-project</InlineCode> command is
              the fastest way to make a repo brain-aware. It sets up four
              things:
            </P>
            <StepList>
              <Step n={1}>
                <InlineCode>AGENTS.md</InlineCode> -- the repo-visible
                instruction layer with workflow rules and your generated
                brain context
              </Step>
              <Step n={2}>
                <InlineCode>CLAUDE.md</InlineCode> -- the Claude-specific
                entrypoint with a managed You.md bootstrap block
              </Step>
              <Step n={3}>
                <InlineCode>project-context/</InlineCode> -- the canonical repo
                context directory, filled additively per file
              </Step>
              <Step n={4}>
                <InlineCode>.you/</InlineCode> plus host-linked skills -- the
                generated additive layer and tool-specific discovery surfaces
              </Step>
            </StepList>
            <CodeBlock title="terminal">{`$ you skill init-project
  install claude-md-generator ready
  install project-context-init ready
  .you/ created AGENT.md, STACK-MAP.md, project-context/README.md
  agent instruction files created AGENTS.md; created CLAUDE.md
  project-context/ created TODO.md, FEATURES.md, CHANGELOG.md, PROMPTS.md ...
  link .claude/skills/youmd/ /path/to/repo/.claude/skills/youmd
  done -- your repo is brain-aware`}</CodeBlock>

            <H3 id="skills-sync">Skill Sync</H3>
            <P>
              Installed skills are stored in your local{" "}
              <InlineCode>.you/skills/</InlineCode> directory and tracked in
              your bundle manifest. When you run{" "}
              <InlineCode>you push</InlineCode>, your skill installs are
              synced to the cloud. When you run{" "}
              <InlineCode>you pull</InlineCode> on another machine, your
              skills come with it.
            </P>
            <P>
              Use <InlineCode>you skill sync</InlineCode> to explicitly
              reconcile local and remote skill state without a full push/pull
              cycle.
            </P>

            {/* ── YouStacks ───────────────────────────────── */}
            <H2 id="youstacks">YouStacks</H2>
            <P>
              A YouStack packages your own expertise and workflows into your
              own stack. Think of Gary Tan creating GStack from years of startup
              operating experience, specialist agents, taste, review loops, and
              workflows. YouStacks let anyone do that for their own domain, and
              you can keep multiple named stacks for different expertise lanes.
            </P>
            <Callout>
              You.md is the brain. A YouStack is the shareable stack built from
              that brain: a named domain package of skills, sub-agents, prompts,
              examples, docs, tool rules, improvement policy, update policy, and
              protected memory boundaries that can be installed into Claude Code,
              Codex, Cursor, shared with a teammate, or published as an open
              stack.
            </Callout>
            <Callout type="tip">
              The user-facing install should be one command:{" "}
              <InlineCode>curl -fsSL https://you.md/install.sh | bash</InlineCode>.
              The <InlineCode>you</InlineCode> binary is the runtime helper
              underneath, not the main product mental model.
            </Callout>

            <H3 id="youstacks-overview">Overview</H3>
            <FeatureMatrix
              items={[
                {
                  title: "A portfolio of named stacks",
                  body: "Keep separate stacks for coding, scientific research, content creation, investing, teaching, or any domain where the skills and workflows should not blur together.",
                },
                {
                  title: "Your expertise, packaged",
                  body: "A stack can contain your domain skills, hard-won instincts, sub-agents, writing taste, engineering review loops, examples, tool rules, and golden prompts.",
                },
                {
                  title: "Works like a personal GStack",
                  body: "Install one stack and any host agent gets the same operating layer: who the expert is, what agents to call, what skills to use, what workflows to run, and what not to touch.",
                },
                {
                  title: "Host-native adapters",
                  body: "Claude Code, Codex, and Cursor are the first targets. OpenClaw, Hermes Agent, and Pi agents come after the first three work.",
                },
                {
                  title: "Private, shared, or public",
                  body: "Stacks default to private. Share with friends or teammates through scoped access, or publish an open version only after redaction, smoke checks, and explicit owner approval.",
                },
                {
                  title: "Native maintainer skill",
                  body: "The bundled youstack-maintainer skill helps agents organize stacks, run smoke checks, keep skills/docs/tests together, and prepare public-readiness diffs.",
                },
              ]}
            />

            <H3 id="youstacks-named">Named Stacks</H3>
            <P>
              A You.md account should be able to own many YouStacks. The
              manifest <InlineCode>name</InlineCode> is the human label, the{" "}
              <InlineCode>slug</InlineCode> is the stable install id, and{" "}
              <InlineCode>domain</InlineCode>, <InlineCode>aliases</InlineCode>,
              and <InlineCode>tags</InlineCode> make the stack discoverable by
              agents and humans.
            </P>
            <CommandTable
              commands={[
                { cmd: "Coding Copilot Stack", desc: "Code review, debugging, architecture, repo startup, tests, release flow, and coding sub-agents" },
                { cmd: "Scientific Research Stack", desc: "Paper triage, source quality, experiment planning, math checks, literature synthesis, and research-memory retrieval" },
                { cmd: "Content Studio Stack", desc: "Voice, hooks, examples, editorial review, repurposing workflows, media prompts, and publishing rules" },
              ]}
            />
            <CodeBlock title="stack portfolio">{`youstacks/
  coding-copilot/
    youstack.json
  scientific-research/
    youstack.json
  content-studio/
    youstack.json`}</CodeBlock>

            <H3 id="youstacks-contents">What Goes In</H3>
            <P>
              A YouStack should feel like an installable version of how you
              operate. The local part carries the reusable expertise. The
              protected part stays behind You.md auth.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "Skills",
                  body: "Reusable expert instructions such as founder review, growth writing, research synthesis, release QA, design critique, or your personal startup office-hours mode.",
                },
                {
                  title: "Sub-agents",
                  body: "Specialists that reflect how you divide work: operator, editor, researcher, reviewer, QA lead, launch planner, security check, or whatever your domain needs.",
                },
                {
                  title: "Workflows",
                  body: "Step-by-step operating loops from your actual playbook: how to start a repo, review a plan, ship a release, write in your voice, prep a meeting, or audit a strategy.",
                },
                {
                  title: "Taste and examples",
                  body: "Golden prompts, before/after examples, decision rules, style notes, quality bars, and the small preferences that make an agent sound and act like it learned from you.",
                },
                {
                  title: "Protected capabilities",
                  body: "Private memories, private context, connected tools, proprietary prompts, and sensitive actions stay behind scoped You.md API/MCP access.",
                },
                {
                  title: "Improvement and update policy",
                  body: "Rules for how the stack learns from usage, failures, corrections, evals, repo diffs, and new source material, plus which local updates can be applied automatically.",
                },
              ]}
            />

            <H3 id="youstacks-improvement">Self-Improving Stacks</H3>
            <P>
              A strong YouStack should not be frozen promptware. Each stack and
              each skill inside it should have an improvement loop: observe how
              agents use it, catch failures, absorb user corrections, run evals,
              update examples, and refresh local adapter files when the manifest
              policy allows it.
            </P>
            <P>
              Self-improving does not mean uncontrolled. The v1 default is:
              propose improvements, auto-apply only safe local file refreshes
              when the manifest allows it, and require approval for private
              context reads, brain writes, connected tools, remote repo writes,
              and visibility changes.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "Autonomous observation",
                  body: "Capture safe signals such as route choices, smoke results, failed workflows, repeated edits, user corrections, and repo diffs.",
                },
                {
                  title: "Skill-level refinement",
                  body: "Improve individual skills, sub-agents, prompts, workflows, examples, and docs instead of rewriting the whole stack blindly.",
                },
                {
                  title: "Eval-gated updates",
                  body: "Run stack doctor diagnostics, smoke checks, and stack-specific evals before accepting a new skill version or generated adapter update.",
                },
                {
                  title: "Policy-bound autonomy",
                  body: "Auto-apply only the local updates the manifest permits. Brain writes, private context reads, connected tools, and remote repo writes stay behind scoped approval.",
                },
              ]}
            />

            <H3 id="youstacks-proposals-consent">Proposals + Consent</H3>
            <P>
              Server-generated maintainer proposals and background analysis
              consent are the two human-approval gates that keep the improvement
              loop auditable.
            </P>
            <P>
              Use <InlineCode>you stack proposals</InlineCode> to see
              proposals the server has generated about your stacks — skill
              quality improvements, doc drift, stale adapter files, or
              capability gaps. Review each proposal before anything changes:
            </P>
            <CommandTable
              commands={[
                { cmd: "you stack proposals", desc: "List pending maintainer proposals for your stacks" },
                { cmd: "you stack proposals approve <id>", desc: "Accept a proposal and apply the suggested change locally" },
                { cmd: "you stack proposals reject <id>", desc: "Dismiss a proposal without applying it" },
              ]}
            />
            <P>
              Use <InlineCode>you stack consent</InlineCode> to control
              which background analyses are allowed to run on your data. Scopes
              are narrow and opt-in; none run automatically without your
              explicit grant:
            </P>
            <CommandTable
              commands={[
                { cmd: "you stack consent", desc: "Show current consent grants and available scopes" },
                { cmd: "you stack consent grant journal_mine", desc: "Allow the server to mine your session journal for improvement signals" },
                { cmd: "you stack consent grant consolidate", desc: "Allow background memory consolidation and deduplication" },
                { cmd: "you stack consent grant fleet_aggregate", desc: "Allow anonymized, k-anon-gated contribution to fleet-level aggregate reports" },
                { cmd: "you stack consent revoke <scope>", desc: "Revoke a previously granted consent scope" },
              ]}
            />
            <Callout type="info">
              All three consent scopes are off by default. Revoking a scope
              stops future analysis immediately; it does not delete data
              already aggregated under that scope.
            </Callout>

            <H3 id="youstacks-safety-readiness">Safety and Readiness Contract</H3>
            <P>
              The Jun 2026 reference-intelligence wave sharpened four product
              rules for YouStacks and the protected brain layer: shell-facing
              helpers must be sanitized at use time, local metadata should stay
              local by default, protected reads should report honest readiness,
              and retrieval should fall back before it goes silent.
            </P>
            <P>
              In short: local metadata should stay local by default, protected
              reads should report honest readiness, and retrieval should fall
              back before it goes silent.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "Shell-safe helpers",
                  body: "Generated adapter files, startup helpers, and cached identifiers should be re-sanitized before shell use. Never trust an old cache file just because this runtime wrote it once.",
                },
                {
                  title: "Local-only metadata by default",
                  body: "Repo names, branch names, and other stack/runtime metadata stay local unless a hosted API or MCP surface explicitly documents that it carries them.",
                },
                {
                  title: "Honest readiness states",
                  body: "Protected brain, project-context, and stack-aware reads should distinguish not built, indexing, and ready. An empty answer should mean genuinely empty, not unknown.",
                },
                {
                  title: "Fallback before silence",
                  body: "When richer retrieval stalls, the system should degrade toward narrower search or basic context instead of returning nothing and pretending the context does not exist.",
                },
              ]}
            />

            <H3 id="youstacks-reference-loop">Reference Intelligence Loop</H3>
            <P>
              YouStacks should deliberately follow what works in GStack,
              GBrain, Agent Scripts, and The Library. The loop is: fetch
              upstream repos, inspect the newest commits, map each useful
              pattern to the stack layer, brain layer, docs layer, or runtime
              layer, then create a concrete You.md task only when it improves
              the product.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "GStack -> YouStacks",
                  body: "Borrow local-first skills, host-native adapter files, specialist modes, upgrade flows, doctor diagnostics, smoke checks, eval-first quality gates, and agent workflows.",
                },
                {
                  title: "GBrain -> You.md brain",
                  body: "Borrow durable memory architecture, retrieval hygiene, source/provenance tracking, sync discipline, context extraction, and privacy boundaries.",
                },
                {
                  title: "Agent Scripts -> runtime scripts",
                  body: "Borrow practical agent command layout, shared scripts, lightweight installer ergonomics, and easy-to-inspect local workflow conventions.",
                },
                {
                  title: "The Library -> skill catalogs",
                  body: "Borrow library-style organization for prompts, commands, reusable context, examples, and discoverable bootstrap material.",
                },
                {
                  title: "Usage -> improvement",
                  body: "Use real You.md sessions, user corrections, route misses, failed recalls, repo diffs, and eval results to improve stacks and brain context.",
                },
                {
                  title: "Tasks before code",
                  body: "The monitor writes candidate tasks first so the team can decide what to copy, adapt, defer, or reject before product code changes.",
                },
              ]}
            />
            <CommandTable
              commands={[
                { cmd: "npm run references:sync", desc: "Fetch local GStack, GBrain, Agent Scripts, and The Library reference repos and regenerate reports" },
                { cmd: "Daily You.md Reference Intelligence", desc: "Local Codex automation that runs the reference monitor each morning and reports candidate tasks" },
                { cmd: "project-context/reference-intelligence/LATEST.md", desc: "Latest upstream commit summary and source-linked candidate tasks" },
                { cmd: "project-context/reference-intelligence/TASKS.md", desc: "Review queue for stack, brain, memory, context, API/MCP, and docs improvements" },
              ]}
            />

            <H3 id="youstacks-use-cases">Use Cases</H3>
            <FeatureMatrix
              items={[
                {
                  title: "Domain stack portfolio",
                  body: "Keep coding, scientific research, content creation, and personal operating stacks separate so each agent loads the right skills, examples, sub-agents, and improvement loop.",
                },
                {
                  title: "Personal expertise stack",
                  body: "Package your taste, default prompts, preferred tools, sub-agents, identity, current projects, and memory-safe startup flow so every agent begins like it already knows how you work.",
                },
                {
                  title: "Project operating layer",
                  body: "Make a repo agent-ready with the exact workflows, test commands, review rules, docs, smoke tests, and release rituals an agent should follow.",
                },
                {
                  title: "Team or collaborator stack",
                  body: "Give a teammate, friend, contractor, or client a scoped copy of your operating system without exposing your entire private context or API key surface.",
                },
                {
                  title: "Public/open workflow stack",
                  body: "Publish a useful agent kit: skills, workflows, examples, docs, and adapter files that anyone can inspect, fork, and install.",
                },
                {
                  title: "Protected memory workflow",
                  body: "Keep private memories, sensitive retrieval, proprietary prompts, and connected actions behind authenticated You.md API/MCP instead of dumping them into local files.",
                },
                {
                  title: "Host adapter bootstrap",
                  body: "Generate Claude Code, Codex, and Cursor files from one manifest so the same expertise stack travels across the first product wedge.",
                },
              ]}
            />

            <H3 id="youstacks-runtime">Runtime, Not CLI-First</H3>
            <P>
              Users should not have to understand a CLI before they understand
              YouStacks. The product promise is: run one curl command, then your
              agents can see the You.md runtime, native skills, stack manifests,
              auto-update helper, MCP server, and host adapters. The helper
              commands exist for agents and power users.
            </P>
            <CommandTable
              commands={[
                { cmd: "curl -fsSL https://you.md/install.sh | bash", desc: "Install the You.md runtime, bundled skills, auto-upgrade helper, and stack starter files" },
                { cmd: "curl -fsSL https://you.md/install.sh | YOU_INSTALL_DAEMON=1 bash", desc: "Install the runtime and opt into resident sync on macOS" },
                { cmd: "you stack inspect --path DIR", desc: "Show name, slug, domain, manifest metadata, files, scopes, adapters, and validation warnings" },
                { cmd: "you stack doctor --path DIR", desc: "Run read-only diagnostics for manifest bloat, route drift, stale adapters, update hygiene, and public-readiness gaps" },
                { cmd: "you stack smoke --path DIR", desc: "Run read-only schema, file, checksum, adapter, and capability checks" },
                { cmd: "you stack capabilities --path DIR", desc: "List local and protected capabilities declared by the stack" },
                { cmd: "you stack route --path DIR \"start this repo\"", desc: "Choose the best local capability for a natural-language request" },
                { cmd: "you stack link --path DIR --hosts codex --target .", desc: "Generate host adapter files from the stack manifest" },
                { cmd: "you skill use youstack-maintainer", desc: "Ask the bundled maintainer skill to organize, improve, update, or prep a stack for sharing" },
              ]}
            />
            <CodeBlock title="terminal">{`curl -fsSL https://you.md/install.sh | bash
you stack doctor --path cli/examples/youstack-personal
you stack smoke --path cli/examples/youstack-personal
you stack route --path cli/examples/youstack-personal "search my memories before starting"
you stack link --path cli/examples/youstack-personal --hosts codex --target . --dry-run`}</CodeBlock>

            <H3 id="youstacks-management">Shell And Profile Management</H3>
            <P>
              You.md should expose stack management in the web shell and profile
              the same way it exposes skills, sharing, memory, and agents. Type{" "}
              <InlineCode>/stacks</InlineCode> in the shell to view named stacks,
              their visibility, install command, update policy, and maintainer
              workflow. Public profiles can show only stacks whose manifest is{" "}
              <InlineCode>public-open</InlineCode>; private and scoped stacks stay
              owner-only.
            </P>
            <CommandTable
              commands={[
                { cmd: "/stacks", desc: "Open the stack portfolio pane in the You.md shell" },
                { cmd: "/skill use youstack-maintainer", desc: "Ask the agent to organize, update, or improve a selected stack" },
                { cmd: "make my BAMFStack public", desc: "Agent prepares a public-readiness diff, redaction list, smoke result, and asks for final approval" },
                { cmd: "create a private scientific research stack", desc: "Agent scaffolds a named private stack with skills, workflows, examples, tests, and protected brain scopes" },
              ]}
            />

            <H3 id="youstacks-install-flow">Install Flow</H3>
            <StepList>
              <Step n={1}>
                Install the runtime once with{" "}
                <InlineCode>curl -fsSL https://you.md/install.sh | bash</InlineCode>.
                This installs current You.md source, bundled skills, the
                auto-upgrade helper, and stack diagnostics.
              </Step>
              <Step n={2}>
                Pull, create, or ask U to scaffold a named stack folder that
                contains <InlineCode>youstack.json</InlineCode>, local skills,
                prompts, sub-agents, workflows, docs, examples, and smoke tests.
              </Step>
              <Step n={3}>
                Run <InlineCode>you stack inspect --path DIR</InlineCode> to
                read metadata, declared scopes, adapters, capabilities, and
                warnings before trusting the package.
              </Step>
              <Step n={4}>
                Run <InlineCode>you stack smoke --path DIR</InlineCode>. This
                is read-only: it validates schema, required files, checksums,
                adapters, and capability declarations without touching the brain.
              </Step>
              <Step n={5}>
                Generate host-native files with{" "}
                <InlineCode>you stack link --path DIR --hosts codex,claude,cursor --target .</InlineCode>.
                Use <InlineCode>--dry-run</InlineCode> first when installing into
                an existing repo.
              </Step>
              <Step n={6}>
                Start the host agent. It can read local stack files first, then
                use You.md MCP/API only for protected memory, private context,
                sync, grants, connected tools, or server-side actions.
              </Step>
            </StepList>

            <H3 id="youstacks-auto-update">Auto-Update</H3>
            <P>
              The curl installer writes a best-effort auto-upgrade helper at{" "}
              <InlineCode>~/.you/bin/youmd-auto-upgrade</InlineCode>. Host
              adapter files and the <InlineCode>youstack-maintainer</InlineCode>{" "}
              skill can run it quietly before stack work, just like the BAMFStack
              preamble. The helper is throttled by default so it does not rebuild
              on every agent message.
            </P>
            <CodeBlock title="agent preamble">{`if [ -x "$HOME/.you/bin/youmd-auto-upgrade" ]; then
  "$HOME/.you/bin/youmd-auto-upgrade" --quiet || true
fi`}</CodeBlock>

            <H3 id="youstacks-bamfstack">BAMFStack Lighthouse</H3>
            <P>
              BAMFStack should be the first public proof that YouStacks work:
              a shareable, open creator-growth stack with a one-line install,
              local skills, commands, workflow routing, read-only smoke checks,
              docs-quality examples, env-only API key handling, and protected
              API/MCP calls for real product actions.
            </P>
            <FeatureMatrix
              items={[
                {
                  title: "What maps 1:1",
                  body: "Curl install, host-native skills, helper CLI behavior, capability discovery, deterministic route endpoint, doctor diagnostics, smoke test, docs, prompts, and auto-upgrade preamble.",
                },
                {
                  title: "What stays protected",
                  body: "BAMF API keys, private creator data, proprietary prompts, product internals, mutations, and connected actions stay behind env vars and authenticated API/MCP.",
                },
                {
                  title: "What You.md adds",
                  body: "Named stack metadata, public/private/scoped visibility, You.md brain scopes, profile-hosted discovery, GitHub sync design, and self-improvement policy.",
                },
              ]}
            />
            <CodeBlock title="public example">{`you stack inspect --path cli/examples/youstack-bamfstack-public
you stack doctor --path cli/examples/youstack-bamfstack-public
you stack smoke --path cli/examples/youstack-bamfstack-public
you stack route --path cli/examples/youstack-bamfstack-public "draft a creator post from research"`}</CodeBlock>

            <H3 id="youstacks-manifest">Manifest</H3>
            <P>
              The v1 manifest is <InlineCode>youstack.json</InlineCode>. It
              declares package metadata, local files, requested brain scopes,
              host adapters, capabilities, access policy, sharing modes, repo
              sync metadata, docs, and smoke tests.
            </P>
            <CodeBlock title="youstack.json">{`{
  "schemaVersion": "youstack/v1",
  "kind": "youstack",
  "slug": "founder-growth-stack",
  "name": "Founder Growth Stack",
  "domain": "growth",
  "aliases": ["content", "linkedin", "founder-led-growth"],
  "tags": ["content", "growth", "founder-review"],
  "version": "0.1.0",
  "visibility": "private",
  "brainScopes": [
    {
      "scope": "identity.public.read",
      "required": true,
      "reason": "Introduce the user to the host agent."
    }
  ],
  "files": [
    {
      "path": "skills/founder-review/SKILL.md",
      "type": "skill",
      "required": true
    },
    {
      "path": "subagents/operator.md",
      "type": "subagent",
      "required": true
    },
    {
      "path": "workflows/growth-writing.md",
      "type": "workflow",
      "required": true
    }
  ],
  "capabilities": [
    {
      "id": "founder-review",
      "intent": "Review a plan using the user's founder taste and operating rules.",
      "localOnly": true,
      "mutationPolicy": "read_only"
    }
  ],
  "accessPolicy": {
    "defaultMode": "local_static",
    "protectedByDefault": true
  },
  "improvement": {
    "mode": "propose",
    "cadence": "after meaningful agent sessions",
    "signals": ["usage", "failures", "user corrections", "repo diffs"],
    "evals": ["you stack smoke", "golden prompt regression checks"],
    "appliesTo": ["skills", "subagents", "workflows", "examples", "docs"],
    "approvalRequiredFor": ["brain.write", "private_context.read", "connected_tool.write", "remote_repo.write"]
  },
  "update": {
    "channel": "manual",
    "check": "you stack smoke",
    "source": "user-owned GitHub repo or local stack folder",
    "autoApply": false
  }
}`}</CodeBlock>

            <H3 id="youstacks-examples">Examples</H3>
            <P>
              A personal stack is the closest mental model: build your own
              GStack from your expertise, workflows, sub-agents, examples, and
              taste; name separate versions for different domains; install them
              into the agents you already use; and let protected requests cross
              the You.md brain boundary only when needed.
            </P>
            <CodeBlock title="named domain stacks">{`# coding stack
you stack inspect --path stacks/coding-copilot

# scientific research stack
you stack route --path stacks/scientific-research "triage these papers and design the next experiment"

# content stack
you stack route --path stacks/content-studio "turn this idea into a LinkedIn post in my style"`}</CodeBlock>
<CodeBlock title="BAMFStack lighthouse">{`# open public stack example
you stack inspect --path cli/examples/youstack-bamfstack-public
you stack doctor --path cli/examples/youstack-bamfstack-public
you stack smoke --path cli/examples/youstack-bamfstack-public

# public install surface stays curl-first
curl -fsSL https://you.md/install.sh | bash

# host agents use the maintainer skill for safe updates
you skill use youstack-maintainer`}</CodeBlock>
            <CodeBlock title="personal stack">{`# inspect what a stack asks for
you stack inspect --path stacks/my-founder-stack

# verify it without writing adapter files
you stack smoke --path stacks/my-founder-stack

# ask the deterministic router which capability should handle a request
you stack route --path stacks/my-founder-stack "review this like me before we ship"

# link the same stack into Codex, Claude Code, and Cursor
you stack link --path stacks/my-founder-stack --hosts codex,claude,cursor --target .`}</CodeBlock>
            <P>
              A public stack can expose the reusable agent kit while protected
              capabilities still require authentication.
            </P>
            <CodeBlock title="capability boundary">{`{
  "id": "review-release",
  "intent": "Run the repo release review workflow before landing changes.",
  "localOnly": true,
  "mutationPolicy": "read_only",
  "triggers": ["review", "ship", "release", "qa"],
  "entrypoint": "workflows/release-review.md"
},
{
  "id": "skill-improvement-loop",
  "intent": "Improve stack skills from failures, user corrections, eval results, and updated examples.",
  "localOnly": true,
  "mutationPolicy": "write_local",
  "entrypoint": "improvement/skill-loop.md"
},
{
  "id": "protected-memory-search",
  "intent": "Search private user memory when local files are not enough.",
  "localOnly": false,
  "requiresAuth": true,
  "scopes": ["memories.search"],
  "mutationPolicy": "read_only"
}`}</CodeBlock>

            <H3 id="youstacks-threshold">API/MCP Threshold</H3>
            <P>
              Local-only stacks can ship names, slugs, domains, static skills,
              sub-agents, workflows, prompts, docs, examples, evals,
              improvement proposals, host adapter files, and read-only route
              tables. Use shared You.md API/MCP when the stack needs protected brain
              retrieval, private context, stack grants, sync, audit logs,
              connected tools, or server-side actions. Custom per-stack API/MCP
              is optional later, not the v1 baseline.
            </P>
            <SystemPanel title="stack boundary rule">
              <StepList>
                <Step n={1}>Static names, domains, skills, sub-agents, prompts, workflows, examples, docs, taste rules, evals, improvement proposals, and adapter files can live inside the stack.</Step>
                <Step n={2}>Identity summaries and public context can be read from local files or public You.md surfaces.</Step>
                <Step n={3}>Private memory, private context, hosted improvement telemetry, tokens, connected tools, sync, and sensitive actions call shared You.md API/MCP.</Step>
                <Step n={4}>Custom per-stack API/MCP is optional later. V1 does not require a custom backend for every stack.</Step>
              </StepList>
            </SystemPanel>

            <H3 id="youstacks-api-mcp">API + MCP</H3>
            <P>
              The shared HTTP endpoints let products and agents inspect the
              default capability contract and route a request against either
              that default contract or manifest-supplied capabilities.
            </P>
            <EndpointReference categories={["YouStacks"]} />
            <CodeBlock title="HTTP">{`GET /api/v1/stacks/capabilities

POST /api/v1/stacks/route
Content-Type: application/json

{
  "request": "review this like me before we ship",
  "stack": {
    "slug": "founder-growth-stack",
    "name": "Founder Growth Stack",
    "domain": "growth",
    "tags": ["content", "founder-review"]
  },
  "capabilities": [
    {
      "id": "founder-review",
      "intent": "Review a plan using the user's founder taste.",
      "localOnly": true,
      "requiresAuth": false,
      "scopes": []
    }
  ]
}`}</CodeBlock>
            <P>
              The local MCP server exposes stack-native tools so Claude Code,
              Codex, Cursor, and similar hosts can inspect and validate a stack
              before using it.
            </P>
            <McpToolReference
              names={[
                "get_stack_manifest",
                "get_stack_capabilities",
                "route_stack_request",
                "smoke_stack",
              ]}
            />

            {/* ── Agent Directives ───────────────────────────── */}
            <H2 id="directives">Agent Directives</H2>
            <P>
              Directives are instructions embedded in your you.md brain that
              tell AI agents how to behave when working with you. They live in
              your preferences layer and are included in every context share.
            </P>
            <P>
              Unlike skills (which are templates you run), directives are
              passive -- they ride along with your brain and shape how agents
              respond to you. Think of them as persistent system prompts keyed
              to your preferences.
            </P>
            <CodeBlock title=".you/preferences/agent.md">{`# Agent Directives

## Tone
Direct and concise. No filler. No corporate speak.

## Code Style
Prefer functional patterns. Use TypeScript strict mode.
Never add comments that restate the code.

## Workflow
Act decisively -- don't ask permission for obvious next steps.
Show progress, don't go silent.
Address every part of multi-part messages.`}</CodeBlock>
            <P>
              When an agent reads your context (via{" "}
              <InlineCode>/share</InlineCode>, a context link, or the API), your
              directives are included automatically. Any agent that respects
              your you.md will follow them.
            </P>

            {/* ── Agent Workflows ─────────────────────────── */}
            <H2 id="agent-workflows">Agent Workflows</H2>
            <P>
              The strongest You.md workflow is continuous context maintenance:
              the agent reads who you are, does the work, then saves the durable
              things it learned so the next agent starts smarter.
            </P>

            <H3 id="workflow-golden-path">Golden Path</H3>
            <StepList>
              <Step n={1}>
                Orient with <InlineCode>whoami</InlineCode> or{" "}
                <InlineCode>GET /api/v1/profiles?username=...</InlineCode>
              </Step>
              <Step n={2}>
                For local coding agents, call <InlineCode>get_agent_brief</InlineCode>{" "}
                to load identity, repo instructions, active requests, TODOs,
                installed skills, and the next move in one shot
              </Step>
              <Step n={3}>
                Pull the full context only when needed with{" "}
                <InlineCode>get_identity</InlineCode>, a context link, or{" "}
                <InlineCode>you pull</InlineCode>
              </Step>
              <Step n={4}>
                Check project context before substantial work with{" "}
                <InlineCode>get_project_context</InlineCode> or{" "}
                <InlineCode>you project show</InlineCode>
              </Step>
              <Step n={5}>
                Mutate only the smallest durable layer: memory, project memory,
                one identity section, one skill, or one source
              </Step>
              <Step n={6}>
                Compile and publish with <InlineCode>compile_and_push</InlineCode>{" "}
                or <InlineCode>you push</InlineCode> when the user wants the
                change live
              </Step>
              <Step n={7}>
                Leave an activity trail through MCP/API so the user can see
                which agents read, wrote, or published context
              </Step>
            </StepList>

            <H3 id="playbooks">Playbooks</H3>
            <FeatureMatrix
              items={[
                {
                  title: "New coding repo",
                  body: "Run you skill init-project, add a managed AGENTS/CLAUDE bootstrap, create project-context files, then save decisions as project memory.",
                },
                {
                  title: "New agent handoff",
                  body: "Create a scoped context link, paste it into the agent, and ask the agent to confirm what it received plus how it will use it.",
                },
                {
                  title: "Post-session capture",
                  body: "Ask the agent to extract preferences, decisions, projects, and durable facts from the session, then save them via memories or section edits.",
                },
                {
                  title: "Identity cleanup",
                  body: "Use get_section/update_section for one file at a time, compile locally, inspect the diff, then publish. No giant mystery rewrite.",
                },
              ]}
            />

            <H3 id="examples">Examples</H3>
            <CodeBlock title="Claude Code / Codex starter prompt">{`Read my You.md context first.

Use the fastest available path:
1. call the youmd MCP whoami tool if available
2. call get_agent_brief to load identity + local project state
3. if you need full detail, call get_identity
4. before editing this repo, read project-context/
5. when you learn a durable preference or decision, save it back with add_memory or add_project_memory

Then continue with the actual task.`}</CodeBlock>
            <CodeBlock title="terminal">{`# Install the local agent surface
curl -fsSL https://you.md/install.sh | bash

# Wire MCP into an agent host
you mcp --install claude --auto
you mcp --install codex --auto
you mcp --install cursor --auto

# Smoke-test brain access
you whoami
you mcp --json`}</CodeBlock>

            <H3 id="agent-docs">Agent Docs</H3>
            <P>
              You.md now exposes root-level agent docs so a coding agent can
              discover the platform before crawling the app. Treat{" "}
              <InlineCode>/llms.txt</InlineCode> as the short index and{" "}
              <InlineCode>/llms-full.txt</InlineCode> as the full context pack
              for docs, API, MCP, runtime, stack routing, and smoke checks. Both
              files are generated from the shipped docs reference and upstream
              reference-intelligence state.
            </P>
            <P>
              Source-repo agents get the same handoff in{" "}
              <InlineCode>README.md</InlineCode>,{" "}
              <InlineCode>AGENTS.md</InlineCode>, and{" "}
              <InlineCode>CLAUDE.md</InlineCode>. Keep those files aligned with
              the generated root docs so GitHub, npm, local coding agents, and
              web-capable agents all start from the same API/MCP/stack map.
            </P>
            <CommandTable
              commands={[
                { cmd: "GET /llms.txt", desc: "Short Markdown index for agents: docs, API, MCP, runtime, stacks, privacy, and source links" },
                { cmd: "GET /llms-full.txt", desc: "Full plain-text agent context with order of operations, commands, API/MCP examples, stack rules, and smoke checks" },
                { cmd: "README.md / AGENTS.md / CLAUDE.md", desc: "Repo-visible handoff surfaces for GitHub/npm readers and local coding agents" },
                { cmd: "npm run llms:check", desc: "Verify the root agent docs are current with the generated docs reference and reference-intelligence state" },
                { cmd: "npm run llms:generate", desc: "Regenerate the root agent docs when routes, MCP tools, CLI metadata, or upstream references change" },
                { cmd: "npm run agent-docs:syntax", desc: "Syntax-check the docs generator, root agent-docs generator, live smoke script, and handoff checker" },
                { cmd: "node scripts/check-agent-doc-handoff.mjs", desc: "Assert README, root agent manuals, /docs source, PRD, and architecture docs keep required handoff markers and reject stale stack/auth language" },
                { cmd: "npm run agent-docs:handoff", desc: "Run the handoff marker check with file and marker-count diagnostics" },
                { cmd: "npm run agent-docs:handoff:json", desc: "Emit the handoff marker contract as JSON for automation and CI log parsing" },
                { cmd: "npm run agent-docs:lint", desc: "Run targeted ESLint for generated docs artifacts, docs automation scripts, and the docs page source" },
                { cmd: "npm run llms:smoke -- --base-url https://www.you.md", desc: "Smoke-test live agent docs against the generated docs reference, MCP discovery, robots, sitemap, and docs page" },
                { cmd: "npm run sync:graph:smoke", desc: "Smoke-test the authenticated synced-brain graph REST endpoint and hosted MCP tool with redacted output" },
                { cmd: "npm run sync:agent-stack:smoke", desc: "Smoke-test authenticated agent-stack REST summaries plus hosted MCP tool/resources, including generated HTML and repo snapshots" },
                { cmd: "npm run agent-docs:ci", desc: "Run generated docs checks, required/forbidden handoff marker checks, syntax checks, and targeted lint" },
                { cmd: "GET /api/v1/docs/reference", desc: "Generated manifest for shipped routes, MCP tools, CLI version, counts, and source hash" },
                { cmd: "GET /api/v1/docs/openapi.json", desc: "OpenAPI-style inventory for API reference generators and agent tool builders" },
                { cmd: "GET /.well-known/mcp.json", desc: "MCP discovery metadata for web-capable clients" },
                { cmd: "GET /api/v1/stacks/capabilities", desc: "Default YouStacks capability map for route-before-action workflows" },
              ]}
            />
            <CodeBlock title="agent bootstrap">{`# Fast agent preflight
curl -fsSL https://you.md/llms.txt
curl -fsSL https://you.md/api/v1/docs/reference
curl -fsSL https://you.md/.well-known/mcp.json

# Full docs/context pass
curl -fsSL https://you.md/llms-full.txt

# Release smoke
npm run agent-docs:syntax
npm run agent-docs:handoff
npm run agent-docs:handoff:json
npm run agent-docs:lint
npm run llms:smoke -- --base-url https://www.you.md
npm run sync:graph:smoke
npm run sync:agent-stack:smoke
npm run agent-docs:ci`}</CodeBlock>

            {/* ── API ──────────────────────────────────────── */}
            <H2 id="api">API</H2>
            <P>
              You.md has a first-party HTTP API, same-origin web proxies, a
              JSON Schema, and MCP endpoints for agent-native access. The
              endpoint inventory below is generated from source on every build,
              so it tracks the routes that actually ship.
            </P>
            <ReferenceStats />

            <H3 id="public-endpoints">Public Endpoints</H3>
            <P>
              Public routes are intentionally agent-readable: profile JSON,
              markdown negotiation, schema discovery, MCP discovery, context
              links, auth handshakes, and rate-limited enrichment helpers.
            </P>
            <EndpointReference
              categories={[
                "Public Identity",
                "Context Links",
                "Schema",
                "Auth",
                "MCP",
                "Docs",
                "Chat",
                "Enrichment",
              ]}
            />

            <H3 id="authenticated-endpoints">Authenticated Endpoints</H3>
            <P>
              Include your API key as a Bearer token. Generate keys from the
              shell (<InlineCode>/settings</InlineCode>) or via CLI (
              <InlineCode>you keys create</InlineCode>).
            </P>
            <CodeBlock title="HTTP">{`Authorization: Bearer ym_your_api_key_here
Content-Type: application/json`}</CodeBlock>
            <EndpointReference
              categories={[
                "Account",
                "Memories",
                "Private Context",
                "Activity",
                "Skills",
              ]}
            />

            <H3 id="skills-api">Skills API</H3>
            <P>
              Programmatic access to the skill registry and your installed
              skills. Public endpoints are unauthenticated. Install, usage, and
              publish endpoints require a Bearer token.
            </P>
            <EndpointReference categories={["Skills"]} />

            <H3 id="mcp-server">MCP Server</H3>
            <P>
              You.md ships two MCP surfaces with distinct tool sets: a local
              stdio server through the CLI ({docsReference.counts.mcpTools}{" "}
              tools) and a hosted same-origin JSON-RPC endpoint (
              {docsReference.counts.hostedMcpTools} tools) for clients that can
              speak HTTP. The local server is the power path for Claude Code,
              Codex, Cursor, and similar coding agents.
            </P>
            <CodeBlock title="HTTP">{`# MCP discovery — auto-configure any MCP-compatible client
GET /.well-known/mcp.json

# JSON-RPC 2.0 MCP endpoint
POST /api/v1/mcp
Content-Type: application/json

# Example: list available tools
{ "jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 1 }

# Example: get a user's public identity (username is required)
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_identity",
    "arguments": { "username": "houstongolden" }
  },
  "id": 2
}`}</CodeBlock>
            <P>
              <strong className="text-[hsl(var(--text-primary))]">
                Hosted MCP tools
              </strong>{" "}
              — the {docsReference.counts.hostedMcpTools} tools served by{" "}
              <InlineCode>POST /api/v1/mcp</InlineCode>.{" "}
              <InlineCode>get_identity</InlineCode> and{" "}
              <InlineCode>search_profiles</InlineCode> are public; the rest
              require a Bearer API key.
            </P>
            <HostedMcpToolReference />
            <P>
              The local stdio server also exposes <InlineCode>get_agent_brief</InlineCode>,
              a YouStack startup brief that combines identity, repo instructions,
              active requests, open TODOs, installed skills, and recommended next
              moves for Claude Code, Codex, Cursor, and similar agents.
            </P>
            <P>
              Configure via CLI:
            </P>
            <CodeBlock title="bash">{`npx --yes youmd@latest mcp --install claude --auto
npx --yes youmd@latest mcp --install cursor --auto
you mcp --json               # Print the exact MCP config JSON`}</CodeBlock>
            <P>
              <strong className="text-[hsl(var(--text-primary))]">
                Local stdio MCP tools
              </strong>{" "}
              — all {docsReference.counts.mcpTools} tools served by the local
              runtime:
            </P>
            <McpToolReference />

            <H3 id="schema-reference">Schema</H3>
            <P>
              Public profile responses point to the canonical{" "}
              <InlineCode>you-md/v1</InlineCode> schema with a{" "}
              <InlineCode>Link</InlineCode> header. Agents can validate the
              identity document before caching or mutating it. The format
              itself is an open standard — see{" "}
              <a
                href="#open-standard"
                className="text-[hsl(var(--accent))] hover:opacity-80"
              >
                Open Standard: you-md/v1
              </a>{" "}
              for sections, versioning policy, and how to implement it.
            </P>
            <CodeBlock title="HTTP">{`GET /schema/you-md/v1.json
Accept: application/json

GET /api/v1/profiles?username=houstongolden
Accept: application/vnd.you-md.v1+json`}</CodeBlock>

            <H3 id="docs-automation">Docs Automation</H3>
            <SystemPanel title="docs sync contract">
              <div className="space-y-3 text-[13px] leading-relaxed text-[hsl(var(--text-secondary))]">
                <p>
                  <InlineCode>npm run docs:generate</InlineCode> scans{" "}
                  <InlineCode>convex/http.ts</InlineCode>, Next route files, and{" "}
                  <InlineCode>cli/src/mcp/server.ts</InlineCode>, then writes the
                  generated manifest used by this page.
                </p>
                <p>
                  <InlineCode>npm run build</InlineCode> runs that generator
                  first through <InlineCode>prebuild</InlineCode>, so Vercel
                  deploys refresh API/MCP docs as part of the normal release
                  path.
                </p>
                <p>
                  <InlineCode>GET /api/v1/docs/reference</InlineCode> exposes
                  the same generated manifest for agents, smoke tests, and
                  release checks. <InlineCode>GET /api/v1/docs/openapi.json</InlineCode>{" "}
                  exposes an OpenAPI-style spec for API reference tooling.{" "}
                  <InlineCode>npm run docs:check</InlineCode> fails when the
                  committed generated files are stale.
                </p>
                <p>
                  Counts are honest: {docsReference.counts.internalRoutes}{" "}
                  internal, retired, or webhook-only routes are excluded at
                  generation time and listed (with reasons) under{" "}
                  <InlineCode>internalRoutes</InlineCode> in the docs manifest,
                  so the published endpoint count equals what this page
                  documents.
                </p>
              </div>
            </SystemPanel>

            {/* ── Errors ───────────────────────────────────── */}
            <H2 id="errors-troubleshooting">Errors + Troubleshooting</H2>
            <P>
              You.md keeps errors plain because agents need recoverable
              instructions more than theatrics. HTTP endpoints return JSON with
              an <InlineCode>error</InlineCode> field, context links use explicit
              status codes, and bundle writes return <InlineCode>409</InlineCode>{" "}
              for ancestor mismatches so clients know to pull before pushing.
            </P>
            <CommandTable
              commands={[
                { cmd: "401", desc: "Missing, expired, invalid, or revoked API key. Re-run you login or rotate a key." },
                { cmd: "404", desc: "Profile, context token, bundle version, or local section not found." },
                { cmd: "409 ancestor_mismatch", desc: "Remote bundle changed since your local parent hash. Pull, inspect diff, then push again." },
                { cmd: "413", desc: "Chat or compaction payload is too large for the protected LLM route." },
                { cmd: "429", desc: "Rate limit hit on public chat, research, scraping, enrichment, or per-user compacting." },
                { cmd: "503", desc: "Spend-cap or provider kill switch is active. Retry after the service window resets." },
              ]}
            />
            <CodeBlock title="terminal">{`# Most useful smoke checks
you whoami
you status
you diff
you mcp --json
npm run docs:check`}</CodeBlock>

            {/* ── Privacy ──────────────────────────────────── */}
            <H2 id="privacy">Privacy</H2>
            <P>You.md uses a two-layer privacy model:</P>
            <div className="my-4 space-y-3">
              <div className="flex gap-3 text-[15px] leading-relaxed">
                <span className="shrink-0 text-[hsl(var(--accent))] font-mono text-[13px] mt-0.5">
                  public
                </span>
                <span className="text-[hsl(var(--text-secondary))]">
                  Your bio, role, projects, values, and communication style.
                  Visible to anyone and any agent.
                </span>
              </div>
              <div className="flex gap-3 text-[15px] leading-relaxed">
                <span className="shrink-0 text-[hsl(var(--accent))] font-mono text-[13px] mt-0.5">
                  private
                </span>
                <span className="text-[hsl(var(--text-secondary))]">
                  Contact info, internal notes, sensitive preferences, API keys.
                  Only shared via{" "}
                  <InlineCode>/share --private</InlineCode> or access tokens.
                </span>
              </div>
            </div>
            <P>
              Context links can be generated from the shell with{" "}
              <InlineCode>/share</InlineCode> or from the CLI with{" "}
              <InlineCode>you link create</InlineCode>. API keys can be
              created, revealed, rotated, and revoked from settings or{" "}
              <InlineCode>you keys</InlineCode>.
            </P>
            <Callout type="tip">
              You control what goes into each layer. Nothing is shared without
              your explicit action.
            </Callout>

            {/* ── Telemetry ─────────────────────────────────── */}
            <H2 id="telemetry">Telemetry &amp; Privacy</H2>
            <P>
              You.md collects three categories of telemetry to power the
              self-improving skill loop. Each category has a distinct
              privacy posture:
            </P>
            <div className="my-4 rounded-sm border border-[hsl(var(--border))] bg-[hsl(var(--bg-raised))]">
              <div className="px-4 py-2 border-b border-[hsl(var(--border))] flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-20 mt-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-20 mt-1" />
                <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--text-secondary))] opacity-20 mt-1" />
                <span className="ml-2 text-[11px] font-mono text-[hsl(var(--text-secondary))] opacity-50 uppercase tracking-widest">
                  telemetry categories
                </span>
              </div>
              <div className="divide-y divide-[hsl(var(--border))]">
                <div className="px-4 py-3 flex gap-3 text-[13px]">
                  <span className="shrink-0 font-mono text-[hsl(var(--accent))] w-40">skillEvents / skillOutcomes</span>
                  <span className="text-[hsl(var(--text-secondary))]">
                    Owner-scoped and identifiable. Linked to your account so the improvement loop can surface per-skill success rates, flag low performers, and generate personalised recommendations. Default on for authenticated users.
                  </span>
                </div>
                <div className="px-4 py-3 flex gap-3 text-[13px]">
                  <span className="shrink-0 font-mono text-[hsl(var(--accent))] w-40">consolidationRuns</span>
                  <span className="text-[hsl(var(--text-secondary))]">
                    Per-user metadata (run date, duplicate count, archive count, review-queue size). Identifiable to your account; used only for consolidation health dashboards and rate limiting. Default on for authenticated users.
                  </span>
                </div>
                <div className="px-4 py-3 flex gap-3 text-[13px]">
                  <span className="shrink-0 font-mono text-[hsl(var(--accent))] w-40">fleetReports</span>
                  <span className="text-[hsl(var(--text-secondary))]">
                    Aggregate only. Contains category names and counts — never content strings, usernames, or any per-user identifier. Published only when the cohort meets a k-anonymity threshold of at least 20 users. Never identifiable.
                  </span>
                </div>
              </div>
            </div>
            <P>
              Owner-scoped telemetry (skillEvents, skillOutcomes, consolidationRuns) is on by
              default and linked to your account so the improvement loop works. Fleet telemetry is
              anonymised before aggregation and published only when the k-anonymity threshold
              (k&nbsp;&ge;&nbsp;20) is met, so no individual can be identified from a fleet report.
              Fleet snapshots returned to you show only fleet-wide aggregates respecting the k-anon
              floor of 20 &mdash; your individual usage never appears in any other user&rsquo;s snapshot.
              You can review all telemetry stored against your account from the dashboard under
              Settings &rsaquo; Privacy.
            </P>

            {/* ── Dashboard Commands ────────────────────────── */}
            <H2 id="commands">Dashboard Commands</H2>
            <P>
              The web shell supports the following slash commands:
            </P>
            <CommandTable
              commands={[
                { cmd: "/share", desc: "Create shareable context link (copied to clipboard)" },
                { cmd: "/share --private", desc: "Include private context in the link" },
                { cmd: "/share --project {name}", desc: "Share context scoped to a specific project" },
                { cmd: "/profile", desc: "View your public brain/profile" },
                { cmd: "/portrait", desc: "ASCII portrait editor + format picker" },
                { cmd: "/portrait show", desc: "Render your portrait inline in chat" },
                { cmd: "/portrait --regenerate", desc: "Re-scrape social profiles for a fresh portrait" },
                { cmd: "/edit", desc: "Edit brain context (files, JSON, sources)" },
                { cmd: "/sources", desc: "Manage connected sources (LinkedIn, GitHub, X)" },
                { cmd: "/skills", desc: "Browse and manage installed skills" },
                { cmd: "/skill use {name}", desc: "Activate a skill in this conversation" },
                { cmd: "/publish", desc: "Publish latest changes to your public profile" },
                { cmd: "/preview", desc: "Preview your public profile" },
                { cmd: "/json", desc: "Export identity as raw JSON" },
                { cmd: "/settings", desc: "Account settings, API keys, billing" },
                { cmd: "/tokens", desc: "Manage API access tokens" },
                { cmd: "/agents", desc: "View connected agents and activity" },
                { cmd: "/memory", desc: "Memory summary and stats" },
                { cmd: "/recall", desc: "List recent memories" },
                { cmd: "/recall {query}", desc: "Full-text search across memories" },
                { cmd: "/status", desc: "Bundle status and profile completeness" },
                { cmd: "/help", desc: "Show all available commands" },
              ]}
            />
          </div>
        </main>
      </div>

      {/* Page-level footer landmark (outside main so it gets contentinfo role) */}
      <footer className="max-w-6xl mx-auto px-6 md:px-12 pb-12">
        <div className="md:ml-56 md:pl-12">
          <div className="max-w-2xl border-t border-[hsl(var(--border))] mt-16 pt-8 flex items-center justify-between">
            <span className="text-[12px] text-[hsl(var(--text-secondary))] opacity-40">
              you.md -- agent brain + expertise stacks for the agent internet
            </span>
            <Link
              href="/create"
              className="text-[13px] text-[hsl(var(--accent))] hover:opacity-80 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
