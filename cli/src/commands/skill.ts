/**
 * youmd skill — identity-aware agent skill system.
 *
 * Subcommand router following the project.ts pattern.
 * Manages skill lifecycle: install, remove, use, sync, link, init-project.
 */

import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  readSkillCatalog,
  findSkill,
  addSkillEntry,
  removeSkillEntry,
  searchSkills,
  SkillEntry,
  SkillScope,
} from "../lib/skill-catalog";
import {
  installSkill,
  installSkillAsync,
  removeSkill,
  useSkill,
  syncAllSkills,
  linkToAgent,
  initProject,
  getMetrics,
  AgentTarget,
} from "../lib/skills";
import { loadIdentityData, resolveVariable, IdentityData } from "../lib/skill-renderer";
import { BrailleSpinner, renderRichResponse } from "../lib/render";
import { isAuthenticated } from "../lib/config";
import { browseSkills, publishSkill as apiPublishSkill, getMySkills, getRegistrySkill } from "../lib/api";
import { readSkillFile, getSkillDir } from "../lib/skills";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

// ─── Personality spinner labels ──────────────────────────────────────

const SKILL_SPINNERS = {
  install: [
    "downloading your superpowers",
    "wiring identity into skill matrix",
    "importing agent knowledge",
    "bootstrapping skill neurons",
    "fetching your secret sauce",
  ],
  use: [
    "resolving identity against skill template",
    "interpolating your whole vibe",
    "mapping your identity to agent instructions",
    "converting you into context",
    "rendering your digital twin's playbook",
  ],
  sync: [
    "re-interpolating skills against live identity",
    "propagating identity changes across skills",
    "syncing your soul to all agents",
    "reconciling who you are with what agents know",
  ],
  link: [
    "wiring your identity into the agent",
    "bridging identity to agent workspace",
    "establishing the neural handshake",
  ],
  init: [
    "computing your project's main character energy",
    "scaffolding your identity into this repo",
    "making this project know who it's working with",
    "infusing project with identity context",
  ],
  remove: [
    "severing the identity link",
    "cleaning up skill artifacts",
    "removing agent knowledge",
  ],
};

function randomSpinner(category: keyof typeof SKILL_SPINNERS): string {
  const labels = SKILL_SPINNERS[category];
  return labels[Math.floor(Math.random() * labels.length)];
}

/** Truncate at word boundary instead of mid-word */
function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const truncated = text.slice(0, max);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? truncated.slice(0, lastSpace) : truncated) + "...";
}

// ─── Subcommands ──────────────────────────────────────────────────────

const RECOMMENDED_SKILLS = new Set(["claude-md-generator", "voice-sync"]);

async function listSkills(): Promise<void> {
  const catalog = readSkillCatalog();

  console.log("");
  console.log("  " + chalk.bold("youmd skills") + DIM(` (${catalog.skills.length} in catalog)`));
  console.log("");

  if (catalog.skills.length === 0) {
    console.log(DIM("  no skills registered."));
    console.log(DIM("  run ") + chalk.cyan("youmd skill add <name> <source>") + DIM(" to add one."));
    console.log("");
    return;
  }

  // Best-effort: fetch registry metadata for download counts.
  // Network failures are silent — list still works offline.
  const downloads: Record<string, number> = {};
  try {
    const reg = await browseSkills();
    if (reg.ok && reg.data?.skills) {
      for (const s of reg.data.skills) {
        if (typeof s.downloads === "number") {
          downloads[s.name] = s.downloads;
        }
      }
    }
  } catch {
    /* offline is fine */
  }

  const maxName = Math.max(...catalog.skills.map((s) => s.name.length));

  for (const skill of catalog.skills) {
    const status = skill.installed
      ? chalk.green("\u2713 installed")
      : DIM("\u25CB available");
    const scope = skill.scope === "shared"
      ? DIM("shared")
      : skill.scope === "project"
      ? ACCENT("project")
      : chalk.yellow("private");
    const fields = skill.identity_fields.length > 0
      ? DIM(` [${skill.identity_fields.join(", ")}]`)
      : "";
    const recommended = RECOMMENDED_SKILLS.has(skill.name)
      ? " " + ACCENT("recommended")
      : "";
    const dl = downloads[skill.name];
    const dlLabel = typeof dl === "number"
      ? DIM(` \u2193 ${dl.toLocaleString()}`)
      : "";

    console.log(
      `  ${status}  ${chalk.cyan(skill.name.padEnd(maxName + 2))}` +
      `${DIM(skill.description)}${recommended}`
    );
    console.log(
      `    ${DIM("v" + skill.version)} ${scope}${dlLabel}${fields}`
    );
  }

  console.log("");

  const installed = catalog.skills.filter((s) => s.installed).length;
  console.log(DIM(`  ${installed}/${catalog.skills.length} installed`));
  if (installed === 0) {
    console.log("");
    console.log(
      DIM("  get started: ") +
      chalk.cyan("youmd skill install claude-md-generator")
    );
  }
  console.log("");
}

