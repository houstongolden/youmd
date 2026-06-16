/**
 * youmd prompts — search and browse your past messages across agent sessions.
 *
 * Subcommands:
 *   youmd prompts              — show recent messages (last 20)
 *   youmd prompts search <q>   — search all messages for a keyword
 *   youmd prompts tail [n]     — show last N messages
 *   youmd prompts today        — messages from today
 *   youmd prompts export       — dump all messages to stdout (pipe-friendly)
 *   youmd prompts catalog      — index project-local prompt history files
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import { getHomeBundleDir } from "../lib/config";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

interface PromptEntry {
  timestamp: string;
  content: string;
  session: string;
}

interface PromptCatalogEntry {
  time: string;
  context: string;
  section: string;
}

interface PromptCatalogFile {
  projectName: string;
  projectRoot: string;
  promptPath: string;
  legacy: boolean;
  entryCount: number;
  lastEntry: PromptCatalogEntry | null;
}

interface PromptCatalogOptions {
  roots: string[];
  outPath?: string;
  write: boolean;
  json: boolean;
  limit: number;
}

const DEFAULT_CATALOG_EXCLUDES = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  ".cache",
  ".gradle",
  ".pytest_cache",
  ".mypy_cache",
  ".ruff_cache",
  ".venv",
  "venv",
  "vendor",
  "target",
  "tmp",
  "__pycache__",
]);

function defaultPromptCatalogRoots(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return [
    process.cwd(),
    path.join(home, "Desktop", "CODE_2025"),
    path.join(home, "Documents"),
  ];
}

function dedupeResolvedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    const expanded = raw.replace(/^~(?=$|\/|\\)/, process.env.HOME || "");
    const resolved = path.resolve(expanded);
    let key = resolved;
    try {
      key = fs.realpathSync(resolved);
    } catch {
      // Keep the resolved path for non-existent roots; caller filters later.
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

function shouldSkipDir(name: string): boolean {
  return DEFAULT_CATALOG_EXCLUDES.has(name);
}

export function findPromptHistoryFiles(roots = defaultPromptCatalogRoots(), limit = 500): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const queue = dedupeResolvedPaths(roots).filter((root) => fs.existsSync(root));

  while (queue.length && found.length < limit) {
    const dir = queue.shift()!;
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;

    let real = dir;
    try {
      real = fs.realpathSync(dir);
    } catch {
      // Best effort.
    }
    if (seen.has(real)) continue;
    seen.add(real);

    const contextDir = path.join(dir, "project-context");
    const promptsPath = path.join(contextDir, "prompts.md");
    const legacyPath = path.join(contextDir, "prompt-history.md");
    if (fs.existsSync(promptsPath)) {
      found.push(promptsPath);
    } else if (fs.existsSync(legacyPath)) {
      found.push(legacyPath);
    }
    if (found.length >= limit) break;

    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const child of children) {
      if (shouldSkipDir(child.name)) continue;
      if (child.isDirectory() && !child.isSymbolicLink()) {
        queue.push(path.join(dir, child.name));
      }
    }
  }

  return found.sort();
}

function inferProjectName(projectRoot: string): string {
  const markerPath = path.join(projectRoot, ".youmd-project");
  if (fs.existsSync(markerPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(markerPath, "utf-8")) as { name?: string };
      if (parsed.name) return parsed.name;
    } catch {
      // Fall through to package/basename.
    }
  }

  const packagePath = path.join(projectRoot, "package.json");
  if (fs.existsSync(packagePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(packagePath, "utf-8")) as { name?: string };
      if (parsed.name) return parsed.name;
    } catch {
      // Fall through.
    }
  }

  return path.basename(projectRoot);
}

function promptCatalogSortKey(item: PromptCatalogFile): string {
  if (!item.lastEntry) return "";
  return `${item.lastEntry.section} ${item.lastEntry.time}`;
}

export function parseProjectPromptFile(promptPath: string): PromptCatalogFile {
  const text = fs.readFileSync(promptPath, "utf-8");
  const projectRoot = path.dirname(path.dirname(promptPath));
  let currentSection = "unsectioned";
  const entries: PromptCatalogEntry[] = [];

  for (const line of text.split(/\r?\n/)) {
    const sectionMatch = line.match(/^##\s+(.+?)\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }
    const entryMatch = line.match(/^\*\*(.+?)\s+-\s+(.+?)\*\*\s*$/);
    if (!entryMatch) continue;
    entries.push({
      time: entryMatch[1].trim(),
      context: entryMatch[2].trim(),
      section: currentSection,
    });
  }

  return {
    projectName: inferProjectName(projectRoot),
    projectRoot,
    promptPath,
    legacy: path.basename(promptPath) === "prompt-history.md",
    entryCount: entries.length,
    lastEntry: entries.length ? entries[entries.length - 1] : null,
  };
}

export function buildPromptCatalog(files: string[]): PromptCatalogFile[] {
  return files.map(parseProjectPromptFile).sort((a, b) => {
    const aKey = promptCatalogSortKey(a);
    const bKey = promptCatalogSortKey(b);
    return bKey.localeCompare(aKey) || a.projectName.localeCompare(b.projectName);
  });
}

export function renderPromptCatalogMarkdown(catalog: PromptCatalogFile[]): string {
  const generatedAt = new Date().toISOString();
  const totalEntries = catalog.reduce((sum, item) => sum + item.entryCount, 0);
  const lines: string[] = [
    "# Prompt History Catalog",
    "",
    `Generated: ${generatedAt}`,
    "",
    `Projects indexed: ${catalog.length}`,
    `Prompt entries indexed: ${totalEntries}`,
    "",
    "This is an index of project-local prompt logs. Raw prompt history stays in each project's `project-context/prompts.md` file.",
    "",
    "## Projects",
    "",
  ];

  if (!catalog.length) {
    lines.push("No project prompt logs found.");
    lines.push("");
    return lines.join("\n");
  }

  for (const item of catalog) {
    lines.push(`### ${item.projectName}`);
    lines.push("");
    lines.push(`- Root: \`${item.projectRoot}\``);
    lines.push(`- Prompt log: \`${item.promptPath}\`${item.legacy ? " (legacy name)" : ""}`);
    lines.push(`- Entries: ${item.entryCount}`);
    if (item.lastEntry) {
      lines.push(`- Last entry: ${item.lastEntry.time} - ${item.lastEntry.context}`);
      lines.push(`- Last section: ${item.lastEntry.section}`);
    } else {
      lines.push("- Last entry: none detected");
    }
    lines.push("");
  }

  return lines.join("\n");
}

function parseCatalogOptions(args: string[]): PromptCatalogOptions {
  const roots: string[] = [];
  let outPath: string | undefined;
  let write = true;
  let json = false;
  let limit = 500;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--no-write") {
      write = false;
    } else if (arg === "--write") {
      write = true;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--out") {
      outPath = args[++i];
    } else if (arg === "--limit") {
      const parsed = Number.parseInt(args[++i] || "", 10);
      if (Number.isFinite(parsed) && parsed > 0) limit = parsed;
    } else if (arg === "--root") {
      roots.push(args[++i]);
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown catalog option: ${arg}`);
    } else {
      roots.push(arg);
    }
  }

  return { roots: roots.length ? roots : defaultPromptCatalogRoots(), outPath, write, json, limit };
}

async function promptsCatalogCommand(args: string[]): Promise<void> {
  let options: PromptCatalogOptions;
  try {
    options = parseCatalogOptions(args);
  } catch (err) {
    console.log(`  ${ACCENT("ERR")} ${err instanceof Error ? err.message : "invalid catalog options"}`);
    console.log(`  ${DIM("usage:")} ${ACCENT("youmd prompts catalog [--root <dir>] [--out <file>] [--no-write] [--json]")}`);
    console.log("");
    return;
  }

  const files = findPromptHistoryFiles(options.roots, options.limit);
  const catalog = buildPromptCatalog(files);
  const markdown = renderPromptCatalogMarkdown(catalog);
  const outPath = path.resolve(options.outPath || path.join(getHomeBundleDir(), "private", "prompt-catalog.md"));

  if (options.json) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), outPath, catalog }, null, 2));
  } else {
    console.log("");
    console.log("  " + chalk.bold("you.md") + DIM(" -- prompt catalog"));
    console.log(`  ${DIM(`found ${catalog.length} project prompt logs (${catalog.reduce((sum, item) => sum + item.entryCount, 0)} entries)`)}`);
    console.log("");
    for (const item of catalog.slice(0, 20)) {
      const last = item.lastEntry ? `${item.lastEntry.time} - ${item.lastEntry.context}` : "no entries";
      console.log(`  ${ACCENT(item.projectName)} ${DIM(`(${item.entryCount})`)} ${DIM(last)}`);
      console.log(`  ${DIM(item.promptPath)}`);
    }
    if (catalog.length > 20) {
      console.log(`  ${DIM(`... +${catalog.length - 20} more`)}`);
    }
    console.log("");
  }

  if (options.write) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, "utf-8");
    if (!options.json) {
      console.log(`  ${DIM("wrote")} ${ACCENT(outPath)}`);
      console.log("");
    }
  } else if (!options.json) {
    console.log(markdown);
  }
}

/**
 * Scan all Claude Code session transcripts for this project and extract user messages.
 */
