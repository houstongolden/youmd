import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import {
  initProjectFiles,
  readProjectContext,
  listProjects,
  findProjectsRoot,
  getProjectDir,
  getProjectMemories,
  addProjectMemory,
} from "../lib/project";
import { projectLogWrite, projectLogRead } from "./project-log";
import {
  getLocalBundleDir,
  localBundleExists,
  detectProjectContext,
  YoumdProjectFile,
} from "../lib/config";
import {
  ensureProjectDirs,
  readMergedProjectContext,
  readProjectPrivateNotes,
  resolveProjectContext,
} from "../lib/projectContext";
import { runPortfolioAudit } from "../lib/portfolio-audit";

// ─── Helpers ──────────────────────────────────────────────────────────

const ACCENT = chalk.hex("#C46A3A");

function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function ensureProjectsRoot(): string {
  // Use local .youmd/projects/ relative to the bundle dir, or cwd
  let base: string;
  if (localBundleExists()) {
    base = getLocalBundleDir();
  } else {
    base = path.join(process.cwd(), ".youmd");
  }
  const projectsRoot = path.join(base, "projects");
  if (!fs.existsSync(projectsRoot)) {
    fs.mkdirSync(projectsRoot, { recursive: true });
  }
  return projectsRoot;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ─── Subcommands ──────────────────────────────────────────────────────

async function initProject(args: string[]): Promise<void> {
  const rl = createRL();
  console.log("");

  // Auto-detect project from cwd
  const detected = detectProjectContext();
  let projectName = args[0] || "";

  if (!projectName && detected) {
    console.log(
      chalk.dim(`  detected project: ${detected.name} (${detected.root})`)
    );
    const useDetected = await ask(rl, chalk.dim(`  use "${detected.name}" as project name? [Y/n]: `));
    if (!useDetected || useDetected.toLowerCase() !== "n") {
      projectName = detected.name;
    }
  }

  if (!projectName) {
    projectName = await ask(rl, chalk.dim("  project name: "));
  }

  if (!projectName) {
    console.log(chalk.yellow("  project name is required."));
    console.log("");
    rl.close();
    return;
  }

  const description = await ask(rl, chalk.dim("  description (optional): "));

  // Ask if they want to create a .youmd-project marker file in the project root
  let createMarker = false;
  if (detected) {
    const youmdProjectPath = path.join(detected.root, ".youmd-project");
    if (!fs.existsSync(youmdProjectPath)) {
      const markerAnswer = await ask(rl, chalk.dim("  create .youmd-project marker in project root? [Y/n]: "));
      createMarker = !markerAnswer || markerAnswer.toLowerCase() !== "n";
    }
  }

  rl.close();

  const projectsRoot = ensureProjectsRoot();
  const slug = slugify(projectName);
  const projectDir = path.join(projectsRoot, slug);

  if (fs.existsSync(path.join(projectDir, "project.json"))) {
    console.log(chalk.yellow(`  project "${slug}" already exists.`));
    console.log(chalk.dim(`  ${projectDir}`));
    console.log("");
    return;
  }

  initProjectFiles(projectDir, projectName, description);

  // Also create .youmd-project marker in the project root if requested
  if (createMarker && detected) {
    const youmdProjectPath = path.join(detected.root, ".youmd-project");
    const projectFile: YoumdProjectFile = {
      name: projectName,
      description: description || undefined,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(youmdProjectPath, JSON.stringify(projectFile, null, 2) + "\n");
    console.log(chalk.dim(`  created ${youmdProjectPath}`));
  }

  // Also ensure global project dirs exist
  ensureProjectDirs(projectName);

  console.log("");
  console.log(chalk.green("  project initialized:") + " " + chalk.bold(projectName));
  console.log(chalk.dim(`  ${projectDir}`));
  console.log("");
  console.log(chalk.dim("  structure:"));
  console.log(chalk.dim("    project.json          metadata"));
  console.log(chalk.dim("    context/prd.md        product requirements"));
  console.log(chalk.dim("    context/todo.md       task tracking"));
  console.log(chalk.dim("    context/features.md   feature requests"));
  console.log(chalk.dim("    context/changelog.md  changes log"));
  console.log(chalk.dim("    context/decisions.md  decision log"));
  console.log(chalk.dim("    agent/instructions.md agent instructions"));
  console.log(chalk.dim("    agent/preferences.json agent preferences"));
  console.log(chalk.dim("    agent/memory.json     agent memories"));
  console.log(chalk.dim("    private/notes.md      private notes"));
  console.log("");
}

function listAllProjects(): void {
  const projectsRoot = findProjectsRoot();
  if (!projectsRoot) {
    console.log("");
    console.log(chalk.yellow("  no .youmd/projects/ directory found."));
    console.log(chalk.dim("  run ") + chalk.cyan("youmd project init") + chalk.dim(" to create one."));
    console.log("");
    return;
  }

  const projects = listProjects(projectsRoot);
  if (projects.length === 0) {
    console.log("");
    console.log(chalk.dim("  no projects yet."));
    console.log(chalk.dim("  run ") + chalk.cyan("youmd project init <name>") + chalk.dim(" to create one."));
    console.log("");
    return;
  }

  console.log("");
  console.log("  " + chalk.bold("projects:"));
  console.log("");

  for (const name of projects) {
    const projectDir = path.join(projectsRoot, name);
    const ctx = readProjectContext(projectDir);
    if (ctx) {
      const desc = ctx.meta.description ? chalk.dim(` — ${ctx.meta.description}`) : "";
      console.log(`    ${chalk.cyan(ctx.meta.name)}${desc}`);
      console.log(chalk.dim(`    updated: ${ctx.meta.updated_at.slice(0, 10)}`));
      console.log("");
    }
  }
}

function showProject(args: string[]): void {
  let projectName = args[0];

  // Auto-detect project from cwd if no name given
  if (!projectName) {
    const detected = detectProjectContext();
    if (detected) {
      projectName = detected.name;
      console.log("");
      console.log(
        "  " + chalk.hex("#C46A3A")("detected project:") + " " + chalk.white(detected.name) +
        chalk.dim(` (${detected.root})`)
      );
      if (detected.youmdProject?.description) {
        console.log(chalk.dim(`  ${detected.youmdProject.description}`));
      }

      // Show project-scoped private notes from global .youmd
      const notes = readProjectPrivateNotes(detected.name);
      if (notes) {
        console.log("");
        console.log("  " + chalk.hex("#C46A3A")("project private notes:"));
        for (const line of notes.split("\n").slice(0, 10)) {
          console.log(chalk.white(`    ${line}`));
        }
        const lineCount = notes.split("\n").length;
        if (lineCount > 10) {
          console.log(chalk.dim(`    ... ${lineCount - 10} more lines`));
        }
      }
    } else {
      console.log("");
      console.log(chalk.yellow("  usage: youmd project show <name>"));
      console.log(chalk.dim("  or run from inside a project directory for auto-detection."));
      console.log("");
      return;
    }
  }

  const projectsRoot = findProjectsRoot();
  const resolved = resolveProjectContext({ projectName });
  if (!projectsRoot && !resolved.repoContextDir) {
    console.log("");
    console.log(chalk.yellow("  no projects directory found."));
    console.log("");
    return;
  }

  const slug = slugify(projectName);
  // Merged read: repo project-context/ overlays the managed store copy.
  const ctx = readMergedProjectContext({ projectName });
  const projectDir = resolved.globalDir ||
    (projectsRoot ? getProjectDir(projectsRoot, projectName) : resolved.repoContextDir || "");

  if (!ctx) {
    console.log("");
    console.log(chalk.yellow(`  project "${slug}" not found.`));
    console.log("");
    return;
  }

  console.log("");
  console.log("  " + chalk.bold(ctx.meta.name));
  if (ctx.meta.description) {
    console.log(chalk.dim(`  ${ctx.meta.description}`));
  }
  console.log(chalk.dim(`  created: ${ctx.meta.created_at.slice(0, 10)}  updated: ${ctx.meta.updated_at.slice(0, 10)}`));
  console.log("");

  // Show preferences
  const prefs = ctx.preferences;
  if (prefs.tone || prefs.stack || prefs.focus) {
    console.log("  " + chalk.hex("#C46A3A")("preferences:"));
    if (prefs.tone) console.log(chalk.dim(`    tone: ${prefs.tone}`));
    if (prefs.stack) console.log(chalk.dim(`    stack: ${prefs.stack}`));
    if (prefs.focus) console.log(chalk.dim(`    focus: ${prefs.focus}`));
    console.log("");
  }

  // Show TODO summary
  const todoLines = ctx.todo.split("\n").filter((l) => l.startsWith("- ") || l.startsWith("* "));
  if (todoLines.length > 0) {
    console.log("  " + chalk.hex("#C46A3A")("tasks:") + chalk.dim(` (${todoLines.length})`));
    for (const line of todoLines.slice(0, 5)) {
      console.log(chalk.dim(`    ${line}`));
    }
    if (todoLines.length > 5) {
      console.log(chalk.dim(`    ... and ${todoLines.length - 5} more`));
    }
    console.log("");
  }

  // Show memories count
  const memories = ctx.memories;
  if (memories.length > 0) {
    console.log("  " + chalk.hex("#C46A3A")("memories:") + chalk.dim(` ${memories.length}`));
    console.log("");
  }

  console.log(chalk.dim(`  path: ${projectDir}`));
  console.log("");
}

function showMemories(args: string[]): void {
  const projectName = args[0];
  if (!projectName) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd project memories <name>"));
    console.log("");
    return;
  }

  const projectsRoot = findProjectsRoot();
  if (!projectsRoot) {
    console.log("");
    console.log(chalk.yellow("  no projects directory found."));
    console.log("");
    return;
  }

  const projectDir = getProjectDir(projectsRoot, projectName);
  const memories = getProjectMemories(projectDir);

  if (memories.length === 0) {
    console.log("");
    console.log(chalk.dim("  no memories for this project yet."));
    console.log("");
    return;
  }

  console.log("");
  console.log("  " + chalk.bold("project memories:") + chalk.dim(` (${memories.length})`));
  console.log("");

  for (const mem of memories.slice(-20)) {
    console.log(`    ${chalk.hex("#C46A3A")(`[${mem.category}]`)} ${chalk.dim(mem.content)}`);
    console.log(chalk.dim(`    ${mem.created_at.slice(0, 10)}`));
  }
  console.log("");
}

async function addMemory(args: string[]): Promise<void> {
  const projectName = args[0];
  if (!projectName) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd project remember <name> <category> <content>"));
    console.log("");
    return;
  }

  const category = args[1] || "note";
  const content = args.slice(2).join(" ");

  if (!content) {
    console.log("");
    console.log(chalk.yellow("  memory content is required."));
    console.log(chalk.dim("  usage: youmd project remember <name> <category> <content>"));
    console.log("");
    return;
  }

  const projectsRoot = findProjectsRoot();
  if (!projectsRoot) {
    console.log("");
    console.log(chalk.yellow("  no projects directory found."));
    console.log("");
    return;
  }

  const projectDir = getProjectDir(projectsRoot, projectName);
  if (!fs.existsSync(path.join(projectDir, "project.json"))) {
    console.log("");
    console.log(chalk.yellow(`  project "${projectName}" not found.`));
    console.log("");
    return;
  }

  addProjectMemory(projectDir, { category, content });
  console.log("");
  console.log(chalk.green(`  memory saved`) + chalk.dim(` [${category}] ${content.slice(0, 60)}`));
  console.log("");
}

