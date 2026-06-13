#!/usr/bin/env node
/**
 * dedupe-reference-intelligence.mjs
 * Reads project-context/reference-intelligence/LATEST.md, splits into
 * paragraph blocks (blank-line separated), hashes each block > 50 chars
 * with sha256, drops exact duplicates (keep first), and writes deduped
 * output to project-context/reference-intelligence/LATEST.dedupe.md.
 * Does NOT overwrite LATEST.md.
 */

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const INPUT = resolve(ROOT, "project-context/reference-intelligence/LATEST.md");
const OUTPUT = resolve(ROOT, "project-context/reference-intelligence/LATEST.dedupe.md");

const raw = readFileSync(INPUT, "utf-8");

// Split on one or more blank lines, preserving paragraph identity.
const blocks = raw.split(/\n{2,}/);

const seen = new Set();
const kept = [];
let dropped = 0;

for (const block of blocks) {
  const trimmed = block.trim();
  if (trimmed.length > 50) {
    const hash = createHash("sha256").update(trimmed).digest("hex");
    if (seen.has(hash)) {
      dropped++;
      continue;
    }
    seen.add(hash);
  }
  kept.push(block);
}

writeFileSync(OUTPUT, kept.join("\n\n"), "utf-8");
console.log(`kept ${kept.length}, dropped ${dropped} duplicates`);
