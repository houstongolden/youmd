#!/usr/bin/env node
/**
 * check-radius.mjs — U18 border-radius regression guard.
 *
 * PRD v2.3: border radius is 2px EVERYWHERE. The single source of truth is the
 * `--radius: 2px` token in src/app/globals.css (the whole Tailwind radius scale
 * is capped to it, so `rounded-sm` is the canonical utility).
 *
 * This script fails when src/ reintroduces:
 *   1. Banned radius utilities: bare `rounded` (deprecated 4px in Tailwind v4)
 *      and `rounded-md|lg|xl|2xl|3xl|4xl` (incl. corner/side variants).
 *   2. Arbitrary radius utilities (`rounded-[...]`) — use `rounded-sm` /
 *      `rounded-full` / the token instead.
 *   3. Hardcoded radii in inline styles or CSS that exceed the design system:
 *      allowed values are 0, 0px, 1px, 2px, 50%, var(--radius), 9999px-never.
 *   4. `rounded-full` outside the allowlist below (circles are reserved for
 *      status dots, terminal traffic lights, pulse indicators, ASCII avatars).
 *
 * Run: node scripts/check-radius.mjs   (wired into `npm run lint`)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/**
 * Files allowed to use `rounded-full` / circular radii. Every entry is a
 * genuinely circular element, audited 2026-06 (U18):
 *   - status dots / live-pulse indicators
 *   - terminal-panel traffic-light dots
 *   - pagination dots
 */
const ROUNDED_FULL_ALLOWLIST = new Set([
  "src/app/(app)/[username]/profile-content.tsx", // live/status dots
  "src/app/(app)/dashboard/dashboard-content.tsx", // skeleton traffic-light dots
  "src/app/(app)/docs/docs-content.tsx", // status dots, pagination dots
  "src/app/(app)/profiles/profiles-content.tsx", // index status dots
  "src/app/globals.css", // .terminal-dot (50%) + scale documentation comment
  "src/components/panes/AgentsPane.tsx", // agent status dots
  "src/components/panes/FilesPane.tsx", // 4px accent dot
  "src/components/panes/ProfilePane.tsx", // status pulse dot
  "src/components/panes/SharePane.tsx", // status dots + radio indicators
  "src/components/terminal/TerminalHeader.tsx", // traffic-light dots
  "src/components/ui/Card.tsx", // terminal-panel header dots
  "src/app/(desktop)/desktop-demo/_components/TitleBar.tsx", // toggle switch: pill track + circular thumb
]);

/**
 * Allowed literal radius components (each space-separated part of a value).
 * Literal "2px"/"1px"/"0px"/"50%" stay legal so files that render WITHOUT
 * globals.css keep working (global-error.tsx standalone shell, Satori
 * opengraph-image.tsx — neither can resolve var(--radius)). Anything larger
 * than 2px (other than 50% circles) is a violation.
 */
const ALLOWED_VALUE = /^(0|0px|1px|2px|50%|var\(--radius\)|inherit|initial)$/;

const BANNED_CLASS =
  /\brounded(?:-(?:s|e|t|r|b|l|ss|se|es|ee|tl|tr|br|bl))?-(?:md|lg|xl|2xl|3xl|4xl)\b/;
const BARE_ROUNDED = /(?<![-\w])rounded(?![-\w[])/;
const ARBITRARY =
  /\brounded(?:-(?:s|e|t|r|b|l|ss|se|es|ee|tl|tr|br|bl))?-\[/;
const ROUNDED_FULL =
  /\brounded(?:-(?:s|e|t|r|b|l|ss|se|es|ee|tl|tr|br|bl))?-full\b/;
const INLINE_RADIUS = /borderRadius:\s*["'`]([^"'`]+)["'`]/g;
const CSS_RADIUS = /border-radius:\s*([^;]+);/g;

const errors = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "generated") continue; // src/generated is machine-written
      walk(p);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry)) {
      checkFile(p);
    }
  }
}

function checkValue(value, rel, lineNo, kind) {
  const parts = value.trim().split(/\s+/);
  for (const part of parts) {
    if (ALLOWED_VALUE.test(part)) continue;
    errors.push(
      `${rel}:${lineNo} — ${kind} radius "${value}" not allowed (use var(--radius), <=2px, or 50% for circles)`
    );
    return;
  }
}

function checkFile(path) {
  const rel = relative(ROOT, path);
  const lines = readFileSync(path, "utf8").split("\n");

  lines.forEach((line, i) => {
    const n = i + 1;

    if (BANNED_CLASS.test(line)) {
      errors.push(`${rel}:${n} — banned radius utility (rounded-md/lg/xl/2xl/3xl/4xl). Use rounded-sm (2px token).`);
    }
    if (BARE_ROUNDED.test(line)) {
      errors.push(`${rel}:${n} — bare \`rounded\` is banned (deprecated 4px in Tailwind v4). Use rounded-sm.`);
    }
    if (ARBITRARY.test(line)) {
      errors.push(`${rel}:${n} — arbitrary rounded-[...] is banned. Use rounded-sm / rounded-full / the --radius token.`);
    }
    if (ROUNDED_FULL.test(line) && !ROUNDED_FULL_ALLOWLIST.has(rel)) {
      errors.push(
        `${rel}:${n} — rounded-full outside the circular allowlist. If this element is genuinely a circle (status dot, avatar), add the file to ROUNDED_FULL_ALLOWLIST in scripts/check-radius.mjs.`
      );
    }

    for (const m of line.matchAll(INLINE_RADIUS)) {
      checkValue(m[1], rel, n, "inline");
    }
    if (rel.endsWith(".css")) {
      for (const m of line.matchAll(CSS_RADIUS)) {
        checkValue(m[1], rel, n, "css");
      }
    }
  });
}

walk(SRC);

if (errors.length > 0) {
  console.error(`check-radius: ${errors.length} violation(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error(
    "\nPRD v2.3: border radius is 2px everywhere (--radius token). rounded-full is for true circles only."
  );
  process.exit(1);
}

console.log("check-radius: OK — radius token discipline holds (2px everywhere).");
