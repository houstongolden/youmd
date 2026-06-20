import type { LocalMachineReadiness } from "@/lib/local-machine-readiness.server";
import type {
  SyncedBrainGraphActivity,
  SyncedBrainGraphLink,
  SyncedBrainGraphNode,
  SyncedBrainGraphSignal,
} from "./SyncedBrainGraph";
import type { PixelCharacterStatus } from "@/components/ui/PixelCharacter";

export type MachineBrainGraphProof = {
  hostName: string;
  status: string;
};

export type MachineBrainGraphEvent = {
  activityId: string;
  source: string;
  title: string;
  status: "live" | "ok" | "warn" | "error" | "info";
  occurredAt: number;
};

export type MachineBrainGraphPortfolio = {
  focusedProjectCount?: number;
  openTaskCount?: number;
  latestProjectSignal?: {
    projectSlug: string;
    occurredAt: number;
  } | null;
};

export type MachineBrainGraphModel = {
  nodes: SyncedBrainGraphNode[];
  links: SyncedBrainGraphLink[];
  signals: SyncedBrainGraphSignal[];
  latestActivity: SyncedBrainGraphActivity[];
};

export function buildMachineBrainGraphModel({
  report,
  syncedProofs,
  brainActivities,
  portfolio,
}: {
  report: LocalMachineReadiness | null;
  syncedProofs?: MachineBrainGraphProof[];
  brainActivities?: MachineBrainGraphEvent[];
  portfolio?: MachineBrainGraphPortfolio;
}): MachineBrainGraphModel {
  const proofCount = syncedProofs?.length ?? 0;
  const currentHost = report?.hostName ?? syncedProofs?.[0]?.hostName ?? "local";
  const trustedHosts = Array.from(new Set((syncedProofs ?? []).map((proof) => proof.hostName).filter(Boolean))).slice(0, 3);
  const recentActivities = (brainActivities ?? []).filter((activity) =>
    activity.status === "live" || isRecent(activity.occurredAt, 12)
  );
  const agentBusLive = report?.agentBus?.state === "active" || isRecent(report?.agentBus?.latestMessageAt, 12);
  const skillLive = report?.skillSync?.status === "ready" && isRecent(report.skillSync.highlightedSkill.updatedAt, 60 * 24);
  const projectLive = (report?.summary.projectReady ?? 0) > 0;
  const vaultLive = report?.envVault.accountSnapshotStatus === "ready" || isRecent(report?.envVault.accountSnapshotUpdatedAt, 60 * 24);
  const realtimeLive = Boolean(report?.daemons.some((daemon) => daemon.label.endsWith(".realtime-sync") && daemon.loaded));
  const status = report?.summary.status ?? syncedProofs?.[0]?.status ?? "unknown";
  const projectValue = report
    ? `${report.summary.projectReady}/${report.summary.projectScanned}`
    : portfolio?.focusedProjectCount !== undefined
      ? `${portfolio.focusedProjectCount} focus`
      : "scan";
  const projectDetail = report
    ? `${report.summary.projectContext} contexts / ${report.summary.envLocal} env locals`
    : portfolio?.openTaskCount !== undefined
      ? `${portfolio.openTaskCount} open tasks / portfolio graph`
      : "local readiness not loaded";

  const nodes: SyncedBrainGraphNode[] = [
    {
      id: "brain",
      label: "you.md brain",
      value: recentActivities.length > 0 ? `${recentActivities.length} live` : "ready",
      detail: "Convex activity, identity, sync proof",
      x: 50,
      y: 46,
      kind: "shell",
      status: recentActivities.length > 0 || agentBusLive ? "active" : "ready",
      live: recentActivities.length > 0 || agentBusLive,
      tone: recentActivities.length > 0 || agentBusLive ? "success" : "muted",
    },
    {
      id: "machines",
      label: "trusted Macs",
      value: `${Math.max(proofCount, trustedHosts.length || (report ? 1 : 0))}`,
      detail: [currentHost, ...trustedHosts.filter((host) => host !== currentHost)].slice(0, 3).join(" / ") || "waiting for proof",
      x: 18,
      y: 20,
      kind: "machine",
      status: pixelStatus(status),
      live: realtimeLive || isRecent(report?.generatedAt, 12),
      tone: graphTone(status),
    },
    {
      id: "skills",
      label: "skills",
      value: report?.skillSync ? `${report.skillSync.canonicalCount}` : "sync",
      detail: report?.skillSync ? `${report.skillSync.codexMirrorCount} codex / ${report.skillSync.claudeMirrorCount} claude` : "no local skill proof yet",
      x: 78,
      y: 20,
      kind: "agent",
      status: pixelStatus(report?.skillSync?.status),
      live: skillLive,
      tone: graphTone(report?.skillSync?.status),
    },
    {
      id: "projects",
      label: "projects",
      value: projectValue,
      detail: projectDetail,
      x: 82,
      y: 72,
      kind: "shell",
      status: pixelStatus(report?.summary.status),
      live: projectLive && isRecent(report?.generatedAt, 30),
      tone: graphTone(report?.summary.status),
    },
    {
      id: "vault",
      label: "vault",
      value: report?.envVault.accountSnapshotStatus ?? "unknown",
      detail: report?.envVault.latestAccountSnapshot
        ? `${report.envVault.latestAccountSnapshot.projectCount ?? 0} projects / ${report.envVault.latestAccountSnapshot.variableCount ?? 0} vars`
        : "encrypted metadata only",
      x: 22,
      y: 72,
      kind: "shell",
      status: pixelStatus(report?.envVault.accountSnapshotStatus),
      live: vaultLive,
      tone: graphTone(report?.envVault.accountSnapshotStatus),
    },
    {
      id: "agents",
      label: "agents",
      value: report?.agentBus?.state ?? "quiet",
      detail: report?.agentBus ? `${report.agentBus.recentCount} msgs / ${report.agentBus.channelCount} channels` : "agent bus not observed",
      x: 50,
      y: 10,
      kind: "agent",
      status: pixelStatus(report?.agentBus?.state),
      live: agentBusLive,
      tone: graphTone(report?.agentBus?.state),
    },
    {
      id: "activity",
      label: "activity",
      value: brainActivities ? `${brainActivities.length}` : "--",
      detail: recentActivities[recentActivities.length - 1]?.title ?? "durable brain stream",
      x: 50,
      y: 84,
      kind: "agent",
      status: recentActivities.length > 0 ? "active" : "idle",
      live: recentActivities.length > 0,
      tone: recentActivities.length > 0 ? "success" : "muted",
    },
  ];

  const links: SyncedBrainGraphLink[] = [
    { from: "machines", to: "brain", active: realtimeLive || proofCount > 0 },
    { from: "agents", to: "brain", active: agentBusLive },
    { from: "skills", to: "brain", active: skillLive || report?.skillSync?.status === "ready" },
    { from: "projects", to: "brain", active: projectLive || Boolean(portfolio?.focusedProjectCount) },
    { from: "vault", to: "brain", active: vaultLive },
    { from: "activity", to: "brain", active: recentActivities.length > 0 },
    { from: "skills", to: "projects", active: Boolean(report?.skillSync && report.summary.projectScanned > 0) },
    { from: "agents", to: "activity", active: agentBusLive || recentActivities.some((activity) => activity.source.includes("agent")) },
  ];

  const signals: SyncedBrainGraphSignal[] = [
    { label: "realtime", value: realtimeLive ? "loaded" : "not loaded", live: realtimeLive },
    { label: "agent bus", value: report?.agentBus ? `${report.agentBus.recentCount} messages` : "not observed", live: agentBusLive },
    { label: "activity stream", value: brainActivities ? `${recentActivities.length}/${brainActivities.length} recent` : "loading", live: recentActivities.length > 0 },
    { label: "skill mesh", value: report?.skillSync ? `${report.skillSync.status} / ${report.skillSync.canonicalCount} shared` : "waiting", live: report?.skillSync?.status === "ready" },
    { label: "project graph", value: report ? `${report.summary.projectReady}/${report.summary.projectScanned} ready` : `${portfolio?.focusedProjectCount ?? 0} focused`, live: projectLive || Boolean(portfolio?.focusedProjectCount) },
    { label: "secret vault", value: report?.envVault.accountSnapshotStatus ?? "unknown", live: vaultLive },
  ];

  if (portfolio?.openTaskCount !== undefined) {
    signals.push({ label: "open tasks", value: `${portfolio.openTaskCount}`, live: portfolio.openTaskCount > 0 });
  }
  if (portfolio?.latestProjectSignal) {
    signals.push({
      label: "latest project",
      value: `${portfolio.latestProjectSignal.projectSlug} / ${formatRelativeTime(portfolio.latestProjectSignal.occurredAt)}`,
      live: isRecent(portfolio.latestProjectSignal.occurredAt, 60 * 24),
    });
  }

  return {
    nodes,
    links,
    signals,
    latestActivity: recentActivities.slice(-4).map((activity) => ({
      id: activity.activityId,
      source: activity.source,
      title: activity.title,
    })),
  };
}

function isRecent(value?: string | number | null, minutes = 10) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time < minutes * 60 * 1000;
}

function graphTone(status?: string): SyncedBrainGraphNode["tone"] {
  if (status === "ready" || status === "active" || status === "live" || status === "ok") return "success";
  if (status === "blocked" || status === "failed" || status === "missing" || status === "error") return "danger";
  if (status === "warn" || status === "needs-env" || status === "partial" || status === "scope-missing") return "accent";
  return "muted";
}

function pixelStatus(status?: string): PixelCharacterStatus {
  if (status === "ready") return "ready";
  if (status === "active") return "active";
  if (status === "warn" || status === "needs-env" || status === "partial") return "warn";
  if (status === "failed" || status === "blocked" || status === "missing") return "blocked";
  if (status === "quiet" || status === "waiting") return "idle";
  return "unknown";
}

function formatRelativeTime(value: number) {
  const diffMin = Math.max(0, Math.floor((Date.now() - value) / 60000));
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.floor(diffHours / 24)}d`;
}
