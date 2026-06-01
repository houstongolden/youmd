#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceRoot = path.join(rootDir, ".reference-repos");
const outputDir = path.join(rootDir, "project-context", "reference-intelligence");
const statePath = path.join(rootDir, ".reference-repos", "state.json");
const now = new Date();

const repos = [
  {
    id: "gstack",
    name: "GStack",
    url: "https://github.com/garrytan/gstack.git",
    localDir: path.join(referenceRoot, "garrytan", "gstack"),
    youmdSurface: "YouStacks",
  },
  {
    id: "gbrain",
    name: "GBrain",
    url: "https://github.com/garrytan/gbrain.git",
    localDir: path.join(referenceRoot, "garrytan", "gbrain"),
    youmdSurface: "You.md brain/context/memory",
  },
  {
    id: "agent-scripts",
    name: "Agent Scripts",
    url: "https://github.com/steipete/agent-scripts.git",
    localDir: path.join(referenceRoot, "steipete", "agent-scripts"),
    youmdSurface: "YouStacks shared agent runtime",
  },
  {
    id: "the-library",
    name: "The Library",
    url: "https://github.com/disler/the-library.git",
    localDir: path.join(referenceRoot, "disler", "the-library"),
    youmdSurface: "YouStacks catalog/distribution",
  },
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || rootDir,
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
  }).trim();
}

function readJson(filePath, fallback) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function ensureRepo(repo) {
  mkdirSync(path.dirname(repo.localDir), { recursive: true });
  if (!existsSync(path.join(repo.localDir, ".git"))) {
    run("git", ["clone", "--depth", "80", repo.url, repo.localDir]);
  } else {
    run("git", ["fetch", "--prune", "--tags", "--depth", "80", "origin"], { cwd: repo.localDir });
  }

  const remoteHead = getRemoteHead(repo.localDir);
  run("git", ["checkout", "--quiet", remoteHead], { cwd: repo.localDir });
  run("git", ["pull", "--ff-only", "--quiet"], { cwd: repo.localDir });

  return {
    remoteHead,
    commit: run("git", ["rev-parse", "HEAD"], { cwd: repo.localDir }),
  };
}