async function editFile(args: string[]): Promise<void> {
  const projectName = args[0];
  const filePath = args[1];

  if (!projectName || !filePath) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd project edit <name> <file-path>"));
    console.log(chalk.dim("  files: context/prd.md, context/todo.md, context/features.md, ..."));
    console.log("");
    return;
  }

  const projectsRoot = findProjectsRoot();
  if (!projectsRoot) {
    console.log("");
    console.log(chalk.yellow("  no projects directory found."));
    console.log("");
    return;
  }

  const projectDir = getProjectDir(projectsRoot, projectName);
  const fullPath = path.join(projectDir, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log("");
    console.log(chalk.yellow(`  file not found: ${filePath}`));
    console.log("");
    return;
  }

  const current = fs.readFileSync(fullPath, "utf-8");
  console.log("");
  console.log(chalk.dim(`  --- ${filePath} ---`));
  console.log(chalk.dim(current.slice(0, 500)));
  if (current.length > 500) console.log(chalk.dim("  ..."));
  console.log(chalk.dim(`  --- end ---`));
  console.log("");
  console.log(chalk.dim(`  edit this file directly at:`));
  console.log(`  ${fullPath}`);
  console.log("");
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function showPortfolioAudit(args: string[]): void {
  const root = readFlagValue(args, "--root");
  const json = hasFlag(args, "--json");
  const includeDotenv = hasFlag(args, "--include-dotenv");
  const fingerprints = hasFlag(args, "--fingerprints");
  const result = runPortfolioAudit({ root, includeDotenv, fingerprints, activeDays: 365 });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("");
  console.log("  " + chalk.bold("portfolio audit") + chalk.dim(" — project/api/env map"));
  console.log("");
  console.log(chalk.dim(`  root: ${result.root}`));
  console.log(chalk.dim(`  projects scanned: ${result.projectsScanned}`));
  console.log(chalk.dim(`  env files scanned: ${result.envFilesScanned}`));
  console.log(chalk.dim(`  providers detected: ${result.providers.length}`));
  console.log("");

  if (!fingerprints) {
    console.log(chalk.dim("  secret values were not read. add --fingerprints to compare reused values by local salted HMAC."));
    console.log("");
  } else {
    console.log(chalk.dim("  fingerprints are local salted HMAC prefixes, not raw secret values."));
    console.log("");
  }

  for (const provider of result.providers.slice(0, 20)) {
    const shared = provider.sharedFingerprints.length > 0
      ? ACCENT(` / ${provider.sharedFingerprints.length} shared value group${provider.sharedFingerprints.length === 1 ? "" : "s"}`)
      : "";
    console.log(`  ${chalk.cyan(provider.provider)} ${chalk.dim(`(${provider.category})`)}${shared}`);
    console.log(chalk.dim(`    projects: ${provider.projects.join(", ") || "none"}`));
    console.log(chalk.dim(`    key names: ${provider.keyNames.slice(0, 8).join(", ")}${provider.keyNames.length > 8 ? ", ..." : ""}`));
    if (provider.sharedFingerprints.length > 0) {
      for (const group of provider.sharedFingerprints.slice(0, 3)) {
        console.log(chalk.dim(`    shared ${group.fingerprint}: ${group.projects.join(", ")} (${group.keyNames.join(", ")})`));
      }
    }
    console.log("");
  }

  console.log(chalk.dim("  dashboard: /api or /env"));
  console.log(chalk.dim("  skill: /skill use portfolio-graph-auditor"));
  console.log("");
}

