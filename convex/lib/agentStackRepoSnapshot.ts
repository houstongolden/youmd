type MaybeNumber = number | null | undefined;
type MaybeString = string | null | undefined;

export type AgentStackRepoInventory = {
  machineKey: string;
  hostName: string;
  platform?: MaybeString;
  rootDir: string;
  inventorySchemaVersion?: MaybeString;
  uniqueSkillNames: number;
  uniqueRealSkillFiles: number;
  directExposureSkillRecords: number;
  canonicalSkillFiles: number;
  youmdCatalogSkills: number;
  missingFromYoumdCatalog: number;
  duplicateNameDifferentRealpaths: number;
  sameRealpathMirrors: number;
  projectSignals: number;
  ownershipRollup?: Record<string, unknown>;
  syncPolicyRollup?: Record<string, unknown>;
  provenanceRollup?: Record<string, unknown>;
  missingCatalogSamples?: string[];
  duplicateNameSamples?: string[];
  mirrorSamples?: string[];
  source?: MaybeString;
  agentName?: MaybeString;
  secretValuesExposed: boolean;
  generatedAt: number;
  updatedAt: number;
};

export type AgentStackRepoSnapshotFile = {
  path: string;
  content: string;
};

const SNAPSHOT_VERSION = "you-md/agent-stack-repo-snapshot/v1";
const MAX_INVENTORIES = 20;
const MAX_SAMPLE_ITEMS = 24;
const SECRET_ASSIGNMENT_PATTERN =
  /\b([A-Z][A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*)\s*=\s*[^\s,;]+/gi;
const SECRET_TOKEN_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
  /\bym_[A-Za-z0-9_=-]{16,}\b/g,
];

function cleanText(value: MaybeString, maxChars = 320): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return undefined;
  let cleaned = text.replace(/\s+/g, " ");
  cleaned = cleaned.replace(SECRET_ASSIGNMENT_PATTERN, (_match, keyName: string) => `${keyName}=[REDACTED_SECRET]`);
  for (const pattern of SECRET_TOKEN_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED_SECRET]");
  }
  return cleaned.slice(0, maxChars);
}

function cleanList(value: string[] | undefined, limit = MAX_SAMPLE_ITEMS): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => cleanText(item, 180))
        .filter((item): item is string => Boolean(item))
        .slice(0, limit)
    : [];
}

function safeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function dateStamp(value: MaybeNumber): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : "unknown";
}

function tableCell(value: unknown): string {
  const text = cleanText(typeof value === "string" ? value : String(value ?? ""), 240) ?? "-";
  return text.replace(/\|/g, "\\|");
}

function cleanRollup(value: Record<string, unknown> | undefined): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const rows: Array<[string, number]> = [];
  for (const [key, raw] of Object.entries(value)) {
    const name = cleanText(key, 80);
    const count = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : undefined;
    if (name && count !== undefined) rows.push([name, count]);
  }
  return Object.fromEntries(rows.sort((a, b) => b[1] - a[1]).slice(0, 40));
}

function compactInventory(row: AgentStackRepoInventory) {
  return {
    machineKey: cleanText(row.machineKey, 120) ?? "unknown-machine",
    hostName: cleanText(row.hostName, 180) ?? "unknown-host",
    platform: cleanText(row.platform, 180),
    rootDir: cleanText(row.rootDir, 700) ?? "unknown-root",
    inventorySchemaVersion: cleanText(row.inventorySchemaVersion, 80),
    counts: {
      uniqueSkillNames: safeCount(row.uniqueSkillNames),
      uniqueRealSkillFiles: safeCount(row.uniqueRealSkillFiles),
      directExposureSkillRecords: safeCount(row.directExposureSkillRecords),
      canonicalSkillFiles: safeCount(row.canonicalSkillFiles),
      youmdCatalogSkills: safeCount(row.youmdCatalogSkills),
      missingFromYoumdCatalog: safeCount(row.missingFromYoumdCatalog),
      duplicateNameDifferentRealpaths: safeCount(row.duplicateNameDifferentRealpaths),
      sameRealpathMirrors: safeCount(row.sameRealpathMirrors),
      projectSignals: safeCount(row.projectSignals),
    },
    ownershipRollup: cleanRollup(row.ownershipRollup),
    syncPolicyRollup: cleanRollup(row.syncPolicyRollup),
    provenanceRollup: cleanRollup(row.provenanceRollup),
    missingCatalogSamples: cleanList(row.missingCatalogSamples),
    duplicateNameSamples: cleanList(row.duplicateNameSamples),
    mirrorSamples: cleanList(row.mirrorSamples),
    source: cleanText(row.source, 80),
    agentName: cleanText(row.agentName, 160),
    secretValuesExposed: row.secretValuesExposed === true,
    generatedAt: row.generatedAt,
    updatedAt: row.updatedAt,
  };
}

