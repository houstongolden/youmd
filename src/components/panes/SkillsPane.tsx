"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@/lib/you-auth";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PaneCallout, PaneSectionLabel, PaneDivider } from "./shared";
import { skillPropagation } from "@/data/portfolioGraph";
import type { Doc } from "../../../convex/_generated/dataModel";
import {
  SyncedBrainGraph,
  type SyncedBrainGraphActivity,
  type SyncedBrainGraphLink,
  type SyncedBrainGraphNode,
  type SyncedBrainGraphSignal,
} from "@/components/sync/SyncedBrainGraph";

interface SkillEntry {
  name: string;
  description: string;
  version: string;
  scope: "shared" | "project" | "private";
  identityFields: string[];
  downloads?: number;
}

type InstalledSkillSummary = {
  skillName: string;
  useCount?: number;
};

type AgentStackInventory = Doc<"agentStackInventories">;
type MachineProofReport = Doc<"machineProofReports">;
type AgentStackDrift = {
  baseline: null | {
    hostName: string;
    rootDir: string;
    generatedAt: number;
    counts: {
      uniqueSkillNames: number;
      uniqueRealSkillFiles: number;
      missingFromYoumdCatalog: number;
      duplicateNameDifferentRealpaths: number;
    };
  };
  summary: {
    machineCount: number;
    driftCount: number;
    staleCount: number;
    unsafeCount: number;
    okCount: number;
  };
  machines: Array<{
    machineKey: string;
    hostName: string;
    rootDir: string;
    status: string;
    stale: boolean;
    issues: string[];
    deltas: {
      uniqueSkillNames: number;
      uniqueRealSkillFiles: number;
      missingFromYoumdCatalog: number;
      duplicateNameDifferentRealpaths: number;
    };
  }>;
  secretValuesExposed: false;
};

type SkillPaneMode = "catalog" | "mesh";

const BUNDLED_SKILLS: SkillEntry[] = [
  {
    name: "youstack-start",
    description: "Start local agents with brain context, project state, active requests, skills, and next moves",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
  },
  {
    name: "youstack-maintainer",
    description: "Organize, update, safely improve, and publish private-by-default YouStacks",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
  },
  {
    name: "machine-bootstrap",
    description: "Set up a fresh computer with identity, skills, stacks, agent config, active projects, and env sanity checks",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["profile.about", "profile.projects", "preferences.agent", "directives.agent"],
  },
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
    description: "Self-improvement protocol — review effectiveness, propose brain updates",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["preferences.agent", "directives.agent"],
  },
  {
    name: "proactive-context-fill",
    description: "Detect thin brain context and offer safe additive improvements",
    version: "1.0.0",
    scope: "shared",
    identityFields: ["profile.projects", "profile.about", "preferences.agent", "voice.overall"],
  },
  {
    name: "portfolio-graph-auditor",
    description: "Audit local projects, APIs, MCPs, env key names, stacks, protected harnesses, dependencies, and reusable patterns",
    version: "0.1.0",
    scope: "shared",
    identityFields: ["profile.projects", "preferences.agent", "directives.agent"],
  },
  {
    name: "you-logs",
    description: "View recent agent activity and brain access logs inline",
    version: "1.0.0",
    scope: "shared",
    identityFields: [],
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
      style={{ borderRadius: "var(--radius)" }}
    >
      {`{{${field}}}`}
    </span>
  );
}

function formatCount(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString()
    : "--";
}

