/**
 * Skill engine — install, remove, resolve, sync, link.
 *
 * Manages the lifecycle of skills from the catalog to the filesystem.
 * Skills are SKILL.md files with identity-aware template variables.
 */

import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import {
  getSkillsDir,
  getSkillMetricsPath,
  ensureSkillsDir,
  detectProjectContext,
} from "./config";
import {
  readSkillCatalog,
  writeSkillCatalog,
  findSkill,
  setSkillInstalled,
  SkillEntry,
  SkillCatalog,
} from "./skill-catalog";
import { renderSkillTemplate, loadIdentityData, checkTemplateReadiness, IdentityData } from "./skill-renderer";
import { isAuthenticated } from "./config";
import {
  recordSkillInstall as apiRecordInstall,
  trackSkillUsage as apiTrackUsage,
  removeSkillInstall as apiRemoveInstall,
} from "./api";

// ─── Skill File I/O ───────────────────────────────────────────────────

/**
 * Get the directory for an installed skill.
 */
export function getSkillDir(skillName: string): string {
  return path.join(getSkillsDir(), skillName);
}

/**
 * Get the SKILL.md path for an installed skill.
 */
export function getSkillPath(skillName: string): string {
  return path.join(getSkillDir(skillName), "SKILL.md");
}

/**
 * Read a skill's SKILL.md content and frontmatter.
 */
export function readSkillFile(skillName: string): { content: string; metadata: Record<string, unknown> } | null {
  const skillPath = getSkillPath(skillName);
  if (!fs.existsSync(skillPath)) return null;

  try {
    const raw = fs.readFileSync(skillPath, "utf-8");
    const { data, content } = matter(raw);
    return { content: content.trim(), metadata: data };
  } catch {
    return null;
  }
}

// ─── Source Resolution ────────────────────────────────────────────────

/**
 * Resolve a skill source to its raw markdown content.
 *
 * Supported sources:
 *   bundled:path/to/file.md — relative to repo root
 *   local:/absolute/path.md — local filesystem
 *   github:owner/repo/path  — (future) GitHub raw content
 */
export function resolveSkillSource(source: string): string | null {
  if (source.startsWith("bundled:")) {
    const relativePath = source.slice("bundled:".length);
    const filename = path.basename(relativePath);

    // Priority 1: cli/skills/ directory (npm package ships these)
    const pkgRoot = path.resolve(__dirname, "..", "..");
    const pkgSkillsPath = path.join(pkgRoot, "skills", filename);
    if (fs.existsSync(pkgSkillsPath)) {
      return fs.readFileSync(pkgSkillsPath, "utf-8");
    }

    // Priority 2: repo root (development mode)
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const repoPath = path.join(repoRoot, relativePath);
    if (fs.existsSync(repoPath)) {
      return fs.readFileSync(repoPath, "utf-8");
    }

    // Priority 3: relative to package root
    const altPath = path.join(pkgRoot, relativePath);
    if (fs.existsSync(altPath)) {
      return fs.readFileSync(altPath, "utf-8");
    }
    return null;
  }

  if (source.startsWith("local:")) {
    const filePath = source.slice("local:".length);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return null;
  }

  // Plain file path
  if (fs.existsSync(source)) {
    return fs.readFileSync(source, "utf-8");
  }

  return null;
}

/**
 * Async source resolver — handles remote sources (GitHub).
 *
 * github:owner/repo/path → https://raw.githubusercontent.com/owner/repo/main/path
 * Also supports full https:// URLs to raw markdown files.
 */