function compactInventories(inventories: AgentStackRepoInventory[], generatedAt: string) {
  const rows = [...inventories]
    .sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0))
    .slice(0, MAX_INVENTORIES)
    .map(compactInventory);
  const latest = rows[0];
  return {
    schemaVersion: SNAPSHOT_VERSION,
    generatedAt,
    counts: {
      machines: rows.length,
      latestUniqueSkillNames: latest?.counts.uniqueSkillNames ?? 0,
      latestYoumdCatalogSkills: latest?.counts.youmdCatalogSkills ?? 0,
      latestMissingFromYoumdCatalog: latest?.counts.missingFromYoumdCatalog ?? 0,
      latestDryReviewCases: latest?.counts.duplicateNameDifferentRealpaths ?? 0,
      latestMirrorClusters: latest?.counts.sameRealpathMirrors ?? 0,
    },
    inventories: rows,
    security: {
      secretValuesExposed: rows.some((row) => row.secretValuesExposed),
      note: "This repo snapshot stores safe metadata only: counts, rollups, short sample names, and local report paths. Raw skill bodies, prompt logs, env values, tokens, and secret material are excluded.",
    },
  };
}

function renderRollup(title: string, rows: Record<string, number>): string[] {
  const entries = Object.entries(rows);
  return [
    `### ${title}`,
    "",
    ...(entries.length
      ? entries.map(([name, count]) => `- ${name}: ${count}`)
      : ["- none tracked yet"]),
    "",
  ];
}

function renderReadme(snapshot: ReturnType<typeof compactInventories>): string {
  return [
    "# Agent Stack Inventory",
    "",
    "Repo-backed snapshot maintained by You.md. Local agents use this folder to compare trusted machines, inspect skill catalog drift, and understand canonical/shared/external skill ownership without crawling every local path first.",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    "## Files",
    "",
    "- `inventory.md` — human-readable machine and skill mesh summary",
    "- `inventory.json` — compact machine-readable inventory summary",
    "",
    "## Latest Counts",
    "",
    `- machines: ${snapshot.counts.machines}`,
    `- latest unique skill names: ${snapshot.counts.latestUniqueSkillNames}`,
    `- latest You.md catalog skills: ${snapshot.counts.latestYoumdCatalogSkills}`,
    `- latest catalog gaps: ${snapshot.counts.latestMissingFromYoumdCatalog}`,
    `- latest DRY review cases: ${snapshot.counts.latestDryReviewCases}`,
    `- latest mirror clusters: ${snapshot.counts.latestMirrorClusters}`,
    "",
    "This snapshot intentionally excludes raw skill bodies, prompt logs, `.env.local` values, API keys, auth tokens, and secret material.",
    "",
  ].join("\n");
}

function renderMarkdown(snapshot: ReturnType<typeof compactInventories>): string {
  const machineRows = snapshot.inventories.map((row) =>
    `| ${tableCell(row.hostName)} | ${tableCell(row.platform)} | ${tableCell(row.rootDir)} | ${row.counts.uniqueSkillNames} | ${row.counts.youmdCatalogSkills} | ${row.counts.missingFromYoumdCatalog} | ${row.counts.duplicateNameDifferentRealpaths} | ${row.counts.sameRealpathMirrors} | ${dateStamp(row.generatedAt)} |`
  );
  const latest = snapshot.inventories[0];

  return [
    "# Agent Stack Inventory Snapshot",
    "",
    `Generated: ${snapshot.generatedAt}`,
    "",
    "This is a portable, repo-backed summary generated from You.md's persisted local/global agent stack inventory. It is designed for Claude Code, Codex, Cursor, MCP clients, fresh-machine setup, and future You.md Skill Mesh UI.",
    "",
    "Security contract: raw skill bodies, prompt logs, `.env.local` values, API keys, auth tokens, and secret material are not stored here.",
    "",
    "## Machines",
    "",
    "| Host | Platform | Root | Unique Skills | You.md Catalog | Catalog Gaps | DRY Reviews | Mirror Clusters | Generated |",
    "|---|---|---|---:|---:|---:|---:|---:|---|",
    ...(machineRows.length ? machineRows : ["| none | - | - | 0 | 0 | 0 | 0 | 0 | - |"]),
    "",
    ...(latest
      ? [
          "## Latest Machine Samples",
          "",
          `Host: ${latest.hostName}`,
          "",
          "### Missing From You.md Catalog",
          "",
          ...(latest.missingCatalogSamples.length ? latest.missingCatalogSamples.map((name) => `- ${name}`) : ["- none"]),
          "",
          "### DRY Review Candidates",
          "",
          ...(latest.duplicateNameSamples.length ? latest.duplicateNameSamples.map((name) => `- ${name}`) : ["- none"]),
          "",
          "### Healthy Mirror Clusters",
          "",
          ...(latest.mirrorSamples.length ? latest.mirrorSamples.map((name) => `- ${name}`) : ["- none"]),
          "",
          ...renderRollup("Ownership Rollup", latest.ownershipRollup),
          ...renderRollup("Sync Policy Rollup", latest.syncPolicyRollup),
          ...renderRollup("Provenance Rollup", latest.provenanceRollup),
        ]
      : []),
  ].join("\n");
}

export function buildAgentStackRepoSnapshotFiles(
  inventories: AgentStackRepoInventory[],
  generatedAt = new Date().toISOString()
): AgentStackRepoSnapshotFile[] {
  const snapshot = compactInventories(inventories, generatedAt);
  return [
    {
      path: "agent-stack/README.md",
      content: renderReadme(snapshot),
    },
    {
      path: "agent-stack/inventory.md",
      content: renderMarkdown(snapshot),
    },
    {
      path: "agent-stack/inventory.json",
      content: `${JSON.stringify(snapshot)}\n`,
    },
  ];
}
