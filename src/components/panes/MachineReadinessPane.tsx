"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Copy, RefreshCw } from "lucide-react";
import type {
  LocalMachineReadiness,
  LocalReadinessStatus,
  LocalProjectReadiness,
} from "@/lib/local-machine-readiness.server";
import { CopyableCommand } from "./CopyableCommand";
import { PaneCallout, PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";
import {
  FRESH_MACHINE_BOOTSTRAP_DAYS,
  FRESH_MACHINE_BOOTSTRAP_EXPAND_DAYS,
  FRESH_MACHINE_BOOTSTRAP_LIMIT,
  FRESH_MACHINE_BOOTSTRAP_ROOT,
  FRESH_MACHINE_BOOTSTRAP_SCOPES,
  buildFreshMachineBootstrapMessage,
} from "@/hooks/useYouAgent";

type RootMode = "current" | "fresh";

type MachineReadinessPaneProps = {
  clerkId?: string;
};

const freshComputerPromptCommand = "youmd machine prompt --root ~/Desktop/CODE_YOU --days 30 --limit 80 --require-env-vault";
const freshComputerShellCommand = "/new computer";
const sourceEnvVaultBackupCommand = "youmd env vault push --root ~/Desktop/CODE_2025 --out ~/Desktop/youmd-env-vault";

function statusClass(status: LocalReadinessStatus | LocalProjectReadiness["status"]) {
  if (status === "ready") return "text-[hsl(var(--success))]";
  if (status === "warn" || status === "needs-env" || status === "partial") return "text-[hsl(var(--accent))]";
  if (status === "blocked" || status === "missing") return "text-red-400";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function proofStatusClass(status?: string) {
  if (status === "ready") return "text-[hsl(var(--success))]";
  if (status === "warn") return "text-[hsl(var(--accent))]";
  if (status === "failed") return "text-red-400";
  return "text-[hsl(var(--text-secondary))] opacity-55";
}

function formatTime(value?: string | number) {
  if (!value) return "not observed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "not observed";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/45 px-3 py-2">
      <div className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">{value}</div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--text-secondary))] opacity-45">
        {label}
      </div>
    </div>
  );
}

function BooleanCell({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
      <span className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-55">{label}</span>
      <span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${value ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}`}>
        {value ? "ready" : "missing"}
      </span>
    </div>
  );
}

function AgentBusPanel({ agentBus }: { agentBus: LocalMachineReadiness["agentBus"] }) {
  return (
    <div id="agent-bus" className="mt-4 border-l border-[hsl(var(--success))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
          realtime agent bus
        </span>
        <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${agentBus.state === "active" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}`}>
          {agentBus.state}
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
        {agentBus.summary ?? "realtime daemon has not received an agent-bus message yet"}
      </p>
      <div className="mt-2 grid gap-2 font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45 lg:grid-cols-[1fr_1fr]">
        <div>inbox: {agentBus.inboxPath}</div>
        <div>latest: {formatTime(agentBus.latestMessageAt)}</div>
      </div>
      <div className="mt-3">
        <CopyableCommand command={agentBus.sendCommand} dimmed />
      </div>
      {agentBus.messages.length > 0 && (
        <div className="mt-3 divide-y divide-[hsl(var(--border))]/50 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35">
          {agentBus.messages.slice(-5).map((message) => (
            <div key={message.messageId} className="grid gap-2 px-3 py-2 lg:grid-cols-[0.7fr_1fr]">
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] text-[hsl(var(--text-primary))]">
                  {message.sourceAgent}{message.sourceHost ? ` @ ${message.sourceHost}` : ""}
                </div>
                <div className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                  {formatTime(message.createdAt)} / {message.channel} / {message.kind}
                </div>
              </div>
              <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">
                {message.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillSyncProofPanel({ skillSync }: { skillSync: LocalMachineReadiness["skillSync"] }) {
  const proof = skillSync.highlightedSkill;
  const checks = [
    ["shared", proof.canonicalPresent],
    ["rendered", proof.renderedPresent],
    ["claude", proof.claudePresent],
    ["codex", proof.codexPresent],
    ["catalog", proof.catalogPresent],
    ["stack map", proof.stackMapPresent],
  ] as const;

  return (
    <div id="skill-sync-proof" className="mt-4 border-l border-[hsl(var(--success))]/70 bg-[hsl(var(--bg))]/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-70">
          live skill mesh
        </span>
        <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${statusClass(skillSync.status)}`}>
          {skillSync.status}
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1fr]">
        <div>
          <h3 className="font-mono text-[17px] leading-tight text-[hsl(var(--text-primary))]">
            {proof.name}
          </h3>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
            One canonical shared skill, mirrored into Claude and Codex, registered in You.md, and ready for any trusted Mac.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {checks.map(([label, ready]) => (
              <span
                key={label}
                className={`border px-2 py-1 font-mono text-[8.5px] uppercase tracking-[0.11em] ${
                  ready
                    ? "border-[hsl(var(--success))]/35 text-[hsl(var(--success))]"
                    : "border-[hsl(var(--accent))]/35 text-[hsl(var(--accent))]"
                }`}
              >
                {label} {ready ? "yes" : "missing"}
              </span>
            ))}
          </div>
          <div className="mt-3 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
            latest observed {formatTime(proof.updatedAt)}
          </div>
        </div>
        <div>
          <div className="grid gap-2 sm:grid-cols-4">
            <StatCell label="shared" value={skillSync.canonicalCount} />
            <StatCell label="claude" value={skillSync.claudeMirrorCount} />
            <StatCell label="codex" value={skillSync.codexMirrorCount} />
            <StatCell label="catalog" value={skillSync.youmdCatalogCount} />
          </div>
          <div className="mt-3 font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-48">
            recent shared skills: {skillSync.recentSharedSkills.join(", ") || "none observed"}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <CopyableCommand command={skillSync.syncCommand} dimmed />
        <CopyableCommand command={skillSync.verifyCommand} dimmed />
      </div>
    </div>
  );
}

function MachineSetupHero({
  clerkId,
  onCopied,
}: {
  clerkId?: string;
  onCopied: (label: string) => void;
}) {
  const createApiKey = useMutation(api.apiKeys.createKey);
  const [copyState, setCopyState] = useState<"idle" | "minting" | "copied" | "fallback" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    onCopied(label);
  };

  const copyGeneratedCommand = async () => {
    setError(null);
    if (!clerkId) {
      try {
        await copyText(freshComputerShellCommand, "copied shell command");
        setCopyState("fallback");
      } catch {
        setCopyState("failed");
        setError("clipboard unavailable");
      }
      return;
    }

    setCopyState("minting");
    try {
      const result = await createApiKey({
        clerkId,
        label: "fresh-machine bootstrap",
        scopes: FRESH_MACHINE_BOOTSTRAP_SCOPES,
        expiresInDays: 7,
      });
      const prompt = buildFreshMachineBootstrapMessage(result.key);
      await copyText(prompt, "copied Claude/Codex prompt");
      setCopyState("copied");
    } catch (err) {
      try {
        await copyText(freshComputerShellCommand, "copied shell fallback");
        setCopyState("fallback");
      } catch {
        setCopyState("failed");
      }
      setError(err instanceof Error ? err.message : "could not mint bootstrap key");
    }
  };

  const copyShellCommand = async () => {
    setError(null);
    try {
      await copyText(freshComputerShellCommand, "copied shell command");
      setCopyState("fallback");
    } catch {
      setCopyState("failed");
      setError("clipboard unavailable");
    }
  };

  return (
    <PaneCallout label="new machine setup" className="px-5 py-5">
        <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
          Copy one Claude/Codex setup prompt into a blank Mac to rebuild this working context.
        </h2>
        <p className="mt-3 max-w-4xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">
          The prompt tells the local agent exactly what to do, includes the curl runtime command, authenticates, pulls your identity bundle, syncs shared skills/stacks and MCP host config, creates {FRESH_MACHINE_BOOTSTRAP_ROOT}, restores encrypted env files through a trusted-device Secret Vault envelope or local fallback, clones active focused projects, writes a machine proof, and starts resident sync.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {[
            ["30d first", `${FRESH_MACHINE_BOOTSTRAP_DAYS}-day active + Top Priority/Focusing project pass`],
            ["90d optional", `asks before expanding to ${FRESH_MACHINE_BOOTSTRAP_EXPAND_DAYS}-day active project set`],
            ["secret vault", "registers this Mac, unlocks the encrypted snapshot with its device envelope, then falls back to local/iCloud files"],
          ].map(([label, detail]) => (
            <div key={label} className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg-raised))]/35 px-3 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--accent))]">{label}</div>
              <div className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">{detail}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void copyGeneratedCommand()}
            disabled={copyState === "minting"}
            className="flex h-9 items-center gap-2 border border-[hsl(var(--border))] bg-[hsl(var(--accent))]/10 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--accent))] transition-colors hover:border-[hsl(var(--accent))]/50 disabled:cursor-wait disabled:opacity-60"
          >
            <Copy size={13} />
            {copyState === "minting" ? "minting key" : copyState === "copied" ? "setup prompt copied" : "copy setup prompt"}
          </button>
          <button
            type="button"
            onClick={() => void copyShellCommand()}
            className="h-9 border border-[hsl(var(--border))] bg-[hsl(var(--bg))]/60 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--text-secondary))] opacity-70 transition-colors hover:border-[hsl(var(--accent))]/35 hover:opacity-95"
          >
            copy /new computer
          </button>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-42">
            {copyState === "copied"
              ? "7-day scoped key embedded"
              : copyState === "fallback"
                ? "paste into You.md shell to mint"
                : `${FRESH_MACHINE_BOOTSTRAP_LIMIT} project cap before expansion`}
          </span>
        </div>

        {error && (
          <div className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--accent))] opacity-70">
            key mint fallback: {error}
          </div>
        )}
    </PaneCallout>
  );
}

export function MachineReadinessPane({ clerkId }: MachineReadinessPaneProps) {
  const [rootMode, setRootMode] = useState<RootMode>("current");
  const [report, setReport] = useState<LocalMachineReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const syncedProofs = useQuery(api.portfolio.listMachineProofs, clerkId ? { clerkId, limit: 8 } : "skip");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/local/machine-readiness?root=${rootMode}`, {
        cache: "no-store",
        credentials: "include",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "machine readiness unavailable");
      }
      setReport(payload as LocalMachineReadiness);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "machine readiness unavailable");
    } finally {
      setLoading(false);
    }
  }, [rootMode]);

  const handleCopied = useCallback((label: string) => {
    setCopiedNotice(label);
    window.setTimeout(() => setCopiedNotice(null), 1800);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topProjects = useMemo(() => report?.projects.rows.slice(0, 14) ?? [], [report]);
  const syncedProofsSection = (
    <div className="mt-4 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/25 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-65">
          synced machine records
        </span>
        <span className="ml-auto font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
          {syncedProofs === undefined ? "loading" : `${syncedProofs.length} tracked`}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {syncedProofs === undefined && (
          <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-48">
            reading owner-gated machine proof history...
          </div>
        )}
        {syncedProofs && syncedProofs.length === 0 && (
          <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
            no synced machine proofs yet. Run `youmd machine verify --write-report --sync-report` from an authenticated CLI.
          </div>
        )}
        {syncedProofs?.map((proof) => (
          <div key={proof._id} className="grid gap-3 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2 lg:grid-cols-[0.7fr_0.8fr_1fr]">
            <div>
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-[11px] text-[hsl(var(--text-primary))]">{proof.hostName}</span>
                <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${proofStatusClass(proof.status)}`}>
                  {proof.status}
                </span>
              </div>
              <div className="mt-1 truncate font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-42">
                {formatTime(proof.generatedAt)} / {proof.source}
              </div>
            </div>
            <div className="min-w-0 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
              <div className="truncate">{proof.rootDir}</div>
              <div className="mt-1 opacity-45">secret values exposed: {String(proof.secretValuesExposed)}</div>
            </div>
            <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
              scanned {proof.scanned} / ready {proof.ready} / env {proof.needsEnv} / partial {proof.partial}
              <div className="mt-1 opacity-45">
                installs {proof.installPassed} / checks {proof.checksPassed} / servers {proof.serversPassed} / failures {proof.failures}
              </div>
              {proof.warnings.length > 0 && (
                <div className="mt-1 text-[hsl(var(--accent))] opacity-70">{proof.warnings.slice(0, 2).join(" / ")}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>machine readiness</PaneHeader>
      <div className="max-w-6xl px-6 py-6">
        <MachineSetupHero clerkId={clerkId} onCopied={handleCopied} />
        {copiedNotice && (
          <div className="mt-3 border-l border-[hsl(var(--success))]/70 bg-[hsl(var(--success))]/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--success))]">
            {copiedNotice}
          </div>
        )}
        {report?.agentBus && <AgentBusPanel agentBus={report.agentBus} />}
        {report?.skillSync && <SkillSyncProofPanel skillSync={report.skillSync} />}

        <PaneDivider />

        <section className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <PaneSectionLabel>local agent host</PaneSectionLabel>
            <h2 className="font-mono text-[18px] leading-tight text-[hsl(var(--text-primary))]">
              Fresh-computer proof surface for You.md, shared skills, MCP wiring, project clones, resident sync, and env-vault readiness.
            </h2>
            <p className="mt-3 max-w-3xl font-mono text-[11px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-62">
              This localhost-only pane reads safe local metadata from the signed-in machine. It does not read or return raw .env.local values.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["current", "fresh"] as RootMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRootMode(mode)}
                className={[
                  "h-8 px-3 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors",
                  rootMode === mode
                    ? "bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))]"
                    : "bg-[hsl(var(--bg))]/60 text-[hsl(var(--text-secondary))] opacity-55 hover:opacity-85",
                ].join(" ")}
              >
                {mode === "current" ? "current root" : "fresh root"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void load()}
              className="flex h-8 items-center gap-2 bg-[hsl(var(--bg))]/60 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-60 transition-opacity hover:opacity-90"
            >
              <RefreshCw size={13} />
              refresh
            </button>
          </div>
        </section>

        {loading && (
          <div className="mt-6 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 font-mono text-[11px] text-[hsl(var(--text-secondary))] opacity-55">
            reading local machine state...
          </div>
        )}

        {error && (
          <div className="mt-6 border-l border-red-400/70 bg-red-400/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-red-300">
            {error}
          </div>
        )}

        {!report && syncedProofsSection}

        {report && (
          <>
            <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <StatCell label="status" value={report.summary.status} />
              <StatCell label="daemons" value={`${report.summary.daemonsLoaded}/${report.summary.daemonsTotal}`} />
              <StatCell label="projects ready" value={`${report.summary.projectReady}/${report.summary.projectScanned}`} />
              <StatCell label="env locals" value={report.summary.envLocal} />
              <StatCell label="project context" value={report.summary.projectContext} />
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
              <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/30 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{report.hostName}</span>
                  <span className={`font-mono text-[9px] uppercase tracking-[0.16em] ${statusClass(report.summary.status)}`}>
                    {report.summary.status}
                  </span>
                  <span className="ml-auto font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                    {formatTime(report.generatedAt)}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                  scanning {report.scanRoot}
                </div>
                <div className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-42">
                  fresh-machine target {report.freshMachineRoot}
                </div>
              </div>
              <div className="border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/30 px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-65">
                  current blockers
                </div>
                <div className="mt-2 space-y-1.5">
                  {report.summary.warnings.length > 0 ? (
                    report.summary.warnings.map((warning) => (
                      <div key={warning} className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-58">
                        {warning}
                      </div>
                    ))
                  ) : (
                    <div className="font-mono text-[10px] text-[hsl(var(--success))]">no readiness blockers observed</div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/30 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--accent))] opacity-65">
                  latest machine proof
                </span>
                {report.latestProof ? (
                  <>
                    <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${proofStatusClass(report.latestProof.status)}`}>
                      {report.latestProof.status}
                    </span>
                    <span className="font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                      {formatTime(report.latestProof.generatedAt)}
                    </span>
                  </>
                ) : (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--text-secondary))] opacity-45">
                    not observed
                  </span>
                )}
              </div>
              {report.latestProof ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.85fr]">
                  <div>
                    <div className="font-mono text-[11px] text-[hsl(var(--text-primary))]">
                      {report.latestProof.hostName} / {report.latestProof.rootDir}
                    </div>
                    <div className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                      scanned {report.latestProof.scanned} projects / ready {report.latestProof.ready} / needs env {report.latestProof.needsEnv} / partial {report.latestProof.partial}
                    </div>
                    <div className="mt-1 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-42">
                      installs {report.latestProof.installPassed} / checks {report.latestProof.checksPassed} / servers {report.latestProof.serversPassed} / failures {report.latestProof.failures}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                    {report.latestProof.warnings.length > 0
                      ? report.latestProof.warnings.slice(0, 3).join(" / ")
                      : `proof report saved at ${report.latestProof.reportPath}; secret values exposed: ${String(report.latestProof.secretValuesExposed)}`}
                  </div>
                </div>
              ) : (
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                  Run the full fresh-root proof command below after cloning/restoring envs on a new host. The CLI writes a secret-safe JSON artifact to ~/.youmd/machine-reports/latest.json.
                </p>
              )}
            </div>

            {syncedProofsSection}

            <PaneDivider />

            <section>
              <PaneSectionLabel>resident sync daemons</PaneSectionLabel>
              <div className="space-y-2">
                {report.daemons.map((daemon) => (
                  <div key={daemon.label} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.75fr_0.65fr_1fr]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{daemon.name}</span>
                        <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${daemon.loaded ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}`}>
                          {daemon.loaded ? "loaded" : "not loaded"}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-42">
                        {daemon.intervalSeconds > 0 ? `every ${Math.round(daemon.intervalSeconds / 60)}m` : "live websocket"} / {daemon.label}
                      </div>
                    </div>
                    <div className="font-mono text-[10px] text-[hsl(var(--text-secondary))] opacity-50">
                      {daemon.command}
                      <div className="mt-1 opacity-45">{formatTime(daemon.lastActivityAt)}</div>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                      {daemon.warning ?? daemon.lastLogLine ?? "no daemon log yet"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <PaneDivider />

            <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <div>
                <PaneSectionLabel>local agent stack</PaneSectionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  <BooleanCell label="youmd config" value={report.agentStack.hasYoumdConfig} />
                  <BooleanCell label="api key present" value={report.agentStack.hasApiKey} />
                  <BooleanCell label="shared sync script" value={report.agentStack.syncScriptPresent} />
                  <BooleanCell label="codex skills mirror" value={report.agentStack.codexSkillsPresent} />
                  <BooleanCell label="claude skills mirror" value={report.agentStack.claudeSkillsPresent} />
                  <BooleanCell label="youmd skill cache" value={report.agentStack.youmdSkillsPresent} />
                  <BooleanCell label="clarity skill proof" value={report.skillSync.status === "ready"} />
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                  {report.agentStack.youmdCliPath ?? "youmd cli not found"} / {report.agentStack.sharedSkillCount} shared skills indexed / {report.skillSync.highlightedSkill.name} {report.skillSync.status}
                </p>
              </div>
              <div>
                <PaneSectionLabel>mcp + env vault</PaneSectionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  <BooleanCell label="codex mcp config" value={report.mcp.codexConfigPresent} />
                  <BooleanCell label="claude mcp config" value={report.mcp.claudeConfigPresent} />
                  <BooleanCell label="env audit tool" value={report.envVault.auditToolPresent} />
                  <BooleanCell label="env backup script" value={report.envVault.backupScriptPresent} />
                  <BooleanCell label="env restore script" value={report.envVault.restoreScriptPresent} />
                  <BooleanCell label="private vault key" value={report.envVault.privateVaultKeyPresent} />
                  <BooleanCell label="vault snapshot" value={report.envVault.accountSnapshotStatus === "ready"} />
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                  launcher: {report.mcp.expectedLauncher}. secret values exposed: {String(report.envVault.secretValuesExposed)}.
                </p>
                <div className="mt-3 border-l border-[hsl(var(--border))]/70 bg-[hsl(var(--bg))]/35 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--accent))]">
                      secret vault
                    </span>
                    <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.14em] ${report.envVault.accountSnapshotStatus === "ready" ? "text-[hsl(var(--success))]" : "text-[hsl(var(--accent))]"}`}>
                      {report.envVault.accountSnapshotStatus}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-55">
                    {report.envVault.accountSnapshotSummary ?? "realtime daemon has not published trusted-device Secret Vault status yet"}
                  </p>
                  {report.envVault.latestAccountSnapshot && (
                    <div className="mt-2 font-mono text-[9.5px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-45">
                      {report.envVault.latestAccountSnapshot.fileName ?? "encrypted snapshot"} / {report.envVault.latestAccountSnapshot.projectCount ?? 0} projects / {report.envVault.latestAccountSnapshot.variableCount ?? 0} vars / {report.envVault.latestAccountSnapshot.sourceHost ?? "unknown host"} / {report.envVault.latestAccountSnapshot.sha256Short ?? "checksum pending"}
                    </div>
                  )}
                  {report.envVault.accountSnapshotUpdatedAt && (
                    <div className="mt-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-35">
                      realtime observed {formatTime(report.envVault.accountSnapshotUpdatedAt)}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <PaneDivider />

            <section>
              <PaneSectionLabel>project clone readiness</PaneSectionLabel>
              <div className="grid gap-2 sm:grid-cols-4">
                <StatCell label="git repos" value={report.projects.totals.gitRepos} />
                <StatCell label="packages" value={report.projects.totals.packageProjects} />
                <StatCell label="env examples" value={report.projects.totals.envExample} />
                <StatCell label="agent docs" value={report.projects.totals.agentDocs} />
              </div>
              <div className="mt-4 space-y-2">
                {topProjects.map((project) => (
                  <div key={project.projectDir} className="grid gap-3 border-l border-[hsl(var(--border))]/80 bg-[hsl(var(--bg))]/35 px-4 py-3 lg:grid-cols-[0.7fr_0.8fr_1fr]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12px] text-[hsl(var(--text-primary))]">{project.dirName}</span>
                        <span className={`ml-auto font-mono text-[9px] uppercase tracking-[0.14em] ${statusClass(project.status)}`}>
                          {project.status}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-40">
                        {project.remoteUrl ?? project.projectDir}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        project.isGitRepo ? "git" : "no git",
                        project.packageManager ?? "no package",
                        project.hasEnvLocal ? ".env.local" : "needs env",
                        project.hasProjectContext ? "context" : "no context",
                        project.hasAgentDocs ? "agent docs" : "no agent docs",
                      ].map((tag) => (
                        <span key={`${project.projectDir}-${tag}`} className="border border-[hsl(var(--border))]/70 px-2 py-1 font-mono text-[9px] text-[hsl(var(--text-secondary))] opacity-50">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                      {project.notes.length > 0 ? project.notes.join(" / ") : project.suggestedChecks.slice(0, 3).join(" / ") || "standard checks not detected"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <PaneDivider />

            <section>
              <PaneSectionLabel>copyable local checks</PaneSectionLabel>
              <p className="mb-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-52">
                Fresh-machine handoff starts from the shell or CLI, uses the Portfolio Graph setup gate, and requires an encrypted env vault before strict proof can be marked complete.
              </p>
              <div className="space-y-2">
                <CopyableCommand command={freshComputerShellCommand} />
                <CopyableCommand command={freshComputerPromptCommand} />
                <CopyableCommand command={sourceEnvVaultBackupCommand} dimmed />
                <CopyableCommand command={report.commands.verifyCurrent} />
                <CopyableCommand command={report.commands.verifyFresh} dimmed />
                <CopyableCommand command={report.commands.verifyFreshFull} dimmed />
                <CopyableCommand command={report.commands.daemonStatus} dimmed />
                <CopyableCommand command={report.commands.envBackup} dimmed />
                <CopyableCommand command={report.commands.envRestore} dimmed />
                {report.envVault.accountPullCommand && <CopyableCommand command={report.envVault.accountPullCommand} dimmed />}
                {report.envVault.accountRestoreCommand && <CopyableCommand command={report.envVault.accountRestoreCommand} dimmed />}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
