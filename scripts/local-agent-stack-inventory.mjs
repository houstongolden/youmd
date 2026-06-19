#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";

const home = os.homedir();
const repoRoot = process.cwd();
const now = new Date();

const outJson = path.join(repoRoot, "project-context", "local-agent-stack-inventory-2026-06-19.json");
const outHtml = path.join(repoRoot, "project-context", "local-agent-stack-inventory-2026-06-19.html");

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
  workspace: path.join(home, "Desktop", "CODE_2025"),
};

const skipDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  "target",
  "DerivedData",
  "Library",
  "Cache",
  "Caches",
  "CachedData",
]);

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

function relHome(p) {
  if (!p) return null;
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

function walk(root, predicate, options = {}) {
  const maxDepth = options.maxDepth ?? Infinity;
  const followSymlinks = options.followSymlinks ?? false;
  const seenDirs = new Set();
  const results = [];
  if (!exists(root)) return results;

  function visit(p, depth) {
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
    const realDir = realpathSafe(p);
    if (realDir) {
      if (seenDirs.has(realDir)) return;
      seenDirs.add(realDir);
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
  if (!exists(root)) return [];
  try {
    return fs.readdirSync(root).map((name) => {
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
  } catch {
    return [];
  }
}

function skillFiles(root) {
  return walk(root, (p, st) => st.isFile() && path.basename(p) === "SKILL.md").map((file) => {
    const dir = path.dirname(file);
    const name = path.basename(dir);
    const real = realpathSafe(file) || file;
    return {
      name,
      file,
      pathDisplay: relHome(file),
      realpath: relHome(real),
      sourceClass: classifyPath(real),
    };
  });
}

function directSkillRecords(root) {
  return directEntries(root)
    .filter((entry) => entry.hasSkill)
    .map((entry) => {
      const file = path.join(entry.path, "SKILL.md");
      const real = realpathSafe(file) || file;
      return {
        name: entry.name,
        file,
        pathDisplay: relHome(file),
        realpath: relHome(real),
        sourceClass: classifyPath(real),
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

function uniqueByName(items) {
  const map = new Map();
  for (const item of items) {
    const current = map.get(item.name);
    if (!current) {
      map.set(item.name, { name: item.name, paths: [item.pathDisplay], classes: [item.sourceClass] });
    } else {
      current.paths.push(item.pathDisplay);
      if (!current.classes.includes(item.sourceClass)) current.classes.push(item.sourceClass);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
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
    const parsed = yaml.load(fs.readFileSync(catalogPath, "utf8"));
    return { path: catalogPath, skills: Array.isArray(parsed?.skills) ? parsed.skills : [] };
  } catch {
    return { path: catalogPath, skills: [] };
  }
}

function collectProjectSignals() {
  const signals = walk(roots.workspace, (p, st) => {
    const base = path.basename(p);
    if (st.isDirectory() && base === "project-context") return true;
    if (st.isFile() && ["AGENTS.md", "CLAUDE.md", "youstack.json", ".youmd-project"].includes(base)) return true;
    return false;
  }, { maxDepth: 5 });

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
    youmdCatalogSkills: catalog.skills.length,
    youmdCatalogInstalled: catalog.skills.filter((s) => s.installed).length,
    missingFromYoumdCatalog: missingFromCatalog.length,
    catalogNotFoundInFilesystem: catalogNotFoundInFs.length,
    projectSignals: projectSignals.count,
  },
  hostSummaries,
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
  notes: [
    "Secret-safe inventory: file paths, filenames, counts, and symlink metadata only.",
    "youmd skill list reads ~/.youmd/skills/youmd-skills.yaml merged with CLI defaultSkills(); it does not crawl every host/global skill root.",
    "Top-level host entry counts and nested SKILL.md counts intentionally differ because stack roots such as gstack and scistack contain their own nested skills.",
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
  X -.not fully cataloged.-> L`;

const hostRows = summary.hostSummaries.map((h) => [
  esc(h.label),
  `<code>${esc(h.root)}</code>`,
  esc(h.directEntries),
  esc(h.directSkillEntries),
  esc(h.skillFiles),
  esc(h.symlinks),
  esc(h.brokenSymlinks),
  `<code>${esc(Object.entries(h.sourceClasses).map(([k, v]) => `${k}:${v}`).join(", ") || "-")}</code>`,
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
      ${numberCard("Project context signals", summary.totals.projectSignals, "AGENTS/CLAUDE/project-context/YouStack")}
      ${numberCard("Installed CLI", summary.versions.installedYoumd || "unknown", `repo ${summary.versions.repoPackage || "unknown"} / cli ${summary.versions.cliPackage || "unknown"}`)}
    </section>

    <div class="callout">
      <strong>Initial read:</strong> <code>youmd skill list</code> is not a full local skill inventory today. It reads <code>~/.youmd/skills/youmd-skills.yaml</code> plus the CLI's hard-coded default skills. The real machine has many more local/global skills exposed through Claude, Codex, GStack, SciStack, shared-agent symlinks, and plugin caches. Counts separate direct host exposure from canonical nested stack files so symlinks do not blur the map.
    </div>

    <h2>Topology</h2>
    <div class="diagram"><pre class="mermaid">${esc(mermaid)}</pre></div>

    <h2>Sync Roots</h2>
    ${table(["Root", "Path", "Top-level entries", "Direct skill entries", "Nested SKILL.md", "Symlinks", "Broken symlinks", "Source classes"], hostRows)}

    <h2>You.md Catalog</h2>
    <p>This is what <code>youmd skill list</code> sees today.</p>
    ${table(["Skill", "State", "Scope", "Source", "Description"], catalogRows)}

    <h2>Catalog Gap</h2>
    <p>Filesystem skills not currently represented in the You.md skill catalog. Showing up to 400 rows; full data is in JSON.</p>
    ${table(["Skill", "Classes", "Sample paths"], missingRows)}

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