function getRemoteHead(repoDir) {
  try {
    const ref = run("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"], { cwd: repoDir, quiet: true });
    return ref.replace(/^origin\//, "");
  } catch {
    const branches = run("git", ["branch", "-r", "--format", "%(refname:short)"], { cwd: repoDir, quiet: true })
      .split("\n")
      .map((line) => line.trim().replace(/^origin\//, ""))
      .filter(Boolean);
    return branches.includes("main") ? "main" : branches.includes("master") ? "master" : branches[0];
  }
}

function canUseRange(repoDir, previousCommit, currentCommit) {
  if (!previousCommit || previousCommit === currentCommit) return false;
  try {
    run("git", ["merge-base", "--is-ancestor", previousCommit, currentCommit], { cwd: repoDir, quiet: true });
    return true;
  } catch {
    return false;
  }
}

function getCommits(repo, previousCommit, currentCommit) {
  if (previousCommit && previousCommit === currentCommit) return [];
  const rangeArgs = canUseRange(repo.localDir, previousCommit, currentCommit)
    ? [`${previousCommit}..${currentCommit}`]
    : ["-n", "12"];
  const raw = run(
    "git",
    ["log", "--date=short", "--pretty=format:%H%x09%ad%x09%s", ...rangeArgs],
    { cwd: repo.localDir, quiet: true }
  );
  if (!raw) return [];

  return raw.split("\n").filter(Boolean).map((line) => {
    const [hash, date, ...subjectParts] = line.split("\t");
    const filesRaw = run(
      "git",
      ["diff-tree", "--no-commit-id", "--name-only", "-r", hash],
      { cwd: repo.localDir, quiet: true }
    );
    return {
      hash,
      short: hash.slice(0, 7),
      date,
      subject: subjectParts.join("\t"),
      files: filesRaw.split("\n").map((file) => file.trim()).filter(Boolean),
    };
  });
}

function classifyTask(repo, commit) {
  const haystack = `${commit.subject} ${commit.files.join(" ")}`.toLowerCase();
  const source = `${repo.name} ${commit.short}: ${commit.subject}`;

  if (repo.id === "gstack") {
    if (/(skill|skill\.md|agent|subagent|agents\/|prompt)/.test(haystack)) {
      return task("YouStacks skill packaging", "Review whether this upstream skill/agent pattern should become a YouStack artifact, bundled skill, or adapter-generation rule.", source);
    }
    if (/(upgrade|install|setup|bin|script|sync|host|claude|codex|cursor)/.test(haystack)) {
      return task("YouStacks install/update flow", "Compare the upstream install, upgrade, host-linking, or sync behavior against `youmd stack link`, stack update policy, and docs quickstart.", source);
    }
    if (/(qa|review|ship|release|canary|benchmark|health|test|eval)/.test(haystack)) {
      return task("YouStacks workflow quality gates", "Consider adding or refining stack workflows, smoke tests, evals, or release-review loops based on this upstream quality pattern.", source);
    }
    if (/(browser|mcp|api|tool|server)/.test(haystack)) {
      return task("YouStacks API/MCP/tool boundary", "Check whether this upstream tool boundary should adjust YouStacks local-only vs shared You.md API/MCP thresholds.", source);
    }
  }

  if (repo.id === "gbrain") {
    if (/(memory|memories|brain|context|profile|identity|preference|directive)/.test(haystack)) {
      return task("You.md brain schema/context", "Review whether this upstream brain/context change should improve You.md memory categories, private context, profile files, or agent startup briefs.", source);
    }
    if (/(retriev|search|index|embed|vector|rank|query)/.test(haystack)) {
      return task("You.md retrieval layer", "Compare this retrieval/indexing signal against You.md memory search, project context search, and protected brain retrieval plans.", source);
    }
    if (/(sync|repo|git|migration|backup|export|import)/.test(haystack)) {
      return task("You.md brain sync", "Evaluate whether this upstream sync or migration pattern should change GitHub repo sync, local bundle export/import, or backup behavior.", source);
    }
    if (/(auth|token|secret|privacy|permission|grant|scope)/.test(haystack)) {
      return task("You.md brain privacy/grants", "Check whether this upstream auth/privacy pattern should tighten private context, stack grants, scoped tokens, or audit logs.", source);
    }
  }

  if (repo.id === "agent-scripts") {
    if (/(agents\.md|claude|codex|cursor|global|pointer|downstream|routing)/.test(haystack)) {
      return task("Cross-agent instruction portability", "Review whether this upstream shared-instruction pattern should improve `youmd skill init-project`, host adapters, or repo-local pointer rules.", source);
    }
    if (/(skill|skill\.md|skills\/|frontmatter|description|validate)/.test(haystack)) {
      return task("YouStacks skill ergonomics", "Compare this skill packaging or validation pattern against bundled skills, stack manifests, and `youmd stack doctor` warnings.", source);
    }
    if (/(script|bin|hook|committer|browser|docs-list|dependency-free|portable)/.test(haystack)) {
      return task("Portable helper scripts", "Check whether this dependency-light helper or hook pattern should become a YouStack script convention, smoke check, or adapter utility.", source);
    }
    if (/(symlink|canonical|sync|repo-owned|shared|submodule)/.test(haystack)) {
      return task("Shared stack source-of-truth", "Evaluate whether this canonical repo/symlink/sync pattern should simplify user-owned GitHub repo sync or repo-owned skill exposure.", source);
    }
  }

  if (repo.id === "the-library") {
    if (/(library\.yaml|catalog|reference|source|pointer|github|local path|raw.githubusercontent)/.test(haystack)) {
      return task("YouStacks reference catalog", "Review whether this pointer-catalog pattern should improve stack manifests, skill source references, or private/public stack distribution.", source);
    }
    if (/(private|team|device|sync|fork|clone|share|distribution)/.test(haystack)) {
      return task("Private-first stack distribution", "Compare this private/team/device distribution model against You.md scoped stack sharing, GitHub sync, grants, and hosted mirrors.", source);
    }
    if (/(agent|skill|prompt|requires|dependency|recursive|typed)/.test(haystack)) {
      return task("Typed agentic dependencies", "Check whether typed skill/agent/prompt dependencies should be added to YouStack manifests, routing, or doctor diagnostics.", source);
    }
    if (/(cookbook|install|use|push|remove|list|search|justfile)/.test(haystack)) {
      return task("Agent-run stack operations", "Evaluate whether cookbook-style agent workflows or terminal shortcuts should simplify YouStack install/use/push/sync UX.", source);
    }
  }

  if (/(readme|docs|example|quickstart|guide)/.test(haystack)) {
    return task("Docs/product education", "Compare this upstream docs/example change against the homepage, `/docs`, quickstarts, and stack/brain examples.", source);
  }

  return task(`${repo.youmdSurface} architecture review`, "Skim the upstream change and decide whether it should become a concrete You.md task or be recorded as no-op.", source);
}

function task(surface, action, source) {
  return { surface, action, source };
}

function uniqueTasks(tasks) {
  const seen = new Set();
  return tasks.filter((item) => {
    const key = `${item.surface}|${item.action}|${item.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function markdownForRepo(repo, info, commits, previousCommit) {
  const localPath = path.relative(rootDir, repo.localDir);
  const newLabel = previousCommit === info.commit
    ? `No new commits since ${previousCommit.slice(0, 7)}`
    : previousCommit && previousCommit !== info.commit
    ? `Changes since ${previousCommit.slice(0, 7)}`
    : "Recent commits";

  return [
    `## ${repo.name}`,
    "",
    `- URL: ${repo.url.replace(/\.git$/, "")}`,
    `- Local path: \`${localPath}\``,
    `- Branch: \`${info.remoteHead}\``,
    `- Latest commit: \`${info.commit.slice(0, 12)}\``,
    `- Mode: ${newLabel}`,
    "",
    commits.length === 0 ? "- No commits found." : commits.map((commit) => {
      const files = commit.files.slice(0, 8).map((file) => `\`${file}\``).join(", ");
      const more = commit.files.length > 8 ? `, +${commit.files.length - 8} more` : "";
      return `- \`${commit.short}\` ${commit.date} — ${commit.subject}${files ? `\n  Files: ${files}${more}` : ""}`;
    }).join("\n"),
  ].join("\n");
}

function renderReport(results, tasks) {
  return `# You.md Reference Intelligence

Last updated: ${now.toISOString()}

You.md keeps selected upstream agent-infrastructure repos as local references, then turns upstream changes into reviewable tasks for YouStacks and the You.md brain/context layer. Reference repos are not vendored into this repository; they live under \`.reference-repos/\` and are ignored by git.

Tracked lighthouses:

- GStack: installable local-first agent operating systems, skills, host adapters, evals, QA/review/release loops.
- GBrain: durable shared brain, memory, retrieval, sync, provenance, privacy, and startup context.
- Agent Scripts: canonical shared AGENTS/skills/scripts/hook patterns across Codex/Claude-style agents.
- The Library: private-first pointer catalog for skills, agents, prompts, dependencies, and cross-device/team distribution.

Run:

\`\`\`bash
npm run references:sync
\`\`\`

${results.map((result) => markdownForRepo(result.repo, result.info, result.commits, result.previousCommit)).join("\n\n")}

## Candidate Tasks

${tasks.length === 0 ? "- No task candidates generated." : tasks.map((item) => `- [ ] ${item.surface}: ${item.action}\n  Source: ${item.source}`).join("\n")}
`;
}

function renderTasks(tasks) {
  return `# Reference-Derived You.md Tasks

Last updated: ${now.toISOString()}

Use this as a review queue, not an automatic mandate. Only promote an item into \`TODO.md\` or implementation when it clearly improves YouStacks, You.md brain/context, memory, profiles, API/MCP, source-of-truth sync, safety, or docs.

${tasks.length === 0 ? "- [ ] No new candidates from this sync." : tasks.map((item) => `- [ ] ${item.surface}\n  - Source: ${item.source}\n  - You.md review: ${item.action}`).join("\n")}
`;
}

function main() {
  mkdirSync(referenceRoot, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const state = readJson(statePath, { repos: {} });
  const results = [];
  const allTasks = [];

  for (const repo of repos) {
    const info = ensureRepo(repo);
    const previousCommit = state.repos?.[repo.id]?.commit;
    const commits = getCommits(repo, previousCommit, info.commit);
    const tasks = uniqueTasks(commits.map((commit) => classifyTask(repo, commit))).slice(0, 12);
    results.push({ repo, info, commits, previousCommit });
    allTasks.push(...tasks);

    state.repos = state.repos || {};
    state.repos[repo.id] = {
      url: repo.url,
      localDir: repo.localDir,
      branch: info.remoteHead,
      commit: info.commit,
      updatedAt: now.toISOString(),
    };
  }

  const tasks = uniqueTasks(allTasks).slice(0, 24);
  writeFileSync(path.join(outputDir, "LATEST.md"), renderReport(results, tasks));
  writeFileSync(path.join(outputDir, "TASKS.md"), renderTasks(tasks));
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  console.log(`reference repos synced to ${path.relative(rootDir, referenceRoot)}`);
  console.log(`wrote ${path.relative(rootDir, path.join(outputDir, "LATEST.md"))}`);
  console.log(`wrote ${path.relative(rootDir, path.join(outputDir, "TASKS.md"))}`);
  console.log(`task candidates: ${tasks.length}`);
}

main();
