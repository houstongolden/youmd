import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export type RealtimeSyncHead = {
  schemaVersion?: string;
  serverNow?: number;
  sessionExpiresAt?: number;
  user?: { username?: string; plan?: string };
  identity?: {
    latestVersion?: number | null;
    latestHash?: string | null;
    publishedVersion?: number | null;
    publishedHash?: string | null;
    latestCreatedAt?: number | null;
    latestPublishedAt?: number | null;
  };
  skills?: {
    installedCount?: number;
    latestInstalledAt?: number | null;
    names?: string[];
  };
  portfolio?: {
    updatedAt?: number | null;
    projects?: number;
    activeFocusedProjects?: number;
    apiSurfaces?: number;
    dependencyEdges?: number;
    reusablePatterns?: number;
    activities?: number;
    providerAccounts?: number;
    tasks?: number;
    brainDumps?: number;
    machineProofs?: number;
  };
  agentBus?: {
    status?: "active" | "idle" | string;
    channelCount?: number;
    recentCount?: number;
    latestMessageAt?: number | null;
    messages?: RealtimeAgentMessage[];
    secretValuesExposed?: false;
  };
  repoMirror?: {
    repoFullName?: string | null;
    commitSha?: string | null;
    fileCount?: number;
    totalBytes?: number;
    truncated?: boolean;
    syncedAt?: number;
  } | null;
  github?: {
    repoFullName?: string | null;
    lastSyncedAt?: number | null;
    lastPushedCommitSha?: string | null;
    mirrorStale?: boolean;
    lastPushErrorAt?: number | null;
  } | null;
  encryptedEnvVault?: {
    status?: "ready" | "missing" | "scope-missing" | string;
    flow?: string;
    available?: boolean;
    snapshotCount?: number;
    id?: string | null;
    label?: string | null;
    createdAt?: number | null;
    fileName?: string | null;
    contentType?: string | null;
    encryptionTool?: string | null;
    extension?: string | null;
    formatVersion?: number | null;
    sizeBytes?: number | null;
    projectCount?: number | null;
    variableCount?: number | null;
    sha256?: string | null;
    manifestSha256?: string | null;
    agentAuthIncluded?: boolean;
    sourceHost?: string | null;
    sourceRoot?: string | null;
    restoreMode?: string;
    scope?: string;
    secretValuesExposed?: false;
  };
};

export const REALTIME_SYNC_STATUS_PATH = path.join(os.homedir(), ".youmd", "realtime-sync-status.json");
export const REALTIME_AGENT_INBOX_PATH = path.join(os.homedir(), ".youmd", "agent-bus", "inbox.json");

export type RealtimeAgentMessage = {
  id?: string;
  messageId: string;
  channel: string;
  kind: string;
  body: string;
  sourceHost?: string | null;
  sourceAgent: string;
  sourceRuntime?: string | null;
  targetHost?: string | null;
  targetAgent?: string | null;
  metadata?: unknown;
  createdAt: number;
  secretValuesExposed: false;
};

export type RealtimeAgentBusStatus = {
  state: "active" | "idle" | "unknown";
  summary: string;
  channelCount: number;
  recentCount: number;
  latestMessageAt?: number | null;
  messages: RealtimeAgentMessage[];
  inboxPath: string;
  sendCommand: string;
  secretValuesExposed: false;
};

export type RealtimeSecretVaultStatus = {
  state: "ready" | "missing" | "scope-missing" | "unknown";
  flow: "account-backed-encrypted-snapshot";
  available: boolean;
  snapshotCount: number;
  summary: string;
  latestSnapshot?: {
    id?: string | null;
    label?: string | null;
    fileName?: string | null;
    createdAt?: number | null;
    sizeBytes?: number | null;
    projectCount?: number | null;
    variableCount?: number | null;
    sha256?: string | null;
    sha256Short?: string | null;
    manifestSha256?: string | null;
    encryptionTool?: string | null;
    extension?: string | null;
    formatVersion?: number | null;
    agentAuthIncluded?: boolean;
    sourceHost?: string | null;
    sourceRoot?: string | null;
  };
  pullCommand: string;
  restoreCommand: string;
  secretValuesExposed: false;
};

export type RealtimeSyncStatusFile = {
  schemaVersion: "you-md/realtime-sync-daemon-status/v1";
  generatedAt: number;
  summary: string;
  user?: RealtimeSyncHead["user"];
  identity?: RealtimeSyncHead["identity"];
  skills?: { installedCount?: number; latestInstalledAt?: number | null };
  portfolio?: RealtimeSyncHead["portfolio"];
  agentBus: RealtimeAgentBusStatus;
  repoMirror?: RealtimeSyncHead["repoMirror"];
  github?: RealtimeSyncHead["github"];
  secretVault: RealtimeSecretVaultStatus;
  secretValuesExposed: false;
};

