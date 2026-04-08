import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import {
  getLocalBundleDir,
  localBundleExists,
  isAuthenticated,
  readGlobalConfig,
} from "../lib/config";
import {
  getPublicProfile,
  getBundleByVersion,
  getMe,
  type BundleVersionData,
} from "../lib/api";
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

// ─── Section-by-section structured diff helpers ──────────────────────

function extractIdentity(youJson: Record<string, unknown>): {
  name: string;
  tagline: string;
  bio: string;
} {
  const identity = (youJson.identity as Record<string, unknown>) || {};
  const bio = (identity.bio as Record<string, unknown>) || {};
  return {
    name: String(identity.name || ""),
    tagline: String(identity.tagline || ""),
    bio: String(bio.long || bio.medium || bio.short || ""),
  };
}

function extractProjects(youJson: Record<string, unknown>): Array<Record<string, string>> {
  const projects = (youJson.projects as Array<Record<string, string>>) || [];
  return projects.map((p) => ({
    name: String(p.name || ""),
    role: String(p.role || ""),
    status: String(p.status || ""),
    description: String(p.description || ""),
    url: String(p.url || ""),
  }));
}

function extractValues(youJson: Record<string, unknown>): string[] {
  const values = (youJson.values as unknown) || [];
  if (Array.isArray(values)) return values.map((v) => String(v));
  return [];
}

function extractAgentPrefs(youJson: Record<string, unknown>): Record<string, string> {
  const prefs = (youJson.preferences as Record<string, Record<string, unknown>>) || {};
  const agent = prefs.agent || {};
  return {
    tone: String(agent.tone || ""),
    formality: String(agent.formality || ""),
    avoid: Array.isArray(agent.avoid) ? (agent.avoid as string[]).join(", ") : "",
  };
}

function diffField(
  label: string,
  oldVal: string,
  newVal: string
): boolean {
  if (oldVal === newVal) return false;

  if (!oldVal && newVal) {
    console.log("  " + chalk.green("+ " + label + ": " + truncate(newVal, 80)));
  } else if (oldVal && !newVal) {
    console.log("  " + chalk.red("- " + label + ": " + truncate(oldVal, 80)));
  } else {
    console.log("  " + chalk.yellow("~ " + label + ":"));
    console.log("    " + chalk.red("- " + truncate(oldVal, 100)));
    console.log("    " + chalk.green("+ " + truncate(newVal, 100)));
  }
  return true;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "\u2026";
}

function diffStructured(
  oldData: BundleVersionData,
  newData: BundleVersionData
): { changes: number } {
  let changes = 0;
  const oldJson = (oldData.youJson as Record<string, unknown>) || {};
  const newJson = (newData.youJson as Record<string, unknown>) || {};

  // Identity
  const oldId = extractIdentity(oldJson);
  const newId = extractIdentity(newJson);
  const idChanged =
    oldId.name !== newId.name ||
    oldId.tagline !== newId.tagline ||
    oldId.bio !== newId.bio;

  if (idChanged) {
    console.log("");
    console.log("  " + chalk.bold("identity"));
    console.log(chalk.dim("  " + "\u2500".repeat(40)));
    if (diffField("name", oldId.name, newId.name)) changes++;
    if (diffField("tagline", oldId.tagline, newId.tagline)) changes++;
    if (diffField("bio", oldId.bio, newId.bio)) changes++;
  }

  // Projects: added / removed / modified by name
  const oldProjects = extractProjects(oldJson);
  const newProjects = extractProjects(newJson);
  const oldByName = new Map(oldProjects.map((p) => [p.name, p]));
  const newByName = new Map(newProjects.map((p) => [p.name, p]));

  const projectAdds: Array<Record<string, string>> = [];
  const projectRemoves: Array<Record<string, string>> = [];
  const projectMods: Array<{ name: string; before: Record<string, string>; after: Record<string, string> }> = [];

  for (const [name, p] of newByName) {
    if (!oldByName.has(name)) {
      projectAdds.push(p);
    } else {
      const before = oldByName.get(name)!;
      if (JSON.stringify(before) !== JSON.stringify(p)) {
        projectMods.push({ name, before, after: p });
      }
    }
  }
  for (const [name, p] of oldByName) {
    if (!newByName.has(name)) {
      projectRemoves.push(p);
    }
  }

  if (projectAdds.length || projectRemoves.length || projectMods.length) {
    console.log("");
    console.log("  " + chalk.bold("projects"));
    console.log(chalk.dim("  " + "\u2500".repeat(40)));

    for (const p of projectAdds) {
      console.log("  " + chalk.green("+ added: " + p.name));
      if (p.role) console.log(chalk.green("      role: " + p.role));
      if (p.description) console.log(chalk.green("      desc: " + truncate(p.description, 80)));
      changes++;
    }
    for (const p of projectRemoves) {
      console.log("  " + chalk.red("- removed: " + p.name));
      changes++;
    }
    for (const m of projectMods) {
      console.log("  " + chalk.yellow("~ modified: " + m.name));
      for (const key of ["role", "status", "url", "description"]) {
        const oldV = m.before[key] || "";
        const newV = m.after[key] || "";
        if (oldV !== newV) {
          if (oldV) console.log("      " + chalk.red("- " + key + ": " + truncate(oldV, 80)));
          if (newV) console.log("      " + chalk.green("+ " + key + ": " + truncate(newV, 80)));
        }
      }
      changes++;
    }
  }

  // Values
  const oldValues = extractValues(oldJson);
  const newValues = extractValues(newJson);
  const oldValSet = new Set(oldValues);
  const newValSet = new Set(newValues);
  const addedValues = newValues.filter((v) => !oldValSet.has(v));
  const removedValues = oldValues.filter((v) => !newValSet.has(v));

  if (addedValues.length || removedValues.length) {
    console.log("");
    console.log("  " + chalk.bold("values"));
    console.log(chalk.dim("  " + "\u2500".repeat(40)));
    for (const v of addedValues) {
      console.log("  " + chalk.green("+ " + v));
      changes++;
    }
    for (const v of removedValues) {
      console.log("  " + chalk.red("- " + v));
      changes++;
    }
  }

  // Preferences (agent block)
  const oldPrefs = extractAgentPrefs(oldJson);
  const newPrefs = extractAgentPrefs(newJson);
  const prefsChanged =
    oldPrefs.tone !== newPrefs.tone ||
    oldPrefs.formality !== newPrefs.formality ||
    oldPrefs.avoid !== newPrefs.avoid;

  if (prefsChanged) {
    console.log("");
    console.log("  " + chalk.bold("preferences"));
    console.log(chalk.dim("  " + "\u2500".repeat(40)));
    if (diffField("tone", oldPrefs.tone, newPrefs.tone)) changes++;
    if (diffField("formality", oldPrefs.formality, newPrefs.formality)) changes++;
    if (diffField("avoid", oldPrefs.avoid, newPrefs.avoid)) changes++;
  }

  return { changes };
}

