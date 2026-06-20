#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const home = os.homedir();
const repoRoot = process.cwd();
const now = new Date();

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir") opts.outDir = argv[++i];
    else if (arg === "--workspace") opts.workspace = argv[++i];
    else if (arg === "--date") opts.date = argv[++i];
    else if (arg === "--help" || arg === "-h") opts.help = true;
  }
  return opts;
}

const cli = parseArgs(process.argv.slice(2));
if (cli.help) {
  console.log(`Usage: node scripts/local-agent-stack-inventory.mjs [--out-dir DIR] [--workspace DIR] [--date YYYY-MM-DD]

Secret-safe inventory of Houston's local/global agent skills, prompts,
preferences, project context, host mirrors, and sync/catalog gaps.
`);
  process.exit(0);
}

const stamp = cli.date || now.toISOString().slice(0, 10);
const workspaceRoot = path.resolve(cli.workspace || path.join(home, "Desktop", "CODE_2025"));
const outDir = path.resolve(cli.outDir || path.join(repoRoot, "project-context"));
fs.mkdirSync(outDir, { recursive: true });

const outJson = path.join(outDir, `local-agent-stack-inventory-${stamp}.json`);
const outHtml = path.join(outDir, `local-agent-stack-inventory-${stamp}.html`);

const roots = {
  agentShared: path.join(home, ".agent-shared"),
  sharedSkills: path.join(home, ".agent-shared", "claude-skills"),
  sharedAgentConfig: path.join(home, ".agent-shared", "agent-config"),
  claudeSkills: path.join(home, ".claude", "skills"),
  claudeProjects: path.join(home, ".claude", "projects"),
  codexSkills: path.join(home, ".codex", "skills"),
  codexUpperSkills: path.join(home, ".Codex", "skills"),
  codexPluginSkills: path.join(home, ".codex", "plugins", "cache"),
  agentsSkills: path.join(home, ".agents", "skills"),
  cursorRoot: path.join(home, ".cursor"),
  piAgent: path.join(home, ".pi", "agent"),
  scienceStack: path.join(home, ".claude", "scistack"),
  gstack: path.join(home, ".claude", "skills", "gstack"),
  youmdHome: path.join(home, ".youmd"),
  youmdSkills: path.join(home, ".youmd", "skills"),
  workspace: workspaceRoot,
};

const skipDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  ".cache",
  ".gradle",
  ".idea",
  ".mypy_cache",
  ".parcel-cache",
  ".pnpm-store",
  ".pytest_cache",
  ".ruff_cache",
  ".serverless",
  ".venv",
  ".vscode",
  ".yarn",
  "__pycache__",
  "coverage",
  "dist",
  "build",
  "env",
  "logs",
  "Pods",
  ".turbo",
  "target",
  "tmp",
  "venv",
  "DerivedData",
  "Library",
  "Cache",
  "Caches",
  "CachedData",
]);

const projectSignalSkipDirs = new Set([
  ...skipDirs,
  ".agents",
  ".claude",
  ".codex",
  ".Codex",
  ".cursor",
  ".pi",
]);

