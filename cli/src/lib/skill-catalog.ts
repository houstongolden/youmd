/**
 * Skill catalog — YAML parser/writer for youmd-skills.yaml
 *
 * Manages the catalog of installed/available skills with metadata
 * including identity field requirements and scope.
 */

import * as fs from "fs";
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
}

export interface SkillCatalog {
  version: number;
  owner: string;
  skills: SkillEntry[];
}

/**
 * Default bundled skills that ship with youmd.
 */
function defaultSkills(owner: string): SkillEntry[] {
  return [
    {
      name: "claude-md-generator",
      description: "Generate CLAUDE.md from identity + project detection",
      version: "1.0.0",
      source: "bundled:you-agent/skills/claude-md-generator.md",
      scope: "shared",
      identity_fields: ["preferences.agent", "directives.agent", "voice.overall"],
      requires: [],
      installed: false,
    },
    {
      name: "project-context-init",
      description: "Scaffold project-context/ directory with PRD, TODO, features, changelog",
      version: "1.0.0",
      source: "bundled:you-agent/skills/project-context-init.md",
      scope: "project",
      identity_fields: ["preferences.agent", "profile.about"],
      requires: [],
      installed: false,
    },
    {
      name: "voice-sync",
      description: "Sync voice profile across all agent tools",
      version: "1.0.0",
      source: "bundled:you-agent/skills/voice-sync.md",
      scope: "shared",
      identity_fields: ["voice.overall", "voice.writing", "voice.speaking"],
      requires: [],
      installed: false,
    },
    {
      name: "meta-improve",
      description: "Self-improvement protocol — review effectiveness, propose identity updates",
      version: "1.0.0",
      source: "bundled:you-agent/skills/meta-improve.md",
      scope: "shared",
      identity_fields: ["preferences.agent", "directives.agent"],
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

  if (fs.existsSync(catalogPath)) {
    try {
      const raw = fs.readFileSync(catalogPath, "utf-8");
      const parsed = yaml.load(raw) as SkillCatalog;
      if (parsed && parsed.skills) {
        return parsed;
      }
    } catch {
      // Fall through to defaults
    }
  }

  // Create default catalog
  const config = readGlobalConfig();
  const owner = config.username || "anonymous";
  const catalog: SkillCatalog = {
    version: 1,
    owner,
    skills: defaultSkills(owner),
  };

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
