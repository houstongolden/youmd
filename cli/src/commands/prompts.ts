/**
 * youmd prompts — search and browse your past messages across agent sessions.
 *
 * Subcommands:
 *   youmd prompts              — show recent messages (last 20)
 *   youmd prompts search <q>   — search all messages for a keyword
 *   youmd prompts tail [n]     — show last N messages
 *   youmd prompts today        — messages from today
 *   youmd prompts export       — dump all messages to stdout (pipe-friendly)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";

const ACCENT = chalk.hex("#C46A3A");
const DIM = chalk.dim;

interface PromptEntry {
  timestamp: string;
  content: string;
  session: string;
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
  console.log(`  ${DIM("available:")} recent, search <q>, tail [n], today, export`);
  console.log("");
}
