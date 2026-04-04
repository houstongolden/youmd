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
import { detectFormat } from "../lib/decompile";

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
  const dirs = ["profile", "preferences", "voice", "directives"];

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

// ─── Extract sections from remote bundle (handles both formats) ──────

function extractRemoteSections(
  remoteData: { youJson: unknown; youMd: string }
): Map<string, string> {
  const sections = new Map<string, string>();
  const youJson = remoteData.youJson as Record<string, unknown>;

  const format = detectFormat(youJson);

  if (format === "array") {
    // Legacy array format: {profile: [{slug, title, content}], preferences: [...]}
    const bundle = youJson as {
      profile?: Array<{ slug: string; title: string; content: string; metadata?: Record<string, unknown> }>;
      preferences?: Array<{ slug: string; title: string; content: string; metadata?: Record<string, unknown> }>;
    };

    if (bundle.profile) {
      for (const section of bundle.profile) {
        const frontmatter = `---\ntitle: "${section.title}"\n---\n\n`;
        sections.set(`profile/${section.slug}.md`, frontmatter + section.content + "\n");
      }
    }

    if (bundle.preferences) {
      for (const section of bundle.preferences) {
        const frontmatter = `---\ntitle: "${section.title}"\n---\n\n`;
        sections.set(`preferences/${section.slug}.md`, frontmatter + section.content + "\n");
      }
    }
  } else {
    // Nested server format — reconstruct markdown files
    const identity = (youJson.identity as Record<string, unknown>) || {};
    const bio = (identity.bio as Record<string, string>) || {};

    // profile/about.md
    if (identity.name || bio.long) {
      const lines = [`---\ntitle: "About"\n---\n`, `# ${identity.name || ""}`, ""];
      if (identity.tagline) lines.push(`${identity.tagline}`, "");
      if (identity.location) lines.push(`*${identity.location}*`, "");
      if (bio.long) lines.push(bio.long, "");
      sections.set("profile/about.md", lines.join("\n"));
    }

    // profile/now.md
    const now = (youJson.now as Record<string, unknown>) || {};
    const focus = (now.focus as string[]) || [];
    if (focus.length > 0) {
      sections.set("profile/now.md", `---\ntitle: "Now"\n---\n\n${focus.map((f) => `- ${f}`).join("\n")}\n`);
    }

    // profile/projects.md
    const projects = (youJson.projects as Array<Record<string, string>>) || [];
    if (projects.length > 0) {
      const lines = [`---\ntitle: "Projects"\n---\n`];
      for (const p of projects) {
        lines.push(`## ${p.name}`);
        if (p.role) lines.push(`**Role:** ${p.role}`);
        if (p.status) lines.push(`**Status:** ${p.status}`);
        if (p.url) lines.push(`**URL:** ${p.url}`);
        if (p.description) lines.push(`\n${p.description}`);
        lines.push("");
      }
      sections.set("profile/projects.md", lines.join("\n"));
    }

    // profile/values.md
    const values = (youJson.values as string[]) || [];
    if (values.length > 0) {
      sections.set("profile/values.md", `---\ntitle: "Values"\n---\n\n${values.map((v) => `- ${v}`).join("\n")}\n`);
    }

    // profile/links.md
    const links = (youJson.links as Record<string, string>) || {};
    const linkEntries = Object.entries(links).filter(([, url]) => url);
    if (linkEntries.length > 0) {
      sections.set("profile/links.md", `---\ntitle: "Links"\n---\n\n${linkEntries.map(([p, u]) => `- **${p}**: ${u}`).join("\n")}\n`);
    }

    // preferences/agent.md
    const prefs = (youJson.preferences as Record<string, Record<string, unknown>>) || {};
    if (prefs.agent) {
      const lines = [`---\ntitle: "Agent Preferences"\n---\n`];
      if (prefs.agent.tone) lines.push(`**Tone:** ${prefs.agent.tone}`);
      if (prefs.agent.formality) lines.push(`**Formality:** ${prefs.agent.formality}`);
      const avoid = (prefs.agent.avoid as string[]) || [];
      if (avoid.length > 0) lines.push(`**Avoid:** ${avoid.join(", ")}`);
      lines.push("");
      sections.set("preferences/agent.md", lines.join("\n"));
    }

    // preferences/writing.md
    if (prefs.writing) {
      const lines = [`---\ntitle: "Writing Preferences"\n---\n`];
      if (prefs.writing.style) lines.push(`**Style:** ${prefs.writing.style}`);
      if (prefs.writing.format) lines.push(`**Format:** ${prefs.writing.format}`);
      lines.push("");
      sections.set("preferences/writing.md", lines.join("\n"));
    }

    // voice/voice.md
    const voice = (youJson.voice as Record<string, unknown>) || {};
    if (voice.overall) {
      sections.set("voice/voice.md", `---\ntitle: "Voice Profile"\n---\n\n${voice.overall}\n`);
    }

    // voice/voice.{platform}.md
    const platforms = (voice.platforms as Record<string, string>) || {};
    for (const [platform, content] of Object.entries(platforms)) {
      if (content) {
        sections.set(`voice/voice.${platform}.md`, `---\ntitle: "${platform} Voice"\n---\n\n${content}\n`);
      }
    }

    // directives/agent.md
    const ad = (youJson.agent_directives as Record<string, unknown>) || {};
    if (ad.communication_style || (ad.negative_prompts as string[])?.length || ad.default_stack) {
      const lines = [`---\ntitle: "Agent Directives"\n---\n`];
      if (ad.communication_style) lines.push(`**Communication Style:** ${ad.communication_style}`);
      const np = (ad.negative_prompts as string[]) || [];
      if (np.length > 0) lines.push(`**Never:** ${np.join(". ")}`);
      if (ad.default_stack) lines.push(`**Default Stack:** ${ad.default_stack}`);
      if (ad.decision_framework) lines.push(`**Decision Framework:** ${ad.decision_framework}`);
      if (ad.current_goal) lines.push(`**Current Goal:** ${ad.current_goal}`);
      lines.push("");
      sections.set("directives/agent.md", lines.join("\n"));
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
