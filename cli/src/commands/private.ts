import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import {
  isAuthenticated,
  detectProjectContext,
  readProjectPrivateNotes,
  writeProjectPrivateNotes,
  getProjectPrivateDir,
} from "../lib/config";
import { getPrivateContext, updatePrivateContext, PrivateContext } from "../lib/api";
import { BrailleSpinner } from "../lib/render";

const ACCENT = chalk.hex("#C46A3A");

/**
 * Check if --global flag is present in args and strip it.
 */
function extractGlobalFlag(args: string[]): { isGlobal: boolean; cleanArgs: string[] } {
  const isGlobal = args.includes("--global");
  const cleanArgs = args.filter((a) => a !== "--global");
  return { isGlobal, cleanArgs };
}

export async function privateCommand(subcommand?: string, ...args: string[]) {
  if (!isAuthenticated()) {
    console.log(chalk.red("not authenticated. run `youmd login` first."));
    process.exit(1);
  }

  const { isGlobal, cleanArgs } = extractGlobalFlag(args);
  const projectCtx = isGlobal ? null : detectProjectContext();

  const cmd = subcommand || "show";

  switch (cmd) {
    case "show": {
      await showAll(projectCtx?.name || null);
      break;
    }

    case "notes": {
      const notesSub = cleanArgs[0];
      if (!notesSub) {
        await showNotes(projectCtx?.name || null);
      } else if (notesSub === "set") {
        if (projectCtx && !isGlobal) {
          await setProjectNotes(projectCtx.name);
        } else {
          await setNotes();
        }
      } else if (notesSub === "append") {
        const text = cleanArgs.slice(1).join(" ");
        if (!text) {
          console.log(chalk.red("usage: youmd private notes append \"text to append\""));
          process.exit(1);
        }
        if (projectCtx && !isGlobal) {
          await appendProjectNotes(projectCtx.name, text);
        } else {
          await appendNotes(text);
        }
      } else {
        console.log(chalk.red(`unknown notes subcommand: ${notesSub}`));
        printUsage();
      }
      break;
    }

    case "links": {
      const linksSub = cleanArgs[0];
      if (!linksSub) {
        await showLinks();
      } else if (linksSub === "add") {
        const label = cleanArgs[1];
        const url = cleanArgs[2];
        if (!label || !url) {
          console.log(chalk.red("usage: youmd private links add <label> <url>"));
          process.exit(1);
        }
        await addLink(label, url);
      } else if (linksSub === "remove") {
        const label = cleanArgs[1];
        if (!label) {
          console.log(chalk.red("usage: youmd private links remove <label>"));
          process.exit(1);
        }
        await removeLink(label);
      } else {
        console.log(chalk.red(`unknown links subcommand: ${linksSub}`));
        printUsage();
      }
      break;
    }

    case "projects": {
      const projectsSub = cleanArgs[0];
      if (!projectsSub) {
        await showProjects();
      } else if (projectsSub === "add") {
        const name = cleanArgs[1];
        if (!name) {
          console.log(chalk.red("usage: youmd private projects add <name> [description]"));
          process.exit(1);
        }
        const description = cleanArgs.slice(2).join(" ") || "";
        await addProject(name, description);
      } else if (projectsSub === "remove") {
        const name = cleanArgs[1];
        if (!name) {
          console.log(chalk.red("usage: youmd private projects remove <name>"));
          process.exit(1);
        }
        await removeProject(name);
      } else {
        console.log(chalk.red(`unknown projects subcommand: ${projectsSub}`));
        printUsage();
      }
      break;
    }

    default:
      printUsage();
      break;
  }
}

function printUsage() {
  console.log(chalk.dim("usage:"));
  console.log("  youmd private                              show all private context");
  console.log("  youmd private notes                        show private notes");
  console.log("  youmd private notes set                    set notes (stdin or prompt)");
  console.log("  youmd private notes append \"text\"          append to notes");
  console.log("  youmd private links                        list private links");
  console.log("  youmd private links add <label> <url>      add a link");
  console.log("  youmd private links remove <label>         remove a link");
  console.log("  youmd private projects                     list private projects");
  console.log("  youmd private projects add <name> [desc]   add a project");
  console.log("  youmd private projects remove <name>       remove a project");
  console.log("");
  console.log(chalk.dim("  in a project directory, notes are project-scoped by default."));
  console.log(chalk.dim("  use --global to target global private context instead."));
}

