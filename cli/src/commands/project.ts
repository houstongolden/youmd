import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { execFileSync } from "child_process";
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
  isAuthenticated,
  localBundleExists,
  detectProjectContext,
  YoumdProjectFile,
} from "../lib/config";
import {
  apiErrorMessage,
  hydratePortfolioProjects,
  saveBrainDump,
  savePortfolioTask,
  updatePortfolioTask,
  type BrainDumpPayload as BrainDumpPayloadType,
  type BrainDumpTaskPayload as BrainDumpTaskPayloadType,
  type PortfolioHydratePatternPayload as PortfolioHydratePatternPayloadType,
  type PortfolioHydrateProjectPayload as PortfolioHydrateProjectPayloadType,
  type PortfolioTaskPayload as PortfolioTaskPayloadType,
  type PortfolioTaskUpdatePayload as PortfolioTaskUpdatePayloadType,
  type PortfolioWriteResult as PortfolioWriteResultType,
  type ApiResponse as ApiResponseType,
} from "../lib/api";
import {
  ensureProjectDirs,
  readMergedProjectContext,
  readProjectPrivateNotes,
  resolveProjectContext,
} from "../lib/projectContext";
import { runPortfolioAudit } from "../lib/portfolio-audit";
import { mineReusablePatterns } from "../lib/reusable-patterns";
import { synthesizeProjectStrategy } from "../lib/project-strategy";

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
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag) || args.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function readAllFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flag && args[i + 1]) values.push(args[i + 1]);
    if (arg.startsWith(`${flag}=`)) values.push(arg.slice(flag.length + 1));
  }
  return values;
}

function nonFlagArgs(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const inlineValueFlag = valueFlags.some((flag) => arg.startsWith(`${flag}=`));
    if (inlineValueFlag) continue;
    if (valueFlags.includes(arg)) {
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) continue;
    out.push(arg);
  }
  return out;
}