export async function resolveSkillSourceAsync(source: string): Promise<string | null> {
  // Try sync first (bundled, local, file path)
  const syncResult = resolveSkillSource(source);
  if (syncResult) return syncResult;

  // GitHub: github:owner/repo/path/to/file.md
  if (source.startsWith("github:")) {
    const ghPath = source.slice("github:".length);
    const parts = ghPath.split("/");
    if (parts.length < 3) return null;

    const owner = parts[0];
    const repo = parts[1];
    const filePath = parts.slice(2).join("/");

    // Try main, then master
    for (const branch of ["main", "master"]) {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      try {
        const res = await fetch(url);
        if (res.ok) {
          return await res.text();
        }
      } catch {
        // try next branch
      }
    }
    return null;
  }

  // Direct HTTPS URL to raw markdown
  if (source.startsWith("https://") || source.startsWith("http://")) {
    try {
      const res = await fetch(source);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Install / Remove ─────────────────────────────────────────────────

/**
 * Install a skill from its source to ~/.youmd/skills/<name>/SKILL.md.
 * Uses sync resolution for local/bundled, falls back to async for remote.
 */
export function installSkill(skillName: string): { ok: boolean; error?: string } {
  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, skillName);

  if (!entry) {
    return { ok: false, error: `skill "${skillName}" not found in catalog` };
  }

  // Resolve source (sync only — async handled by installSkillAsync)
  const content = resolveSkillSource(entry.source);
  if (!content) {
    // If source is remote, caller should use installSkillAsync instead
    if (entry.source.startsWith("github:") || entry.source.startsWith("https://")) {
      return { ok: false, error: `remote source — use installSkillAsync for: ${entry.source}` };
    }
    return { ok: false, error: `could not resolve source: ${entry.source}` };
  }

  // Create skill directory and write SKILL.md
  const skillDir = getSkillDir(entry.name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);

  // Render an interpolated version alongside the raw one
  const identity = loadIdentityData();
  const rendered = renderSkillTemplate(content, identity);
  fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);

  // Mark installed in catalog
  setSkillInstalled(catalog, entry.name, true);

  // Track metrics
  trackSkillEvent(entry.name, "install");

  // Sync to Convex (non-blocking, warn on failure)
  syncInstallToRemote(entry);

  return { ok: true };
}

/**
 * Async install — handles remote sources (GitHub, HTTPS URLs).
 */
export async function installSkillAsync(skillName: string): Promise<{ ok: boolean; error?: string }> {
  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, skillName);

  if (!entry) {
    return { ok: false, error: `skill "${skillName}" not found in catalog` };
  }

  // Try sync first
  let content = resolveSkillSource(entry.source);

  // Fall back to async
  if (!content) {
    content = await resolveSkillSourceAsync(entry.source);
  }

  if (!content) {
    return { ok: false, error: `could not resolve source: ${entry.source}` };
  }

  const skillDir = getSkillDir(entry.name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), content);

  const identity = loadIdentityData();
  const rendered = renderSkillTemplate(content, identity);
  fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);

  setSkillInstalled(catalog, entry.name, true);
  trackSkillEvent(entry.name, "install");
  syncInstallToRemote(entry);

  return { ok: true };
}

/**
 * Remove an installed skill.
 */
export function removeSkill(skillName: string): { ok: boolean; error?: string } {
  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, skillName);

  if (!entry) {
    return { ok: false, error: `skill "${skillName}" not found in catalog` };
  }

  const skillDir = getSkillDir(entry.name);
  if (fs.existsSync(skillDir)) {
    fs.rmSync(skillDir, { recursive: true, force: true });
  }

  setSkillInstalled(catalog, entry.name, false);
  trackSkillEvent(entry.name, "remove");

  // Sync removal to Convex (non-blocking, warn on failure)
  if (isAuthenticated()) {
    apiRemoveInstall(entry.name).catch((err) => {
      const chalk = require("chalk");
      console.log(chalk.dim(`  sync: ${entry.name} remote removal sync failed (non-fatal)`));
      if (process.env.DEBUG) console.error(`[skill sync] remove failed: ${err}`);
    });
  }

  return { ok: true };
}

// ─── Use / Render ─────────────────────────────────────────────────────

/**
 * Use a skill — render it with current identity data.
 * Returns the rendered content.
 */