// ─── Main command router ──────────────────────────────────────────────

export async function projectCommand(subcommand?: string, ...args: string[]): Promise<void> {
  const sub = (subcommand || "").toLowerCase();

  switch (sub) {
    case "init":
      await initProject(args);
      break;
    case "list":
    case "ls":
      listAllProjects();
      break;
    case "show":
    case "info":
      showProject(args);
      break;
    case "memories":
    case "memory":
      showMemories(args);
      break;
    case "remember":
      await addMemory(args);
      break;
    case "edit":
      await editFile(args);
      break;
    case "log":
      // With message args: write mode. No args: read mode.
      if (args.length > 0) {
        projectLogWrite(args);
      } else {
        projectLogRead();
      }
      break;
    case "portfolio-audit":
    case "env-audit":
    case "apis":
      showPortfolioAudit(args);
      break;
    default: {
      // If no subcommand, try auto-detecting the current project
      const detected = detectProjectContext();
      if (detected && !sub) {
        // Show current project info
        showProject([]);
        return;
      }

      console.log("");
      console.log("  " + chalk.bold("youmd project") + chalk.dim(" — manage project agent context"));
      console.log("");
      console.log("  " + chalk.cyan("subcommands:"));
      console.log("");
      console.log(`    ${chalk.cyan("init [name]".padEnd(28))} ${chalk.dim("initialize a new project")}`);
      console.log(`    ${chalk.cyan("list".padEnd(28))} ${chalk.dim("list all projects")}`);
      console.log(`    ${chalk.cyan("show [name]".padEnd(28))} ${chalk.dim("show project details (auto-detects in project dir)")}`);
      console.log(`    ${chalk.cyan("memories <name>".padEnd(28))} ${chalk.dim("list project memories")}`);
      console.log(`    ${chalk.cyan("remember <name> <cat> <msg>".padEnd(28))} ${chalk.dim("add a memory to a project")}`);
      console.log(`    ${chalk.cyan("edit <name> <file>".padEnd(28))} ${chalk.dim("show a project file path for editing")}`);
      console.log(`    ${chalk.cyan("log <message...>".padEnd(28))} ${chalk.dim("append an agent activity entry to project-context/you.md/log.md")}`);
      console.log(`    ${chalk.cyan("log".padEnd(28))} ${chalk.dim("read last 15 entries from the activity log")}`);
      console.log(`    ${chalk.cyan("portfolio-audit".padEnd(28))} ${chalk.dim("scan recent projects and env key names without printing secrets")}`);
      console.log(`    ${chalk.cyan("env-audit --fingerprints".padEnd(28))} ${chalk.dim("detect reused key values by local salted HMAC")}`);
      console.log("");
      console.log(chalk.dim("  projects are stored in .youmd/projects/<name>/"));
      console.log(chalk.dim("  run from a project directory for auto-detection."));
      console.log("");
      break;
    }
  }
}