// ── Fetch helper ──────────────────────────────────────────────

async function fetchPrivateContext(): Promise<PrivateContext> {
  const spinner = new BrailleSpinner("fetching private context");
  spinner.start();

  const res = await getPrivateContext();

  if (!res.ok) {
    spinner.fail("failed to fetch private context");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  return res.data || {};
}

// ── Show all ──────────────────────────────────────────────────

async function showAll(projectName: string | null) {
  // Show project-scoped notes if in a project
  if (projectName) {
    const projectNotes = readProjectPrivateNotes(projectName);
    if (projectNotes) {
      console.log(ACCENT(`  project notes [${projectName}]`));
      for (const line of projectNotes.split("\n")) {
        console.log(chalk.white(`    ${line}`));
      }
      console.log();
    } else {
      console.log(chalk.dim(`  no project-specific notes for ${projectName}.`));
      console.log();
    }
  }

  // Always show global private context
  const ctx = await fetchPrivateContext();

  const hasNotes = !!ctx.privateNotes;
  const hasLinks = ctx.internalLinks && Object.keys(ctx.internalLinks).length > 0;
  const hasProjects = ctx.privateProjects && ctx.privateProjects.length > 0;

  if (!hasNotes && !hasLinks && !hasProjects) {
    if (!projectName) {
      console.log(chalk.dim("  no private context yet."));
      console.log(chalk.dim("  use `youmd private notes set`, `youmd private links add`, or `youmd private projects add` to get started."));
    } else {
      console.log(chalk.dim("  no global private context."));
    }
    return;
  }

  if (projectName) {
    console.log(ACCENT("  global private context"));
    console.log();
  }

  if (hasNotes) {
    console.log(ACCENT("  notes"));
    for (const line of ctx.privateNotes!.split("\n")) {
      console.log(chalk.white(`    ${line}`));
    }
    console.log();
  }

  if (hasLinks) {
    console.log(ACCENT("  links"));
    for (const [label, url] of Object.entries(ctx.internalLinks!)) {
      console.log(`    ${chalk.white(label)} ${chalk.dim(url)}`);
    }
    console.log();
  }

  if (hasProjects) {
    console.log(ACCENT("  projects"));
    for (const p of ctx.privateProjects!) {
      const status = p.status ? chalk.dim(` [${p.status}]`) : "";
      const desc = p.description ? chalk.dim(` - ${p.description}`) : "";
      console.log(`    ${chalk.white(p.name)}${status}${desc}`);
    }
    console.log();
  }
}

// ── Notes ─────────────────────────────────────────────────────

async function showNotes(projectName: string | null) {
  // Show project-scoped notes if in a project
  if (projectName) {
    const projectNotes = readProjectPrivateNotes(projectName);
    if (projectNotes) {
      console.log(ACCENT(`  project notes [${projectName}]`));
      for (const line of projectNotes.split("\n")) {
        console.log(chalk.white(`    ${line}`));
      }
    } else {
      console.log(chalk.dim(`  no project-specific notes for ${projectName}.`));
    }
    console.log();
  }

  // Always show global notes
  const ctx = await fetchPrivateContext();

  if (!ctx.privateNotes) {
    if (!projectName) {
      console.log(chalk.dim("  no private notes set."));
      console.log(chalk.dim("  use `youmd private notes set` to add notes."));
    } else {
      console.log(chalk.dim("  no global private notes."));
    }
    return;
  }

  if (projectName) {
    console.log(ACCENT("  global notes"));
  } else {
    console.log(ACCENT("  notes"));
  }
  for (const line of ctx.privateNotes.split("\n")) {
    console.log(chalk.white(`    ${line}`));
  }
}

async function setNotes() {
  let text: string;

  // Check if stdin has data piped in
  if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    // Interactive prompt
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    text = await new Promise<string>((resolve) => {
      console.log(chalk.dim("  enter your private notes (press Ctrl+D when done):"));
      const lines: string[] = [];
      rl.on("line", (line) => lines.push(line));
      rl.on("close", () => resolve(lines.join("\n")));
    });
  }

  if (!text.trim()) {
    console.log(chalk.red("  empty input, notes not updated."));
    return;
  }

  const spinner = new BrailleSpinner("saving notes");
  spinner.start();

  const res = await updatePrivateContext({ privateNotes: text });

  if (!res.ok) {
    spinner.fail("failed to save notes");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green("  notes saved."));
}