export function useSkill(skillName: string): { ok: boolean; content?: string; readiness?: ReturnType<typeof checkTemplateReadiness>; error?: string } {
  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, skillName);

  if (!entry) {
    return { ok: false, error: `skill "${skillName}" not found in catalog` };
  }

  // Install if not already
  if (!entry.installed) {
    const installResult = installSkill(skillName);
    if (!installResult.ok) return installResult;
  }

  const skillFile = readSkillFile(entry.name);
  if (!skillFile) {
    return { ok: false, error: `could not read SKILL.md for "${skillName}"` };
  }

  const identity = loadIdentityData();
  const readiness = checkTemplateReadiness(skillFile.content, identity);
  const rendered = renderSkillTemplate(skillFile.content, identity);

  // Update rendered version
  const skillDir = getSkillDir(entry.name);
  fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);

  trackSkillEvent(entry.name, "use");

  // Sync usage to Convex (non-blocking, warn on failure)
  if (isAuthenticated()) {
    apiTrackUsage(entry.name).catch((err) => {
      const chalk = require("chalk");
      console.log(chalk.dim(`  sync: usage tracking failed for ${entry.name} (non-fatal)`));
      if (process.env.DEBUG) console.error(`[skill sync] usage tracking failed: ${err}`);
    });
  }

  return { ok: true, content: rendered, readiness };
}

// ─── Sync ─────────────────────────────────────────────────────────────

/**
 * Re-interpolate all installed skills against current identity data.
 */