function findSessionDir(): string | null {
  // Claude Code stores transcripts in ~/.claude/projects/{project-slug}/
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const cwd = process.cwd();
  // Build the project slug: replace path separators with hyphens
  const slug = cwd.replace(/\//g, "-").replace(/^-/, "");
  const sessionDir = path.join(home, ".claude", "projects", slug);
  if (fs.existsSync(sessionDir)) return sessionDir;

  // Try common patterns
  const claudeDir = path.join(home, ".claude", "projects");
  if (!fs.existsSync(claudeDir)) return null;

  const dirs = fs.readdirSync(claudeDir);
  // Find a directory that contains our project path
  const match = dirs.find((d) => {
    const decoded = d.replace(/-/g, "/");
    return cwd.includes(decoded.slice(1)) || decoded.includes(cwd);
  });
  return match ? path.join(claudeDir, match) : null;
}

async function extractMessages(sessionDir: string): Promise<PromptEntry[]> {
  const entries: PromptEntry[] = [];
  const files = fs.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl"));

  for (const file of files) {
    const filePath = path.join(sessionDir, file);
    const sessionId = file.replace(".jsonl", "").slice(0, 8);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === "user" || obj.role === "user") {
          const content =
            typeof obj.message?.content === "string"
              ? obj.message.content
              : typeof obj.content === "string"
                ? obj.content
                : Array.isArray(obj.message?.content)
                  ? obj.message.content
                      .filter((b: { type: string }) => b.type === "text")
                      .map((b: { text: string }) => b.text)
                      .join("\n")
                  : null;

          if (!content || content.length < 3) continue;
          // Skip system noise
          if (content.startsWith("<task-notification>")) continue;
          if (content.startsWith("<system-reminder>") && !content.includes("\n")) continue;

          // Strip system-reminder wrappers if the user message is embedded
          let cleaned = content;
          if (cleaned.includes("<system-reminder>")) {
            // Extract just the user's text before/between system reminders
            cleaned = cleaned
              .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
              .trim();
            if (!cleaned || cleaned.length < 3) continue;
          }

          const ts = obj.timestamp || obj.message?.timestamp || "";
          const date = ts ? new Date(ts).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "unknown";

          entries.push({
            timestamp: date,
            content: cleaned.slice(0, 2000), // cap for display
            session: sessionId,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function printMessage(entry: PromptEntry, compact = false): void {
  const ts = DIM(entry.timestamp);
  const sess = DIM(`[${entry.session}]`);
  const preview = entry.content.length > 200 && compact
    ? entry.content.slice(0, 200) + DIM("...")
    : entry.content;

  console.log(`  ${ts} ${sess}`);
  // Indent and wrap the message
  const lines = preview.split("\n");
  for (const line of lines.slice(0, compact ? 3 : 50)) {
    console.log(`  ${ACCENT(">")} ${line}`);
  }
  if (compact && lines.length > 3) {
    console.log(`  ${DIM(`  ... +${lines.length - 3} more lines`)}`);
  }
  console.log("");
}

export async function promptsCommand(
  subcommand?: string,
  ...args: string[]
): Promise<void> {
  if (subcommand === "catalog") {
    await promptsCatalogCommand(args);
    return;
  }

  const sessionDir = findSessionDir();
  if (!sessionDir) {
    console.log("");
    console.log(`  ${ACCENT("ERR")} could not find claude code session transcripts`);
    console.log(`  ${DIM("expected in ~/.claude/projects/")}`);
    console.log("");
    return;
  }

  const allMessages = await extractMessages(sessionDir);

  if (!allMessages.length) {
    console.log("");
    console.log(`  ${DIM("no messages found in session transcripts")}`);
    console.log("");
    return;
  }

  console.log("");
  console.log("  " + chalk.bold("you.md") + DIM(" -- prompts"));
  console.log(`  ${DIM(`${allMessages.length} messages across ${new Set(allMessages.map((m) => m.session)).size} sessions`)}`);
  console.log("");

  if (!subcommand || subcommand === "recent") {
    // Show last 20
    const recent = allMessages.slice(-20);
    console.log(`  ${ACCENT("recent")} ${DIM(`(last ${recent.length})`)}`);
    console.log("");
    for (const msg of recent) {
      printMessage(msg, true);
    }
    console.log(`  ${DIM("use")} ${ACCENT("youmd prompts search <query>")} ${DIM("to find specific messages")}`);
    console.log(`  ${DIM("use")} ${ACCENT("youmd prompts tail 50")} ${DIM("for more history")}`);
    console.log("");
    return;
  }

  if (subcommand === "search") {
    const query = args.join(" ").toLowerCase();
    if (!query) {
      console.log(`  ${ACCENT("ERR")} provide a search query`);
      console.log(`  ${DIM("example:")} ${ACCENT("youmd prompts search portrait")}`);
      console.log("");
      return;
    }

    const matches = allMessages.filter((m) =>
      m.content.toLowerCase().includes(query)
    );

    console.log(`  ${ACCENT("search")} "${query}" ${DIM(`-- ${matches.length} matches`)}`);
    console.log("");

    if (!matches.length) {
      console.log(`  ${DIM("no messages matched that query")}`);
      console.log("");
      return;
    }

    for (const msg of matches) {
      // Highlight the query in the content
      printMessage(msg, true);
    }
    return;
  }

  if (subcommand === "tail") {
    const n = parseInt(args[0] || "20", 10);
    const tail = allMessages.slice(-n);
    console.log(`  ${ACCENT("tail")} ${DIM(`(last ${tail.length})`)}`);
    console.log("");
    for (const msg of tail) {
      printMessage(msg, true);
    }
    return;
  }

  if (subcommand === "today") {
    const today = new Date().toISOString().slice(0, 10);
    const todayMsgs = allMessages.filter((m) => m.timestamp.startsWith(today));
    console.log(`  ${ACCENT("today")} ${DIM(`-- ${todayMsgs.length} messages`)}`);
    console.log("");

    if (!todayMsgs.length) {
      console.log(`  ${DIM("no messages from today")}`);
      console.log("");
      return;
    }

    for (const msg of todayMsgs) {
      printMessage(msg, false);
    }
    return;
  }

  if (subcommand === "export") {
    // Raw output for piping
    for (const msg of allMessages) {
      console.log(`[${msg.timestamp}] [${msg.session}]`);
      console.log(msg.content);
      console.log("---");
    }
    return;
  }

  console.log(`  ${ACCENT("ERR")} unknown subcommand "${subcommand}"`);
  console.log(`  ${DIM("available:")} recent, search <q>, tail [n], today, export, catalog`);
  console.log("");
}