function formatInventoryTime(value: number | undefined) {
  if (!value) return "unknown";
  const diffMs = Date.now() - value;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function numericRollupEntries(rollup: Record<string, unknown> | undefined, limit = 8) {
  if (!rollup) return [];
  return Object.entries(rollup)
    .flatMap(([label, raw]) => {
      const value = typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
      return value === undefined ? [] : [{ label, value }];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function rollupValue(rollup: Record<string, unknown> | undefined, label: string) {
  const raw = rollup?.[label];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function rollupValueIncludes(rollup: Record<string, unknown> | undefined, terms: string[]) {
  if (!rollup) return 0;
  return Object.entries(rollup).reduce((sum, [label, raw]) => {
    if (typeof raw !== "number" || !Number.isFinite(raw)) return sum;
    const normalized = label.toLowerCase();
    return terms.some((term) => normalized.includes(term)) ? sum + raw : sum;
  }, 0);
}

function topRollupLabels(rollup: Record<string, unknown> | undefined, terms: string[], limit = 3) {
  if (!rollup) return [];
  return Object.entries(rollup)
    .flatMap(([label, raw]) => {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return [];
      const normalized = label.toLowerCase();
      return terms.some((term) => normalized.includes(term)) ? [{ label, value: raw }] : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((row) => `${row.label} ${row.value.toLocaleString()}`);
}

function buildSourceGroups(inventory: AgentStackInventory | undefined) {
  if (!inventory) return [];
  const ownership = inventory.ownershipRollup as Record<string, unknown> | undefined;
  const provenance = inventory.provenanceRollup as Record<string, unknown> | undefined;
  const sync = inventory.syncPolicyRollup as Record<string, unknown> | undefined;
  return [
    {
      label: "Houston managed",
      value:
        rollupValue(ownership, "houston-owned-shared") +
        rollupValue(ownership, "houston-owned-science"),
      detail: "canonical shared ops plus SciStack/HubStack/AstroStack skills",
      tone: "ok" as const,
      samples: topRollupLabels(provenance, ["agent-shared", "scistack", "hubstack", "astrostack"]),
    },
    {
      label: "GStack reference",
      value: rollupValue(ownership, "gstack-managed-reference"),
      detail: "local reference stack; catalog as source, do not absorb ownership",
      tone: "accent" as const,
      samples: topRollupLabels(provenance, ["gstack"]),
    },
    {
      label: "Public / upstream",
      value:
        rollupValue(ownership, "external-science-extension") +
        rollupValue(ownership, "public-marketplace-helper") +
        rollupValueIncludes(provenance, ["skills.sh", "clawhub"]),
      detail: "public registries, opt-in upstream extensions, and marketplace helpers",
      tone: "neutral" as const,
      samples: topRollupLabels(provenance, ["skills.sh", "clawhub", "extension", "marketplace"]),
    },
    {
      label: "Runtime/plugin",
      value:
        rollupValue(ownership, "plugin-bundled") +
        rollupValue(ownership, "youmd-catalog-cache"),
      detail: "Codex/OpenAI plugin caches and You.md catalog cache references",
      tone: "neutral" as const,
      samples: topRollupLabels(provenance, ["plugin", "codex", "openai", "you.md"]),
    },
    {
      label: "Needs review",
      value:
        rollupValue(sync, "review-before-sync") +
        rollupValue(ownership, "unknown") +
        rollupValue(ownership, "host-local-or-mirror") +
        inventory.duplicateNameDifferentRealpaths,
      detail: "ambiguous owners, host-local mirrors, and same-name DRY review cases",
      tone: inventory.duplicateNameDifferentRealpaths > 0 ? "warn" as const : "ok" as const,
      samples: [
        ...topRollupLabels(ownership, ["unknown", "host-local", "mirror"]),
        ...(inventory.duplicateNameSamples ?? []).slice(0, 2),
      ].slice(0, 3),
    },
  ];
}

function buildSkillMeshTopology({
  latest,
  sourceGroups,
  proofSummary,
  machineCount,
  secretLeak,
}: {
  latest: AgentStackInventory;
  sourceGroups: ReturnType<typeof buildSourceGroups>;
  proofSummary: { matched: number; missing: number; stale: number; unsafe: number };
  machineCount: number;
  secretLeak: boolean;
}) {
  const groupValue = (label: string) => sourceGroups.find((group) => group.label === label)?.value ?? 0;
  const reviewCount = groupValue("Needs review");
  const hasProofIssues = proofSummary.missing > 0 || proofSummary.stale > 0 || proofSummary.unsafe > 0;
  const hasCatalogGaps = latest.missingFromYoumdCatalog > 0;
  const hasReviewPressure = reviewCount > 0 || latest.duplicateNameDifferentRealpaths > 0;
  const nodes: SyncedBrainGraphNode[] = [
    {
      id: "youmd",
      label: "you.md mesh",
      value: `${latest.uniqueSkillNames.toLocaleString()} skills`,
      detail: `${latest.uniqueRealSkillFiles.toLocaleString()} real files / ${machineCount} trusted machine${machineCount === 1 ? "" : "s"}`,
      x: 50,
      y: 46,
      kind: "shell",
      status: secretLeak ? "warn" : "ready",
      live: !secretLeak,
      tone: secretLeak ? "danger" : "success",
    },
    {
      id: "machines",
      label: "machines",
      value: `${machineCount}`,
      detail: `${latest.hostName} / ${formatInventoryTime(latest.generatedAt)}`,
      x: 16,
      y: 22,
      kind: "machine",
      status: hasProofIssues ? "warn" : "ready",
      live: proofSummary.matched > 0 && !hasProofIssues,
      tone: hasProofIssues ? "accent" : "success",
    },
    {
      id: "houston",
      label: "houston owned",
      value: groupValue("Houston managed").toLocaleString(),
      detail: "canonical shared and science-stack skills stay authoritative",
      x: 82,
      y: 20,
      kind: "agent",
      status: groupValue("Houston managed") > 0 ? "ready" : "idle",
      live: groupValue("Houston managed") > 0,
      tone: "success",
    },
    {
      id: "references",
      label: "references",
      value: (groupValue("GStack reference") + groupValue("Public / upstream")).toLocaleString(),
      detail: "GStack plus public/upstream sources are grouped before promotion",
      x: 82,
      y: 73,
      kind: "agent",
      status: groupValue("GStack reference") + groupValue("Public / upstream") > 0 ? "active" : "idle",
      live: groupValue("GStack reference") + groupValue("Public / upstream") > 0,
      tone: "accent",
    },
    {
      id: "runtime",
      label: "runtime",
      value: groupValue("Runtime/plugin").toLocaleString(),
      detail: "plugin caches and You.md catalog cache are references",
      x: 50,
      y: 84,
      kind: "shell",
      status: groupValue("Runtime/plugin") > 0 ? "ready" : "idle",
      live: groupValue("Runtime/plugin") > 0,
      tone: "muted",
    },
    {
      id: "review",
      label: "review queue",
      value: reviewCount.toLocaleString(),
      detail: "ambiguous owners, mirrors, and duplicate-name DRY cases",
      x: 17,
      y: 73,
      kind: "agent",
      status: hasReviewPressure ? "warn" : "ready",
      live: hasReviewPressure,
      tone: hasReviewPressure ? "accent" : "success",
    },
    {
      id: "catalog",
      label: "catalog",
      value: hasCatalogGaps ? `${latest.missingFromYoumdCatalog.toLocaleString()} gaps` : "clean",
      detail: "what You.md has cataloged versus host-discovered skills",
      x: 50,
      y: 12,
      kind: "shell",
      status: hasCatalogGaps ? "warn" : "ready",
      live: hasCatalogGaps,
      tone: hasCatalogGaps ? "accent" : "success",
    },
  ];
  const links: SyncedBrainGraphLink[] = [
    { from: "machines", to: "youmd", active: machineCount > 0 },
    { from: "houston", to: "youmd", active: groupValue("Houston managed") > 0 },
    { from: "references", to: "youmd", active: groupValue("GStack reference") + groupValue("Public / upstream") > 0 },
    { from: "runtime", to: "youmd", active: groupValue("Runtime/plugin") > 0 },
    { from: "review", to: "youmd", active: hasReviewPressure },
    { from: "catalog", to: "youmd", active: !hasCatalogGaps },
    { from: "houston", to: "review", active: hasReviewPressure },
    { from: "references", to: "catalog", active: hasCatalogGaps },
  ];
  const signals: SyncedBrainGraphSignal[] = [
    { label: "inventory age", value: formatInventoryTime(latest.generatedAt), live: true },
    { label: "trusted machines", value: `${machineCount}`, live: machineCount > 1 },
    { label: "machine proof", value: `${proofSummary.matched}/${machineCount}`, live: proofSummary.matched === machineCount && machineCount > 0 },
    { label: "catalog gaps", value: latest.missingFromYoumdCatalog.toLocaleString(), live: hasCatalogGaps },
    { label: "DRY review", value: latest.duplicateNameDifferentRealpaths.toLocaleString(), live: latest.duplicateNameDifferentRealpaths > 0 },
    { label: "secret exposure", value: secretLeak ? "review" : "none", live: !secretLeak },
  ];
  const latestActivity: SyncedBrainGraphActivity[] = [
    {
      id: `${latest._id}:inventory`,
      source: latest.hostName,
      title: `inventory synced ${formatInventoryTime(latest.generatedAt)}`,
    },
    {
      id: `${latest._id}:source-groups`,
      source: "source groups",
      title: `${groupValue("Houston managed").toLocaleString()} Houston-owned / ${reviewCount.toLocaleString()} review`,
    },
    {
      id: `${latest._id}:proof`,
      source: "machine proof",
      title: `${proofSummary.matched}/${machineCount} inventories have readiness proof`,
    },
  ];
  return { nodes, links, signals, latestActivity };
}

function normalizeMachineKeyPart(value: string | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^~(?=\/|$)/, "")
    .replace(/^\/users\/[^/]+(?=\/|$)/, "")
    .replace(/\/+$/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function machineHostRootKey(row: Pick<AgentStackInventory | MachineProofReport, "hostName" | "rootDir">) {
  return `${normalizeMachineKeyPart(row.hostName)}::${normalizeMachineKeyPart(row.rootDir)}`;
}

function machineProofKeys(row: Pick<AgentStackInventory | MachineProofReport, "machineKey" | "hostName" | "rootDir">) {
  const direct = normalizeMachineKeyPart(row.machineKey);
  const hostRoot = machineHostRootKey(row);
  const keys = new Set<string>([hostRoot]);
  if (direct) {
    keys.add(direct);
    keys.add(direct.replace(/-agent-stack$/, ""));
  }
  return Array.from(keys).filter(Boolean);
}

function machineHostKey(row: Pick<AgentStackInventory | MachineProofReport, "hostName">) {
  return normalizeMachineKeyPart(row.hostName);
}

function buildMachineProofIndexes(machineProofs: MachineProofReport[] | undefined) {
  const byKey = new Map<string, MachineProofReport>();
  const byHost = new Map<string, MachineProofReport>();
  for (const proof of machineProofs ?? []) {
    for (const key of machineProofKeys(proof)) {
      if (!byKey.has(key)) byKey.set(key, proof);
    }
    const hostKey = machineHostKey(proof);
    if (hostKey && !byHost.has(hostKey)) byHost.set(hostKey, proof);
  }
  return { byKey, byHost };
}

function machineProofForInventory(
  inventory: AgentStackInventory,
  proofIndexes: ReturnType<typeof buildMachineProofIndexes>
) {
  for (const key of machineProofKeys(inventory)) {
    const proof = proofIndexes.byKey.get(key);
    if (proof) return proof;
  }
  return proofIndexes.byHost.get(machineHostKey(inventory));
}

function isMachineProofStale(proof: MachineProofReport | undefined) {
  if (!proof) return true;
  return Date.now() - proof.updatedAt > 6 * 60 * 60 * 1000;
}

function MeshMetric({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "accent" | "warn" | "ok" }) {
  const color = tone === "accent"
    ? "text-[hsl(var(--accent))]"
    : tone === "warn"
      ? "text-yellow-500"
      : tone === "ok"
        ? "text-[hsl(var(--success))]"
        : "text-[hsl(var(--text-primary))]";
  return (
    <div className="border-t border-[hsl(var(--border))]/45 pt-2">
      <div className={`font-mono text-[17px] leading-none ${color}`}>{value}</div>
      <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
        {label}
      </div>
    </div>
  );
}

function RollupColumn({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <div>
      <PaneSectionLabel>{title}</PaneSectionLabel>
      <div className="space-y-1.5 font-mono text-[10px]">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 border-t border-[hsl(var(--border))]/35 pt-1.5">
            <span className="min-w-0 flex-1 truncate text-[hsl(var(--text-secondary))] opacity-62">{row.label}</span>
            <span className="text-[hsl(var(--text-primary))] opacity-80">{row.value.toLocaleString()}</span>
          </div>
        )) : (
          <p className="text-[hsl(var(--text-secondary))] opacity-38">no rollup yet</p>
        )}
      </div>
    </div>
  );
}

function SourceGroupPanel({ groups }: { groups: ReturnType<typeof buildSourceGroups> }) {
  return (
    <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PaneSectionLabel>source groups</PaneSectionLabel>
          <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
            Owner-managed vs external references
          </h3>
          <p className="mt-1 max-w-3xl font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-48">
            The mesh keeps Houston-owned canonical skills authoritative, while public/plugin/GStack sources stay grouped as references unless explicitly promoted.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 xl:grid-cols-5">
        {groups.map((group) => {
          const toneClass =
            group.tone === "ok"
              ? "text-[hsl(var(--success))]"
              : group.tone === "warn"
                ? "text-yellow-500"
                : group.tone === "accent"
                  ? "text-[hsl(var(--accent))]"
                  : "text-[hsl(var(--text-primary))]";
          return (
            <div key={group.label} className="min-w-0 border-t border-[hsl(var(--border))]/45 pt-2">
              <div className={`font-mono text-[17px] leading-none ${toneClass}`}>{formatCount(group.value)}</div>
              <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
                {group.label}
              </div>
              <p className="mt-2 min-h-10 font-mono text-[9px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                {group.detail}
              </p>
              {group.samples.length > 0 && (
                <div className="mt-2 space-y-1">
                  {group.samples.map((sample) => (
                    <div key={sample} className="truncate font-mono text-[8.5px] text-[hsl(var(--text-secondary))] opacity-38" title={sample}>
                      {sample}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SkillsSurfaceHeader({
  mode,
  installedCount,
  availableCount,
  totalCount,
  totalUses,
  showAllSkills,
  mcpCopied,
  onInstallMcp,
  onToggleAllSkills,
}: {
  mode: SkillPaneMode;
  installedCount: number;
  availableCount: number;
  totalCount: number;
  totalUses: number;
  showAllSkills: boolean;
  mcpCopied: boolean;
  onInstallMcp: () => void;
  onToggleAllSkills: () => void;
}) {
  return (
    <section className="border-l border-[hsl(var(--accent))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <PaneSectionLabel>{mode === "mesh" ? "skill mesh" : "skills"}</PaneSectionLabel>
          <h2 className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">
            {mode === "mesh" ? "Synced skill topology" : "Identity-aware agent skills"}
          </h2>
          <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
            {mode === "mesh"
              ? "Trusted-machine inventory, source ownership, catalog gaps, DRY review, and proof status from real synced metadata."
              : `Rendered skill templates for local agents. ${installedCount}/${totalCount} installed; ${availableCount} available for the catalog.`}
          </p>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-3 font-mono text-[9px] uppercase tracking-[0.12em]">
          <span className="text-[hsl(var(--success))]">{installedCount} installed</span>
          <span className="text-[hsl(var(--text-secondary))] opacity-55">{totalUses} uses</span>
          <span className="text-[hsl(var(--text-secondary))] opacity-55">{availableCount} available</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))]/45 pt-3">
        <button
          type="button"
          onClick={onInstallMcp}
          className="cursor-pointer px-3 py-1.5 font-mono text-[10px] text-[hsl(var(--accent))] transition-colors hover:bg-[hsl(var(--accent))]/[0.10]"
          style={{ borderRadius: "var(--radius)" }}
          title="copy Claude MCP install command"
        >
          {mcpCopied ? "copied MCP command" : "install MCP"}
        </button>
        {mode === "catalog" && (
          <button
            type="button"
            onClick={onToggleAllSkills}
            className="cursor-pointer px-3 py-1.5 font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-65 transition-[background,opacity] hover:bg-[hsl(var(--shell-chrome-hover))] hover:opacity-90"
            style={{ borderRadius: "var(--radius)" }}
          >
            {showAllSkills ? "hide available" : "show available"}
          </button>
        )}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-38">
          {mode === "mesh" ? "safe metadata only" : "templates + {{identity}}"}
        </span>
      </div>
    </section>
  );
}

function SampleList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <PaneSectionLabel>{title}</PaneSectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {values.length ? values.slice(0, 18).map((value) => (
          <span
            key={value}
            className="max-w-full truncate border border-[hsl(var(--border))]/70 px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-65"
            style={{ borderRadius: "var(--radius)" }}
            title={value}
          >
            {value}
          </span>
        )) : (
          <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-38">none</span>
        )}
      </div>
    </div>
  );
}

function SkillMeshView({
  inventories,
  drift,
  machineProofs,
  isLoading,
}: {
  inventories: AgentStackInventory[] | undefined;
  drift: AgentStackDrift | undefined;
  machineProofs: MachineProofReport[] | undefined;
  isLoading: boolean;
}) {
  const latest = inventories?.[0];
  const machineCount = inventories?.length ?? 0;
  const secretLeak = inventories?.some((inventory) => inventory.secretValuesExposed) ?? false;
  const driftByMachineKey = new Map((drift?.machines ?? []).map((machine) => [machine.machineKey, machine]));
  const proofIndexes = buildMachineProofIndexes(machineProofs);
  const proofSummary = (inventories ?? []).reduce(
    (acc, inventory) => {
      const proof = machineProofForInventory(inventory, proofIndexes);
      if (proof) acc.matched += 1;
      else acc.missing += 1;
      if (isMachineProofStale(proof)) acc.stale += 1;
      if (proof?.secretValuesExposed || inventory.secretValuesExposed) acc.unsafe += 1;
      return acc;
    },
    { matched: 0, missing: 0, stale: 0, unsafe: 0 }
  );
  const ownershipRows = numericRollupEntries(latest?.ownershipRollup as Record<string, unknown> | undefined);
  const syncRows = numericRollupEntries(latest?.syncPolicyRollup as Record<string, unknown> | undefined);
  const provenanceRows = numericRollupEntries(latest?.provenanceRollup as Record<string, unknown> | undefined);
  const sourceGroups = buildSourceGroups(latest);
  const topology = latest
    ? buildSkillMeshTopology({ latest, sourceGroups, proofSummary, machineCount, secretLeak })
    : null;

  return (
    <div className="space-y-6">
      <PaneCallout label="skill mesh">
        <p className="font-mono text-[11px] leading-relaxed text-[hsl(var(--text-primary))] opacity-78">
          Local/global skill inventory from trusted machines. This is the productized version of the HTML/Mermaid audit:
          ownership, source/provenance, DRY review queues, mirror clusters, catalog gaps, and second-machine proof.
        </p>
        <p className="border-t border-[hsl(var(--accent))]/25 pt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
          Safe metadata only. Raw skill bodies, prompt logs, `.env.local` values, auth tokens, and secret material are excluded.
        </p>
      </PaneCallout>

      {isLoading && (
        <p className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-45">
          loading synced agent stack inventories...
        </p>
      )}

      {!isLoading && !latest && (
        <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
          <PaneSectionLabel>no inventory synced yet</PaneSectionLabel>
          <p className="font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
            Run the inventory command on this Mac or the Mac mini, then refresh this pane.
          </p>
          <div className="mt-3">
            <CommandRow
              command="you skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync"
              description="generate HTML/JSON and persist safe counts to You.md"
            />
          </div>
        </div>
      )}

      {latest && (
        <>
          {topology && (
            <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <PaneSectionLabel>live topology</PaneSectionLabel>
                  <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
                    Real synced brain graph for skills
                  </h3>
                  <p className="mt-1 max-w-3xl font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-48">
                    Nodes and firing states are derived from synced inventory, source groups, proof coverage, catalog gaps, and DRY review counts.
                  </p>
                </div>
              </div>
              <SyncedBrainGraph
                nodes={topology.nodes}
                links={topology.links}
                signals={topology.signals}
                latestActivity={topology.latestActivity}
              />
            </section>
          )}

          <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <PaneSectionLabel>latest machine</PaneSectionLabel>
                <h2 className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">
                  {latest.hostName}
                </h2>
                <p className="mt-2 max-w-3xl truncate font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-52">
                  {latest.rootDir}
                </p>
              </div>
              <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-48">
                {formatInventoryTime(latest.generatedAt)} / {machineCount} machine{machineCount === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MeshMetric label="unique skills" value={formatCount(latest.uniqueSkillNames)} tone="accent" />
              <MeshMetric label="real SKILL.md files" value={formatCount(latest.uniqueRealSkillFiles)} />
              <MeshMetric label="catalog gaps" value={formatCount(latest.missingFromYoumdCatalog)} tone={latest.missingFromYoumdCatalog > 0 ? "warn" : "ok"} />
              <MeshMetric label="DRY review cases" value={formatCount(latest.duplicateNameDifferentRealpaths)} tone={latest.duplicateNameDifferentRealpaths > 0 ? "warn" : "ok"} />
              <MeshMetric label="host exposures" value={formatCount(latest.directExposureSkillRecords)} />
              <MeshMetric label="canonical files" value={formatCount(latest.canonicalSkillFiles)} />
              <MeshMetric label="mirror clusters" value={formatCount(latest.sameRealpathMirrors)} tone="ok" />
              <MeshMetric label="project signals" value={formatCount(latest.projectSignals)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[hsl(var(--border))]/45 pt-3 font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-58">
              <span>schema: {latest.inventorySchemaVersion ?? "unknown"}</span>
              <span>source: {latest.source}</span>
              <span>agent: {latest.agentName ?? "unknown"}</span>
              <span className={secretLeak ? "text-yellow-500" : "text-[hsl(var(--success))]"}>
                secrets: {secretLeak ? "review required" : "not exposed"}
              </span>
            </div>
          </section>

          <SourceGroupPanel groups={sourceGroups} />

          {drift?.baseline && (
            <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <PaneSectionLabel>machine drift</PaneSectionLabel>
                  <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
                    baseline: {drift.baseline.hostName}
                  </h3>
                  <p className="mt-1 max-w-3xl truncate font-mono text-[9.5px] text-[hsl(var(--text-secondary))] opacity-48">
                    {drift.baseline.rootDir}
                  </p>
                </div>
              <div className="grid grid-cols-4 gap-3 font-mono text-[9px] uppercase tracking-[0.12em]">
                  <span className="text-[hsl(var(--text-secondary))] opacity-55">{drift.summary.machineCount} machines</span>
                  <span className={drift.summary.driftCount > 0 ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}>
                    {drift.summary.driftCount} drift
                  </span>
                  <span className={drift.summary.staleCount > 0 ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}>
                    {drift.summary.staleCount} stale
                  </span>
                  <span className={drift.summary.unsafeCount > 0 ? "text-yellow-500" : "text-[hsl(var(--success))]"}>
                    {drift.summary.unsafeCount} unsafe
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {drift.machines.slice(0, 6).map((machine) => (
                  <div key={machine.machineKey} className="grid gap-2 border-t border-[hsl(var(--border))]/45 py-2 font-mono text-[10px] md:grid-cols-[1fr_auto_auto]">
                    <div className="min-w-0">
                      <div className="truncate text-[hsl(var(--text-primary))]">{machine.hostName}</div>
                      <div className="truncate text-[hsl(var(--text-secondary))] opacity-45">
                        {machine.issues[0] ?? "matches baseline counts"}
                      </div>
                    </div>
                    <span className={machine.status === "baseline" || machine.status === "ok" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}>
                      {machine.status}
                    </span>
                    <span className="text-[hsl(var(--text-secondary))] opacity-52">
                      {machine.deltas.uniqueSkillNames >= 0 ? "+" : ""}{machine.deltas.uniqueSkillNames} skills
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <PaneSectionLabel>machine proof</PaneSectionLabel>
                <h3 className="font-mono text-[13px] text-[hsl(var(--text-primary))]">
                  inventory plus readiness attestation
                </h3>
                <p className="mt-1 max-w-3xl font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-48">
                  Fresh-machine proof joins the skill mesh with project/env/MCP readiness. This is the check before calling a second Mac synced.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 font-mono text-[9px] uppercase tracking-[0.12em]">
                <span className={proofSummary.matched === machineCount ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}>
                  {proofSummary.matched}/{machineCount} proof
                </span>
                <span className={proofSummary.missing > 0 ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}>
                  {proofSummary.missing} missing
                </span>
                <span className={proofSummary.stale > 0 ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}>
                  {proofSummary.stale} stale
                </span>
                <span className={proofSummary.unsafe > 0 ? "text-yellow-500" : "text-[hsl(var(--success))]"}>
                  {proofSummary.unsafe} unsafe
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {(inventories ?? []).slice(0, 6).map((inventory) => {
                const proof = machineProofForInventory(inventory, proofIndexes);
                const stale = isMachineProofStale(proof);
                return (
                  <div key={inventory._id} className="grid gap-2 border-t border-[hsl(var(--border))]/45 py-2 font-mono text-[10px] md:grid-cols-[1fr_auto_auto_auto]">
                    <div className="min-w-0">
                      <div className="truncate text-[hsl(var(--text-primary))]">{inventory.hostName}</div>
                      <div className="truncate text-[hsl(var(--text-secondary))] opacity-45">
                        {proof?.warnings?.[0] ?? (proof ? "latest proof has no warnings" : "no machine proof synced yet")}
                      </div>
                    </div>
                    <span className={proof?.status === "ready" ? "text-[hsl(var(--success))]" : proof ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--text-secondary))] opacity-45"}>
                      {proof?.status ?? "missing"}
                    </span>
                    <span className={stale ? "text-[hsl(var(--accent))]" : "text-[hsl(var(--success))]"}>
                      {proof ? formatInventoryTime(proof.updatedAt) : "no proof"}
                    </span>
                    <span className={proof?.secretValuesExposed ? "text-yellow-500" : "text-[hsl(var(--text-secondary))] opacity-52"}>
                      secrets {proof?.secretValuesExposed ? "review" : "safe"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <RollupColumn title="ownership" rows={ownershipRows} />
            <RollupColumn title="sync policy" rows={syncRows} />
            <RollupColumn title="provenance" rows={provenanceRows} />
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <SampleList title="catalog gaps" values={latest.missingCatalogSamples ?? []} />
            <SampleList title="DRY review queue" values={latest.duplicateNameSamples ?? []} />
            <SampleList title="healthy mirrors" values={latest.mirrorSamples ?? []} />
          </section>

          <section>
            <PaneSectionLabel>trusted machine snapshots</PaneSectionLabel>
            <div className="space-y-2">
              {(inventories ?? []).map((inventory) => (
                <MachineSnapshotRow
                  key={inventory._id}
                  inventory={inventory}
                  drift={driftByMachineKey.get(inventory.machineKey)}
                  proof={machineProofForInventory(inventory, proofIndexes)}
                />
              ))}
            </div>
          </section>

          <section>
            <PaneSectionLabel>verify and compare</PaneSectionLabel>
            <div className="space-y-2">
              <CommandRow command="you skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync" description="refresh this machine's local/global skill mesh, catalog discovered references, and sync safe metadata" />
              <CommandRow command="you machine verify --write-report --sync-report" description="write machine readiness proof with the latest skill mesh counts attached" />
              <CommandRow command="you skill inventory diff macbook.json mac-mini.json" description="compare two trusted machine snapshots before calling sync parity clean" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MachineSnapshotRow({
  inventory,
  drift,
  proof,
}: {
  inventory: AgentStackInventory;
  drift?: AgentStackDrift["machines"][number];
  proof?: MachineProofReport;
}) {
  const driftOk = drift?.status === "baseline" || drift?.status === "ok";
  const proofStale = isMachineProofStale(proof);
  return (
    <div className="grid gap-2 border-t border-[hsl(var(--border))]/45 py-2 font-mono text-[10px] md:grid-cols-[1fr_auto_auto_auto_auto_auto]">
      <div className="min-w-0">
        <div className="truncate text-[hsl(var(--text-primary))]">{inventory.hostName}</div>
        <div className="truncate text-[hsl(var(--text-secondary))] opacity-45">{inventory.rootDir}</div>
      </div>
      <span className="text-[hsl(var(--accent))]">{inventory.uniqueSkillNames.toLocaleString()} skills</span>
      <span className="text-[hsl(var(--text-secondary))] opacity-58">{inventory.missingFromYoumdCatalog.toLocaleString()} gaps</span>
      <span className={driftOk ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}>
        {drift?.status ?? "unknown"}
      </span>
      <span className={proof && !proofStale && proof.status === "ready" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}>
        proof {proof?.status ?? "missing"}
      </span>
      <span className="text-[hsl(var(--text-secondary))] opacity-42">{formatInventoryTime(inventory.generatedAt)}</span>
    </div>
  );
}

function skillNameFromPath(pathname: string) {
  const match = pathname.match(/^\/shell\/skills\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function skillDetailHref(skillName: string) {
  return `/shell/skills/${encodeURIComponent(skillName)}`;
}

function SkillCard({
  skill,
  isInstalled,
  useCount,
  onOpen,
}: {
  skill: SkillEntry;
  isInstalled: boolean;
  useCount?: number;
  onOpen: () => void;
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
      style={{ borderRadius: "var(--radius)" }}
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
          <button
            type="button"
            onClick={onOpen}
            className="text-[9px] font-mono uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-45 transition-opacity hover:opacity-85"
            title={`open ${skill.name} detail`}
          >
            detail
          </button>
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

function SkillDetailView({
  skill,
  isInstalled,
  useCount,
  onBack,
}: {
  skill: SkillEntry;
  isInstalled: boolean;
  useCount?: number;
  onBack: () => void;
}) {
  const useCmd = `/skill use ${skill.name}`;
  const propagationRows = skillPropagation.filter((entry) => entry.skill === skill.name);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-y border-[hsl(var(--border))]/55 py-3 font-mono text-[9px] uppercase tracking-[0.14em]">
        <button
          type="button"
          onClick={onBack}
          className="text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
        >
          {"<<"} back to skills
        </button>
        <span className="text-[hsl(var(--text-secondary))] opacity-35">/</span>
        <span className="text-[hsl(var(--text-primary))] opacity-85">{skill.name}</span>
      </div>

      <section className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-[15px] leading-tight text-[hsl(var(--text-primary))]">{skill.name}</h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
                v{skill.version}
              </span>
              <ScopeTag scope={skill.scope} />
              <span className={`font-mono text-[8.5px] uppercase tracking-[0.14em] ${
                isInstalled ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-45"
              }`}>
                {isInstalled ? "installed" : "available"}
              </span>
              {useCount !== undefined && useCount > 0 && (
                <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-70">
                  {useCount} uses
                </span>
              )}
            </div>
            <p className="mt-3 max-w-3xl font-mono text-[10.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">
              {skill.description}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <PaneSectionLabel>identity fields</PaneSectionLabel>
            {skill.identityFields.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skill.identityFields.map((field) => (
                  <IdentityFieldTag key={field} field={field} />
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                no identity fields required.
              </p>
            )}
          </div>
          <div>
            <PaneSectionLabel>use in shell</PaneSectionLabel>
            <CommandRow command={useCmd} description="copy and paste into the You.md shell" />
            <CommandRow command={`you skill use ${skill.name}`} description="local CLI equivalent for terminal agents" />
          </div>
        </div>

        {propagationRows.length > 0 && (
          <div className="mt-4 border-t border-[hsl(var(--border))]/45 pt-3">
            <PaneSectionLabel>project propagation</PaneSectionLabel>
            <div className="space-y-2">
              {propagationRows.flatMap((entry) => entry.projects.map((project) => (
                <div key={`${entry.skill}-${project.project}`} className="flex flex-wrap items-center gap-2 border-t border-[hsl(var(--border))]/35 pt-2 font-mono text-[9.5px]">
                  <span className="text-[hsl(var(--text-primary))]">{project.project}</span>
                  <span className={`uppercase tracking-[0.14em] ${
                    project.status === "synced"
                      ? "text-[hsl(var(--success))]"
                      : project.status === "cataloged"
                        ? "text-[hsl(var(--accent))]"
                        : "text-[hsl(var(--text-secondary))] opacity-50"
                  }`}>
                    {project.status}
                  </span>
                  <span className="text-[hsl(var(--text-secondary))] opacity-48">{project.note}</span>
                </div>
              )))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

interface SkillsPaneProps {
  userId: Id<"users">;
}

export function SkillsPane({ userId }: SkillsPaneProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const clerkId = user?.id;
  // Query user's installed skills from Convex
  const installs = useQuery(api.skills.listInstalls, clerkId ? { clerkId, userId } : "skip");
  // Query published skills from registry
  const registrySkills = useQuery(api.skills.listPublished, { limit: 20 });
  const agentStackInventories = useQuery(api.portfolio.listAgentStackInventories, clerkId ? { clerkId, limit: 12 } : "skip");
  const agentStackDrift = useQuery(api.portfolio.getAgentStackInventoryDrift, clerkId ? { clerkId, limit: 12 } : "skip");
  const machineProofs = useQuery(api.portfolio.listMachineProofs, clerkId ? { clerkId, limit: 12 } : "skip");

  const isLoading = installs === undefined || registrySkills === undefined;
  const meshLoading = agentStackInventories === undefined || agentStackDrift === undefined || machineProofs === undefined;
  const installMap = new Map<string, InstalledSkillSummary>(
    (installs ?? []).map((install) => [
      install.skillName,
      { skillName: install.skillName, useCount: install.useCount },
    ])
  );
  const installedNames = new Set(installMap.keys());

  const [showAllSkills, setShowAllSkills] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [localMode, setLocalMode] = useState<SkillPaneMode>(() => searchParams.get("view") === "mesh" ? "mesh" : "catalog");
  const requestedView = searchParams.get("view");
  const mode: SkillPaneMode = requestedView === "mesh" || requestedView === "catalog" ? requestedView : localMode;

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
  const totalUses = (installs ?? []).reduce((sum, install) => sum + (install.useCount ?? 0), 0);
  const routeSkillName = skillNameFromPath(pathname);
  const legacySkillName = searchParams.get("skill");
  const selectedSkillName = routeSkillName ?? legacySkillName;
  const selectedSkill = selectedSkillName ? allSkills.find((skill) => skill.name === selectedSkillName) : undefined;
  const localSyncRows = [
    {
      label: "portfolio-graph-auditor",
      value: installedNames.has("portfolio-graph-auditor") ? "synced" : "install needed",
      ok: installedNames.has("portfolio-graph-auditor"),
    },
    {
      label: "meta-improve",
      value: installedNames.has("meta-improve") ? "synced" : "install needed",
      ok: installedNames.has("meta-improve"),
    },
    {
      label: "proactive-context-fill",
      value: installedNames.has("proactive-context-fill") ? "synced" : "install needed",
      ok: installedNames.has("proactive-context-fill"),
    },
  ];

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

  const setMode = (nextMode: SkillPaneMode) => {
    setLocalMode(nextMode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "skills");
    if (nextMode === "mesh") {
      params.set("view", "mesh");
    } else {
      params.delete("view");
    }
    router.replace(`/shell?${params.toString()}`, { scroll: false });
  };

  const openSkill = (skillName: string) => {
    router.push(skillDetailHref(skillName), { scroll: false });
  };

  const returnToSkills = () => {
    router.push("/shell?tab=skills", { scroll: false });
  };

  useEffect(() => {
    if (routeSkillName || !legacySkillName) return;
    router.replace(skillDetailHref(legacySkillName), { scroll: false });
  }, [legacySkillName, routeSkillName, router]);

  if (selectedSkill) {
    return (
      <div className="p-6 space-y-6">
        <SkillDetailView
          skill={selectedSkill}
          isInstalled={installedNames.has(selectedSkill.name)}
          useCount={installMap.get(selectedSkill.name)?.useCount}
          onBack={returnToSkills}
        />
      </div>
    );
  }

  if (selectedSkillName && !selectedSkill) {
    return (
      <div className="p-6">
        <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-4">
          <button
            type="button"
            onClick={returnToSkills}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--accent))] opacity-80 transition-opacity hover:opacity-100"
          >
            {"<<"} back to skills
          </button>
          <h2 className="mt-3 font-mono text-[14px] text-[hsl(var(--text-primary))]">skill not found</h2>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
            No skill is saved as <code className="text-[hsl(var(--text-primary))]">{selectedSkillName}</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <SkillsSurfaceHeader
        mode={mode}
        installedCount={installedSkills.length}
        availableCount={availableSkills.length}
        totalCount={allSkills.length}
        totalUses={totalUses}
        showAllSkills={showAllSkills}
        mcpCopied={mcpCopied}
        onInstallMcp={handleInstallMcp}
        onToggleAllSkills={() => setShowAllSkills((value) => !value)}
      />

      <div className="flex flex-wrap items-center gap-2 border-y border-[hsl(var(--border))]/55 py-2">
        {(["catalog", "mesh"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setMode(nextMode)}
            className={[
              "px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-[background,color,opacity]",
              mode === nextMode
                ? "bg-[hsl(var(--shell-active))] text-[hsl(var(--text-primary))]"
                : "text-[hsl(var(--text-secondary))] opacity-50 hover:bg-[hsl(var(--shell-chrome-hover))] hover:opacity-85",
            ].join(" ")}
            style={{ borderRadius: "var(--radius)" }}
          >
            {nextMode === "catalog" ? "skill catalog" : "skill mesh"}
          </button>
        ))}
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-35">
          {mode === "mesh" ? "machine inventory + drift" : "installed + available"}
        </span>
      </div>

      {mode === "mesh" ? (
        <SkillMeshView
          inventories={agentStackInventories}
          drift={agentStackDrift as AgentStackDrift | undefined}
          machineProofs={machineProofs}
          isLoading={meshLoading}
        />
      ) : (
        <>
      <div>
        <PaneSectionLabel>local agent sync</PaneSectionLabel>
        <div className="space-y-2 border-l border-[hsl(var(--border))]/80 pl-4 font-mono text-[11px]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[hsl(var(--success))]">
              {installs ? `${installs.length}/${allSkills.length} skills synced` : "checking sync"}
            </span>
            <span className="text-[hsl(var(--text-secondary))] opacity-25">|</span>
            <span className="text-[hsl(var(--text-secondary))] opacity-55">
              MCP startup packet: get_agent_brief + portfolio graph
            </span>
          </div>
          <div className="space-y-1.5">
            {localSyncRows.map((row) => (
              <div key={row.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[hsl(var(--border))]/45 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-[hsl(var(--text-primary))]">{row.label}</span>
                  <span className={`text-[8px] uppercase tracking-[0.14em] ${
                    row.ok ? "text-[hsl(var(--success))]" : "text-[hsl(var(--text-secondary))] opacity-50"
                  }`}>
                    {row.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-4 text-[hsl(var(--text-secondary))] opacity-45">
            Local Claude/Codex agents should call `get_agent_brief` first; the brief now includes API/MCP ownership,
            env-audit commands, reusable patterns, and shared-skill propagation guardrails.
          </p>
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
            {totalUses} total uses
          </span>
        </div>
      )}

      <PaneDivider />

      {/* Cross-project skill propagation */}
      <div>
        <PaneSectionLabel>tracked project propagation</PaneSectionLabel>
        <div className="space-y-3">
          {skillPropagation.map((entry) => (
            <div key={entry.skill} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{entry.skill}</span>
                <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-45">{entry.owner}</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {entry.projects.map((project) => (
                  <div key={`${entry.skill}-${project.project}`} className="border-t border-[hsl(var(--border))]/45 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-[hsl(var(--text-primary))]">{project.project}</span>
                      <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.14em] ${
                        project.status === "synced"
                          ? "text-[hsl(var(--success))]"
                          : project.status === "cataloged"
                            ? "text-[hsl(var(--accent))]"
                            : "text-[hsl(var(--text-secondary))] opacity-50"
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[9px] leading-4 text-[hsl(var(--text-secondary))] opacity-50">
                      {project.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                useCount={installMap.get(skill.name)?.useCount}
                onOpen={() => openSkill(skill.name)}
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
                  useCount={installMap.get(skill.name)?.useCount}
                  onOpen={() => openSkill(skill.name)}
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
          <CommandRow command="you skill install all" description="install all bundled skills" />
          <CommandRow command="/new computer" description="mint a scoped key and generate a one-command fresh-machine setup prompt" />
          <CommandRow command="you machine prompt --root ~/Desktop/CODE_YOU --days 30" description="terminal-generated Claude/Codex bootstrap command" />
          <CommandRow command="/skill use portfolio-graph-auditor" description="audit projects, APIs, env keys, and reuse candidates" />
          <CommandRow command="you project portfolio-audit --root ~/Desktop/CODE_2025" description="local project/API/env portfolio scan" />
          <CommandRow command="you skill use youstack-maintainer" description="organize or improve a named stack" />
          <CommandRow command="you skill init-project" description="AGENTS/CLAUDE bootstrap + project-context/ + .you/ + links" />
          <CommandRow command="you skill link claude" description="link skills to Claude Code" />
          <CommandRow command="you skill sync" description="re-render skills with latest identity" />
          <CommandRow command="you skill create" description="scaffold a new custom skill" />
          <CommandRow command="you skill improve" description="review metrics, find gaps" />
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
              skills live in ~/.you/skills/ as SKILL.md files with {`{{var}}`} template variables. Legacy ~/.youmd/ skills are still read during migration.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">2. interpolate</p>
            <p>
              when you run <span className="text-[hsl(var(--accent))]">you skill use</span>, template
              variables resolve against your live brain data — voice, preferences, directives.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">3. sync</p>
            <p>
              when your brain changes (via chat, push, or pull), installed skills auto re-interpolate.
              shared skills propagate everywhere. project skills stay local.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">4. link</p>
            <p>
              <span className="text-[hsl(var(--accent))]">you skill link claude</span> writes rendered
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
        </>
      )}
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
