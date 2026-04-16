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

  // Direct HTTPS URL to raw markdown.
  // Cycle 53: was previously accepting http:// as well. Skill installs are
  // executable content — fetching them over insecure HTTP allows MITM
  // injection of malicious skill code. HTTPS-only.
  if (source.startsWith("https://")) {
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
export type InitProjectMode = "auto" | "additive" | "zero-touch" | "scaffold";

export interface InitProjectOptions {
  mode?: InitProjectMode;
}

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

const BOOTSTRAP_START = "<!-- youmd:bootstrap:start -->";
const BOOTSTRAP_END = "<!-- youmd:bootstrap:end -->";

/**
 * Initialize a project with additive agent bootstrap files, scaffolded
 * project-context docs, a generated .you layer, and host-linked skills.
 */
export function initProject(options: InitProjectOptions = {}): {
  ok: boolean;
  mode: Exclude<InitProjectMode, "auto">;
  steps: Array<{ name: string; ok: boolean; detail?: string }>;
} {
  const steps: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const project = detectProjectContext();
  const cwd = process.cwd();
  const identity = loadIdentityData();
  const projectName = project?.name || path.basename(cwd);
  const agentsPath = path.join(cwd, "AGENTS.md");
  const claudePath = path.join(cwd, "CLAUDE.md");
  const projectContextDir = path.join(cwd, "project-context");
  const youDir = path.join(cwd, ".you");

  const requestedMode = options.mode ?? "auto";
  const resolvedMode = resolveInitProjectMode({
    mode: requestedMode,
    hasAgentFile: fs.existsSync(agentsPath),
    hasClaudeFile: fs.existsSync(claudePath),
    hasProjectContext: fs.existsSync(projectContextDir),
  });

  // Step 1: Install core skills that power the generated layer
  for (const name of ["claude-md-generator", "project-context-init"]) {
    const result = installSkill(name);
    steps.push({
      name: `install ${name}`,
      ok: result.ok,
      detail: result.ok ? "ready" : result.error,
    });
  }

  // Step 2: Create/update the generated .you layer
  const youResult = scaffoldYouLayer(youDir, identity, projectName);
  steps.push({
    name: ".you/",
    ok: true,
    detail: youResult,
  });

  // Step 3: Scaffold or update first-class entrypoints
  if (resolvedMode === "zero-touch") {
    steps.push({
      name: "top-level agent files",
      ok: true,
      detail: "zero-touch mode — left AGENTS.md and CLAUDE.md unchanged",
    });
  } else {
    const agentResult = ensureAgentInstructionFiles({
      cwd,
      projectName,
      identity,
    });
    steps.push({
      name: "agent instruction files",
      ok: true,
      detail: agentResult,
    });
  }

  // Step 4: Scaffold the canonical project-context/ directory
  if (resolvedMode === "zero-touch") {
    steps.push({
      name: "project-context/",
      ok: true,
      detail: "zero-touch mode — left canonical project-context untouched",
    });
  } else {
    const scaffolded = scaffoldProjectContext(projectContextDir, identity, projectName);
    steps.push({
      name: "project-context/",
      ok: true,
      detail: scaffolded,
    });
  }

  // Step 5: Link rendered skills into host-specific discovery paths
  const linkTargets: AgentTarget[] = ["claude"];
  if (fs.existsSync(path.join(cwd, ".cursor"))) linkTargets.push("cursor");
  if (fs.existsSync(path.join(cwd, ".codex"))) linkTargets.push("codex");

  for (const target of linkTargets) {
    const result = linkToAgent(target);
    const label =
      target === "claude"
        ? "link .claude/skills/youmd/"
        : target === "cursor"
          ? "link .cursor/rules/youmd.md"
          : "link .codex/skills/youmd/";
    steps.push({
      name: label,
      ok: result.ok,
      detail: result.error || result.path,
    });
  }

  return { ok: steps.every((s) => s.ok), mode: resolvedMode, steps };
}

function resolveInitProjectMode(args: {
  mode: InitProjectMode;
  hasAgentFile: boolean;
  hasClaudeFile: boolean;
  hasProjectContext: boolean;
}): Exclude<InitProjectMode, "auto"> {
  if (args.mode !== "auto") return args.mode;
  if (!args.hasAgentFile && !args.hasClaudeFile && !args.hasProjectContext) {
    return "scaffold";
  }
  return "additive";
}

function generateAgentMd(identity: IdentityData, projectName: string): string {
  const parts: string[] = [];
  parts.push(`# ${projectName} — Agent Operating Manual\n`);
  parts.push(`> Bootstrapped by You.md. This is the repo-visible instruction layer agents should read first.\n`);

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

  parts.push(`\n## Workflow\n`);
  parts.push(`- Read \`project-context/CURRENT_STATE.md\` and \`project-context/feature-requests-active.md\` before substantial work.\n`);
  parts.push(`- Track multi-part user asks in \`project-context/feature-requests-active.md\` rather than silently handling only part of the request.\n`);
  parts.push(`- Treat updates to \`project-context/TODO.md\`, \`FEATURES.md\`, \`CHANGELOG.md\`, \`feature-requests-active.md\`, and \`PROMPTS.md\` as part of "done" after meaningful development sessions.\n`);
  parts.push(`- Read \`.you/AGENT.md\`, \`.you/STACK-MAP.md\`, and \`.you/project-context/\` for additive You.md-generated context.\n`);

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

function generateClaudeMd(projectName: string): string {
  return [
    `# ${projectName} — Claude Entry Point`,
    "",
    "> This repo uses `AGENTS.md` as the canonical human-owned instruction layer.",
    "> Read `AGENTS.md`, `project-context/`, and `.you/` before substantial work.",
    "",
  ].join("\n");
}

/**
 * Generate an additive managed bootstrap block for existing top-level
 * instruction files without rewriting user-owned content.
 */
function generateBootstrapBlock(target: "AGENTS.md" | "CLAUDE.md", includeCompanion: boolean): string {
  const companionLine =
    includeCompanion && target === "CLAUDE.md"
      ? "- Also read `AGENTS.md` for repo-native operating instructions.\n"
      : includeCompanion && target === "AGENTS.md"
        ? "- Keep `CLAUDE.md` as the Claude-specific entrypoint if this repo uses it.\n"
        : "";

  return [
    BOOTSTRAP_START,
    `<!-- Auto-generated by You.md. Re-run \`youmd skill init-project\` to refresh this managed block. -->`,
    "",
    "## You.md Bootstrap",
    "",
    "- Read `project-context/CURRENT_STATE.md` and `project-context/feature-requests-active.md` before substantial work.",
    "- Track multi-part asks in `project-context/feature-requests-active.md` rather than silently handling only one part.",
    "- Treat updates to `project-context/TODO.md`, `FEATURES.md`, `CHANGELOG.md`, `feature-requests-active.md`, and `PROMPTS.md` as part of done after meaningful development sessions.",
    "- Read `.you/AGENT.md`, `.you/STACK-MAP.md`, and `.you/project-context/` for additive You.md-generated context.",
    companionLine.trimEnd(),
    "",
    BOOTSTRAP_END,
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

function upsertManagedBootstrap(
  existing: string,
  target: "AGENTS.md" | "CLAUDE.md",
  includeCompanion: boolean
): { content: string; status: "added" | "updated" | "unchanged" } {
  const block = generateBootstrapBlock(target, includeCompanion).trim();
  const pattern = new RegExp(
    `${escapeRegex(BOOTSTRAP_START)}[\\s\\S]*?${escapeRegex(BOOTSTRAP_END)}`,
    "m"
  );
  if (pattern.test(existing)) {
    const replaced = existing.replace(pattern, block);
    return {
      content: replaced === existing ? existing : replaced,
      status: replaced === existing ? "unchanged" : "updated",
    };
  }
  const trimmed = existing.trimEnd();
  return {
    content: trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`,
    status: "added",
  };
}

function ensureAgentInstructionFiles(args: {
  cwd: string;
  projectName: string;
  identity: IdentityData;
}): string {
  const agentsPath = path.join(args.cwd, "AGENTS.md");
  const claudePath = path.join(args.cwd, "CLAUDE.md");
  const hasAgents = fs.existsSync(agentsPath);
  const hasClaude = fs.existsSync(claudePath);
  const notes: string[] = [];

  if (!hasAgents) {
    fs.writeFileSync(agentsPath, generateAgentMd(args.identity, args.projectName));
    notes.push("created AGENTS.md");
  } else {
    const existing = fs.readFileSync(agentsPath, "utf-8");
    const update = upsertManagedBootstrap(existing, "AGENTS.md", hasClaude);
    fs.writeFileSync(agentsPath, update.content);
    notes.push(`${update.status} AGENTS.md bootstrap`);
  }

  if (!hasClaude) {
    fs.writeFileSync(
      claudePath,
      `${generateClaudeMd(args.projectName)}\n${generateBootstrapBlock("CLAUDE.md", true)}`
    );
    notes.push("created CLAUDE.md");
  } else {
    const existing = fs.readFileSync(claudePath, "utf-8");
    const update = upsertManagedBootstrap(existing, "CLAUDE.md", true);
    fs.writeFileSync(claudePath, update.content);
    notes.push(`${update.status} CLAUDE.md bootstrap`);
  }

  return notes.join("; ");
}

function scaffoldProjectContext(dir: string, identity: IdentityData, projectName: string): string {
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
    "PROMPTS.md": `# ${projectName} — Prompt Archive\n\n> Updated: ${date}\n> Total sessions: 0\n> Total prompts: 0\n\n## Notes\n\nAppend user messages here after each development session so future agents can search exact wording.\n`,
  };

  const created: string[] = [];
  const skipped: string[] = [];
  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content);
      created.push(filename);
    } else {
      skipped.push(filename);
    }
  }
  if (created.length === 0) {
    return `all canonical files already present (${skipped.length} checked)`;
  }
  return `created ${created.length} file(s): ${created.join(", ")}`;
}

function scaffoldYouLayer(dir: string, identity: IdentityData, projectName: string): string {
  const projectContextDir = path.join(dir, "project-context");
  fs.mkdirSync(projectContextDir, { recursive: true });

  const writes: Array<[string, string]> = [
    [path.join(dir, "AGENT.md"), generateYouAgentMd(identity, projectName)],
    [path.join(dir, "STACK-MAP.md"), generateStackMap(projectName)],
    [
      path.join(projectContextDir, "README.md"),
      generateYouProjectContextReadme(projectName),
    ],
  ];

  const created: string[] = [];
  const updated: string[] = [];
  for (const [filePath, content] of writes) {
    const existed = fs.existsSync(filePath);
    fs.writeFileSync(filePath, content);
    (existed ? updated : created).push(path.relative(dir, filePath));
  }

  const parts: string[] = [];
  if (created.length > 0) parts.push(`created ${created.join(", ")}`);
  if (updated.length > 0) parts.push(`updated ${updated.join(", ")}`);
  return parts.join("; ");
}

function generateYouAgentMd(identity: IdentityData, projectName: string): string {
  const lines: string[] = [
    `# You.md Generated Agent Context`,
    "",
    `> This is the You.md-owned additive layer for \`${projectName}\`. Top-level repo files stay user-owned.`,
    "",
    "## Purpose",
    "",
    "- Provide additive identity and workflow context without overwriting human-maintained docs.",
    "- Keep cross-agent expectations consistent across Claude, Codex, Cursor, and similar tools.",
    "",
  ];

  if (identity.profile.about) {
    lines.push("## Identity", "", identity.profile.about, "");
  }
  if (identity.preferences.agent) {
    lines.push("## Agent Preferences", "", identity.preferences.agent, "");
  }
  if (identity.directives.agent) {
    lines.push("## Directives", "", identity.directives.agent, "");
  }
  if (identity.voice.overall) {
    lines.push("## Voice", "", identity.voice.overall, "");
  }

  lines.push("## Operating Expectations", "");
  lines.push("- Read the repo-visible instruction file(s) first.");
  lines.push("- Treat `project-context/` as the canonical shared working context.");
  lines.push("- Use this `.you/` layer as additive guidance and generated metadata, not as a replacement for repo-owned docs.");
  lines.push("");
  return lines.join("\n");
}

function generateStackMap(projectName: string): string {
  return [
    "# You.md Stack Map",
    "",
    `> Generated for \`${projectName}\`. This file explains what You.md owns versus what the repo/user owns.`,
    "",
    "## Ownership",
    "",
    "- `AGENTS.md` / `CLAUDE.md`: human-owned entrypoints with a managed additive You.md bootstrap block.",
    "- `project-context/`: canonical shared repo context. You.md only fills missing files unless a human explicitly asks for deeper changes.",
    "- `.you/`: You.md-owned generated layer for additive cross-agent context.",
    "- `.claude/skills/youmd`, `.codex/skills/youmd`, `.cursor/rules/youmd.md`: host-specific rendered skill surfaces when linked.",
    "",
    "## Maintenance Rules",
    "",
    "- Update only the managed You.md block inside top-level instruction files.",
    "- Never delete or rewrite user-authored repo context without explicit approval.",
    "- Prefer additive file creation and managed-block refreshes over broad merges.",
    "",
  ].join("\n");
}

function generateYouProjectContextReadme(projectName: string): string {
  return [
    "# You.md Supplemental Project Context",
    "",
    `This directory holds additive, generated context for \`${projectName}\`.`,
    "",
    "- Keep canonical project docs in `project-context/`.",
    "- Keep generated cross-agent context in `.you/`.",
    "- Use this layer when You.md needs to preserve shared behavior without clobbering hand-written repo docs.",
    "",
  ].join("\n");
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