// ─── Version-vs-version diff (youmd diff <v1> <v2>) ──────────────────

async function diffTwoVersions(v1: number, v2: number): Promise<void> {
  if (!isAuthenticated()) {
    console.log(chalk.yellow("  not authenticated -- cannot fetch bundle versions."));
    console.log("  run " + chalk.cyan("youmd login") + " to authenticate.");
    console.log("");
    return;
  }

  // Resolve "latest" semantics: -1 means use the latest from /api/v1/me
  const resolveVersion = async (v: number): Promise<number> => {
    if (v >= 1) return v;
    const me = await getMe();
    if (!me.ok || !me.data.latestBundle) {
      throw new Error("could not determine latest version");
    }
    return me.data.latestBundle.version;
  };

  let resolvedV1: number;
  let resolvedV2: number;
  try {
    resolvedV1 = await resolveVersion(v1);
    resolvedV2 = await resolveVersion(v2);
  } catch (err) {
    console.log(chalk.red("  " + (err instanceof Error ? err.message : String(err))));
    console.log("");
    return;
  }

  process.stdout.write(
    chalk.dim(`  fetching v${resolvedV1} and v${resolvedV2}...`)
  );

  const [a, b] = await Promise.all([
    getBundleByVersion(resolvedV1),
    getBundleByVersion(resolvedV2),
  ]);

  process.stdout.write("\r" + " ".repeat(60) + "\r");

  if (!a.ok || !a.data) {
    console.log(chalk.red(`  could not fetch v${resolvedV1}`));
    if (a.status === 404) {
      console.log(chalk.dim("  version not found -- try `youmd status` to see available versions"));
    }
    console.log("");
    return;
  }
  if (!b.ok || !b.data) {
    console.log(chalk.red(`  could not fetch v${resolvedV2}`));
    if (b.status === 404) {
      console.log(chalk.dim("  version not found -- try `youmd status` to see available versions"));
    }
    console.log("");
    return;
  }

  console.log(
    "  " +
      chalk.bold("you.md diff") +
      chalk.dim(` -- v${resolvedV1} \u2192 v${resolvedV2}`)
  );

  const { changes } = diffStructured(a.data, b.data);

  if (changes === 0) {
    console.log("");
    console.log(
      chalk.green("  no changes") + chalk.dim(` -- v${resolvedV1} matches v${resolvedV2}`)
    );
  } else {
    console.log("");
    console.log(chalk.dim("  " + "\u2500".repeat(40)));
    console.log(chalk.dim(`  ${changes} change${changes === 1 ? "" : "s"}`));
  }

  console.log("");
}

// ─── Local-vs-remote diff (youmd diff with no args) ──────────────────

async function diffLocalVsRemote(): Promise<void> {
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

// ─── Main diff command ───────────────────────────────────────────────

function parseVersionArg(arg: string): number | null {
  const trimmed = arg.trim().toLowerCase();
  if (trimmed === "latest" || trimmed === "head") return -1;
  // Allow "v3" or "3"
  const stripped = trimmed.startsWith("v") ? trimmed.slice(1) : trimmed;
  const n = Number(stripped);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

export async function diffCommand(v1?: string, v2?: string): Promise<void> {
  console.log("");

  // Two version args -> compare two bundle versions
  if (v1 && v2) {
    const parsedV1 = parseVersionArg(v1);
    const parsedV2 = parseVersionArg(v2);
    if (parsedV1 === null) {
      console.log(chalk.red(`  invalid version: ${v1}`));
      console.log(chalk.dim("  use a number, 'v3', or 'latest'"));
      console.log("");
      return;
    }
    if (parsedV2 === null) {
      console.log(chalk.red(`  invalid version: ${v2}`));
      console.log(chalk.dim("  use a number, 'v3', or 'latest'"));
      console.log("");
      return;
    }
    await diffTwoVersions(parsedV1, parsedV2);
    return;
  }

  if (v1 && !v2) {
    console.log(chalk.yellow("  pass two versions: ") + chalk.cyan("youmd diff <v1> <v2>"));
    console.log(chalk.dim("  example: ") + chalk.cyan("youmd diff 3 5"));
    console.log("");
    return;
  }

  // No args -> local vs remote
  await diffLocalVsRemote();
}