function shortSha(value?: string | null): string | null {
  if (!value) return null;
  return value.length <= 16 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`;
}

export function describeRealtimeSecretVault(head: RealtimeSyncHead | null | undefined): RealtimeSecretVaultStatus {
  const vault = head?.encryptedEnvVault;
  const state = vault?.status === "ready"
    ? "ready"
    : vault?.status === "scope-missing" || vault?.scope === "vault-not-granted"
      ? "scope-missing"
      : vault
        ? "missing"
        : "unknown";
  const pullCommand = "youmd env vault pull --out ~/.youmd/secret-vault";
  const restoreCommand = "youmd env vault pull --restore --root ~/Desktop/CODE_YOU --map-existing --existing-only --skip-agent-auth";

  if (state === "ready") {
    const projects = vault?.projectCount ?? 0;
    const vars = vault?.variableCount ?? 0;
    const source = vault?.sourceHost ? ` from ${vault.sourceHost}` : "";
    const hash = shortSha(vault?.sha256);
    return {
      state,
      flow: "account-backed-encrypted-snapshot",
      available: true,
      snapshotCount: vault?.snapshotCount ?? 1,
      summary: `Secret Vault ready: ${projects} projects / ${vars} vars${source}${hash ? ` / ${hash}` : ""}`,
      latestSnapshot: {
        id: vault?.id ?? null,
        label: vault?.label ?? null,
        fileName: vault?.fileName ?? null,
        createdAt: vault?.createdAt ?? null,
        sizeBytes: vault?.sizeBytes ?? null,
        projectCount: vault?.projectCount ?? null,
        variableCount: vault?.variableCount ?? null,
        sha256: vault?.sha256 ?? null,
        sha256Short: hash,
        manifestSha256: vault?.manifestSha256 ?? null,
        encryptionTool: vault?.encryptionTool ?? null,
        extension: vault?.extension ?? null,
        formatVersion: vault?.formatVersion ?? null,
        agentAuthIncluded: vault?.agentAuthIncluded === true,
        sourceHost: vault?.sourceHost ?? null,
        sourceRoot: vault?.sourceRoot ?? null,
      },
      pullCommand,
      restoreCommand,
      secretValuesExposed: false,
    };
  }

  if (state === "scope-missing") {
    return {
      state,
      flow: "account-backed-encrypted-snapshot",
      available: false,
      snapshotCount: 0,
      summary: "Secret Vault unknown: current realtime key lacks vault scope",
      pullCommand,
      restoreCommand,
      secretValuesExposed: false,
    };
  }

  if (state === "missing") {
    return {
      state,
      flow: "account-backed-encrypted-snapshot",
      available: false,
      snapshotCount: vault?.snapshotCount ?? 0,
      summary: "Secret Vault missing: upload encrypted snapshot from the source Mac with `youmd env vault push`",
      pullCommand,
      restoreCommand,
      secretValuesExposed: false,
    };
  }

  return {
    state,
    flow: "account-backed-encrypted-snapshot",
    available: false,
    snapshotCount: 0,
    summary: "Secret Vault not observed yet: realtime daemon has not received a vault-scoped sync head",
    pullCommand,
    restoreCommand,
    secretValuesExposed: false,
  };
}

export function describeRealtimeAgentBus(head: RealtimeSyncHead | null | undefined): RealtimeAgentBusStatus {
  const bus = head?.agentBus;
  const messages = (bus?.messages ?? [])
    .filter((message): message is RealtimeAgentMessage => {
      return Boolean(
        message &&
        typeof message.messageId === "string" &&
        typeof message.body === "string" &&
        message.secretValuesExposed === false,
      );
    })
    .slice(-12);
  const latest = bus?.latestMessageAt ?? (messages.length ? messages[messages.length - 1]?.createdAt : null);
  const state = bus?.status === "active" || messages.length ? "active" : bus ? "idle" : "unknown";
  const latestLabel = latest ? new Date(latest).toISOString() : "none yet";
  return {
    state,
    summary: state === "unknown"
      ? "Agent bus not observed yet"
      : `${messages.length} recent agent message${messages.length === 1 ? "" : "s"} / latest ${latestLabel}`,
    channelCount: bus?.channelCount ?? new Set(messages.map((message) => message.channel)).size,
    recentCount: bus?.recentCount ?? messages.length,
    latestMessageAt: latest,
    messages,
    inboxPath: REALTIME_AGENT_INBOX_PATH,
    sendCommand: 'youmd agent send "hello from this Mac"',
    secretValuesExposed: false,
  };
}

export function realtimeSyncHeadSignature(head: RealtimeSyncHead | null | undefined): string {
  if (!head) return "none";
  return JSON.stringify({
    identity: {
      latestVersion: head.identity?.latestVersion ?? null,
      latestHash: head.identity?.latestHash ?? null,
      publishedVersion: head.identity?.publishedVersion ?? null,
      publishedHash: head.identity?.publishedHash ?? null,
    },
    skills: {
      installedCount: head.skills?.installedCount ?? 0,
      latestInstalledAt: head.skills?.latestInstalledAt ?? null,
      names: head.skills?.names ?? [],
    },
    portfolio: head.portfolio ?? null,
    agentBus: {
      status: head.agentBus?.status ?? null,
      latestMessageAt: head.agentBus?.latestMessageAt ?? null,
      recentCount: head.agentBus?.recentCount ?? 0,
      messages: (head.agentBus?.messages ?? []).map((message) => ({
        messageId: message.messageId,
        channel: message.channel,
        kind: message.kind,
        body: message.body,
        sourceHost: message.sourceHost ?? null,
        sourceAgent: message.sourceAgent,
        targetHost: message.targetHost ?? null,
        targetAgent: message.targetAgent ?? null,
        createdAt: message.createdAt,
      })),
    },
    repoMirror: head.repoMirror ?? null,
    github: head.github ?? null,
    encryptedEnvVault: {
      status: head.encryptedEnvVault?.status ?? null,
      available: head.encryptedEnvVault?.available ?? false,
      snapshotCount: head.encryptedEnvVault?.snapshotCount ?? 0,
      id: head.encryptedEnvVault?.id ?? null,
      createdAt: head.encryptedEnvVault?.createdAt ?? null,
      fileName: head.encryptedEnvVault?.fileName ?? null,
      sha256: head.encryptedEnvVault?.sha256 ?? null,
      manifestSha256: head.encryptedEnvVault?.manifestSha256 ?? null,
      projectCount: head.encryptedEnvVault?.projectCount ?? null,
      variableCount: head.encryptedEnvVault?.variableCount ?? null,
      sourceHost: head.encryptedEnvVault?.sourceHost ?? null,
      sourceRoot: head.encryptedEnvVault?.sourceRoot ?? null,
    },
  });
}

export function summarizeRealtimeSyncHead(head: RealtimeSyncHead): string {
  const bundle = head.identity?.latestVersion
    ? `bundle v${head.identity.latestVersion}`
    : "bundle unknown";
  const skills = `${head.skills?.installedCount ?? 0} skills`;
  const projects = `${head.portfolio?.projects ?? 0} projects`;
  const tasks = `${head.portfolio?.tasks ?? 0} tasks`;
  const agentMessages = `${head.agentBus?.recentCount ?? 0} agent msgs`;
  const vault = describeRealtimeSecretVault(head).summary;
  return `${bundle}, ${skills}, ${projects}, ${tasks}, ${agentMessages}, ${vault}`;
}

export function buildRealtimeSyncStatusFile(head: RealtimeSyncHead): RealtimeSyncStatusFile {
  return {
    schemaVersion: "you-md/realtime-sync-daemon-status/v1",
    generatedAt: Date.now(),
    summary: summarizeRealtimeSyncHead(head),
    user: head.user,
    identity: head.identity,
    skills: {
      installedCount: head.skills?.installedCount,
      latestInstalledAt: head.skills?.latestInstalledAt ?? null,
    },
    portfolio: head.portfolio,
    agentBus: describeRealtimeAgentBus(head),
    repoMirror: head.repoMirror,
    github: head.github,
    secretVault: describeRealtimeSecretVault(head),
    secretValuesExposed: false,
  };
}

export function writeRealtimeSyncStatusFile(head: RealtimeSyncHead): void {
  fs.mkdirSync(path.dirname(REALTIME_SYNC_STATUS_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    REALTIME_SYNC_STATUS_PATH,
    JSON.stringify(buildRealtimeSyncStatusFile(head), null, 2),
    { mode: 0o600 },
  );
  writeRealtimeAgentInboxFile(head);
}

export function readRealtimeSyncStatusFile(): RealtimeSyncStatusFile | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(REALTIME_SYNC_STATUS_PATH, "utf-8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.secretValuesExposed !== false) return null;
    return parsed as RealtimeSyncStatusFile;
  } catch {
    return null;
  }
}

export function writeRealtimeAgentInboxFile(head: RealtimeSyncHead): void {
  const agentBus = describeRealtimeAgentBus(head);
  fs.mkdirSync(path.dirname(REALTIME_AGENT_INBOX_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    REALTIME_AGENT_INBOX_PATH,
    JSON.stringify(
      {
        schemaVersion: "you-md/realtime-agent-bus-inbox/v1",
        generatedAt: Date.now(),
        ...agentBus,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
}

export function shouldRunBoundedSync(
  lastRunAt: number,
  now: number,
  minIntervalMs: number,
): boolean {
  return lastRunAt === 0 || now - lastRunAt >= minIntervalMs;
}