async function installSkillCmd(args: string[]): Promise<void> {
  const name = args[0];

  // Batch install all
  if (name === "all" || name === "--all" || name === "-a") {
    const catalog = readSkillCatalog();
    const toInstall = catalog.skills.filter((s) => !s.installed);

    if (toInstall.length === 0) {
      console.log("");
      console.log(DIM("  all skills already installed."));
      console.log("");
      return;
    }

    console.log("");
    const spinner = new BrailleSpinner(randomSpinner("install"));
    spinner.start();
    await new Promise((r) => setTimeout(r, 300));

    let installed = 0;
    for (const entry of toInstall) {
      let result = installSkill(entry.name);
      if (!result.ok && (entry.source.startsWith("github:") || entry.source.startsWith("https://"))) {
        result = await installSkillAsync(entry.name);
      }
      if (result.ok) installed++;
    }

    spinner.stop(`${installed} skills installed`);
    console.log("");
    return;
  }

  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill install <name>"));
    console.log(DIM("  or:    youmd skill install all"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, name);

  if (!entry) {
    // Not in local catalog — check the registry
    if (isAuthenticated()) {
      console.log("");
      const regSpinner = new BrailleSpinner("checking the skill registry");
      regSpinner.start();
      await new Promise((r) => setTimeout(r, 200));

      try {
        const regRes = await browseSkills();
        if (regRes.ok) {
          const regSkill = regRes.data.skills.find((s) => s.name === name);
          if (regSkill) {
            regSpinner.stop(`found "${name}" in registry`);

            // Fetch full skill content from registry
            const contentRes = await getRegistrySkill(regSkill.name);
            if (contentRes.ok && contentRes.data.content) {
              // Write SKILL.md directly
              const skillDir = getSkillDir(regSkill.name);
              fs.mkdirSync(skillDir, { recursive: true });
              fs.writeFileSync(path.join(skillDir, "SKILL.md"), contentRes.data.content);

              // Render with identity
              const { renderSkillTemplate, loadIdentityData: loadId } = require("../lib/skill-renderer");
              const rendered = renderSkillTemplate(contentRes.data.content, loadId());
              fs.writeFileSync(path.join(skillDir, "RENDERED.md"), rendered);

              // Add to catalog and mark installed
              addSkillEntry(readSkillCatalog(), {
                name: regSkill.name,
                description: regSkill.description,
                version: regSkill.version,
                source: `registry:${regSkill.name}`,
                scope: regSkill.scope as SkillScope,
                identity_fields: regSkill.identityFields,
                requires: [],
                installed: true,
              });

              console.log("");
              console.log(
                chalk.green("  \u2713") + ` ${chalk.bold(name)} installed from registry` +
                DIM(` [${regSkill.scope}]`)
              );
              if (regSkill.identityFields.length > 0) {
                console.log(DIM(`  identity fields: ${regSkill.identityFields.join(", ")}`));
              }
            } else {
              // Content not available, just add to catalog
              addSkillEntry(readSkillCatalog(), {
                name: regSkill.name,
                description: regSkill.description,
                version: regSkill.version,
                source: `registry:${regSkill.name}`,
                scope: regSkill.scope as SkillScope,
                identity_fields: regSkill.identityFields,
                requires: [],
              });
              console.log("");
              console.log(DIM(`  added to catalog but content not available.`));
            }
            console.log("");
            return;
          }
        }
        regSpinner.stop("not found in registry either");
      } catch {
        regSpinner.fail("registry check failed");
      }
    }

    console.log("");
    console.log(chalk.yellow(`  skill "${name}" not found in catalog or registry.`));
    console.log(DIM("  run ") + chalk.cyan("youmd skill list") + DIM(" to see available skills."));
    console.log(DIM("  or:  ") + chalk.cyan("youmd skill browse") + DIM(" to check the registry."));
    console.log("");
    return;
  }

  if (entry.installed) {
    console.log("");
    console.log(DIM(`  "${entry.name}" is already installed.`));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner(randomSpinner("install"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 300));

  // Try sync install, fall back to async for remote sources
  let result = installSkill(entry.name);
  if (!result.ok && (entry.source.startsWith("github:") || entry.source.startsWith("https://"))) {
    result = await installSkillAsync(entry.name);
  }

  if (result.ok) {
    spinner.stop(`v${entry.version}`);
    console.log("");
    console.log(
      "  " + chalk.green("\u2713") + ` ${chalk.bold(entry.name)} installed` +
      DIM(` [${entry.scope}]`)
    );
    if (entry.identity_fields.length > 0) {
      console.log(DIM(`  identity fields: ${entry.identity_fields.join(", ")}`));
    }
  } else {
    spinner.fail(result.error);
  }
  console.log("");
}

async function removeSkillCmd(args: string[]): Promise<void> {
  const name = args[0];

  // Batch remove all
  if (name === "all" || name === "--all" || name === "-a") {
    const catalog = readSkillCatalog();
    const toRemove = catalog.skills.filter((s) => s.installed);

    if (toRemove.length === 0) {
      console.log("");
      console.log(DIM("  no skills installed."));
      console.log("");
      return;
    }

    console.log("");
    const spinner = new BrailleSpinner(randomSpinner("remove"));
    spinner.start();
    await new Promise((r) => setTimeout(r, 200));

    let removed = 0;
    for (const entry of toRemove) {
      const result = removeSkill(entry.name);
      if (result.ok) removed++;
    }

    spinner.stop(`${removed} skills removed`);
    console.log("");
    return;
  }

  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill remove <name>"));
    console.log(DIM("  or:    youmd skill remove all"));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner(randomSpinner("remove"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 200));

  const result = removeSkill(name);

  if (result.ok) {
    spinner.stop("removed");
  } else {
    spinner.fail(result.error);
  }
  console.log("");
}

async function useSkillCmd(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill use <name>"));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner(randomSpinner("use"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 400));

  const result = useSkill(name);

  if (!result.ok) {
    spinner.fail(result.error);
    console.log("");
    return;
  }

  spinner.stop();

  // Show readiness
  if (result.readiness) {
    const { total, filled, missing } = result.readiness;
    if (missing.length > 0) {
      console.log("");
      console.log(
        ACCENT(`  ${filled}/${total} identity fields resolved.`) +
        DIM(` missing: ${missing.join(", ")}`)
      );
      console.log(DIM("  fill these via ") + chalk.cyan("youmd chat") + DIM(" or edit .youmd/preferences/"));
    } else {
      console.log(DIM(`  ${total}/${total} identity fields resolved.`));
    }
  }

  // Show rendered output with rich terminal formatting
  if (result.content) {
    console.log("");
    console.log(DIM("  " + "\u2500".repeat(50)));
    const rendered = renderRichResponse(result.content);
    // Limit output to ~40 visual lines
    const renderedLines = rendered.split("\n");
    for (const line of renderedLines.slice(0, 40)) {
      console.log(`  ${line}`);
    }
    if (renderedLines.length > 40) {
      console.log(DIM(`  ... ${renderedLines.length - 40} more lines`));
    }
    console.log(DIM("  " + "\u2500".repeat(50)));
  }
  console.log("");
}

async function syncSkillsCmd(): Promise<void> {
  console.log("");
  const spinner = new BrailleSpinner(randomSpinner("sync"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 400));

  const result = syncAllSkills();

  if (result.synced.length > 0) {
    spinner.stop(`${result.synced.length} skills synced`);
    for (const name of result.synced) {
      console.log(`  ${chalk.green("\u2713")} ${DIM(name)}`);
    }
  } else {
    spinner.stop("no installed skills to sync");
  }

  if (result.errors.length > 0) {
    console.log("");
    for (const err of result.errors) {
      console.log(`  ${ACCENT("\u2717")} ${DIM(err)}`);
    }
  }
  console.log("");
}

function addSkillCmd(args: string[]): void {
  const name = args[0];
  const source = args[1];

  if (!name || !source) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill add <name> <source>"));
    console.log(DIM("  source: local:/path/to/skill.md or github:owner/repo/path"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  addSkillEntry(catalog, {
    name,
    description: `Custom skill: ${name}`,
    version: "1.0.0",
    source,
    scope: "shared" as SkillScope,
    identity_fields: [],
    requires: [],
  });

  console.log("");
  console.log(chalk.green("  \u2713") + ` ${chalk.bold(name)} added to catalog`);
  console.log(DIM(`  source: ${source}`));
  console.log(DIM("  run ") + chalk.cyan(`youmd skill install ${name}`) + DIM(" to install."));
  console.log("");
}

async function createSkillCmd(args: string[]): Promise<void> {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((res) => rl.question(q, (a: string) => res(a.trim())));

  console.log("");
  console.log("  " + chalk.bold("youmd skill create"));
  console.log(DIM("  scaffold a new identity-aware skill\n"));

  // Name
  let name = args[0] || "";
  if (!name) {
    name = await ask(ACCENT("  skill name: "));
  }
  if (!name) {
    console.log(chalk.yellow("  name is required."));
    rl.close();
    return;
  }
  const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");

  // Description
  const description = await ask(DIM("  description: "));

  // Scope
  const scopeInput = await ask(DIM("  scope (shared/project/private) [shared]: "));
  const scope = (["shared", "project", "private"].includes(scopeInput) ? scopeInput : "shared") as SkillScope;

  // Identity fields
  console.log(DIM("  common fields: voice.overall, preferences.agent, directives.agent, profile.about"));
  const fieldsInput = await ask(DIM("  identity fields (comma-separated): "));
  const identityFields = fieldsInput
    ? fieldsInput.split(",").map((f: string) => f.trim()).filter(Boolean)
    : [];

  rl.close();

  // Generate SKILL.md content
  const skillContent = [
    "---",
    `name: ${slug}`,
    `version: 1.0.0`,
    `scope: ${scope}`,
    `identity_fields: [${identityFields.join(", ")}]`,
    `description: "${description || `Custom skill: ${slug}`}"`,
    "---",
    "",
    `# ${slug}`,
    "",
    description || "(describe what this skill does)",
    "",
    ...(identityFields.length > 0
      ? [
          "## Identity Context",
          "",
          ...identityFields.map((f: string) => `- **${f}:** {{${f}}}`),
          "",
        ]
      : []),
    "## What This Skill Does",
    "",
    "1. (step 1)",
    "2. (step 2)",
    "3. (step 3)",
    "",
  ].join("\n");

  // Write to ~/.youmd/skills/<name>/SKILL.md
  const os = require("os");
  const skillDir = path.join(os.homedir(), ".youmd", "skills", slug);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillContent);

  // Add to catalog
  const catalog = readSkillCatalog();
  addSkillEntry(catalog, {
    name: slug,
    description: description || `Custom skill: ${slug}`,
    version: "1.0.0",
    source: `local:${path.join(skillDir, "SKILL.md")}`,
    scope,
    identity_fields: identityFields,
    requires: [],
    installed: true,
  });

  console.log("");
  console.log(chalk.green("  \u2713") + ` ${chalk.bold(slug)} created`);
  console.log(DIM(`  ${path.join(skillDir, "SKILL.md")}`));
  console.log("");
  console.log(DIM("  edit the SKILL.md, then:"));
  console.log(`    ${chalk.cyan(`youmd skill use ${slug}`)}   ${DIM("render with your identity")}`);
  console.log(`    ${chalk.cyan(`youmd skill link claude`)} ${DIM("link to your project")}`);
  console.log("");
}

function pushSkillCmd(args: string[]): void {
  const name = args[0];
  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill push <name>"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, name);

  if (!entry) {
    console.log("");
    console.log(chalk.yellow(`  skill "${name}" not found.`));
    console.log("");
    return;
  }

  if (!entry.source.startsWith("local:")) {
    console.log("");
    console.log(DIM("  push is only supported for local: sources right now."));
    console.log(DIM(`  source: ${entry.source}`));
    console.log("");
    return;
  }

  const skillPath = path.join(
    require("os").homedir(), ".youmd", "skills", entry.name, "SKILL.md"
  );
  if (!fs.existsSync(skillPath)) {
    console.log(chalk.yellow(`  SKILL.md not found for "${name}". install first.`));
    return;
  }

  const destPath = entry.source.slice("local:".length);
  const content = fs.readFileSync(skillPath, "utf-8");
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content);

  console.log("");
  console.log(chalk.green("  \u2713") + ` ${name} pushed to ${destPath}`);
  console.log("");
}

async function linkSkillsCmd(args: string[]): Promise<void> {
  let target = (args[0] || "").toLowerCase() as AgentTarget;
  const validTargets: AgentTarget[] = ["claude", "cursor", "codex"];

  // Auto-detect agent if no target specified
  if (!target) {
    const cwd = process.cwd();
    if (fs.existsSync(path.join(cwd, ".claude")) || fs.existsSync(path.join(cwd, "CLAUDE.md"))) {
      target = "claude";
    } else if (fs.existsSync(path.join(cwd, ".cursor"))) {
      target = "cursor";
    } else {
      target = "claude"; // default
    }
  }

  if (!validTargets.includes(target)) {
    console.log("");
    console.log(chalk.yellow(`  unknown target: ${target}`));
    console.log(DIM(`  valid targets: ${validTargets.join(", ")}`));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner(randomSpinner("link"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 300));

  const result = linkToAgent(target);

  if (result.ok) {
    spinner.stop(result.path);
  } else {
    spinner.fail(result.error);
  }
  console.log("");
}

async function initProjectCmd(): Promise<void> {
  console.log("");
  console.log("  " + chalk.bold("youmd skill init-project"));

  // Detect existing .youmd-project
  const youmdProjectPath = path.join(process.cwd(), ".youmd-project");
  if (fs.existsSync(youmdProjectPath)) {
    console.log(DIM("  .youmd-project already exists -- re-running will update...\n"));
  } else {
    console.log(DIM("  scaffolding identity-aware project structure...\n"));
  }

  // Auto-install all catalog skills first (not just 2)
  const catalog = readSkillCatalog();
  const toInstall = catalog.skills.filter((s) => !s.installed);
  if (toInstall.length > 0) {
    const installSpinner = new BrailleSpinner(randomSpinner("install"));
    installSpinner.start();
    await new Promise((r) => setTimeout(r, 300));

    let installed = 0;
    for (const entry of toInstall) {
      let result = installSkill(entry.name);
      if (!result.ok && (entry.source.startsWith("github:") || entry.source.startsWith("https://"))) {
        result = await installSkillAsync(entry.name);
      }
      if (result.ok) installed++;
    }

    installSpinner.stop(`${installed} skills installed`);
  }

  const spinner = new BrailleSpinner(randomSpinner("init"));
  spinner.start();

  await new Promise((r) => setTimeout(r, 500));

  const result = initProject();

  spinner.stop();
  console.log("");

  for (const step of result.steps) {
    const icon = step.ok ? chalk.green("\u2713") : ACCENT("\u2717");
    const detail = step.detail ? DIM(` ${step.detail}`) : "";
    console.log(`  ${icon} ${step.name}${detail}`);
  }

  console.log("");
  if (result.ok) {
    console.log("  " + chalk.green("project initialized with your identity."));
    console.log(DIM("  every agent that touches this repo now knows who you are."));
  } else {
    console.log(ACCENT("  some steps failed. check above for details."));
  }
  console.log("");
}

function metricsCmd(): void {
  const metrics = getMetrics();

  console.log("");
  console.log("  " + chalk.bold("skill metrics"));
  console.log("");

  const skillEntries = Object.entries(metrics.skills);
  if (skillEntries.length === 0) {
    console.log(DIM("  no usage data yet. use some skills first."));
    console.log("");
    return;
  }

  const maxName = Math.max(...skillEntries.map(([name]) => name.length));

  for (const [name, data] of skillEntries) {
    const lastUsed = data.lastUsed
      ? DIM(` last: ${data.lastUsed.slice(0, 10)}`)
      : "";
    console.log(
      `  ${chalk.cyan(name.padEnd(maxName + 2))}` +
      `${ACCENT(String(data.uses))} uses  ` +
      `${DIM(String(data.installs))} installs${lastUsed}`
    );
  }

  console.log("");

  const fieldEntries = Object.entries(metrics.identityFields);
  if (fieldEntries.length > 0) {
    console.log("  " + ACCENT("identity field usage:"));
    for (const [field, data] of fieldEntries.sort((a, b) => b[1].references - a[1].references)) {
      console.log(`    ${DIM(field.padEnd(25))} ${ACCENT(String(data.references))} refs`);
    }
    console.log("");
  }
}

function improveCmd(): void {
  const metrics = getMetrics();
  const catalog = readSkillCatalog();
  const identity = loadIdentityData();

  console.log("");
  console.log("  " + chalk.bold("skill improvement analysis"));
  console.log("");

  const installed = catalog.skills.filter((s) => s.installed);
  const notInstalled = catalog.skills.filter((s) => !s.installed);

  // ─── Activity Analysis ────────────────────────────────────────────
  const totalUses = Object.values(metrics.skills).reduce((sum, s) => sum + s.uses, 0);
  console.log(
    "  " + ACCENT("overview: ") +
    `${installed.length} installed, ${totalUses} total uses, ` +
    `${Object.keys(metrics.identityFields).length} identity fields tracked`
  );
  console.log("");

  // Most used
  const mostUsed = Object.entries(metrics.skills)
    .filter(([, data]) => data.uses > 0)
    .sort((a, b) => b[1].uses - a[1].uses)
    .slice(0, 5);

  if (mostUsed.length > 0) {
    console.log("  " + ACCENT("most active:"));
    for (const [name, data] of mostUsed) {
      const bar = ACCENT("\u2588".repeat(Math.min(data.uses, 20))) + DIM("\u2591".repeat(Math.max(0, 20 - data.uses)));
      console.log(`    ${chalk.cyan(name.padEnd(24))} ${bar} ${data.uses}`);
    }
    console.log("");
  }

  // Unused installed skills
  const unused = installed.filter((s) => {
    const m = metrics.skills[s.name];
    return !m || m.uses === 0;
  });

  if (unused.length > 0) {
    console.log("  " + chalk.yellow("installed but never used:"));
    for (const s of unused) {
      console.log(`    ${DIM(s.name)} — consider removing or using`);
    }
    console.log("");
  }

  if (notInstalled.length > 0) {
    console.log("  " + DIM("available but not installed:"));
    for (const s of notInstalled) {
      console.log(`    ${chalk.cyan(s.name)} — ${DIM(s.description)}`);
    }
    console.log("");
  }

  // ─── Identity Coverage ────────────────────────────────────────────
  const allFields = new Set<string>();
  for (const s of catalog.skills) {
    for (const f of s.identity_fields) allFields.add(f);
  }

  const filled: string[] = [];
  const missing: string[] = [];

  for (const field of allFields) {
    const val = resolveVariable(field, identity);
    if (val) {
      filled.push(field);
    } else {
      missing.push(field);
    }
  }

  if (allFields.size > 0) {
    const pct = Math.round((filled.length / allFields.size) * 100);
    const barWidth = 30;
    const filledBar = Math.round((filled.length / allFields.size) * barWidth);
    const bar = chalk.green("\u2588".repeat(filledBar)) + DIM("\u2591".repeat(barWidth - filledBar));
    console.log("  " + ACCENT("identity coverage:"));
    console.log(`    ${bar} ${pct}% (${filled.length}/${allFields.size})`);
    console.log("");
  }

  if (missing.length > 0) {
    console.log("  " + ACCENT("identity gaps:"));
    console.log(DIM("  referenced by skills but empty in your identity:"));
    for (const f of missing) {
      console.log(`    ${chalk.yellow(f)}`);
    }
    console.log(DIM("\n  fill via ") + chalk.cyan("youmd chat") + DIM(" or edit .youmd/preferences/"));
    console.log("");
  } else if (allFields.size > 0) {
    console.log("  " + chalk.green("\u2713") + DIM(" all identity fields populated."));
    console.log("");
  }

  // ─── Actionable Proposals ─────────────────────────────────────────
  const proposals: string[] = [];

  // Propose installing uninstalled skills if identity data exists for them
  for (const s of notInstalled) {
    const hasData = s.identity_fields.some((f) => resolveVariable(f, identity));
    if (hasData) {
      proposals.push(`install "${s.name}" — you have identity data it needs`);
    }
  }

  // Propose adding directives if agent preference exists but no directives
  if (identity.preferences.agent && !identity.directives.agent) {
    proposals.push("add directives.agent — you have agent preferences but no directives file");
  }

  // Propose voice sync if voice data exists but voice-sync isn't installed
  if (identity.voice.overall && !findSkill(catalog, "voice-sync")?.installed) {
    proposals.push("install voice-sync — you have voice data that could propagate to all agents");
  }

  // Propose running sync if skills are installed but metrics show 0 syncs
  const syncCount = Object.values(metrics.skills).reduce((sum, s) => sum + s.uses, 0);
  if (installed.length > 0 && syncCount === 0) {
    proposals.push("run \"youmd skill sync\" — installed skills haven't been synced yet");
  }

  // Propose linking if skills installed but no .claude/skills/youmd exists
  if (installed.length > 0) {
    const claudeSkillsDir = path.join(process.cwd(), ".claude", "skills", "youmd");
    if (!fs.existsSync(claudeSkillsDir)) {
      proposals.push("run \"youmd skill link claude\" — skills aren't linked to this project's agent");
    }
  }

  if (proposals.length > 0) {
    console.log("  " + chalk.bold("proposals:"));
    for (const p of proposals) {
      console.log(`    ${ACCENT("\u203A")} ${p}`);
    }
    console.log("");
  } else {
    console.log("  " + chalk.green("\u2713") + DIM(" no improvements to suggest right now."));
    console.log("");
  }
}

function searchCmd(args: string[]): void {
  const query = args.join(" ");
  if (!query) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill search <query>"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  const results = searchSkills(catalog, query);

  console.log("");
  if (results.length === 0) {
    console.log(DIM(`  no skills matching "${query}".`));
  } else {
    console.log(`  ${results.length} result${results.length === 1 ? "" : "s"} for "${query}":`);
    console.log("");
    for (const s of results) {
      const status = s.installed ? chalk.green("\u2713") : DIM("\u2022");
      console.log(`  ${status} ${chalk.cyan(s.name)} — ${DIM(s.description)}`);
    }
  }
  console.log("");
}

async function browseCmd(): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner("scanning the skill registry");
  spinner.start();
  await new Promise((r) => setTimeout(r, 300));

  try {
    const res = await browseSkills();
    if (!res.ok) {
      spinner.fail("could not reach registry");
      console.log("");
      return;
    }

    const skills = res.data.skills;
    spinner.stop(`${skills.length} skill${skills.length === 1 ? "" : "s"} in registry`);

    if (skills.length === 0) {
      console.log(DIM("  no skills published yet."));
      console.log(DIM("  be the first: ") + chalk.cyan("youmd skill publish <name>"));
      console.log("");
      return;
    }

    console.log("");
    const maxName = Math.max(...skills.map((s) => s.name.length));
    for (const s of skills) {
      const dl = s.downloads > 0 ? ACCENT(` ${s.downloads} dl`) : "";
      console.log(
        `  ${chalk.cyan(s.name.padEnd(maxName + 2))}` +
        `${DIM(s.description)}${dl}`
      );
      console.log(`    ${DIM("v" + s.version)} ${DIM(s.scope)} ${DIM(`[${s.identityFields.join(", ")}]`)}`);
    }
    console.log("");
    console.log(DIM(`  install with: youmd skill add <name> registry:<name>`));
  } catch {
    spinner.fail("registry unreachable");
  }
  console.log("");
}

async function publishSkillCmd(args: string[]): Promise<void> {
  const name = args[0];
  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill publish <name>"));
    console.log(DIM("  publishes an installed skill to the you.md registry."));
    console.log("");
    return;
  }

  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, name);

  if (!entry) {
    console.log("");
    console.log(chalk.yellow(`  skill "${name}" not found in catalog.`));
    console.log("");
    return;
  }

  const skillFile = readSkillFile(entry.name);
  if (!skillFile) {
    console.log("");
    console.log(chalk.yellow(`  SKILL.md not found for "${name}". install first.`));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner("publishing to the skill registry");
  spinner.start();
  await new Promise((r) => setTimeout(r, 400));

  try {
    const res = await apiPublishSkill({
      name: entry.name,
      description: entry.description,
      version: entry.version,
      scope: entry.scope,
      identityFields: entry.identity_fields,
      content: skillFile.content,
    });

    if (res.ok) {
      spinner.stop(res.data.updated ? "updated" : "published");
      console.log("");
      console.log(
        chalk.green("  \u2713") + ` ${chalk.bold(entry.name)} is live on the registry`
      );
      console.log(DIM(`  others can install with: youmd skill add ${entry.name} registry:${entry.name}`));
    } else {
      spinner.fail(String((res.data as any)?.error || "publish failed"));
    }
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : "failed");
  }
  console.log("");
}

