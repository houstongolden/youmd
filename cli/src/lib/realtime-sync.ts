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
    available?: boolean;
    createdAt?: number | null;
    fileName?: string | null;
    sizeBytes?: number | null;
    projectCount?: number | null;
    variableCount?: number | null;
    sha256?: string | null;
    scope?: string;
    secretValuesExposed?: false;
  };
};

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
    repoMirror: head.repoMirror ?? null,
    github: head.github ?? null,
    encryptedEnvVault: {
      available: head.encryptedEnvVault?.available ?? false,
      createdAt: head.encryptedEnvVault?.createdAt ?? null,
      sha256: head.encryptedEnvVault?.sha256 ?? null,
      projectCount: head.encryptedEnvVault?.projectCount ?? null,
      variableCount: head.encryptedEnvVault?.variableCount ?? null,
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
  const vault = head.encryptedEnvVault?.available ? "vault metadata ready" : "vault metadata absent";
  return `${bundle}, ${skills}, ${projects}, ${tasks}, ${vault}`;
}

export function shouldRunBoundedSync(
  lastRunAt: number,
  now: number,
  minIntervalMs: number,
): boolean {
  return lastRunAt === 0 || now - lastRunAt >= minIntervalMs;
}