export function syncAllSkills(): { synced: string[]; errors: string[] } {
  const catalog = readSkillCatalog();
  const identity = loadIdentityData();
  const synced: string[] = [];
  const errors: string[] = [];

  for (const entry of catalog.skills) {
    if (!entry.installed) continue;

    const skillFile = readSkillFile(entry.name);
    if (!skillFile) {
      errors.push(`${entry.name}: SKILL.md not found`);
      continue;
    }

    try {
      const rendered = renderSkillTemplate(skillFile.content, identity);
      const skillDir = getSkillDir(entry.name);
      fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);
      synced.push(entry.name);
    } catch (err) {
      errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { synced, errors };
}

/**
 * Sync only skills affected by specific identity field changes.
 */
export function syncAffectedSkills(changedFields: string[]): { synced: string[]; errors: string[] } {
  const catalog = readSkillCatalog();
  const identity = loadIdentityData();
  const synced: string[] = [];
  const errors: string[] = [];

  const affected = catalog.skills.filter(
    (s) => s.installed && s.identity_fields.some((f) => changedFields.includes(f))
  );

  for (const entry of affected) {
    const skillFile = readSkillFile(entry.name);
    if (!skillFile) {
      errors.push(`${entry.name}: SKILL.md not found`);
      continue;
    }

    try {
      const rendered = renderSkillTemplate(skillFile.content, identity);
      const skillDir = getSkillDir(entry.name);
      fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);
      synced.push(entry.name);
    } catch (err) {
      errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { synced, errors };
}

// ─── Link to Agent Directories ────────────────────────────────────────

export type AgentTarget = "claude" | "cursor" | "codex";

/**
 * Link installed skills to an agent's directory.
 *
 * claude → .claude/skills/youmd/
 * cursor → .cursor/rules/youmd.md (single file concatenation)
 * codex  → .codex/skills/youmd/
 */
export function linkToAgent(target: AgentTarget): { ok: boolean; path?: string; error?: string } {
  const catalog = readSkillCatalog();
  const installedSkills = catalog.skills.filter((s) => s.installed);

  if (installedSkills.length === 0) {
    return { ok: false, error: "no skills installed. run: youmd skill install <name>" };
  }

  const cwd = process.cwd();

  switch (target) {
    case "claude": {
      const targetDir = path.join(cwd, ".claude", "skills", "youmd");
      fs.mkdirSync(targetDir, { recursive: true });

      for (const entry of installedSkills) {
        const rendered = getRenderedContent(entry.name);
        if (rendered) {
          fs.writeFileSync(path.join(targetDir, `${entry.name}.md`), rendered);
        }
      }
      return { ok: true, path: targetDir };
    }

    case "cursor": {
      const targetDir = path.join(cwd, ".cursor", "rules");
      fs.mkdirSync(targetDir, { recursive: true });

      // Cursor prefers a single concatenated file
      const parts: string[] = [];
      parts.push("# You.md Identity Skills\n");
      parts.push(`> Auto-generated by youmd skill link. Do not edit manually.\n`);

      for (const entry of installedSkills) {
        const rendered = getRenderedContent(entry.name);
        if (rendered) {
          parts.push(`\n---\n\n## ${entry.name}\n\n${rendered}`);
        }
      }

      const outPath = path.join(targetDir, "youmd.md");
      fs.writeFileSync(outPath, parts.join("\n"));
      return { ok: true, path: outPath };
    }

    case "codex": {
      const targetDir = path.join(cwd, ".codex", "skills", "youmd");
      fs.mkdirSync(targetDir, { recursive: true });

      for (const entry of installedSkills) {
        const rendered = getRenderedContent(entry.name);
        if (rendered) {
          fs.writeFileSync(path.join(targetDir, `${entry.name}.md`), rendered);
        }
      }
      return { ok: true, path: targetDir };
    }

    default:
      return { ok: false, error: `unknown agent target: ${target}` };
  }
}

function getRenderedContent(skillName: string): string | null {
  const renderedPath = path.join(getSkillDir(skillName), "RENDERED.md");
  if (fs.existsSync(renderedPath)) {
    return fs.readFileSync(renderedPath, "utf-8");
  }

  // Fallback: render on the fly
  const skillFile = readSkillFile(skillName);
  if (!skillFile) return null;
  return renderSkillTemplate(skillFile.content);
}

// ─── Init Project (Compound Command) ─────────────────────────────────

/**
 * Initialize a project with skills: install core skills, generate CLAUDE.md,
 * scaffold project-context/, and link to .claude/skills/.
 */
export function initProject(): {
  ok: boolean;
  steps: Array<{ name: string; ok: boolean; detail?: string }>;
} {
  const steps: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const project = detectProjectContext();
  const cwd = process.cwd();

  // Step 1: Install core skills
  for (const name of ["claude-md-generator", "project-context-init"]) {
    const result = installSkill(name);
    steps.push({
      name: `install ${name}`,
      ok: result.ok,
      detail: result.error,
    });
  }

  // Step 2: Generate or merge CLAUDE.md
  const identity = loadIdentityData();
  const projectName = project?.name || path.basename(cwd);
  const claudeMdPath = path.join(cwd, "CLAUDE.md");
  if (fs.existsSync(claudeMdPath)) {
    // Merge: append identity section if not already present
    const existing = fs.readFileSync(claudeMdPath, "utf-8");
    const IDENTITY_MARKER = "<!-- youmd:identity -->";
    if (existing.includes(IDENTITY_MARKER)) {
      steps.push({ name: "CLAUDE.md", ok: true, detail: "identity section already present" });
    } else {
      const identitySection = generateIdentitySection(identity);
      if (identitySection) {
        fs.writeFileSync(claudeMdPath, existing.trimEnd() + "\n\n" + identitySection);
        steps.push({ name: "CLAUDE.md", ok: true, detail: "identity section appended" });
      } else {
        steps.push({ name: "CLAUDE.md", ok: true, detail: "exists, no identity data to add" });
      }
    }
  } else {
    const claudeMd = generateClaudeMd(identity, projectName);
    fs.writeFileSync(claudeMdPath, claudeMd);
    steps.push({ name: "CLAUDE.md", ok: true, detail: "generated" });
  }

  // Step 3: Scaffold project-context/
  const pcDir = path.join(cwd, "project-context");
  if (fs.existsSync(pcDir)) {
    steps.push({ name: "project-context/", ok: true, detail: "already exists, skipped" });
  } else {
    scaffoldProjectContext(pcDir, identity, project?.name || path.basename(cwd));
    steps.push({ name: "project-context/", ok: true, detail: "scaffolded" });
  }

  // Step 4: Link to .claude/skills/
  const linkResult = linkToAgent("claude");
  steps.push({
    name: "link .claude/skills/youmd/",
    ok: linkResult.ok,
    detail: linkResult.error || linkResult.path,
  });

  // Step 5: Also link to Cursor if .cursor/ exists
  if (fs.existsSync(path.join(cwd, ".cursor"))) {
    const cursorResult = linkToAgent("cursor");
    steps.push({
      name: "link .cursor/rules/youmd.md",
      ok: cursorResult.ok,
      detail: cursorResult.error || cursorResult.path,
    });
  }

  return { ok: steps.every((s) => s.ok), steps };
}

function generateClaudeMd(identity: IdentityData, projectName: string): string {
  const parts: string[] = [];
  parts.push(`# ${projectName} — Coding Agent Operating Manual\n`);
  parts.push(`> Generated by You.md skill system. Powered by your identity context.\n`);

  if (identity.profile.about) {
    parts.push(`\n## Who You're Working With\n\n${identity.profile.about}\n`);
  }

  if (identity.preferences.agent) {
    parts.push(`\n## Agent Preferences\n\n${identity.preferences.agent}\n`);
  }

  if (identity.directives.agent) {
    parts.push(`\n## Directives\n\n${identity.directives.agent}\n`);
  }

  if (identity.voice.overall) {
    parts.push(`\n## Voice & Communication\n\n${identity.voice.overall}\n`);
  }

  parts.push(`\n## Project\n\n- **Name:** ${projectName}\n`);

  // Detect stack
  const cwd = process.cwd();
  const stackHints: string[] = [];
  if (fs.existsSync(path.join(cwd, "package.json"))) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
      if (pkg.dependencies?.next) stackHints.push("Next.js");
      if (pkg.dependencies?.react) stackHints.push("React");
      if (pkg.dependencies?.typescript || pkg.devDependencies?.typescript) stackHints.push("TypeScript");
      if (pkg.dependencies?.convex) stackHints.push("Convex");
    } catch { /* skip */ }
  }
  if (fs.existsSync(path.join(cwd, "Cargo.toml"))) stackHints.push("Rust");
  if (fs.existsSync(path.join(cwd, "go.mod"))) stackHints.push("Go");
  if (fs.existsSync(path.join(cwd, "pyproject.toml"))) stackHints.push("Python");

  if (stackHints.length > 0) {
    parts.push(`- **Stack:** ${stackHints.join(", ")}\n`);
  }

  return parts.join("\n");
}