async function remoteStatusCmd(): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }

  console.log("");
  const spinner = new BrailleSpinner("fetching your skill profile from the cloud");
  spinner.start();
  await new Promise((r) => setTimeout(r, 300));

  try {
    const res = await getMySkills();
    if (!res.ok) {
      spinner.fail("could not fetch");
      console.log("");
      return;
    }

    const skills = res.data.skills;
    spinner.stop(`${skills.length} synced to you.md`);

    if (skills.length === 0) {
      console.log(DIM("  no skills synced to your account yet."));
      console.log(DIM("  install skills locally and they'll auto-sync."));
    } else {
      console.log("");
      for (const s of skills) {
        const uses = s.useCount > 0 ? ACCENT(` ${s.useCount} uses`) : "";
        console.log(`  ${chalk.green("\u2713")} ${chalk.cyan(s.skillName)} ${DIM(s.source)}${uses}`);
      }
    }
  } catch {
    spinner.fail("unreachable");
  }
  console.log("");
}

function infoCmd(args: string[]): void {
  const name = args[0];
  if (!name) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd skill info <name>"));
    console.log("");
    return;
  }

  const catalog = readSkillCatalog();
  const entry = findSkill(catalog, name);

  if (!entry) {
    console.log("");
    console.log(chalk.yellow(`  skill "${name}" not found.`));
    console.log("");
    return;
  }

  const skillFile = readSkillFile(entry.name);
  const metrics = getMetrics();
  const m = metrics.skills[entry.name];
  const identity = loadIdentityData();

  console.log("");
  console.log("  " + chalk.bold(entry.name) + DIM(` v${entry.version}`));
  console.log(DIM(`  ${entry.description}`));
  console.log("");

  // Status
  console.log(`  ${ACCENT("status:")}    ${entry.installed ? chalk.green("installed") : DIM("not installed")}`);
  console.log(`  ${ACCENT("scope:")}     ${entry.scope}`);
  console.log(`  ${ACCENT("source:")}    ${DIM(entry.source)}`);

  // Metrics
  if (m) {
    console.log(`  ${ACCENT("uses:")}      ${m.uses}`);
    console.log(`  ${ACCENT("installs:")}  ${m.installs}`);
    if (m.lastUsed) console.log(`  ${ACCENT("last used:")} ${DIM(m.lastUsed.slice(0, 10))}`);
  }

  // Identity fields
  if (entry.identity_fields.length > 0) {
    console.log("");
    console.log("  " + ACCENT("identity fields:"));
    for (const field of entry.identity_fields) {
      const val = resolveVariable(field, identity);
      const status = val ? chalk.green("\u2713") : chalk.yellow("\u2022");
      const preview = val ? DIM(` ${truncateAtWord(val, 50)}`) : DIM(" (empty)");
      console.log(`    ${status} ${field}${preview}`);
    }
  }

  // Content preview
  if (skillFile) {
    console.log("");
    console.log("  " + ACCENT("content:"));
    const lines = skillFile.content.split("\n").slice(0, 8);
    for (const line of lines) {
      console.log(DIM(`    ${line}`));
    }
    const total = skillFile.content.split("\n").length;
    if (total > 8) {
      console.log(DIM(`    ... ${total - 8} more lines`));
    }
  }

  console.log("");
}

