"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { RefreshCw } from "lucide-react";
import type {
  LocalMachineReadiness,
  LocalReadinessStatus,
  LocalProjectReadiness,
} from "@/lib/local-machine-readiness.server";
import { CopyableCommand } from "./CopyableCommand";
import { PaneDivider, PaneHeader, PaneSectionLabel } from "./shared";

type RootMode = "current" | "fresh";

type MachineReadinessPaneProps = {
  clerkId?: string;
};

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

export function MachineReadinessPane({ clerkId }: MachineReadinessPaneProps) {
  const [rootMode, setRootMode] = useState<RootMode>("current");
  const [report, setReport] = useState<LocalMachineReadiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    void load();
  }, [load]);

  const topProjects = useMemo(() => report?.projects.rows.slice(0, 14) ?? [], [report]);

  return (
    <div className="h-full overflow-y-auto">
      <PaneHeader>machine readiness</PaneHeader>
      <div className="max-w-6xl px-6 py-6">
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
                        every {Math.round(daemon.intervalSeconds / 60)}m / {daemon.label}
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
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                  {report.agentStack.youmdCliPath ?? "youmd cli not found"} / {report.agentStack.sharedSkillCount} shared skills indexed
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
                </div>
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-[hsl(var(--text-secondary))] opacity-50">
                  launcher: {report.mcp.expectedLauncher}. secret values exposed: {String(report.envVault.secretValuesExposed)}.
                </p>
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
              <div className="space-y-2">
                <CopyableCommand command={report.commands.verifyCurrent} />
                <CopyableCommand command={report.commands.verifyFresh} dimmed />
                <CopyableCommand command={report.commands.verifyFreshFull} dimmed />
                <CopyableCommand command={report.commands.daemonStatus} dimmed />
                <CopyableCommand command={report.commands.envBackup} dimmed />
                <CopyableCommand command={report.commands.envRestore} dimmed />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