function csvFlag(args: string[], flag: string): string[] {
  const value = readFlagValue(args, flag);
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function normalizeProjectSlug(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  if (!slug || slug === "personal" || slug === "uncategorized") return undefined;
  return slug;
}

function printPortfolioWriteResult(label: string, res: ApiResponseType<PortfolioWriteResultType>): boolean {
  if (!res.ok || !res.data?.success) {
    console.log("");
    console.log(chalk.red(`  ${label} failed`) + chalk.dim(` — ${apiErrorMessage(res.data) || `HTTP ${res.status}`}`));
    console.log("");
    return false;
  }

  const snapshot = res.data.snapshot;
  console.log("");
  console.log(chalk.green(`  ${label} saved`));
  if (res.data.taskId) console.log(chalk.dim(`  task: ${res.data.taskId}`));
  if (res.data.captureId) console.log(chalk.dim(`  capture: ${res.data.captureId}`));
  if (res.data.taskIds?.length) console.log(chalk.dim(`  routed tasks: ${res.data.taskIds.join(", ")}`));
  if (snapshot) {
    console.log(chalk.dim(`  snapshot: ${snapshot.path}`));
    if (snapshot.bundleVersion) console.log(chalk.dim(`  bundle: v${snapshot.bundleVersion}`));
    if (snapshot.publishVersion) console.log(chalk.dim(`  published: v${snapshot.publishVersion}`));
    if (snapshot.repoSync.attempted) {
      if (snapshot.repoSync.ok) {
        const push = snapshot.repoSync.push as { prUrl?: string; via?: string; merged?: boolean } | undefined;
        console.log(chalk.dim(`  repo sync: ${push?.via || "pr"}${push?.merged === false ? " pending" : " merged/current"}`));
        if (push?.prUrl) console.log(chalk.dim(`  pr: ${push.prUrl}`));
      } else {
        console.log(chalk.hex("#C46A3A")(`  repo sync failed: ${snapshot.repoSync.error || "unknown error"}`));
      }
    } else {
      console.log(chalk.dim("  repo sync skipped"));
    }
  }
  console.log("");
  return true;
}

function parseTaskArgs(args: string[]): PortfolioTaskPayloadType | null {
  const ownerFlag = readFlagValue(args, "--owner");
  let ownerType: "human" | "agent" =
    ownerFlag === "me" || ownerFlag === "human" ? "human" : "agent";
  const ownerLabel = readFlagValue(args, "--owner-label");
  let projectSlug = normalizeProjectSlug(readFlagValue(args, "--project"));
  const priority = readFlagValue(args, "--priority") || "normal";
  const status = readFlagValue(args, "--status") || "open";
  const description = readFlagValue(args, "--description") || readFlagValue(args, "--notes");
  const tags = csvFlag(args, "--tags");
  let title = readFlagValue(args, "--title");

  const rawParts = nonFlagArgs(args, [
    "--owner", "--owner-label", "--project", "--priority", "--status",
    "--description", "--notes", "--tags", "--title",
  ]);
  if (rawParts[0] === "add") rawParts.shift();
  let raw = rawParts.join(" ").trim();

  if (!title) {
    const ownerMatch = raw.match(/^(me|human|agent)\s+(.+)$/i);
    if (ownerMatch) {
      ownerType = ownerMatch[1].toLowerCase() === "agent" ? "agent" : "human";
      raw = ownerMatch[2].trim();
    }

    const scoped = raw.match(/^([^:]{1,90}):\s*(.+)$/);
    if (scoped) {
      projectSlug = normalizeProjectSlug(scoped[1]);
      title = scoped[2].trim();
    } else {
      title = raw;
    }
  }

  if (!title?.trim()) return null;

  return {
    projectSlug,
    title: title.trim(),
    description,
    ownerType,
    ownerLabel,
    status,
    priority,
    tags,
    sourceType: "cli",
    syncRepo: !hasFlag(args, "--no-sync"),
    agentName: "youmd CLI",
  };
}

function parseTaskUpdateArgs(args: string[]): PortfolioTaskUpdatePayloadType | null {
  const rawArgs = [...args];
  if (["update", "edit", "triage"].includes((rawArgs[0] || "").toLowerCase())) {
    rawArgs.shift();
  }

  const taskId = readFlagValue(rawArgs, "--task-id") || readFlagValue(rawArgs, "--id") || nonFlagArgs(rawArgs, [
    "--task-id", "--id", "--owner", "--owner-label", "--project", "--priority", "--status",
    "--description", "--notes", "--title", "--tags", "--due",
  ])[0];
  if (!taskId?.trim()) return null;

  const ownerFlag = readFlagValue(rawArgs, "--owner");
  const projectFlagPresent = hasFlag(rawArgs, "--project") || hasFlag(rawArgs, "--personal");
  const projectFlag = hasFlag(rawArgs, "--personal") ? "personal" : readFlagValue(rawArgs, "--project");
  const dueFlagPresent = hasFlag(rawArgs, "--due") || hasFlag(rawArgs, "--clear-due");
  const dueFlag = hasFlag(rawArgs, "--clear-due") ? "clear" : readFlagValue(rawArgs, "--due");

  const payload: PortfolioTaskUpdatePayloadType = {
    taskId: taskId.trim(),
    syncRepo: !hasFlag(rawArgs, "--no-sync"),
    agentName: "youmd CLI",
  };

  const title = readFlagValue(rawArgs, "--title");
  if (title !== undefined) payload.title = title;

  if (hasFlag(rawArgs, "--description") || hasFlag(rawArgs, "--notes") || hasFlag(rawArgs, "--clear-description")) {
    payload.description = hasFlag(rawArgs, "--clear-description")
      ? null
      : (readFlagValue(rawArgs, "--description") ?? readFlagValue(rawArgs, "--notes") ?? null);
  }

  if (ownerFlag) {
    payload.ownerType = ownerFlag === "me" || ownerFlag === "human" ? "human" : "agent";
  }
  if (hasFlag(rawArgs, "--owner-label") || hasFlag(rawArgs, "--clear-owner-label")) {
    payload.ownerLabel = hasFlag(rawArgs, "--clear-owner-label")
      ? null
      : (readFlagValue(rawArgs, "--owner-label") ?? null);
  }
  if (projectFlagPresent) {
    payload.projectSlug = normalizeProjectSlug(projectFlag) ?? null;
  }

  const status = readFlagValue(rawArgs, "--status");
  if (status !== undefined) payload.status = status;
  const priority = readFlagValue(rawArgs, "--priority");
  if (priority !== undefined) payload.priority = priority;

  if (dueFlagPresent) {
    if (!dueFlag || ["clear", "none", "null"].includes(dueFlag.toLowerCase())) {
      payload.dueAt = null;
    } else {
      const parsed = Date.parse(dueFlag);
      payload.dueAt = Number.isFinite(parsed) ? parsed : Number(dueFlag);
    }
  }

  if (hasFlag(rawArgs, "--tags")) {
    payload.tags = csvFlag(rawArgs, "--tags");
  }

  const changedFields = [
    "projectSlug", "title", "description", "ownerType", "ownerLabel",
    "status", "priority", "dueAt", "tags",
  ] as const;
  return changedFields.some((field) => payload[field] !== undefined) ? payload : null;
}

function parseBrainDumpTask(value: string, ownerType: "human" | "agent", projectSlug?: string): BrainDumpTaskPayloadType | null {
  const title = value.trim();
  if (!title) return null;
  return {
    projectSlug,
    title,
    ownerType,
    status: "proposed",
    priority: "normal",
    tags: ["braindump"],
  };
}

function parseBrainDumpArgs(args: string[]): BrainDumpPayloadType | null {
  let projectSlug = normalizeProjectSlug(readFlagValue(args, "--project"));
  const summary = readFlagValue(args, "--summary");
  const tags = csvFlag(args, "--tags");
  const insights = csvFlag(args, "--insights");
  const textFlag = readFlagValue(args, "--text") || readFlagValue(args, "--raw");

  const rawParts = nonFlagArgs(args, [
    "--project", "--summary", "--tags", "--insights", "--text", "--raw",
    "--task", "--agent-task", "--human-task",
  ]);
  if (rawParts[0] === "add" || rawParts[0] === "capture") rawParts.shift();
  let rawText = (textFlag || rawParts.join(" ")).trim();

  const projectPrefix = rawText.match(/^project:([a-zA-Z0-9_-]+)\s+(.+)$/);
  if (projectPrefix) {
    projectSlug = normalizeProjectSlug(projectPrefix[1]);
    rawText = projectPrefix[2].trim();
  }

  if (!rawText) return null;

  const tasks: BrainDumpTaskPayloadType[] = [
    ...readAllFlagValues(args, "--task")
      .map((value) => {
        const match = value.match(/^(me|human|agent):\s*(.+)$/i);
        if (match) {
          return parseBrainDumpTask(match[2], match[1].toLowerCase() === "agent" ? "agent" : "human", projectSlug);
        }
        return parseBrainDumpTask(value, "agent", projectSlug);
      })
      .filter((task): task is BrainDumpTaskPayloadType => task !== null),
    ...readAllFlagValues(args, "--agent-task")
      .map((value) => parseBrainDumpTask(value, "agent", projectSlug))
      .filter((task): task is BrainDumpTaskPayloadType => task !== null),
    ...readAllFlagValues(args, "--human-task")
      .map((value) => parseBrainDumpTask(value, "human", projectSlug))
      .filter((task): task is BrainDumpTaskPayloadType => task !== null),
  ];

  return {
    rawText,
    summary,
    projectSlugs: projectSlug ? [projectSlug] : [],
    tags,
    insights,
    source: "cli",
    tasks,
    metadata: {
      command: "youmd project braindump",
      capturedAt: new Date().toISOString(),
    },
    syncRepo: !hasFlag(args, "--no-sync"),
    agentName: "youmd CLI",
  };
}

async function saveTaskFromCli(args: string[]): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }
  if (["update", "edit", "triage"].includes((args[0] || "").toLowerCase())) {
    const payload = parseTaskUpdateArgs(args);
    if (!payload) {
      console.log("");
      console.log(chalk.yellow("  usage: youmd project task update <task-id> --status in_progress --owner agent --project youmd"));
      console.log(chalk.dim("  clear scope: youmd project task update <task-id> --personal"));
      console.log("");
      return;
    }
    const res = await updatePortfolioTask(payload);
    printPortfolioWriteResult("portfolio task update", res);
    return;
  }
  const payload = parseTaskArgs(args);
  if (!payload) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd project task agent youmd: verify sync proof"));
    console.log(chalk.dim("  or:    youmd project task --owner me --project personal --title \"follow up\""));
    console.log(chalk.dim("  edit:  youmd project task update <task-id> --status in_progress --priority high"));
    console.log("");
    return;
  }
  const res = await savePortfolioTask(payload);
  printPortfolioWriteResult("portfolio task", res);
}

