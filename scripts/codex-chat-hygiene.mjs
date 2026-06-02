#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const options = {
  apply: false,
  codexHome: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
  cwd: process.cwd(),
  olderThanMinutes: 0,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--apply") {
    options.apply = true;
  } else if (arg === "--cwd") {
    options.cwd = args[++index];
  } else if (arg === "--codex-home") {
    options.codexHome = args[++index];
  } else if (arg === "--older-than-minutes") {
    options.olderThanMinutes = Number(args[++index] || 0);
  } else if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  } else {
    throw new Error(`Unknown option: ${arg}`);
  }
}

if (!Number.isFinite(options.olderThanMinutes) || options.olderThanMinutes < 0) {
  throw new Error("--older-than-minutes must be a non-negative number");
}

const sqlite = "/usr/bin/sqlite3";
const statePath = path.join(options.codexHome, "state_5.sqlite");
const indexPath = path.join(options.codexHome, "session_index.jsonl");
const archiveDir = path.join(options.codexHome, "archived_sessions");
const cutoffSeconds = Math.floor(Date.now() / 1000) - options.olderThanMinutes * 60;

function printHelp() {
  console.log(`Usage: node scripts/codex-chat-hygiene.mjs [options]

Archives completed Codex automation threads for a workspace while preserving
their JSONL transcripts under ~/.codex/archived_sessions.

Options:
  --apply                    mutate Codex local state; default is dry-run
  --cwd PATH                 workspace cwd to clean; default is process.cwd()
  --codex-home PATH          Codex state directory; default $CODEX_HOME or ~/.codex
  --older-than-minutes N     only archive matching threads older than N minutes
`);
}

function runSql(sqlArgs) {
  const result = spawnSync(sqlite, sqlArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `sqlite exited ${result.status}`);
  }
  return result.stdout;
}

function quoteSql(value) {
  return String(value).replaceAll("'", "''");
}

function readRows() {
  const titleWhere = [
    `title like 'Automation:%'`,
    `title like 'Daily GStack/GBrain%'`,
    `title like 'Daily You.md Reference Intelligence%'`,
  ].join(" or ");
  const where = [
    `cwd='${quoteSql(options.cwd)}'`,
    `updated_at <= ${Math.floor(cutoffSeconds)}`,
    `(${titleWhere})`,
  ].join(" and ");

  const json = runSql([
    "-json",
    statePath,
    `select id, title, archived, rollout_path, updated_at from threads where ${where} order by updated_at desc;`,
  ]);
  return json.trim() ? JSON.parse(json) : [];
}

function backupState() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const stateBackup = path.join(options.codexHome, `state_5.sqlite.backup-chat-hygiene-${stamp}`);
  const indexBackup = path.join(options.codexHome, `session_index.jsonl.backup-chat-hygiene-${stamp}`);
  runSql([statePath, `.backup '${quoteSql(stateBackup)}'`]);
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, indexBackup);
  }
  return { stateBackup, indexBackup };
}

function archiveRows(rows) {
  fs.mkdirSync(archiveDir, { recursive: true });

  let moved = 0;
  for (const row of rows) {
    let archivedPath = row.rollout_path || "";
    if (archivedPath && fs.existsSync(archivedPath)) {
      if (!archivedPath.startsWith(`${archiveDir}${path.sep}`)) {
        const destination = path.join(archiveDir, path.basename(archivedPath));
        fs.renameSync(archivedPath, destination);
        archivedPath = destination;
        moved += 1;
      }
      runSql([
        statePath,
        `update threads set archived=1, archived_at=strftime('%s','now'), rollout_path='${quoteSql(archivedPath)}' where id='${quoteSql(row.id)}';`,
      ]);
    } else {
      runSql([
        statePath,
        `update threads set archived=1, archived_at=strftime('%s','now') where id='${quoteSql(row.id)}';`,
      ]);
    }
  }

  return moved;
}

function pruneSessionIndex(rows) {
  if (!fs.existsSync(indexPath)) return 0;

  const ids = new Set(rows.map((row) => row.id));
  const input = fs.readFileSync(indexPath, "utf8").split(/\n/);
  const kept = [];
  let removed = 0;

  for (const line of input) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      if (ids.has(parsed.id)) {
        removed += 1;
        continue;
      }
    } catch {
      // Keep malformed rows intact.
    }
    kept.push(line);
  }

  fs.writeFileSync(indexPath, kept.join("\n") + (kept.length ? "\n" : ""));
  return removed;
}

const rows = readRows();
const unarchivedRows = rows.filter((row) => row.archived === 0);

console.log(`workspace=${options.cwd}`);
console.log(`matching_threads=${rows.length}`);
console.log(`unarchived_threads=${unarchivedRows.length}`);

for (const row of rows) {
  const state = row.archived ? "archived" : "active";
  const title = String(row.title || "").split("\n")[0].slice(0, 96);
  console.log(`- ${row.id} [${state}] ${title}`);
}

if (!options.apply) {
  console.log("dry_run=true");
  console.log("Run again with --apply to archive matching automation threads.");
  process.exit(0);
}

const backups = backupState();
const moved = archiveRows(rows);
const removed = pruneSessionIndex(rows);
runSql([statePath, "pragma wal_checkpoint(truncate);"]);

console.log("dry_run=false");
console.log(`moved_transcripts=${moved}`);
console.log(`removed_session_index_rows=${removed}`);
console.log(`backup_state=${backups.stateBackup}`);
console.log(`backup_index=${backups.indexBackup}`);
