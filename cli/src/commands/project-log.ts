/**
 * youmd project log — per-project agent context logging
 *
 * Appends timestamped entries to project-context/you.md/log.md so agents
 * working in the same repo can see what changed. Travels with the project's
 * own git repo — no API calls, no tokens.
 *
 * Write:  youmd project log <message...>
 * Read:   youmd project log        (no message = print last 15 entries)
 */

import * as fs from "fs";
import * as path from "path";
import * as child_process from "child_process";
import chalk from "chalk";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

const LOG_HEADER = `# You.md agent activity log
Shared log of agent updates to this project. Other agents read this to see recent work.\n`;

const CONVENTION_CONTENT = `# You.md project log convention

Agents append to \`log.md\` after meaningful changes.
Other agents read it at session start to see recent work.
The log travels with the project's git repo.

## Format

\`\`\`
## <UTC ISO timestamp> — <agent name>
<message>
\`\`\`

## Usage

  youmd project log "what I changed"   # append entry
  youmd project log                     # read last 15 entries

## Agent name

Set \`YOUMD_AGENT_NAME\` env to identify the writing agent.
Default: "agent"
`;

// ─── Project root resolution ──────────────────────────────────────────

/**
 * Walk up from cwd to find the nearest git root or a directory containing
 * project-context/ or .youmd-project. Returns null if nothing is found.
 */
function resolveProjectRoot(): string | null {
  // Try git first — fastest and most reliable
  try {
    const result = child_process.spawnSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0 && result.stdout.trim()) {
      return result.stdout.trim();
    }
  } catch {
    // git not available or not a git repo — fall through
  }

  // Walk up looking for project-context/ or .youmd-project
  let dir = process.cwd();
  const fsRoot = path.parse(dir).root;

  while (dir !== fsRoot) {
    if (
      fs.existsSync(path.join(dir, "project-context")) ||
      fs.existsSync(path.join(dir, ".youmd-project"))
    ) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function agentName(): string {
  return (
    process.env.YOUMD_AGENT_NAME ||
    process.env.AGENTS ||
    "agent"
  );
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeOnce(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf-8");
  }
}

// ─── Write mode ───────────────────────────────────────────────────────

export function projectLogWrite(messageParts: string[]): void {
  const message = messageParts.join(" ").trim();

  if (!message) {
    console.log("");
    console.log(chalk.yellow("  message required."));
    console.log(DIM("  usage: youmd project log <message...>"));
    console.log(DIM("         youmd project log               # read last 15 entries"));
    console.log("");
    return;
  }

  const projectRoot = resolveProjectRoot();
  if (!projectRoot) {
    console.log("");
    console.log(chalk.yellow("  not inside a project — run from a project directory."));
    console.log(DIM("  needs a git repo, project-context/ dir, or .youmd-project file."));
    console.log("");
    process.exit(1);
  }

  const logDir = path.join(projectRoot, "project-context", "you.md");
  const logFile = path.join(logDir, "log.md");
  const conventionFile = path.join(logDir, "CONVENTION.md");

  ensureDir(logDir);
  writeOnce(logFile, LOG_HEADER);
  writeOnce(conventionFile, CONVENTION_CONTENT);

  const ts = new Date().toISOString();
  const agent = agentName();
  const entry = `\n## ${ts} — ${agent}\n${message}\n`;

  fs.appendFileSync(logFile, entry, "utf-8");

  console.log("");
  console.log(ACCENT("  logged.") + " " + DIM(path.relative(process.cwd(), logFile)));
  console.log("");
  console.log(DIM(`  ## ${ts} — ${agent}`));
  console.log(chalk.white(`  ${message}`));
  console.log("");
}

// ─── Read mode ────────────────────────────────────────────────────────

export function projectLogRead(): void {
  const projectRoot = resolveProjectRoot();
  if (!projectRoot) {
    console.log("");
    console.log(chalk.yellow("  not inside a project — run from a project directory."));
    console.log(DIM("  needs a git repo, project-context/ dir, or .youmd-project file."));
    console.log("");
    process.exit(1);
  }

  const logFile = path.join(projectRoot, "project-context", "you.md", "log.md");

  if (!fs.existsSync(logFile)) {
    console.log("");
    console.log(DIM("  no entries yet."));
    console.log(DIM("  youmd project log <message> to write the first entry."));
    console.log("");
    return;
  }

  const raw = fs.readFileSync(logFile, "utf-8");

  // Split on entry boundaries: lines starting with "## "
  // Skip any header / preamble lines before the first entry.
  const lines = raw.split("\n");
  const entries: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current !== null) entries.push(current);
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
    // lines before the first "## " header are skipped (file preamble)
  }
  if (current !== null) {
    entries.push(current);
  }

  if (entries.length === 0) {
    console.log("");
    console.log(DIM("  no entries yet."));
    console.log(DIM("  youmd project log <message> to write the first entry."));
    console.log("");
    return;
  }

  const recent = entries.slice(-15);

  console.log("");
  console.log(
    "  " + chalk.bold("agent activity log") +
    DIM(` — ${path.relative(process.cwd(), logFile)}`)
  );
  console.log("");

  for (const entry of recent) {
    const header = entry[0] || "";
    // header: ## 2026-06-15T00:00:00.000Z — agent-name
    const match = header.match(/^## (.+?) — (.+)$/);
    if (match) {
      const [, ts, agent] = match;
      const body = entry.slice(1).join("\n").trim();
      console.log("  " + ACCENT(agent) + DIM(` · ${ts}`));
      if (body) {
        console.log("  " + chalk.white(body));
      }
      console.log("");
    } else {
      console.log("  " + chalk.white(header));
      const body = entry.slice(1).join("\n").trim();
      if (body) console.log("  " + chalk.dim(body));
      console.log("");
    }
  }

  if (entries.length > 15) {
    console.log(DIM(`  (showing last 15 of ${entries.length} entries)`));
    console.log("");
  }
}