async function saveBrainDumpFromCli(args: string[]): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }
  const payload = parseBrainDumpArgs(args);
  if (!payload) {
    console.log("");
    console.log(chalk.yellow("  usage: youmd project braindump project:youmd raw idea text --agent-task \"follow up\""));
    console.log(chalk.dim("  or:    youmd project braindump --project youmd --summary \"...\" --text \"...\""));
    console.log("");
    return;
  }
  const res = await saveBrainDump(payload);
  printPortfolioWriteResult("brain dump", res);
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

function inferStackName(name: string, projectPath: string): string {
  const key = `${name} ${projectPath}`.toLowerCase();
  if (key.includes("youmd")) return "YouStack";
  if (key.includes("bamfaiapp") || key.includes("bamf.ai")) return "BAMFStack";
  if (key.includes("bamfsite") || key.includes("bamfos")) return "BAMFOSStack";
  if (key.includes("badapp")) return "BadStack";
  if (key.includes("foldermd")) return "FolderMD Stack";
  if (key.includes("bigbounce")) return "AstroStack";
  if (key.includes("hubify")) return "HubStack";
  if (key.includes("myo")) return "Myo Stack";
  return "Project Stack";
}

function shouldHydrateLocalProject(project: {
  name: string;
  path: string;
  envFiles: string[];
  providers: string[];
}, includeNested: boolean): boolean {
  if (!project.name || project.path === ".") return false;
  if (project.path.includes(".reference-repos/") || project.path.startsWith(".dev-skills/")) return false;
  if (project.path.includes("/project-context/")) return false;
  if (includeNested) return true;
  const depth = project.path.split("/").filter(Boolean).length;
  return depth === 1 || (depth <= 2 && project.envFiles.length > 0);
}