function exportSkillsCmd(args: string[]): void {
  const outputDir = args[0] || path.join(process.cwd(), "youmd-skills");
  const catalog = readSkillCatalog();
  const installed = catalog.skills.filter((s) => s.installed);

  if (installed.length === 0) {
    console.log("");
    console.log(DIM("  no skills installed to export."));
    console.log("");
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log("");
  let exported = 0;
  for (const entry of installed) {
    const skillFile = readSkillFile(entry.name);
    if (!skillFile) continue;

    // Export the raw SKILL.md
    const outPath = path.join(outputDir, `${entry.name}.md`);
    const raw = fs.readFileSync(
      path.join(require("os").homedir(), ".youmd", "skills", entry.name, "SKILL.md"),
      "utf-8"
    );
    fs.writeFileSync(outPath, raw);

    // Also export the rendered version
    const renderedPath = path.join(
      require("os").homedir(), ".youmd", "skills", entry.name, "RENDERED.md"
    );
    if (fs.existsSync(renderedPath)) {
      fs.writeFileSync(
        path.join(outputDir, `${entry.name}.rendered.md`),
        fs.readFileSync(renderedPath, "utf-8")
      );
    }

    console.log(`  ${chalk.green("\u2713")} ${entry.name}`);
    exported++;
  }

  // Write catalog.yaml
  const yaml = require("js-yaml");
  const exportCatalog = {
    version: 1,
    exported: new Date().toISOString(),
    skills: installed.map((s) => ({
      name: s.name,
      description: s.description,
      version: s.version,
      scope: s.scope,
      identity_fields: s.identity_fields,
    })),
  };
  fs.writeFileSync(
    path.join(outputDir, "catalog.yaml"),
    yaml.dump(exportCatalog, { lineWidth: 120, noRefs: true })
  );

  console.log("");
  console.log(chalk.green(`  exported ${exported} skills to ${outputDir}/`));
  console.log(DIM("  share this directory or publish individual skills."));
  console.log("");
}

// ─── Main command router ──────────────────────────────────────────────

export async function skillCommand(subcommand?: string, ...args: string[]): Promise<void> {
  const sub = (subcommand || "").toLowerCase();

  switch (sub) {
    case "list":
    case "ls":
      await listSkills();
      break;
    case "install":
      await installSkillCmd(args);
      break;
    case "remove":
    case "rm":
      await removeSkillCmd(args);
      break;
    case "use":
    case "run":
      await useSkillCmd(args);
      break;
    case "sync":
      await syncSkillsCmd();
      break;
    case "add":
      addSkillCmd(args);
      break;
    case "create":
    case "new":
      await createSkillCmd(args);
      break;
    case "push":
      pushSkillCmd(args);
      break;
    case "link":
      await linkSkillsCmd(args);
      break;
    case "init-project":
    case "init":
      await initProjectCmd();
      break;
    case "improve":
      improveCmd();
      break;
    case "metrics":
    case "stats":
      metricsCmd();
      break;
    case "search":
      searchCmd(args);
      break;
    case "browse":
    case "registry":
      await browseCmd();
      break;
    case "publish":
      await publishSkillCmd(args);
      break;
    case "remote":
    case "cloud":
      await remoteStatusCmd();
      break;
    case "export":
      exportSkillsCmd(args);
      break;
    case "info":
    case "show":
      infoCmd(args);
      break;
    default: {
      const catalog = readSkillCatalog();
      const installed = catalog.skills.filter((s) => s.installed);

      console.log("");
      console.log("  " + chalk.bold("youmd skill") + DIM(" — identity-aware agent skills"));
      console.log("");

      if (installed.length > 0) {
        // Quick identity coverage
        const identity = loadIdentityData();
        const allFields = new Set<string>();
        for (const s of catalog.skills) {
          for (const f of s.identity_fields) allFields.add(f);
        }
        let filledCount = 0;
        for (const field of allFields) {
          if (resolveVariable(field, identity)) filledCount++;
        }
        const pct = allFields.size > 0 ? Math.round((filledCount / allFields.size) * 100) : 0;

        console.log(
          "  " + ACCENT("installed:") +
          DIM(` ${installed.length}/${catalog.skills.length}`) +
          DIM("  identity: ") +
          (pct === 100 ? chalk.green(`${pct}%`) : ACCENT(`${pct}%`))
        );
        for (const s of installed) {
          console.log(`    ${chalk.green("\u2713")} ${chalk.cyan(s.name)} ${DIM("v" + s.version)}`);
        }
        console.log("");
      }

      console.log("  " + chalk.cyan("commands:"));
      console.log("");
      console.log(`    ${chalk.cyan("list".padEnd(28))} ${DIM("show all skills with install status")}`);
      console.log(`    ${chalk.cyan("install <name|all>".padEnd(28))} ${DIM("install skill(s) from the catalog")}`);
      console.log(`    ${chalk.cyan("remove <name|all>".padEnd(28))} ${DIM("remove installed skill(s)")}`);
      console.log(`    ${chalk.cyan("use <name>".padEnd(28))} ${DIM("run a skill with identity interpolation")}`);
      console.log(`    ${chalk.cyan("sync".padEnd(28))} ${DIM("re-render all skills against live identity")}`);
      console.log(`    ${chalk.cyan("create [name]".padEnd(28))} ${DIM("scaffold a new custom skill")}`);
      console.log(`    ${chalk.cyan("add <name> <source>".padEnd(28))} ${DIM("register a new skill in catalog")}`);
      console.log(`    ${chalk.cyan("push <name>".padEnd(28))} ${DIM("push local changes back to source")}`);
      console.log(`    ${chalk.cyan("link <agent>".padEnd(28))} ${DIM("link to claude | cursor | codex")}`);
      console.log(`    ${chalk.cyan("init-project".padEnd(28))} ${DIM("CLAUDE.md + project-context/ + link")}`);
      console.log(`    ${chalk.cyan("improve".padEnd(28))} ${DIM("review metrics, find gaps, propose changes")}`);
      console.log(`    ${chalk.cyan("metrics".padEnd(28))} ${DIM("usage stats and effectiveness scores")}`);
      console.log(`    ${chalk.cyan("search <query>".padEnd(28))} ${DIM("search skills by name or description")}`);
      console.log(`    ${chalk.cyan("browse".padEnd(28))} ${DIM("browse the public skill registry")}`);
      console.log(`    ${chalk.cyan("publish <name>".padEnd(28))} ${DIM("publish a skill to the registry")}`);
      console.log(`    ${chalk.cyan("remote".padEnd(28))} ${DIM("show skills synced to your you.md account")}`);
      console.log(`    ${chalk.cyan("export [dir]".padEnd(28))} ${DIM("export all installed skills to a directory")}`);
      console.log(`    ${chalk.cyan("info <name>".padEnd(28))} ${DIM("detailed info about a skill")}`);
      console.log("");
      console.log(DIM("  skills are identity-aware markdown templates."));
      console.log(DIM("  {{voice.overall}} and {{preferences.agent}} resolve from your bundle."));
      console.log("");
      break;
    }
  }
}