async function appendNotes(text: string) {
  const ctx = await fetchPrivateContext();
  const existing = ctx.privateNotes || "";
  const updated = existing ? `${existing}\n${text}` : text;

  const spinner = new BrailleSpinner("appending to notes");
  spinner.start();

  const res = await updatePrivateContext({ privateNotes: updated });

  if (!res.ok) {
    spinner.fail("failed to append notes");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green("  appended to notes."));
}

// ── Project-scoped notes ──────────────────────────────────────

async function setProjectNotes(projectName: string) {
  let text: string;

  if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    text = await new Promise<string>((resolve) => {
      console.log(chalk.dim(`  enter private notes for project ${projectName} (press Ctrl+D when done):`));
      const lines: string[] = [];
      rl.on("line", (line) => lines.push(line));
      rl.on("close", () => resolve(lines.join("\n")));
    });
  }

  if (!text.trim()) {
    console.log(chalk.red("  empty input, notes not updated."));
    return;
  }

  writeProjectPrivateNotes(projectName, text);
  console.log(chalk.green(`  project notes saved [${projectName}].`));
}

async function appendProjectNotes(projectName: string, text: string) {
  const existing = readProjectPrivateNotes(projectName) || "";
  const updated = existing ? `${existing}\n${text}` : text;
  writeProjectPrivateNotes(projectName, updated);
  console.log(chalk.green(`  appended to project notes [${projectName}].`));
}

// ── Links ─────────────────────────────────────────────────────

async function showLinks() {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};
  const entries = Object.entries(links);

  if (entries.length === 0) {
    console.log(chalk.dim("  no private links."));
    console.log(chalk.dim("  use `youmd private links add <label> <url>` to add one."));
    return;
  }

  console.log(ACCENT(`  links (${entries.length})`));
  for (const [label, url] of entries) {
    console.log(`    ${chalk.white(label)} ${chalk.dim(url)}`);
  }
}

async function addLink(label: string, url: string) {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};
  links[label] = url;

  const spinner = new BrailleSpinner("adding link");
  spinner.start();

  const res = await updatePrivateContext({ internalLinks: links });

  if (!res.ok) {
    spinner.fail("failed to add link");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(ACCENT(`  added [${label}] ${url}`));
}

async function removeLink(label: string) {
  const ctx = await fetchPrivateContext();
  const links = ctx.internalLinks || {};

  if (!(label in links)) {
    console.log(chalk.red(`  link "${label}" not found.`));
    const keys = Object.keys(links);
    if (keys.length > 0) {
      console.log(chalk.dim(`  available: ${keys.join(", ")}`));
    }
    return;
  }

  delete links[label];

  const spinner = new BrailleSpinner("removing link");
  spinner.start();

  const res = await updatePrivateContext({ internalLinks: links });

  if (!res.ok) {
    spinner.fail("failed to remove link");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green(`  removed link "${label}".`));
}

// ── Projects ──────────────────────────────────────────────────

async function showProjects() {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  if (projects.length === 0) {
    console.log(chalk.dim("  no private projects."));
    console.log(chalk.dim("  use `youmd private projects add <name> [description]` to add one."));
    return;
  }

  console.log(ACCENT(`  projects (${projects.length})`));
  for (const p of projects) {
    const status = p.status ? chalk.dim(` [${p.status}]`) : "";
    const desc = p.description ? chalk.dim(` - ${p.description}`) : "";
    console.log(`    ${chalk.white(p.name)}${status}${desc}`);
  }
}

