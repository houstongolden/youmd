import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
} from "../lib/config";
import { getPublicProfile } from "../lib/api";

// ─── Simple line diff ─────────────────────────────────────────────────

interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

function diffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: "context", text: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: "add", text: newLines[j - 1] });
      j--;
    } else {
      stack.push({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }

  // Reverse since we built it backwards
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]);
  }

  return result;
}

function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((d) => d.type !== "context");
}

function printDiff(sectionName: string, diff: DiffLine[]): void {
  if (!hasChanges(diff)) return;

  console.log("");
  console.log("  " + chalk.bold(sectionName));
  console.log(chalk.dim("  " + "\u2500".repeat(40)));

  // Show context-aware diff (3 lines of context around changes)
  const contextRadius = 3;
  const changeIndices = new Set<number>();

  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type !== "context") {
      for (let c = Math.max(0, i - contextRadius); c <= Math.min(diff.length - 1, i + contextRadius); c++) {
        changeIndices.add(c);
      }
    }
  }

  let lastPrinted = -1;
  for (let i = 0; i < diff.length; i++) {
    if (!changeIndices.has(i)) continue;

    if (lastPrinted >= 0 && i > lastPrinted + 1) {
      console.log(chalk.dim("    ..."));
    }
    lastPrinted = i;

    const line = diff[i];
    switch (line.type) {
      case "add":
        console.log(chalk.green("  + " + line.text));
        break;
      case "remove":
        console.log(chalk.red("  - " + line.text));
        break;
      case "context":
        console.log(chalk.dim("    " + line.text));
        break;
    }
  }
}

// ─── Load local sections ─────────────────────────────────────────────

function loadLocalSections(bundleDir: string): Map<string, string> {
  const sections = new Map<string, string>();
  const dirs = ["profile", "preferences"];

  for (const dir of dirs) {
    const dirPath = path.join(bundleDir, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md"))
      .sort();

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8");
      sections.set(`${dir}/${file}`, content);
    }
  }

  return sections;
}

// ─── Extract sections from remote bundle ─────────────────────────────

function extractRemoteSections(
  remoteData: { youJson: unknown; youMd: string }
): Map<string, string> {
  const sections = new Map<string, string>();

  const bundle = remoteData.youJson as {
    profile?: Array<{ slug: string; title: string; content: string; metadata?: Record<string, unknown> }>;
    preferences?: Array<{ slug: string; title: string; content: string; metadata?: Record<string, unknown> }>;
  };

  if (bundle.profile) {
    for (const section of bundle.profile) {
      // Reconstruct the markdown file with frontmatter
      const frontmatter = section.metadata && Object.keys(section.metadata).length > 0
        ? `---\ntitle: "${section.title}"\n---\n\n`
        : `---\ntitle: "${section.title}"\n---\n\n`;
      sections.set(`profile/${section.slug}.md`, frontmatter + section.content + "\n");
    }
  }

  if (bundle.preferences) {
    for (const section of bundle.preferences) {
      const frontmatter = `---\ntitle: "${section.title}"\n---\n\n`;
      sections.set(`preferences/${section.slug}.md`, frontmatter + section.content + "\n");
    }
  }

  return sections;
}

// ─── Main diff command ───────────────────────────────────────────────

export async function diffCommand(): Promise<void> {
  console.log("");

  if (!localBundleExists()) {
    console.log(chalk.yellow("  no .youmd/ directory found"));
    console.log("");
    console.log("  run " + chalk.cyan("youmd init") + " to create one.");
    console.log("");
    return;
  }

  if (!isAuthenticated()) {
    console.log(chalk.yellow("  not authenticated -- cannot fetch remote bundle."));
    console.log("  run " + chalk.cyan("youmd login") + " to authenticate.");
    console.log("");
    return;
  }

  const config = readGlobalConfig();
  const username = config.username;

  if (!username) {
    console.log(chalk.yellow("  no username found in config."));
    console.log("  run " + chalk.cyan("youmd login") + " first.");
    console.log("");
    return;
  }

  // Fetch remote profile
  process.stdout.write(chalk.dim("  fetching remote bundle..."));

  let remoteData: { youJson: unknown; youMd: string; username: string } | null;
  try {
    remoteData = await getPublicProfile(username);
  } catch (err) {
    console.log("");
    console.log(
      chalk.red("  failed to fetch remote: " + (err instanceof Error ? err.message : String(err)))
    );
    console.log("");
    return;
  }

  if (!remoteData || !remoteData.youJson) {
    console.log("");
    console.log(chalk.yellow("  no published bundle found on you.md/" + username));
    console.log(chalk.dim("  publish first with " + chalk.cyan("youmd publish")));
    console.log("");
    return;
  }

  process.stdout.write("\r" + " ".repeat(60) + "\r");

  // Load local sections
  const bundleDir = getLocalBundleDir();
  const localSections = loadLocalSections(bundleDir);
  const remoteSections = extractRemoteSections(remoteData as { youJson: unknown; youMd: string });

  // Collect all section keys
  const allKeys = new Set<string>([...localSections.keys(), ...remoteSections.keys()]);

  let totalChanges = 0;
  let addedSections = 0;
  let removedSections = 0;
  let modifiedSections = 0;

  console.log("  " + chalk.bold("you.md diff") + chalk.dim(` -- local vs you.md/${username}`));

  for (const key of [...allKeys].sort()) {
    const localContent = localSections.get(key) || "";
    const remoteContent = remoteSections.get(key) || "";

    if (localContent === remoteContent) continue;

    if (!remoteContent) {
      // New local file
      addedSections++;
      totalChanges++;
      console.log("");
      console.log("  " + chalk.green("+ new: ") + chalk.bold(key));
      const lines = localContent.split("\n");
      for (const line of lines.slice(0, 10)) {
        console.log(chalk.green("  + " + line));
      }
      if (lines.length > 10) {
        console.log(chalk.dim(`    ... (${lines.length - 10} more lines)`));
      }
      continue;
    }

    if (!localContent) {
      // Removed locally (exists remote but not local)
      removedSections++;
      totalChanges++;
      console.log("");
      console.log("  " + chalk.red("- removed: ") + chalk.bold(key));
      continue;
    }

    // Modified
    modifiedSections++;
    totalChanges++;
    const diff = diffLines(remoteContent, localContent);
    printDiff(key, diff);
  }

  if (totalChanges === 0) {
    console.log("");
    console.log(chalk.green("  no changes") + chalk.dim(" -- local matches remote"));
  } else {
    console.log("");
    console.log(chalk.dim("  " + "\u2500".repeat(40)));
    const parts: string[] = [];
    if (modifiedSections > 0) parts.push(`${modifiedSections} modified`);
    if (addedSections > 0) parts.push(`${addedSections} new`);
    if (removedSections > 0) parts.push(`${removedSections} removed`);
    console.log(chalk.dim("  " + parts.join(", ")));
  }

  console.log("");
}