/**
 * Generate an identity section to append to an existing CLAUDE.md.
 * Returns null if no identity data is available.
 */
function generateIdentitySection(identity: IdentityData): string | null {
  const sections: string[] = [];

  if (identity.profile.about) {
    sections.push(`## Who You're Working With\n\n${identity.profile.about}`);
  }
  if (identity.preferences.agent) {
    sections.push(`## Agent Preferences\n\n${identity.preferences.agent}`);
  }
  if (identity.directives.agent) {
    sections.push(`## Directives\n\n${identity.directives.agent}`);
  }
  if (identity.voice.overall) {
    sections.push(`## Voice & Communication\n\n${identity.voice.overall}`);
  }

  if (sections.length === 0) return null;

  return [
    "<!-- youmd:identity -->",
    "<!-- Auto-generated by You.md skill system. Re-run `youmd skill init-project` to update. -->",
    "",
    "---",
    "",
    "# You.md Identity Context",
    "",
    ...sections,
    "",
  ].join("\n");
}

function scaffoldProjectContext(dir: string, identity: IdentityData, projectName: string): void {
  fs.mkdirSync(dir, { recursive: true });

  const owner = identity.username || "you";
  const date = new Date().toISOString().slice(0, 10);

  const files: Record<string, string> = {
    "PRD.md": `# ${projectName} — Product Requirements\n\n> Owner: ${owner}\n> Created: ${date}\n\n## Vision\n\n(describe the product vision)\n\n## User Journeys\n\n(describe key user flows)\n`,
    "TODO.md": `# ${projectName} — Task Tracking\n\n> Updated: ${date}\n\n## In Progress\n\n## Up Next\n\n## Done\n`,
    "FEATURES.md": `# ${projectName} — Feature Inventory\n\n> Updated: ${date}\n\n| Feature | Status | Notes |\n|---|---|---|\n`,
    "CHANGELOG.md": `# ${projectName} — Changelog\n\n## ${date}\n\n- Project initialized with You.md skill system\n`,
    "ARCHITECTURE.md": `# ${projectName} — Architecture\n\n> Updated: ${date}\n\n## Overview\n\n(describe system architecture)\n\n## Stack\n\n(list technologies)\n`,
    "CURRENT_STATE.md": `# ${projectName} — Current State\n\n> Updated: ${date}\n\n## Deployed\n\n## Known Issues\n\n## Next Priorities\n`,
    "STYLE_GUIDE.md": `# ${projectName} — Style Guide\n\n> Updated: ${date}\n\n(describe design system, colors, typography)\n`,
    "feature-requests-active.md": `# ${projectName} — Active Feature Requests\n\n> Updated: ${date}\n\n| Request | Status | Source | Notes |\n|---|---|---|---|\n`,
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
    }
  }
}

