/**
 * Skill catalog — YAML parser/writer for youmd-skills.yaml
 *
 * Manages the catalog of installed/available skills with metadata
 * including identity field requirements and scope.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "js-yaml";
import { getSkillCatalogPath, ensureSkillsDir, readGlobalConfig } from "./config";

export type SkillScope = "shared" | "project" | "private";

export interface SkillEntry {
  name: string;
  description: string;
  version: string;
  source: string;
  scope: SkillScope;
  identity_fields: string[];
  requires: string[];
  installed: boolean;
  catalog_origin?: string;
  owner_classes?: string[];
  provenances?: string[];
  sync_policies?: string[];
  sample_paths?: string[];
}

export interface SkillCatalog {
  version: number;
  owner: string;
  skills: SkillEntry[];
}

type InventorySnapshot = {
  missingFromCatalog?: InventoryCatalogSkill[];
};

/**
 * Default bundled skills that ship with youmd.
 */
function defaultSkills(): SkillEntry[] {
  return [
    {
      name: "youstack-start",
      description: "Start local agents with identity, project state, active requests, skills, and next moves",
      version: "1.0.0",
      source: "bundled:youstack-start.md",
      scope: "shared",
      identity_fields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
      requires: [],
      installed: false,
    },
    {
      name: "youstack-maintainer",
      description: "Organize, update, safely improve, and publish private-by-default YouStacks",
      version: "1.0.0",
      source: "bundled:youstack-maintainer.md",
      scope: "shared",
      identity_fields: ["profile.about", "preferences.agent", "directives.agent", "voice.overall"],
      requires: ["youstack-start"],
      installed: false,
    },
    {
      name: "machine-bootstrap",
      description: "Set up a fresh computer with You.md identity, skills, stacks, agent config, and active project repos",
      version: "1.0.0",
      source: "bundled:machine-bootstrap.md",
      scope: "shared",
      identity_fields: ["profile.about", "profile.projects", "preferences.agent", "directives.agent"],
      requires: ["youstack-start"],
      installed: false,
    },
    {
      name: "portfolio-graph-auditor",
      description: "Audit active projects, API/MCP dependencies, env providers, service accounts, and reusable patterns",
      version: "1.0.0",
      source: "shared:portfolio-graph-auditor",
      scope: "shared",
      identity_fields: ["profile.projects", "preferences.agent", "directives.agent"],
      requires: ["youstack-maintainer", "machine-bootstrap"],
      installed: false,
    },
    {
      name: "claude-md-generator",
      description: "Generate CLAUDE.md from identity + project detection",
      version: "1.0.0",
      source: "bundled:claude-md-generator.md",
      scope: "shared",
      identity_fields: ["preferences.agent", "directives.agent", "voice.overall"],
      requires: [],
      installed: false,
    },
    {
      name: "project-context-init",
      description: "Scaffold project-context/ directory with PRD, TODO, features, changelog",
      version: "1.0.0",
      source: "bundled:project-context-init.md",
      scope: "project",
      identity_fields: ["preferences.agent", "profile.about"],
      requires: [],
      installed: false,
    },
    {
      name: "voice-sync",
      description: "Sync voice profile across all agent tools",
      version: "1.0.0",
      source: "bundled:voice-sync.md",
      scope: "shared",
      identity_fields: ["voice.overall", "voice.writing", "voice.speaking"],
      requires: [],
      installed: false,
    },
    {
      name: "meta-improve",
      description: "Self-improvement protocol — review effectiveness, propose identity updates",
      version: "1.0.0",
      source: "bundled:meta-improve.md",
      scope: "shared",
      identity_fields: ["preferences.agent", "directives.agent"],
      requires: [],
      installed: false,
    },
    {
      name: "proactive-context-fill",
      description: "Detect thin identity context and offer safe additive improvements",
      version: "1.0.0",
      source: "bundled:proactive-context-fill.md",
      scope: "shared",
      identity_fields: ["profile.projects", "profile.about", "preferences.agent", "voice.overall"],
      requires: [],
      installed: false,
    },
    {
      name: "you-logs",
      description: "View recent agent activity and identity access logs inline",
      version: "1.0.0",
      source: "bundled:you-logs.md",
      scope: "shared",
      identity_fields: [],
      requires: [],
      installed: false,
    },
  ];
}