function readTextIfExists(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function cleanDocSnippet(text: string, limit = 420): string | undefined {
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .split(/\n\s*\n/)
    .map((block) => block.replace(/[#*_>`[\]]/g, " ").replace(/\s+/g, " ").trim())
    .find((block) => {
      const lower = block.toLowerCase();
      const setupBoilerplate = (
        /\b(requires?|install(?:ation)?|getting started|quick start|setup|setup script|dependencies|run|start)\b/.test(lower) &&
        /\b(node\.?js|npm|pnpm|yarn|bun|nvm|localhost|\.env|docker|dev server|chmod|script|dependencies)\b/.test(lower)
      ) || (
        /\b(?:copy|create|configure|add|set|update)\b/.test(lower) &&
        /\.env(?:\.example|\.local)?/.test(lower)
      ) || /\b(?:localhost|preview\/web|dev server)\b/.test(lower) ||
        /\bcursor will expose\b/.test(lower) ||
        (/\b(?:compile|build)\b/.test(lower) && /\b(?:app|production|bundle|dist)\b/.test(lower)) ||
        /^(?:.+\s+)?product requirements document(?:\s*\(prd\))?$/.test(lower) ||
        /^(?:version|last updated|founder|status|date):\s/.test(lower) ||
        /^\s*(npm|pnpm|yarn|bun|nvm|docker)\s+/i.test(block);
      return block.length > 24 && !setupBoilerplate;
    }) ?? "";
  return cleaned ? cleaned.slice(0, limit) : undefined;
}

function repoFullNameFromRemote(absPath: string): string | undefined {
  try {
    const remote = execFileSync("git", ["-C", absPath, "config", "--get", "remote.origin.url"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function githubCommitUrl(repoFullName: string | undefined, sha: string): string | undefined {
  return repoFullName ? `https://github.com/${repoFullName}/commit/${sha}` : undefined;
}

function readRecentCommitEvents(absPath: string, relPath: string, days: number): NonNullable<PortfolioHydrateProjectPayloadType["activityEvents"]> {
  try {
    const output = execFileSync("git", [
      "-C",
      absPath,
      "log",
      `--since=${Math.max(1, Math.min(days, 365))} days ago`,
      "--max-count=40",
      "--pretty=format:%H%x1f%ct%x1f%s",
    ], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!output) return [];
    const repoFullName = repoFullNameFromRemote(absPath);
    return output.split("\n").map((line) => {
      const [sha, epoch, subject] = line.split("\x1f");
      const occurredAt = Number(epoch) * 1000;
      return {
        kind: "commit",
        title: subject || "Commit",
        summary: subject || undefined,
        url: sha ? githubCommitUrl(repoFullName, sha) : undefined,
        source: "local-git",
        evidencePath: relPath,
        dedupeKey: sha ? `commit:${sha}` : undefined,
        tags: ["commit", "shipped"],
        metadata: { sha, repoFullName },
        occurredAt: Number.isFinite(occurredAt) ? occurredAt : Date.now(),
      };
    });
  } catch {
    return [];
  }
}

function readRecentPrEvents(absPath: string, relPath: string, days: number): NonNullable<PortfolioHydrateProjectPayloadType["activityEvents"]> {
  const repoFullName = repoFullNameFromRemote(absPath);
  if (!repoFullName) return [];
  const since = new Date(Date.now() - Math.max(1, Math.min(days, 365)) * 86_400_000).toISOString().slice(0, 10);
  try {
    const output = execFileSync("gh", [
      "pr",
      "list",
      "--repo",
      repoFullName,
      "--state",
      "all",
      "--search",
      `updated:>=${since}`,
      "--limit",
      "30",
      "--json",
      "number,title,state,updatedAt,mergedAt,url",
    ], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const rows = JSON.parse(output || "[]") as Array<{
      number?: number;
      title?: string;
      state?: string;
      updatedAt?: string;
      mergedAt?: string;
      url?: string;
    }>;
    return rows.map((row) => {
      const occurredAt = Date.parse(row.mergedAt || row.updatedAt || "");
      return {
        kind: "pull-request",
        title: row.title || `Pull request #${row.number ?? "?"}`,
        summary: row.state ? `${row.state.toLowerCase()} pull request #${row.number ?? "?"}` : undefined,
        url: row.url,
        source: "github-pr",
        evidencePath: relPath,
        dedupeKey: row.number ? `pr:${repoFullName}:${row.number}` : undefined,
        tags: ["pull-request", row.state?.toLowerCase() || "pr"].filter(Boolean),
        metadata: { repoFullName, number: row.number, state: row.state },
        occurredAt: Number.isFinite(occurredAt) ? occurredAt : Date.now(),
      };
    });
  } catch {
    return [];
  }
}

function readProjectDocs(absPath: string): {
  summary?: string;
  focus?: string;
  docs: string[];
  contents: Parameters<typeof synthesizeProjectStrategy>[0]["docs"];
} {
  const docs: string[] = [];
  const readmePath = ["README.md", "readme.md"].map((file) => path.join(absPath, file)).find((file) => fs.existsSync(file));
  const overviewPath = path.join(absPath, "project-context", "overview.md");
  const currentStatePath = path.join(absPath, "project-context", "CURRENT_STATE.md");
  const todoPath = path.join(absPath, "project-context", "TODO.md");
  const tasksMdPath = path.join(absPath, "project-context", "tasks.md");
  const tasksJsonPath = path.join(absPath, "project-context", "tasks.json");
  const prdPath = path.join(absPath, "project-context", "PRD.md");
  const changelogPath = path.join(absPath, "project-context", "CHANGELOG.md");
  const featuresPath = path.join(absPath, "project-context", "FEATURES.md");
  const designPath = path.join(absPath, "project-context", "design.md");
  const researchPath = path.join(absPath, "project-context", "research.md");
  const ideasPath = path.join(absPath, "project-context", "ideas.md");
  const architecturePath = path.join(absPath, "project-context", "ARCHITECTURE.md");

  const readme = readmePath ? readTextIfExists(readmePath) : "";
  const overview = readTextIfExists(overviewPath);
  const currentState = readTextIfExists(currentStatePath);
  const todo = readTextIfExists(todoPath);
  const tasks = readTextIfExists(tasksMdPath) || readTextIfExists(tasksJsonPath);
  const prd = readTextIfExists(prdPath);

  if (readmePath) docs.push(path.relative(absPath, readmePath));
  if (fs.existsSync(overviewPath)) docs.push("project-context/overview.md");
  if (fs.existsSync(currentStatePath)) docs.push("project-context/CURRENT_STATE.md");
  if (fs.existsSync(todoPath)) docs.push("project-context/TODO.md");
  if (fs.existsSync(tasksMdPath)) docs.push("project-context/tasks.md");
  if (fs.existsSync(tasksJsonPath)) docs.push("project-context/tasks.json");
  if (fs.existsSync(prdPath)) docs.push("project-context/PRD.md");
  if (fs.existsSync(changelogPath)) docs.push("project-context/CHANGELOG.md");
  if (fs.existsSync(featuresPath)) docs.push("project-context/FEATURES.md");
  if (fs.existsSync(designPath)) docs.push("project-context/design.md");
  if (fs.existsSync(researchPath)) docs.push("project-context/research.md");
  if (fs.existsSync(ideasPath)) docs.push("project-context/ideas.md");
  if (fs.existsSync(architecturePath)) docs.push("project-context/ARCHITECTURE.md");

  return {
    summary:
      cleanDocSnippet(overview) ??
      cleanDocSnippet(readme) ??
      cleanDocSnippet(prd) ??
      cleanDocSnippet(currentState),
    focus:
      cleanDocSnippet(currentState, 360) ??
      cleanDocSnippet(todo, 360) ??
      cleanDocSnippet(tasks, 360),
    docs,
    contents: {
      readme,
      overview,
      currentState,
      todo,
      tasks,
      prd,
      features: readTextIfExists(featuresPath),
      design: readTextIfExists(designPath),
      research: readTextIfExists(researchPath),
      ideas: readTextIfExists(ideasPath),
      architecture: readTextIfExists(architecturePath),
    },
  };
}

function shippedCount(events: NonNullable<PortfolioHydrateProjectPayloadType["activityEvents"]>, days: number): number {
  const cutoff = Date.now() - days * 86_400_000;
  return events.filter((event) =>
    event.occurredAt >= cutoff && (event.kind === "commit" || event.kind === "pull-request" || event.tags?.includes("shipped"))
  ).length;
}

function hydrationProjectsFromAudit(
  result: ReturnType<typeof runPortfolioAudit>,
  options: { includeNested: boolean; limit: number; days: number; includePrs: boolean; strategy: boolean }
): PortfolioHydrateProjectPayloadType[] {
  return result.projects
    .filter((project) => shouldHydrateLocalProject(project, options.includeNested))
    .slice(0, options.limit)
    .map((project) => {
      const absPath = path.join(result.root, project.path);
      const docs = readProjectDocs(absPath);
      const commitEvents = readRecentCommitEvents(absPath, project.path, options.days);
      const prEvents = options.includePrs ? readRecentPrEvents(absPath, project.path, options.days) : [];
      const activityEvents = [...commitEvents, ...prEvents]
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 70);
      const latestSubjects = activityEvents
        .filter((event) => event.kind === "commit" || event.kind === "pull-request")
        .slice(0, 4)
        .map((event) => event.title)
        .join("; ");
      const shippedToday = shippedCount(activityEvents, 1);
      const shipped7d = shippedCount(activityEvents, 7);
      const shipped30d = shippedCount(activityEvents, 30);
      const fallbackSummary = `Local portfolio auditor found ${project.name} at ${project.path}${project.providers.length ? ` using ${project.providers.slice(0, 6).join(", ")}` : ""}.`;
      const stackName = inferStackName(project.name, project.path);
      const strategy = options.strategy
        ? synthesizeProjectStrategy({
            projectName: project.name,
            stackName,
            docs: docs.contents,
            providers: project.providers,
            recentActivityTitles: activityEvents.slice(0, 8).map((event) => event.title),
            shippedToday,
            shipped7d,
            shipped30d,
            fallbackSummary,
          })
        : {};
      return {
        name: project.name,
        path: project.path,
        stackName,
        status: activityEvents.length ? "active" : "local-audited",
        summary: docs.summary || fallbackSummary,
        ...strategy,
        focus: docs.focus || (latestSubjects ? `Recent shipping activity: ${latestSubjects}` : "Audit project role, API/MCP ownership, reusable patterns, and env/service-account boundaries."),
        docs: docs.docs,
        envFiles: project.envFiles,
        providers: project.providers,
        tags: [
          ...project.providers.map((provider) => provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")).filter(Boolean),
          activityEvents.length ? "activity-hydrated" : "local-audit",
        ],
        lastActivityAt: activityEvents[0]?.occurredAt ?? Date.now(),
        activityEvents: [
          {
            kind: "summary",
            title: `Shipped ${shippedToday} today / ${shipped7d} in 7d / ${shipped30d} in 30d`,
            summary: latestSubjects || docs.focus || docs.summary || fallbackSummary,
            source: "local-portfolio-audit",
            evidencePath: project.path,
            dedupeKey: `summary:${project.path}`,
            tags: ["activity-summary", "shipped"],
            metadata: { shippedToday, shipped7d, shipped30d, providerCount: project.providers.length },
            occurredAt: activityEvents[0]?.occurredAt ?? Date.now(),
          },
          ...activityEvents,
        ],
      };
    });
}

async function hydratePortfolioFromCli(args: string[]): Promise<void> {
  if (!isAuthenticated()) {
    console.log("");
    console.log(chalk.yellow("  not authenticated. run: youmd login"));
    console.log("");
    return;
  }

  const root = readFlagValue(args, "--root");
  const days = Number(readFlagValue(args, "--days") ?? 90);
  const limit = Number(readFlagValue(args, "--limit") ?? 80);
  const includeNested = hasFlag(args, "--include-nested");
  const includeTracked = !hasFlag(args, "--no-github");
  const includePrs = !hasFlag(args, "--no-prs");
  const strategy = !hasFlag(args, "--no-strategy");
  const reusablePatternsEnabled = !hasFlag(args, "--no-patterns");
  const dryRun = hasFlag(args, "--dry-run");
  const audit = runPortfolioAudit({ root, includeDotenv: hasFlag(args, "--include-dotenv"), fingerprints: false, activeDays: days });
  const projects = hydrationProjectsFromAudit(audit, {
    includeNested,
    limit: Math.max(1, Math.min(limit, 200)),
    days: Number.isFinite(days) ? days : 90,
    includePrs,
    strategy,
  });
  const patternMining = reusablePatternsEnabled
    ? mineReusablePatterns({
        root: audit.root,
        projects: audit.projects
          .filter((project) => shouldHydrateLocalProject(project, includeNested))
          .slice(0, Math.max(1, Math.min(limit, 200))),
        maxProjects: Math.max(1, Math.min(limit, 200)),
      })
    : null;
  const reusablePatternsPayload: PortfolioHydratePatternPayloadType[] = patternMining?.patterns ?? [];

  console.log("");
  console.log("  " + chalk.bold("portfolio hydrate") + chalk.dim(" — auditor -> portfolio graph"));
  console.log("");
  console.log(chalk.dim(`  root: ${audit.root}`));
  console.log(chalk.dim(`  auditor projects scanned: ${audit.projectsScanned}`));
  console.log(chalk.dim(`  local hydration candidates: ${projects.length}`));
  console.log(chalk.dim(`  github tracked sync: ${includeTracked ? `${Number.isFinite(days) ? days : 90}d` : "skipped"}`));
  console.log(chalk.dim(`  local git/PR activity: commits${includePrs ? " + pull requests" : ""}`));
  console.log(chalk.dim(`  strategy fields: ${strategy ? "docs + activity synthesis" : "skipped"}`));
  console.log(chalk.dim(`  reusable patterns: ${patternMining ? `${patternMining.patterns.length} mined from ${patternMining.projectsScanned} projects / ${patternMining.filesScanned} files` : "skipped"}`));
  console.log("");

  for (const project of projects.slice(0, 12)) {
    console.log(`  ${chalk.cyan(project.name.padEnd(24))} ${chalk.dim(project.path || "")}`);
  }
  if (projects.length > 12) console.log(chalk.dim(`  ... ${projects.length - 12} more`));
  if (patternMining && patternMining.patterns.length > 0) {
    console.log("");
    for (const pattern of patternMining.patterns.slice(0, 8)) {
      console.log(`  ${chalk.hex("#C46A3A")(pattern.name.padEnd(36))} ${chalk.dim(`${pattern.usageProjects.length} project${pattern.usageProjects.length === 1 ? "" : "s"}`)}`);
    }
    if (patternMining.patterns.length > 8) console.log(chalk.dim(`  ... ${patternMining.patterns.length - 8} more patterns`));
  }
  console.log("");

  if (dryRun) {
    console.log(chalk.dim("  dry run only. remove --dry-run to hydrate Convex portfolio records."));
    console.log("");
    return;
  }

  const res = await hydratePortfolioProjects({
    projects,
    reusablePatterns: reusablePatternsPayload,
    includeTracked,
    days: Number.isFinite(days) ? days : 90,
    limit: Number.isFinite(limit) ? limit : 80,
    source: "local-portfolio-audit",
    agentName: "youmd CLI portfolio-graph-auditor",
  });

  if (!res.ok || !res.data?.success) {
    console.log(chalk.red("  portfolio hydrate failed") + chalk.dim(` — ${apiErrorMessage(res.data) || `HTTP ${res.status}`}`));
    console.log("");
    return;
  }

  const tracked = res.data.tracked;
  console.log(chalk.green("  portfolio graph hydrated"));
  if (tracked) {
    console.log(chalk.dim(`  github tracked: ${tracked.tracked} considered / ${tracked.created} created / ${tracked.updated} updated`));
  }
  console.log(chalk.dim(`  local audit: ${res.data.local.upserted} upserted / ${res.data.local.skipped} skipped`));
  if (res.data.patterns) {
    console.log(chalk.dim(`  reusable patterns: ${res.data.patterns.upserted} upserted / ${res.data.patterns.created} created / ${res.data.patterns.updated} updated`));
  }
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
    case "task":
    case "tasks":
      await saveTaskFromCli(args);
      break;
    case "braindump":
    case "brain-dump":
    case "dump":
      await saveBrainDumpFromCli(args);
      break;
    case "portfolio-audit":
    case "env-audit":
    case "apis":
      showPortfolioAudit(args);
      break;
    case "portfolio-hydrate":
    case "hydrate-portfolio":
    case "hydrate":
      await hydratePortfolioFromCli(args);
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
      console.log(`    ${chalk.cyan("task agent youmd: ...".padEnd(28))} ${chalk.dim("save an agent/human portfolio task and sync the repo snapshot")}`);
      console.log(`    ${chalk.cyan("task update <id> --status ...".padEnd(28))} ${chalk.dim("edit task owner, project scope, metadata, and triage fields")}`);
      console.log(`    ${chalk.cyan("braindump project:youmd ...".padEnd(28))} ${chalk.dim("capture raw dump text, route tasks, and sync the repo snapshot")}`);
      console.log(`    ${chalk.cyan("portfolio-audit".padEnd(28))} ${chalk.dim("scan recent projects and env key names without printing secrets")}`);
      console.log(`    ${chalk.cyan("portfolio-hydrate".padEnd(28))} ${chalk.dim("hydrate portfolio graph from GitHub + local auditor results")}`);
      console.log(`    ${chalk.cyan("env-audit --fingerprints".padEnd(28))} ${chalk.dim("detect reused key values by local salted HMAC")}`);
      console.log("");
      console.log(chalk.dim("  projects are stored in .youmd/projects/<name>/"));
      console.log(chalk.dim("  run from a project directory for auto-detection."));
      console.log("");
      break;
    }
  }
}