async function addProject(name: string, description: string) {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  const existing = projects.find((p) => p.name === name);
  if (existing) {
    console.log(chalk.red(`  project "${name}" already exists. remove it first to update.`));
    return;
  }

  projects.push({ name, description, status: "active" });

  const spinner = new BrailleSpinner("adding project");
  spinner.start();

  const res = await updatePrivateContext({ privateProjects: projects });

  if (!res.ok) {
    spinner.fail("failed to add project");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  const desc = description ? chalk.dim(` - ${description}`) : "";
  console.log(ACCENT(`  added project: ${name}${desc}`));
}

async function removeProject(name: string) {
  const ctx = await fetchPrivateContext();
  const projects = ctx.privateProjects || [];

  const idx = projects.findIndex((p) => p.name === name);
  if (idx === -1) {
    console.log(chalk.red(`  project "${name}" not found.`));
    if (projects.length > 0) {
      console.log(chalk.dim(`  available: ${projects.map((p) => p.name).join(", ")}`));
    }
    return;
  }

  projects.splice(idx, 1);

  const spinner = new BrailleSpinner("removing project");
  spinner.start();

  const res = await updatePrivateContext({ privateProjects: projects });

  if (!res.ok) {
    spinner.fail("failed to remove project");
    console.log(chalk.red(`  ${JSON.stringify(res.data)}`));
    process.exit(1);
  }

  spinner.stop();
  console.log(chalk.green(`  removed project "${name}".`));
}

// ── Local file I/O (for pull/push integration) ───────────────

export function writePrivateContextToLocal(bundleDir: string, ctx: PrivateContext): number {
  const privateDir = path.join(bundleDir, "private");
  fs.mkdirSync(privateDir, { recursive: true });

  let filesWritten = 0;

  // Write notes
  if (ctx.privateNotes) {
    fs.writeFileSync(path.join(privateDir, "notes.md"), ctx.privateNotes);
    filesWritten++;
  }

  // Write links
  const links = ctx.internalLinks || {};
  const linkEntries = Object.entries(links);
  if (linkEntries.length > 0) {
    const linksArray = linkEntries.map(([label, url]) => ({ label, url }));
    fs.writeFileSync(path.join(privateDir, "links.json"), JSON.stringify(linksArray, null, 2) + "\n");
    filesWritten++;
  }

  // Write projects
  const projects = ctx.privateProjects || [];
  if (projects.length > 0) {
    fs.writeFileSync(path.join(privateDir, "projects.json"), JSON.stringify(projects, null, 2) + "\n");
    filesWritten++;
  }

  return filesWritten;
}

export function readPrivateContextFromLocal(bundleDir: string): Partial<PrivateContext> {
  const privateDir = path.join(bundleDir, "private");
  const updates: Partial<PrivateContext> = {};

  // Read notes
  const notesPath = path.join(privateDir, "notes.md");
  if (fs.existsSync(notesPath)) {
    updates.privateNotes = fs.readFileSync(notesPath, "utf-8");
  }

  // Read links
  const linksPath = path.join(privateDir, "links.json");
  if (fs.existsSync(linksPath)) {
    try {
      const linksArray = JSON.parse(fs.readFileSync(linksPath, "utf-8")) as Array<{ label: string; url: string }>;
      const linksRecord: Record<string, string> = {};
      for (const { label, url } of linksArray) {
        linksRecord[label] = url;
      }
      updates.internalLinks = linksRecord;
    } catch {
      // skip malformed links.json
    }
  }

  // Read projects
  const projectsPath = path.join(privateDir, "projects.json");
  if (fs.existsSync(projectsPath)) {
    try {
      updates.privateProjects = JSON.parse(fs.readFileSync(projectsPath, "utf-8"));
    } catch {
      // skip malformed projects.json
    }
  }

  return updates;
}

// ── Helpers ───────────────────────────────────────────────────

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
