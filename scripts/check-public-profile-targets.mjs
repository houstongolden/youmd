#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "convex", "profileIndexing.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const match = source.match(/const INITIAL_PUBLIC_PROFILE_TARGETS:[\s\S]*?= \[([\s\S]*?)\];/);

if (!match) {
  console.error("public profile target check failed:");
  console.error("- could not find INITIAL_PUBLIC_PROFILE_TARGETS");
  process.exit(1);
}

const block = match[1];
const targetBlocks = block
  .split(/\n\s*\{\s*username:/)
  .slice(1)
  .map((item) => `{ username:${item}`);
const usernames = targetBlocks.map((item) => item.match(/username:\s*"([^"]+)"/)?.[1] ?? "");
const failures = [];
const seen = new Set();

if (usernames.length !== 50) failures.push(`expected exactly 50 targets, found ${usernames.length}`);

for (const [index, targetBlock] of targetBlocks.entries()) {
  const username = usernames[index];
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(username)) {
    failures.push(`invalid username slug: ${username}`);
  }
  if (seen.has(username)) failures.push(`duplicate username: ${username}`);
  seen.add(username);

  if (!/name:\s*"[^"]+"/.test(targetBlock)) {
    failures.push(`target ${username || index} has no name`);
  }

  const linkBlock = targetBlock.match(/links:\s*\{([^}]+)\}/)?.[1];
  if (!linkBlock) {
    failures.push(`target ${username || index} has no links object`);
  } else if (!/https:\/\/[^"\s]+/.test(linkBlock)) {
    failures.push(`target ${username || index} has no https source link`);
  }
}

if (failures.length) {
  console.error("public profile target check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`public profile target check ok: ${usernames.length} unique targets`);