// ─── Remote Sync (non-blocking) ───────────────────────────────────────

/**
 * Sync a local skill install to Convex. Fire-and-forget.
 */
function syncInstallToRemote(entry: SkillEntry): void {
  if (!isAuthenticated()) return;
  apiRecordInstall({
    skillName: entry.name,
    source: entry.source,
    scope: entry.scope,
    identityFields: entry.identity_fields,
  }).catch((err) => {
    // Dim warning instead of silent swallow
    const chalk = require("chalk");
    console.log(chalk.dim(`  sync: ${entry.name} remote sync failed (non-fatal)`));
    if (process.env.DEBUG) console.error(`[skill sync] install sync failed: ${err}`);
  });
}

// ─── Metrics Tracking ─────────────────────────────────────────────────

interface SkillMetrics {
  skills: Record<string, {
    uses: number;
    installs: number;
    lastUsed: string;
    lastInstalled?: string;
  }>;
  identityFields: Record<string, { references: number }>;
  lastUpdated: string;
}

function readMetrics(): SkillMetrics {
  const metricsPath = getSkillMetricsPath();
  if (fs.existsSync(metricsPath)) {
    try {
      return JSON.parse(fs.readFileSync(metricsPath, "utf-8"));
    } catch {
      // reset
    }
  }
  return { skills: {}, identityFields: {}, lastUpdated: new Date().toISOString() };
}

function writeMetrics(metrics: SkillMetrics): void {
  ensureSkillsDir();
  metrics.lastUpdated = new Date().toISOString();
  fs.writeFileSync(getSkillMetricsPath(), JSON.stringify(metrics, null, 2) + "\n");
}

export function trackSkillEvent(skillName: string, event: "use" | "install" | "remove"): void {
  const metrics = readMetrics();

  if (!metrics.skills[skillName]) {
    metrics.skills[skillName] = { uses: 0, installs: 0, lastUsed: "" };
  }

  const now = new Date().toISOString();
  if (event === "use") {
    metrics.skills[skillName].uses++;
    metrics.skills[skillName].lastUsed = now;
  } else if (event === "install") {
    metrics.skills[skillName].installs++;
    metrics.skills[skillName].lastInstalled = now;
  }

  // Track identity field references from the skill's catalog entry
  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, skillName);
  if (entry && event === "use") {
    for (const field of entry.identity_fields) {
      if (!metrics.identityFields[field]) {
        metrics.identityFields[field] = { references: 0 };
      }
      metrics.identityFields[field].references++;
    }
  }

  writeMetrics(metrics);
}

export function getMetrics(): SkillMetrics {
  return readMetrics();
}