const walkIssues = [];
const defaultWalkMaxEntries = Number.parseInt(process.env.YOUMD_AGENT_STACK_INVENTORY_WALK_MAX_ENTRIES || "200000", 10);
const defaultWalkMaxMs = Number.parseInt(process.env.YOUMD_AGENT_STACK_INVENTORY_WALK_MAX_MS || "10000", 10);
const directEntriesCache = new Map();
const skillFilesCache = new Map();

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function statSafe(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

function realpathSafe(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function readTextPrefix(p, max = 12000) {
  try {
    const fd = fs.openSync(p, "r");
    const buffer = Buffer.alloc(max);
    const bytes = fs.readSync(fd, buffer, 0, max, 0);
    fs.closeSync(fd);
    return buffer.subarray(0, bytes).toString("utf8");
  } catch {
    return "";
  }
}

function relHome(p) {
  if (!p) return null;
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

function walk(root, predicate, options = {}) {
  const maxDepth = options.maxDepth ?? Infinity;
  const followSymlinks = options.followSymlinks ?? false;
  const maxEntries = options.maxEntries ?? defaultWalkMaxEntries;
  const maxMs = options.maxMs ?? defaultWalkMaxMs;
  const deadline = Date.now() + maxMs;
  const seenDirs = new Set();
  const results = [];
  if (!exists(root)) return results;
  let visited = 0;
  let stoppedReason = null;

  function stop(reason) {
    if (stoppedReason) return;
    stoppedReason = reason;
    walkIssues.push({
      root: relHome(root),
      reason,
      visited,
      maxDepth: Number.isFinite(maxDepth) ? maxDepth : null,
      maxEntries,
      maxMs,
      partialResults: results.length,
    });
  }

  function visit(p, depth) {
    if (stoppedReason) return;
    visited += 1;
    if (visited > maxEntries) {
      stop("entry-limit");
      return;
    }
    if (Date.now() > deadline) {
      stop("time-limit");
      return;
    }
    const st = statSafe(p);
    if (!st) return;
    if (predicate(p, st)) results.push(p);
    if (depth >= maxDepth) return;

    let dirSt = st;
    if (st.isSymbolicLink()) {
      if (!followSymlinks) return;
      try {
        dirSt = fs.statSync(p);
      } catch {
        return;
      }
    }
    if (!dirSt.isDirectory()) return;
    if (followSymlinks) {
      const realDir = realpathSafe(p);
      if (realDir) {
        if (seenDirs.has(realDir)) return;
        seenDirs.add(realDir);
      }
    }

    let entries = [];
    try {
      entries = fs.readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
      visit(path.join(p, entry.name), depth + 1);
    }
  }

  visit(root, 0);
  return results;
}

function countFiles(root, matcher, options = {}) {
  return walk(root, (p, st) => st.isFile() && matcher(p), options).length;
}

function directEntries(root) {
  if (directEntriesCache.has(root)) return directEntriesCache.get(root);
  if (!exists(root)) return [];
  try {
    const entries = fs.readdirSync(root).map((name) => {
      const full = path.join(root, name);
      const st = statSafe(full);
      const isSymlink = Boolean(st?.isSymbolicLink());
      const target = isSymlink ? fs.readlinkSync(full) : null;
      const real = realpathSafe(full);
      const hasSkill = exists(path.join(full, "SKILL.md"));
      return {
        name,
        path: full,
        pathDisplay: relHome(full),
        kind: isSymlink ? "symlink" : st?.isDirectory() ? "directory" : st?.isFile() ? "file" : "other",
        target: target ? relHome(path.resolve(path.dirname(full), target)) : null,
        realpath: relHome(real),
        hasSkill,
      };
    });
    directEntriesCache.set(root, entries);
    return entries;
  } catch {
    return [];
  }
}

function skillFiles(root) {
  if (skillFilesCache.has(root)) return skillFilesCache.get(root);
  const skills = walk(root, (p, st) => st.isFile() && path.basename(p) === "SKILL.md").map((file) => {
    const dir = path.dirname(file);
    const name = path.basename(dir);
    const real = realpathSafe(file) || file;
    const classification = classifySkill(file, real);
    return {
      name,
      file,
      pathDisplay: relHome(file),
      realpath: relHome(real),
      sourceClass: classification.sourceClass,
      ownerClass: classification.ownerClass,
      provenance: classification.provenance,
      syncPolicy: classification.syncPolicy,
    };
  });
  skillFilesCache.set(root, skills);
  return skills;
}

function directSkillRecords(root) {
  return directEntries(root)
    .filter((entry) => entry.hasSkill)
    .map((entry) => {
      const file = path.join(entry.path, "SKILL.md");
      const real = realpathSafe(file) || file;
      const classification = classifySkill(file, real);
      return {
        name: entry.name,
        file,
        pathDisplay: relHome(file),
        realpath: relHome(real),
        sourceClass: classification.sourceClass,
        ownerClass: classification.ownerClass,
        provenance: classification.provenance,
        syncPolicy: classification.syncPolicy,
        exposureKind: entry.kind,
      };
    });
}

function classifyPath(p) {
  if (!p) return "unknown";
  if (p.startsWith(roots.agentShared)) return "agent-shared";
  if (p.startsWith(roots.scienceStack)) return "scistack";
  if (p.startsWith(roots.gstack)) return "gstack";
  if (p.startsWith(roots.youmdSkills)) return "youmd-catalog";
  if (p.startsWith(path.join(home, ".codex", "plugins", "cache"))) return "codex-plugin-cache";
  if (p.startsWith(path.join(home, ".codex", "skills"))) return "codex-host";
  if (p.startsWith(path.join(home, ".claude", "skills"))) return "claude-host";
  if (p.startsWith(path.join(home, ".agents", "skills"))) return "agents-host";
  return "other";
}

function classifySkill(file, real) {
  const sourceClass = classifyPath(real);
  const text = readTextPrefix(file, 10000).toLowerCase();
  let ownerClass = "unknown";
  let provenance = "unknown";
  let syncPolicy = "review-before-sync";

  if (real.startsWith(roots.sharedSkills)) {
    ownerClass = "houston-owned-shared";
    provenance = "canonical ~/.agent-shared";
    syncPolicy = "syncable-canonical";
  } else if (real.startsWith(roots.scienceStack)) {
    if (real.includes("/extensions/")) {
      ownerClass = "external-science-extension";
      provenance = "SciStack opt-in upstream extension";
      syncPolicy = "catalog-as-external-reference";
    } else {
      ownerClass = "houston-owned-science";
      provenance = "SciStack/HubStack/AstroStack canonical";
      syncPolicy = "syncable-canonical-with-namespace";
    }
  } else if (real.startsWith(roots.gstack)) {
    ownerClass = "gstack-managed-reference";
    provenance = "GStack local reference stack";
    syncPolicy = "catalog-as-external-reference";
  } else if (real.startsWith(roots.youmdSkills)) {
    ownerClass = "youmd-catalog-cache";
    provenance = "You.md local skill catalog";
    syncPolicy = "already-cataloged-or-cache";
  } else if (real.startsWith(roots.codexPluginSkills)) {
    ownerClass = "plugin-bundled";
    provenance = "Codex/OpenAI plugin cache";
    syncPolicy = "catalog-as-plugin-reference";
  } else if (real.startsWith(roots.agentsSkills) && text.includes("skills.sh")) {
    ownerClass = "public-marketplace-helper";
    provenance = "skills.sh referenced helper";
    syncPolicy = "catalog-as-public-source-reference";
  } else if (real.startsWith(roots.agentsSkills)) {
    ownerClass = "agent-host-local";
    provenance = ".agents host-local skill";
    syncPolicy = "review-before-sync";
  } else if (sourceClass.endsWith("-host")) {
    ownerClass = "host-local-or-mirror";
    provenance = "agent host exposure root";
    syncPolicy = "resolve-canonical-owner-first";
  }

  if (text.includes("clawhub.ai")) provenance = "clawhub.ai referenced";
  if (text.includes("skills.sh")) provenance = "skills.sh referenced";
  if (text.includes("github.com")) provenance = provenance === "unknown" ? "GitHub referenced" : provenance;

  return { sourceClass, ownerClass, provenance, syncPolicy };
}

function uniqueByName(items) {
  const map = new Map();
  for (const item of items) {
    const current = map.get(item.name);
    if (!current) {
      map.set(item.name, {
        name: item.name,
        paths: [item.pathDisplay],
        realpaths: [item.realpath],
        classes: [item.sourceClass],
        ownerClasses: [item.ownerClass],
        provenances: [item.provenance],
        syncPolicies: [item.syncPolicy],
      });
    } else {
      current.paths.push(item.pathDisplay);
      if (!current.realpaths.includes(item.realpath)) current.realpaths.push(item.realpath);
      if (!current.classes.includes(item.sourceClass)) current.classes.push(item.sourceClass);
      if (!current.ownerClasses.includes(item.ownerClass)) current.ownerClasses.push(item.ownerClass);
      if (!current.provenances.includes(item.provenance)) current.provenances.push(item.provenance);
      if (!current.syncPolicies.includes(item.syncPolicy)) current.syncPolicies.push(item.syncPolicy);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function rollup(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildDryAudit(records, catalogNameSet) {
  const groups = new Map();
  for (const record of records) {
    const group = groups.get(record.name) || [];
    group.push(record);
    groups.set(record.name, group);
  }

  const duplicateNames = [];
  const mirrors = [];
  const ownedPriority = [];
  for (const [name, group] of groups.entries()) {
    const realpaths = [...new Set(group.map((item) => item.realpath))];
    const owners = [...new Set(group.map((item) => item.ownerClass))];
    const policies = [...new Set(group.map((item) => item.syncPolicy))];
    const row = {
      name,
      occurrences: group.length,
      realpathCount: realpaths.length,
      owners,
      policies,
      cataloged: catalogNameSet.has(name),
      samplePaths: group.map((item) => item.pathDisplay).slice(0, 8),
    };

    if (owners.some((owner) => owner.startsWith("houston-owned"))) ownedPriority.push(row);
    if (realpaths.length === 1 && group.length > 1) mirrors.push(row);
    if (realpaths.length > 1) duplicateNames.push({
      ...row,
      risk: owners.some((owner) => owner.startsWith("houston-owned"))
        ? "review-only-owned-priority"
        : "possible-redundancy-review",
    });
  }

  return {
    duplicateNameDifferentRealpaths: duplicateNames.sort((a, b) => b.realpathCount - a.realpathCount || a.name.localeCompare(b.name)),
    sameRealpathMirrors: mirrors.sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name)),
    ownedPrioritySkills: ownedPriority.sort((a, b) => a.name.localeCompare(b.name)),
    guidance: [
      "Never auto-delete Houston-owned shared, science, or heavily modified skills.",
      "Same-name/different-realpath rows are review queues, not deletion instructions.",
      "Same-realpath mirrors are usually healthy host exposure, not duplication.",
      "Public or plugin skills should be cataloged as external references unless intentionally forked.",
    ],
  };
}

function getCommand(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function readSkillCatalog() {
  const catalogPath = path.join(roots.youmdSkills, "youmd-skills.yaml");
  if (!exists(catalogPath)) return { path: catalogPath, skills: [] };
  try {
    const raw = fs.readFileSync(catalogPath, "utf8");
    const skills = [];
    let current = null;
    let activeArray = null;
    for (const line of raw.split(/\r?\n/)) {
      const nameMatch = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
      if (nameMatch) {
        if (current) skills.push(current);
        current = { name: unquoteYaml(nameMatch[1]), identity_fields: [], requires: [] };
        activeArray = null;
        continue;
      }
      if (!current) continue;
      const scalar = line.match(/^\s{4}([a-zA-Z_]+):\s*(.*?)\s*$/);
      if (scalar) {
        const [, key, value] = scalar;
        if (value === "[]") {
          current[key] = [];
          activeArray = null;
        } else if (value === "") {
          current[key] = [];
          activeArray = key;
        } else {
          current[key] = key === "installed" ? value === "true" : unquoteYaml(value);
          activeArray = null;
        }
        continue;
      }
      const arrayItem = line.match(/^\s{6}-\s+(.+?)\s*$/);
      if (arrayItem && activeArray) {
        current[activeArray].push(unquoteYaml(arrayItem[1]));
      }
    }
    if (current) skills.push(current);
    return { path: catalogPath, skills };
  } catch {
    return { path: catalogPath, skills: [] };
  }
}

function unquoteYaml(value) {
  const trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function collectProjectSignals() {
  const signals = [];
  const maxDepth = 5;
  const maxEntries = defaultWalkMaxEntries;
  const maxMs = 30000;
  const deadline = Date.now() + maxMs;
  const queue = [{ dir: roots.workspace, depth: 0 }];
  let visited = 0;
  let stoppedReason = null;

  while (queue.length > 0 && !stoppedReason) {
    const { dir, depth } = queue.shift();
    visited += 1;
    if (visited > maxEntries) {
      stoppedReason = "entry-limit";
      break;
    }
    if (Date.now() > deadline) {
      stoppedReason = "time-limit";
      break;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "project-context") signals.push(full);
        if (depth < maxDepth && !projectSignalSkipDirs.has(entry.name)) {
          queue.push({ dir: full, depth: depth + 1 });
        }
        continue;
      }
      if (entry.isFile() && ["AGENTS.md", "CLAUDE.md", "youstack.json", ".youmd-project"].includes(entry.name)) {
        signals.push(full);
      }
    }
  }

  if (stoppedReason) {
    walkIssues.push({
      root: relHome(roots.workspace),
      reason: `project-signals-${stoppedReason}`,
      visited,
      maxDepth,
      maxEntries,
      maxMs,
      partialResults: signals.length,
    });
  }

  const buckets = { agents: 0, claude: 0, projectContext: 0, youstack: 0, youmdProject: 0 };
  for (const p of signals) {
    const base = path.basename(p);
    if (base === "AGENTS.md") buckets.agents += 1;
    if (base === "CLAUDE.md") buckets.claude += 1;
    if (base === "project-context") buckets.projectContext += 1;
    if (base === "youstack.json") buckets.youstack += 1;
    if (base === ".youmd-project") buckets.youmdProject += 1;
  }
  return { count: signals.length, buckets, sample: signals.slice(0, 160).map(relHome) };
}

function linkStatus() {
  const expected = [
    [path.join(home, ".claude", "CLAUDE.md"), path.join(home, ".agent-shared", "AGENTS.md")],
    [path.join(home, ".codex", "AGENTS.md"), path.join(home, ".agent-shared", "AGENTS.md")],
    [path.join(home, ".cursorrules"), path.join(home, ".agent-shared", "AGENTS.md")],
    [path.join(home, ".pi", "agent", "AGENTS.md"), path.join(home, ".agent-shared", "AGENTS.md")],
  ];
  return expected.map(([link, target]) => {
    const st = statSafe(link);
    const actual = st?.isSymbolicLink() ? path.resolve(path.dirname(link), fs.readlinkSync(link)) : null;
    return {
      link: relHome(link),
      target: relHome(target),
      ok: actual === target,
      actual: relHome(actual),
      kind: st?.isSymbolicLink() ? "symlink" : exists(link) ? "file" : "missing",
    };
  });
}

function gitInfo(root) {
  if (!exists(path.join(root, ".git"))) return null;
  return {
    branch: getCommand("git", ["-C", root, "branch", "--show-current"]),
    head: getCommand("git", ["-C", root, "rev-parse", "--short", "HEAD"]),
    dirty: Boolean(getCommand("git", ["-C", root, "status", "--short"])),
  };
}

const catalog = readSkillCatalog();
const directExposureSkillRecords = [
  ...directSkillRecords(roots.claudeSkills),
  ...directSkillRecords(roots.codexSkills),
  ...directSkillRecords(roots.codexUpperSkills),
  ...directSkillRecords(roots.agentsSkills),
  ...directSkillRecords(roots.youmdSkills),
];
const canonicalSkillFiles = [
  ...skillFiles(roots.sharedSkills),
  ...skillFiles(roots.scienceStack),
  ...skillFiles(roots.gstack),
  ...skillFiles(roots.codexPluginSkills),
  ...skillFiles(roots.youmdSkills),
];
const allSkillFiles = [
  ...directExposureSkillRecords,
  ...canonicalSkillFiles,
];
const uniqueSkills = uniqueByName(allSkillFiles);
const uniqueRealSkillFiles = new Set(allSkillFiles.map((item) => item.realpath || item.pathDisplay)).size;
const catalogNames = new Set(catalog.skills.map((s) => s.name));
const filesystemNames = new Set(uniqueSkills.map((s) => s.name));
const missingFromCatalog = uniqueSkills.filter((s) => !catalogNames.has(s.name));
const catalogNotFoundInFs = catalog.skills.filter((s) => !filesystemNames.has(s.name));
const dryAudit = buildDryAudit(allSkillFiles, catalogNames);

const hostRoots = [
  ["Claude host", roots.claudeSkills],
  ["Codex host", roots.codexSkills],
  ["Codex app host", roots.codexUpperSkills],
  [".agents host", roots.agentsSkills],
  ["You.md catalog cache", roots.youmdSkills],
  ["Shared canonical", roots.sharedSkills],
  ["SciStack canonical", roots.scienceStack],
  ["GStack root", roots.gstack],
  ["Codex plugin cache", roots.codexPluginSkills],
];

const hostSummaries = hostRoots.map(([label, root]) => {
  const direct = directEntries(root);
  const skills = skillFiles(root);
  return {
    label,
    root: relHome(root),
    exists: exists(root),
    directEntries: direct.length,
    directSkillEntries: direct.filter((entry) => entry.hasSkill).length,
    skillFiles: skills.length,
    symlinks: direct.filter((entry) => entry.kind === "symlink").length,
    brokenSymlinks: direct.filter((entry) => entry.kind === "symlink" && !exists(entry.path)).length,
    sourceClasses: skills.reduce((acc, item) => {
      acc[item.sourceClass] = (acc[item.sourceClass] || 0) + 1;
      return acc;
    }, {}),
    ownerClasses: rollup(skills, "ownerClass"),
    syncPolicies: rollup(skills, "syncPolicy"),
    sampleEntries: direct.slice(0, 80).map((entry) => ({
      name: entry.name,
      kind: entry.kind,
      target: entry.target,
      hasSkill: entry.hasSkill,
    })),
  };
});

const promptContext = {
  youmdIdentityFiles: {
    profile: countFiles(path.join(roots.youmdHome, "profile"), (p) => p.endsWith(".md")),
    preferences: countFiles(path.join(roots.youmdHome, "preferences"), (p) => p.endsWith(".md")),
    voice: countFiles(path.join(roots.youmdHome, "voice"), (p) => p.endsWith(".md")),
    directives: countFiles(path.join(roots.youmdHome, "directives"), (p) => p.endsWith(".md")),
    private: countFiles(path.join(roots.youmdHome, "private"), (p) => p.endsWith(".md")),
  },
  youmdLogs: countFiles(path.join(roots.youmdHome, "logs"), () => true, { maxDepth: 1 }),
  machineReports: countFiles(path.join(roots.youmdHome, "machine-reports"), (p) => p.endsWith(".json"), { maxDepth: 1 }),
  claudeProjectMemories: walk(roots.claudeProjects, (p, st) => st.isFile() && /(^memory$|MEMORY\.md$)/.test(path.basename(p)), { maxDepth: 4 }).length,
  codexJsonlLower: countFiles(path.join(home, ".codex", "projects"), (p) => p.endsWith(".jsonl")),
  codexJsonlUpper: countFiles(path.join(home, ".Codex", "projects"), (p) => p.endsWith(".jsonl")),
  codexAutomationMemories: countFiles(path.join(home, ".codex", "automations"), (p) => path.basename(p) === "memory.md"),
  cursorPlans: countFiles(path.join(home, ".cursor", "plans"), (p) => p.endsWith(".md"), { maxDepth: 1 }),
  cursorBrowserLogs: countFiles(path.join(home, ".cursor", "browser-logs"), (p) => p.endsWith(".log"), { maxDepth: 1 }),
  cursorAgentTranscripts: countFiles(path.join(home, ".cursor", "projects"), (p) => p.includes("agent-transcripts")),
};

const projectSignals = collectProjectSignals();
const localPackage = readJsonSafe(path.join(repoRoot, "cli", "package.json")) || readJsonSafe(path.join(repoRoot, "package.json"));
const rootPackage = readJsonSafe(path.join(repoRoot, "package.json"));
const machineReport = readJsonSafe(path.join(roots.youmdHome, "machine-reports", "latest.json"));
const installedYoumdVersion = getCommand("youmd", ["--version"]);

const summary = {
  generatedAt: now.toISOString(),
  host: os.hostname(),
  repoRoot,
  roots: Object.fromEntries(Object.entries(roots).map(([key, value]) => [key, relHome(value)])),
  versions: {
    installedYoumd: installedYoumdVersion,
    repoPackage: rootPackage?.version || null,
    cliPackage: localPackage?.version || null,
    node: process.version,
  },
  git: {
    youmd: gitInfo(repoRoot),
    agentShared: gitInfo(roots.agentShared),
  },
  totals: {
    uniqueSkillNames: uniqueSkills.length,
    skillFileOccurrences: allSkillFiles.length,
    uniqueRealSkillFiles,
    directExposureSkillRecords: directExposureSkillRecords.length,
    canonicalSkillFiles: canonicalSkillFiles.length,
    duplicateNameDifferentRealpaths: dryAudit.duplicateNameDifferentRealpaths.length,
    sameRealpathMirrors: dryAudit.sameRealpathMirrors.length,
    youmdCatalogSkills: catalog.skills.length,
    youmdCatalogInstalled: catalog.skills.filter((s) => s.installed).length,
    missingFromYoumdCatalog: missingFromCatalog.length,
    catalogNotFoundInFilesystem: catalogNotFoundInFs.length,
    projectSignals: projectSignals.count,
  },
  hostSummaries,
  ownershipRollup: rollup(allSkillFiles, "ownerClass"),
  syncPolicyRollup: rollup(allSkillFiles, "syncPolicy"),
  provenanceRollup: rollup(allSkillFiles, "provenance"),
  dryAudit,
  catalog: {
    path: relHome(catalog.path),
    skills: catalog.skills.map((s) => ({
      name: s.name,
      source: s.source,
      scope: s.scope,
      installed: s.installed,
      description: s.description,
    })),
  },
  missingFromCatalog: missingFromCatalog.map((s) => ({
    name: s.name,
    classes: s.classes,
    ownerClasses: s.ownerClasses,
    provenances: s.provenances,
    syncPolicies: s.syncPolicies,
    samplePaths: s.paths.slice(0, 6),
  })),
  catalogNotFoundInFilesystem: catalogNotFoundInFs.map((s) => s.name),
  uniqueSkills,
  promptContext,
  projectSignals,
  symlinkStatus: linkStatus(),
  machineReport: machineReport ? {
    status: machineReport.status || machineReport.overallStatus || null,
    host: machineReport.host || machineReport.hostname || null,
    generatedAt: machineReport.generatedAt || machineReport.createdAt || null,
    totals: machineReport.totals || null,
    secretValuesExposed: machineReport.secretValuesExposed === true,
  } : null,
  walkIssues,
  notes: [
    "Secret-safe inventory: file paths, filenames, counts, and symlink metadata only.",
    "youmd skill list reads ~/.youmd/skills/youmd-skills.yaml merged with CLI defaultSkills(); it does not crawl every host/global skill root.",
    "Top-level host entry counts and nested SKILL.md counts intentionally differ because stack roots such as gstack and scistack contain their own nested skills.",
    "DRY audit rows are review queues. The scanner never recommends deleting Houston-owned skills automatically.",
    "If walkIssues is non-empty, the inventory is intentionally partial for the listed roots to keep install-time scans bounded.",
  ],
};

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberCard(label, value, detail = "") {
  return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></div>`;
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

const mermaid = `flowchart TB
  subgraph Canonical["Canonical sources"]
    A["~/.agent-shared\\nAGENTS.md, preferences, STACK-MAP\\n${summary.hostSummaries.find((h) => h.label === "Shared canonical")?.skillFiles || 0} shared SKILL.md"]
    S["~/.claude/scistack\\nHubStack + AstroStack + opt-in extensions\\n${summary.hostSummaries.find((h) => h.label === "SciStack canonical")?.skillFiles || 0} SKILL.md"]
    G["~/.claude/skills/gstack\\nGStack reference stack\\n${summary.hostSummaries.find((h) => h.label === "GStack root")?.skillFiles || 0} SKILL.md"]
    Y["~/.youmd\\nidentity, preferences, directives, private notes\\n${summary.totals.youmdCatalogSkills} catalog skills"]
  end
  subgraph Hosts["Agent exposure hosts"]
    C["Claude Code\\n~/.claude/skills\\n${summary.hostSummaries.find((h) => h.label === "Claude host")?.directEntries || 0} top-level entries"]
    X["Codex\\n~/.codex/skills\\n${summary.hostSummaries.find((h) => h.label === "Codex host")?.directEntries || 0} top-level entries"]
    D["Codex app\\n~/.Codex/skills\\n${summary.hostSummaries.find((h) => h.label === "Codex app host")?.directEntries || 0} top-level entries"]
    R["Cursor\\n~/.cursorrules + ~/.cursor plans/projects\\n${summary.promptContext.cursorPlans} plan prompts"]
    P["Pi / .agents\\n~/.agents/skills\\n${summary.hostSummaries.find((h) => h.label === ".agents host")?.directEntries || 0} top-level entries"]
  end
  subgraph Youmd["You.md sync layer"]
    L["youmd skill list\\n${summary.totals.youmdCatalogSkills} cataloged skills"]
    M["resident daemons\\nidentity + skillstack + project-context"]
    B["You.md API/MCP/account sync\\nremote is ${esc(summary.versions.installedYoumd || "unknown")} local CLI"]
  end
  subgraph Analysis["Inventory intelligence"]
    O["Ownership rollup\\nowned vs external vs plugin"]
    Q["DRY audit\\nreview queues, no auto-delete"]
    V["Future app view\\nConvex + username-you-md repo"]
  end
  A --> C
  A --> X
  A --> R
  A --> P
  S --> C
  S --> X
  G --> C
  G --> X
  Y --> L
  L --> B
  M --> B
  C -.not fully cataloged.-> L
  X -.not fully cataloged.-> L
  C --> O
  X --> O
  O --> Q
  Q --> V`;

const hostRows = summary.hostSummaries.map((h) => [
  esc(h.label),
  `<code>${esc(h.root)}</code>`,
  esc(h.directEntries),
  esc(h.directSkillEntries),
  esc(h.skillFiles),
  esc(h.symlinks),
  esc(h.brokenSymlinks),
  `<code>${esc(Object.entries(h.sourceClasses).map(([k, v]) => `${k}:${v}`).join(", ") || "-")}</code>`,
  `<code>${esc(Object.entries(h.ownerClasses).map(([k, v]) => `${k}:${v}`).join(", ") || "-")}</code>`,
  `<code>${esc(Object.entries(h.syncPolicies).map(([k, v]) => `${k}:${v}`).join(", ") || "-")}</code>`,
]);

const catalogRows = summary.catalog.skills.map((s) => [
  `<code>${esc(s.name)}</code>`,
  esc(s.installed ? "installed" : "available"),
  esc(s.scope),
  `<code>${esc(s.source)}</code>`,
  esc(s.description),
]);

const missingRows = summary.missingFromCatalog.slice(0, 400).map((s) => [
  `<code>${esc(s.name)}</code>`,
  `<code>${esc(s.classes.join(", "))}</code>`,
  `<code>${esc(s.ownerClasses.join(", "))}</code>`,
  `<code>${esc(s.syncPolicies.join(", "))}</code>`,
  `<code>${esc(s.samplePaths.join("\\n"))}</code>`,
]);

const rollupRows = Object.entries(summary.ownershipRollup)
  .sort((a, b) => b[1] - a[1])
  .map(([key, value]) => [esc(key), esc(value)]);

const policyRows = Object.entries(summary.syncPolicyRollup)
  .sort((a, b) => b[1] - a[1])
  .map(([key, value]) => [esc(key), esc(value)]);

const duplicateRows = summary.dryAudit.duplicateNameDifferentRealpaths.slice(0, 160).map((s) => [
  `<code>${esc(s.name)}</code>`,
  esc(s.realpathCount),
  esc(s.occurrences),
  `<code>${esc(s.owners.join(", "))}</code>`,
  `<code>${esc(s.risk)}</code>`,
  `<code>${esc(s.samplePaths.join("\\n"))}</code>`,
]);

const mirrorRows = summary.dryAudit.sameRealpathMirrors.slice(0, 160).map((s) => [
  `<code>${esc(s.name)}</code>`,
  esc(s.occurrences),
  `<code>${esc(s.owners.join(", "))}</code>`,
  `<code>${esc(s.samplePaths.join("\\n"))}</code>`,
]);

const linkRows = summary.symlinkStatus.map((s) => [
  `<code>${esc(s.link)}</code>`,
  esc(s.kind),
  esc(s.ok ? "ok" : "check"),
  `<code>${esc(s.actual || "-")}</code>`,
  `<code>${esc(s.target)}</code>`,
]);

const promptRows = Object.entries(summary.promptContext).map(([key, value]) => [
  esc(key),
  typeof value === "object" ? `<code>${esc(JSON.stringify(value))}</code>` : esc(value),
]);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>You.md Local Agent Stack Inventory</title>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "loose" });
  </script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d0d0d;
      --panel: #151312;
      --line: #37312d;
      --text: #f2eee9;
      --muted: #a69b93;
      --accent: #c46a3a;
      --ok: #6fbf73;
      --warn: #d6a84f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.55 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    header, main { max-width: 1240px; margin: 0 auto; padding: 28px; }
    header { border-bottom: 1px solid var(--line); }
    h1, h2, h3, code, th, .metric strong { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
    h1 { margin: 0 0 10px; font-size: clamp(26px, 4vw, 44px); font-weight: 500; letter-spacing: 0; }
    h2 { margin: 42px 0 14px; font-size: 19px; font-weight: 500; color: var(--accent); }
    h3 { margin: 26px 0 10px; font-size: 15px; font-weight: 500; color: var(--text); }
    p { color: var(--muted); max-width: 920px; }
    a { color: var(--accent); }
    code {
      color: #f6d0bd;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin: 22px 0;
    }
    .metric {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 2px;
      padding: 14px;
      min-height: 108px;
    }
    .metric span, .metric small { display: block; color: var(--muted); }
    .metric strong { display: block; margin: 8px 0 3px; font-size: 28px; font-weight: 500; color: var(--text); }
    .callout {
      border-left: 2px solid var(--accent);
      background: #17110e;
      padding: 14px 16px;
      color: var(--muted);
      margin: 18px 0;
    }
    .diagram {
      border: 1px solid var(--line);
      background: #111;
      border-radius: 2px;
      padding: 14px;
      overflow-x: auto;
    }
    .two-col {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 14px;
      align-items: start;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--line);
      margin: 12px 0 26px;
      background: var(--panel);
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0;
      font-weight: 500;
    }
    tr:last-child td { border-bottom: 0; }
    details {
      border: 1px solid var(--line);
      border-radius: 2px;
      background: var(--panel);
      padding: 12px 14px;
      margin: 12px 0;
    }
    summary { cursor: pointer; color: var(--accent); font-family: "JetBrains Mono", ui-monospace, monospace; }
    .status-ok { color: var(--ok); }
    .status-warn { color: var(--warn); }
  </style>
</head>
<body>
  <header>
    <h1>You.md Local Agent Stack Inventory</h1>
    <p>Generated ${esc(summary.generatedAt)} on <code>${esc(summary.host)}</code>. Secret-safe snapshot of local/global skills, host exposure roots, shared prompts/preferences, project context, logs, and You.md catalog coverage.</p>
    <p>Companion JSON: <code>${esc(relHome(outJson))}</code></p>
  </header>
  <main>
    <section class="grid">
      ${numberCard("Unique skill names found", summary.totals.uniqueSkillNames, "across catalog + host + stack roots")}
      ${numberCard("Unique real SKILL.md files", summary.totals.uniqueRealSkillFiles, "deduped by realpath")}
      ${numberCard("Exposure + canonical records", summary.totals.skillFileOccurrences, `${summary.totals.directExposureSkillRecords} host exposures + ${summary.totals.canonicalSkillFiles} canonical files`)}
      ${numberCard("You.md catalog", `${summary.totals.youmdCatalogInstalled}/${summary.totals.youmdCatalogSkills}`, "installed / cataloged")}
      ${numberCard("Missing from catalog", summary.totals.missingFromYoumdCatalog, "filesystem skills not represented in youmd skill list")}
      ${numberCard("Duplicate-name risks", summary.totals.duplicateNameDifferentRealpaths, "same name, different real files")}
      ${numberCard("Healthy mirrors", summary.totals.sameRealpathMirrors, "same real file exposed to hosts")}
      ${numberCard("Project context signals", summary.totals.projectSignals, "AGENTS/CLAUDE/project-context/YouStack")}
      ${numberCard("Installed CLI", summary.versions.installedYoumd || "unknown", `repo ${summary.versions.repoPackage || "unknown"} / cli ${summary.versions.cliPackage || "unknown"}`)}
    </section>

    <div class="callout">
      <strong>Initial read:</strong> <code>youmd skill list</code> is not a full local skill inventory today. It reads <code>~/.youmd/skills/youmd-skills.yaml</code> plus the CLI's hard-coded default skills. The real machine has many more local/global skills exposed through Claude, Codex, GStack, SciStack, shared-agent symlinks, and plugin caches. Counts separate direct host exposure from canonical nested stack files so symlinks do not blur the map.
    </div>

    <h2>Topology</h2>
    <div class="diagram"><pre class="mermaid">${esc(mermaid)}</pre></div>

    <h2>Sync Roots</h2>
    ${table(["Root", "Path", "Top-level entries", "Direct skill entries", "Nested SKILL.md", "Symlinks", "Broken symlinks", "Source classes", "Owner classes", "Sync policies"], hostRows)}

    <h2>Ownership</h2>
    <p>Owned skills should be protected and made canonical; external/reference/plugin skills should be cataloged with provenance instead of copied into the personal stack blindly.</p>
    <div class="two-col">
      <div>${table(["Owner class", "Records"], rollupRows)}</div>
      <div>${table(["Sync policy", "Records"], policyRows)}</div>
    </div>

    <h2>DRY Audit</h2>
    <div class="callout">
      These are review queues, not destructive instructions. Same-realpath mirrors usually mean healthy host exposure. Same-name/different-realpath rows need a human/agent decision, and Houston-owned skills win priority over public or plugin versions.
    </div>
    <h3>Same Name, Different Real Files</h3>
    ${table(["Skill", "Real files", "Occurrences", "Owners", "Risk", "Sample paths"], duplicateRows)}
    <h3>Same Real File Mirrored Across Hosts</h3>
    ${table(["Skill", "Occurrences", "Owners", "Sample paths"], mirrorRows)}

    <h2>You.md Catalog</h2>
    <p>This is what <code>youmd skill list</code> sees today.</p>
    ${table(["Skill", "State", "Scope", "Source", "Description"], catalogRows)}

    <h2>Catalog Gap</h2>
    <p>Filesystem skills not currently represented in the You.md skill catalog. Showing up to 400 rows; full data is in JSON.</p>
    ${table(["Skill", "Classes", "Owners", "Sync policies", "Sample paths"], missingRows)}

    <h2>Shared Instructions Symlinks</h2>
    ${table(["Link", "Kind", "Status", "Actual target", "Expected target"], linkRows)}

    <h2>Prompts, Preferences, Memory, Logs</h2>
    ${table(["Bucket", "Count / summary"], promptRows)}

    <h2>Project Context Coverage</h2>
    <p>Workspace scan under <code>${esc(relHome(roots.workspace))}</code>: ${esc(JSON.stringify(summary.projectSignals.buckets))}</p>
    <details>
      <summary>Show sampled project context paths</summary>
      <pre><code>${esc(summary.projectSignals.sample.join("\\n"))}</code></pre>
    </details>

    <h2>Machine Proof</h2>
    <pre><code>${esc(JSON.stringify(summary.machineReport, null, 2))}</code></pre>

    <h2>Traversal Guardrails</h2>
    <p>Install-time scans are bounded so one huge local tree cannot hang machine setup.</p>
    <pre><code>${esc(JSON.stringify(summary.walkIssues, null, 2))}</code></pre>

    <h2>Notes</h2>
    <ul>
      ${summary.notes.map((note) => `<li>${esc(note)}</li>`).join("")}
    </ul>
  </main>
</body>
</html>`;

fs.writeFileSync(outJson, JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(outHtml, html);

console.log(JSON.stringify({
  html: outHtml,
  json: outJson,
  totals: summary.totals,
  installedYoumdVersion: summary.versions.installedYoumd,
}, null, 2));
