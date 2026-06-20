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

function machineProofKey(row: Pick<AgentStackInventory | MachineProofReport, "machineKey" | "hostName" | "rootDir">) {
  return row.machineKey || `${row.hostName}::${row.rootDir}`;
}

function machineProofForInventory(
  inventory: AgentStackInventory,
  proofByKey: Map<string, MachineProofReport>
) {
  return proofByKey.get(machineProofKey(inventory));
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
  const proofByMachineKey = new Map((machineProofs ?? []).map((proof) => [machineProofKey(proof), proof]));
  const proofSummary = (inventories ?? []).reduce(
    (acc, inventory) => {
      const proof = machineProofForInventory(inventory, proofByMachineKey);
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
              command="youmd skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync"
              description="generate HTML/JSON and persist safe counts to You.md"
            />
          </div>
        </div>
      )}

      {latest && (
        <>
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
                const proof = machineProofForInventory(inventory, proofByMachineKey);
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
                  proof={machineProofForInventory(inventory, proofByMachineKey)}
                />
              ))}
            </div>
          </section>

          <section>
            <PaneSectionLabel>verify and compare</PaneSectionLabel>
            <div className="space-y-2">
              <CommandRow command="youmd skill inventory --out-dir ~/.you/agent-stack-inventory --register-catalog --sync" description="refresh this machine's local/global skill mesh, catalog discovered references, and sync safe metadata" />
              <CommandRow command="youmd machine verify --write-report --sync-report" description="write machine readiness proof with the latest skill mesh counts attached" />
              <CommandRow command="youmd skill inventory diff macbook.json mac-mini.json" description="compare two trusted machine snapshots before calling sync parity clean" />
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
            <CommandRow command={`youmd skill use ${skill.name}`} description="local CLI equivalent for terminal agents" />
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
      {/* ── Always-visible explainer ─────────────────────────── */}
      <PaneCallout label="skills">
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
              • <span className="text-[hsl(var(--text-primary))] opacity-80">youstack-start</span>:
              gives local agents the identity, project state, and next move
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">youstack-maintainer</span>:
              keeps named stacks organized, updated, private by default, and publish-ready
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">claude-md-generator</span>:
              bootstraps repo-visible agent instructions with your context
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">proactive-context-fill</span>:
              detects thin context and proposes safe additive improvements
            </li>
            <li>
              • <span className="text-[hsl(var(--text-primary))] opacity-80">portfolio-graph-auditor</span>:
              maps active projects, APIs, MCPs, env keys, and reusable patterns without printing secrets
            </li>
          </ul>
        </div>

        <p className="text-[10px] font-mono text-[hsl(var(--text-secondary))] opacity-50 leading-relaxed pt-1 border-t border-[hsl(var(--accent))] border-opacity-20">
          Most skills work AUTOMATICALLY once you install youmd MCP. Manual
          install only needed for special skills. YouStacks use the same skill
          layer, but package multiple skills, workflows, examples, tests, and
          host adapters under one named stack.
        </p>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={handleInstallMcp}
            className="text-[10px] font-mono text-[hsl(var(--accent))] border border-[hsl(var(--accent))] px-3 py-1.5 hover:bg-[hsl(var(--accent)/0.1)] transition-colors"
            title="copy install command"
          >
            {mcpCopied ? "copied Claude MCP install command" : "install MCP"}
          </button>
          <button
            onClick={() => setShowAllSkills((v) => !v)}
            className="text-[10px] font-mono text-[hsl(var(--text-secondary))] border border-[hsl(var(--border))] px-3 py-1.5 hover:text-[hsl(var(--text-primary))] hover:border-[hsl(var(--accent))] transition-colors"
            style={{ borderRadius: "var(--radius)" }}
          >
            {showAllSkills ? "hide all skills" : "view all skills"}
          </button>
        </div>
      </PaneCallout>

      <div className="flex flex-wrap items-center gap-2 border-y border-[hsl(var(--border))]/55 py-2">
        {(["catalog", "mesh"] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setLocalMode(nextMode)}
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
            {installs.reduce((sum, install) => sum + (install.useCount ?? 0), 0)} total uses
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
          <CommandRow command="youmd skill install all" description="install all bundled skills" />
          <CommandRow command="/new computer" description="mint a scoped key and generate a one-command fresh-machine setup prompt" />
          <CommandRow command="youmd machine prompt --root ~/Desktop/CODE_YOU --days 30" description="terminal-generated Claude/Codex bootstrap command" />
          <CommandRow command="/skill use portfolio-graph-auditor" description="audit projects, APIs, env keys, and reuse candidates" />
          <CommandRow command="youmd project portfolio-audit --root ~/Desktop/CODE_2025" description="local project/API/env portfolio scan" />
          <CommandRow command="youmd skill use youstack-maintainer" description="organize or improve a named stack" />
          <CommandRow command="youmd skill init-project" description="AGENTS/CLAUDE bootstrap + project-context/ + .you/ + links" />
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
              skills live in ~/.you/skills/ as SKILL.md files with {`{{var}}`} template variables. Legacy ~/.youmd/ skills are still read during migration.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[hsl(var(--text-primary))] opacity-70">2. interpolate</p>
            <p>
              when you run <span className="text-[hsl(var(--accent))]">youmd skill use</span>, template
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