/**
 * Read the skill catalog from disk. Creates default if missing.
 */
export function readSkillCatalog(): SkillCatalog {
  const catalogPath = getSkillCatalogPath();
  const config = readGlobalConfig();
  const owner = config.username || "anonymous";
  const defaults = defaultSkills();

  if (fs.existsSync(catalogPath)) {
    try {
      const raw = fs.readFileSync(catalogPath, "utf-8");
      const parsed = yaml.load(raw) as SkillCatalog;
      if (parsed && parsed.skills) {
        const merged = mergeCatalogWithDefaults(
          {
            version: parsed.version ?? 1,
            owner: parsed.owner || owner,
            skills: parsed.skills,
          },
          defaults
        );
        hydrateCatalogFromLatestInventory(merged);
        writeSkillCatalog(merged);
        return merged;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Create default catalog
  const catalog: SkillCatalog = {
    version: 1,
    owner,
    skills: defaults,
  };

  hydrateCatalogFromLatestInventory(catalog);
  writeSkillCatalog(catalog);
  return catalog;
}

/**
 * Write the skill catalog to disk.
 */
export function writeSkillCatalog(catalog: SkillCatalog): void {
  ensureSkillsDir();
  const catalogPath = getSkillCatalogPath();
  const yamlStr = yaml.dump(catalog, {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  fs.writeFileSync(catalogPath, yamlStr);
}

/**
 * Find a skill entry by name.
 */
export function findSkill(catalog: SkillCatalog, name: string): SkillEntry | undefined {
  return catalog.skills.find(
    (s) => s.name === name || s.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Add a new skill entry to the catalog.
 */
export function addSkillEntry(
  catalog: SkillCatalog,
  entry: Omit<SkillEntry, "installed"> & { installed?: boolean }
): SkillCatalog {
  const existing = findSkill(catalog, entry.name);
  if (existing) {
    // Update existing
    Object.assign(existing, entry);
  } else {
    catalog.skills.push({ installed: false, ...entry });
  }
  writeSkillCatalog(catalog);
  return catalog;
}

export type InventoryCatalogSkill = {
  name?: string;
  ownerClasses?: string[];
  provenances?: string[];
  syncPolicies?: string[];
  samplePaths?: string[];
};

export type InventoryCatalogSyncResult = {
  added: number;
  skipped: number;
  skills: string[];
};

function expandHomePath(p: string): string {
  return p.startsWith("~/") ? `${os.homedir()}${p.slice(1)}` : p;
}

function inventoryScope(skill: InventoryCatalogSkill): SkillScope {
  const owners = skill.ownerClasses || [];
  const policies = skill.syncPolicies || [];
  if (owners.some((owner) => owner.includes("project"))) return "project";
  if (policies.includes("review-before-sync") || owners.includes("agent-host-local")) return "private";
  return "shared";
}

function inventorySource(skill: InventoryCatalogSkill): string {
  const sample = (skill.samplePaths || []).find((p) => p && p.endsWith("/SKILL.md"));
  return sample ? `local:${expandHomePath(sample)}` : `inventory:${skill.name || "unknown"}`;
}

function inventoryDescription(skill: InventoryCatalogSkill): string {
  const owners = (skill.ownerClasses || []).filter(Boolean).join(", ") || "unknown owner";
  const policies = (skill.syncPolicies || []).filter(Boolean).join(", ") || "review-before-sync";
  return `Discovered local/global skill reference (${owners}; ${policies})`;
}

function latestInventoryJsonPath(): string | null {
  const dirs = [
    path.join(os.homedir(), ".you", "agent-stack-inventory"),
    path.join(os.homedir(), ".youmd", "agent-stack-inventory"),
  ];
  const files = dirs.flatMap((dir) => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((file) => /^local-agent-stack-inventory-.*\.json$/.test(file))
      .map((file) => path.join(dir, file));
  }).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs || path.basename(b).localeCompare(path.basename(a)));
  return files[0] || null;
}

function readLatestInventorySnapshot(): InventorySnapshot | null {
  const latest = latestInventoryJsonPath();
  if (!latest) return null;
  try {
    return JSON.parse(fs.readFileSync(latest, "utf-8")) as InventorySnapshot;
  } catch {
    return null;
  }
}

function hydrateCatalogFromLatestInventory(catalog: SkillCatalog): InventoryCatalogSyncResult {
  const snapshot = readLatestInventorySnapshot();
  if (!snapshot?.missingFromCatalog) return { added: 0, skipped: 0, skills: [] };
  return addInventorySkillsToCatalog(catalog, snapshot.missingFromCatalog, { write: false });
}

/**
 * Add missing inventory-discovered skills as catalog references only.
 *
 * This is intentionally additive: it never deletes, never marks a skill as
 * installed, and never overwrites an existing non-inventory catalog entry.
 */
export function addInventorySkillsToCatalog(
  catalog: SkillCatalog,
  skills: InventoryCatalogSkill[],
  options: { write?: boolean } = {}
): InventoryCatalogSyncResult {
  const added: string[] = [];
  let skipped = 0;

  for (const skill of skills) {
    const name = skill.name?.trim();
    if (!name) {
      skipped += 1;
      continue;
    }
    if (findSkill(catalog, name)) {
      skipped += 1;
      continue;
    }
    catalog.skills.push({
      name,
      description: inventoryDescription(skill),
      version: "0.0.0-local",
      source: inventorySource(skill),
      scope: inventoryScope(skill),
      identity_fields: [],
      requires: [],
      installed: false,
      catalog_origin: "agent-stack-inventory",
      owner_classes: skill.ownerClasses || [],
      provenances: skill.provenances || [],
      sync_policies: skill.syncPolicies || [],
      sample_paths: skill.samplePaths || [],
    });
    added.push(name);
  }

  if (added.length > 0) {
    catalog.skills.sort((a, b) => a.name.localeCompare(b.name));
    if (options.write !== false) writeSkillCatalog(catalog);
  }

  return { added: added.length, skipped, skills: added };
}

/**
 * Remove a skill entry from the catalog.
 */
export function removeSkillEntry(catalog: SkillCatalog, name: string): SkillCatalog {
  catalog.skills = catalog.skills.filter((s) => s.name !== name);
  writeSkillCatalog(catalog);
  return catalog;
}

/**
 * Mark a skill as installed/uninstalled.
 */
export function setSkillInstalled(catalog: SkillCatalog, name: string, installed: boolean): SkillCatalog {
  const skill = findSkill(catalog, name);
  if (skill) {
    skill.installed = installed;
    writeSkillCatalog(catalog);
  }
  return catalog;
}

function mergeCatalogWithDefaults(catalog: SkillCatalog, defaults: SkillEntry[]): SkillCatalog {
  const merged: SkillEntry[] = [...catalog.skills];

  for (const def of defaults) {
    const existing = merged.find((entry) => entry.name === def.name);
    if (existing) {
      existing.description = def.description;
      existing.version = def.version;
      existing.source = def.source;
      existing.scope = def.scope;
      existing.identity_fields = def.identity_fields;
      existing.requires = def.requires;
    } else {
      merged.push({ ...def });
    }
  }

  return {
    version: catalog.version ?? 1,
    owner: catalog.owner,
    skills: merged,
  };
}

/**
 * Get skills whose identity_fields overlap with a set of changed fields.
 */
export function getAffectedSkills(catalog: SkillCatalog, changedFields: string[]): SkillEntry[] {
  return catalog.skills.filter(
    (s) => s.installed && s.identity_fields.some((f) => changedFields.includes(f))
  );
}

/**
 * Search skills by name or description substring.
 */
export function searchSkills(catalog: SkillCatalog, query: string): SkillEntry[] {
  const q = query.toLowerCase();
  return catalog.skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}
