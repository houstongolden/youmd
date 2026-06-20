import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const outputJson = process.argv.includes("--json");

function readJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

const cliVersion = readJson("cli/package.json").version;
const cliVersionMarker = `youmd ${cliVersion}`;
const cliPackageMarker = `CLI package (npm: youmd, v${cliVersion})`;
const appPackage = readJson("package.json");
const appDependencies = {
  ...appPackage.dependencies,
  ...appPackage.devDependencies,
};

function packageVersion(packageName) {
  const version = appDependencies[packageName];
  if (!version) {
    throw new Error(`Missing package dependency: ${packageName}`);
  }
  return version.replace(/^[~^]/, "");
}

const rootManualStackMarkers = [
  `| Frontend | Next.js (App Router) | ${packageVersion("next")} |`,
  `| UI | React | ${packageVersion("react")} |`,
  "| Styling | Tailwind CSS | v4 |",
  `| Animation | Motion | ${packageVersion("motion")} |`,
  `| Backend + DB | Convex | ${packageVersion("convex")} |`,
  "| Auth | First-party passwordless sessions | web cookies + API keys |",
  "| Auth issuer | https://you.md | JWKS + signed session cookies |",
  "- Auth: First-party passwordless web sessions + email-code CLI login + scoped API keys (agents)",
];

const rootManualForbiddenMarkers = [
  "| Frontend | Next.js (App Router) | 16.1.6 |",
  "| Animation | Framer Motion | 12.37.0 |",
  "| Auth | Clerk | 7.0.4 |",
  "| Prod Clerk | clerk.you.md | pk_live keys |",
  "- Auth: Clerk (web) + email/password via Clerk Backend API (CLI) + API keys (agents)",
];

const requiredDocs = [
  {
    file: "README.md",
    markers: [
      "## For Agents",
      "https://you.md/llms.txt",
      "https://you.md/llms-full.txt",
      "https://you.md/api/v1/docs/reference",
      "https://you.md/api/v1/docs/openapi.json",
      "https://you.md/.well-known/mcp.json",
      "https://you.md/api/v1/stacks/capabilities",
      "npm run docs:check",
      "npm run agent-docs:syntax",
      "npm run agent-docs:handoff",
      "npm run agent-docs:handoff:json",
      "npm run agent-docs:lint",
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run sync:graph:smoke",
      "npm run agent-docs:ci",
      "sanitize cached shell-facing identifiers before use",
      "Repo names, branch names, and other stack/runtime metadata should stay local",
      "honest readiness states such as `not built`, `indexing`, or `ready`",
      "degrade toward a narrower fallback path before silence",
    ],
  },
  {
    file: "AGENTS.md",
    markers: [
      "## Agent Docs Preflight",
      "https://you.md/llms.txt",
      "https://you.md/llms-full.txt",
      "https://you.md/api/v1/docs/reference",
      "https://you.md/api/v1/docs/openapi.json",
      "https://you.md/.well-known/mcp.json",
      "https://you.md/api/v1/stacks/capabilities",
      "npm run docs:check",
      "npm run agent-docs:syntax",
      "npm run agent-docs:handoff",
      "npm run agent-docs:handoff:json",
      "npm run agent-docs:lint",
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run sync:graph:smoke",
      "npm run agent-docs:ci",
      cliVersionMarker,
      cliPackageMarker,
      ...rootManualStackMarkers,
    ],
    forbiddenMarkers: rootManualForbiddenMarkers,
  },
  {
    file: "CLAUDE.md",
    markers: [
      "## Agent Docs Preflight",
      "https://you.md/llms.txt",
      "https://you.md/llms-full.txt",
      "https://you.md/api/v1/docs/reference",
      "https://you.md/api/v1/docs/openapi.json",
      "https://you.md/.well-known/mcp.json",
      "https://you.md/api/v1/stacks/capabilities",
      "npm run docs:check",
      "npm run agent-docs:syntax",
      "npm run agent-docs:handoff",
      "npm run agent-docs:handoff:json",
      "npm run agent-docs:lint",
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run sync:graph:smoke",
      "npm run agent-docs:ci",
      cliVersionMarker,
      cliPackageMarker,
      ...rootManualStackMarkers,
    ],
    forbiddenMarkers: rootManualForbiddenMarkers,
  },
  {
    file: "src/app/(app)/docs/docs-content.tsx",
    markers: [
      "Agent Docs",
      "README.md / AGENTS.md / CLAUDE.md",
      "node scripts/check-agent-doc-handoff.mjs",
      "PRD, and architecture docs",
      "stale stack/auth language",
      "npm run agent-docs:syntax",
      "npm run agent-docs:handoff",
      "npm run agent-docs:handoff:json",
      "npm run agent-docs:lint",
      "npm run sync:graph:smoke",
      "npm run agent-docs:ci",
      "required/forbidden handoff marker checks",
      "local metadata should stay local by default",
      "protected reads should report honest readiness",
      "retrieval should fall back before it goes silent",
      "GET /llms.txt",
      "GET /llms-full.txt",
      "GET /api/v1/docs/reference",
      "GET /api/v1/docs/openapi.json",
      "GET /.well-known/mcp.json",
      "GET /api/v1/stacks/capabilities",
    ],
  },
  {
    file: "project-context/ARCHITECTURE.md",
    markers: [
      "### Web (First-Party Passwordless)",
      "Legacy field name for the first-party auth subject",
      "Terminal-style email-code sign-in",
      "Terminal-style email-code sign-up",
      "JWT/JWKS",
    ],
    forbiddenMarkers: [
      "### Web (Clerk)",
      "**users** — Authenticated accounts (1:1 with Clerk)",
      "| clerkId | string | Clerk user ID, indexed |",
      "Terminal-style Clerk sign-in",
      "Terminal-style Clerk sign-up",
      "│  │  OpenRouter  │  │  Apify      │  │  Clerk      │",
    ],
  },
  {
    file: "project-context/PRD.md",
    markers: [
      "users (1:1 first-party auth subject) → profiles (1:1, claimable)",
      "**Web:** First-party passwordless email-code auth with signed session cookies and Convex custom JWTs",
    ],
    forbiddenMarkers: [
      "users (1:1 Clerk) → profiles (1:1, claimable)",
    ],
  },
];

const failures = [];
const checkedFiles = [];
let checkedDocCount = 0;
let requiredMarkerCount = 0;
let forbiddenMarkerCount = 0;

for (const doc of requiredDocs) {
  const fullPath = path.join(ROOT, doc.file);
  const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";

  if (!content) {
    failures.push(`${doc.file}: missing or empty`);
    continue;
  }

  checkedDocCount += 1;
  checkedFiles.push(doc.file);
  requiredMarkerCount += doc.markers.length;
  forbiddenMarkerCount += doc.forbiddenMarkers?.length ?? 0;

  for (const marker of doc.markers) {
    if (!content.includes(marker)) {
      failures.push(`${doc.file}: missing marker ${JSON.stringify(marker)}`);
    }
  }

  for (const marker of doc.forbiddenMarkers ?? []) {
    if (content.includes(marker)) {
      failures.push(`${doc.file}: forbidden stale marker ${JSON.stringify(marker)}`);
    }
  }
}

const result = {
  ok: failures.length === 0,
  cliVersion,
  marker: cliVersionMarker,
  files: {
    checked: checkedDocCount,
    paths: checkedFiles,
  },
  markers: {
    required: requiredMarkerCount,
    forbiddenStale: forbiddenMarkerCount,
  },
  failures,
};

if (failures.length > 0) {
  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.error("agent docs handoff check failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    `agent docs handoff markers are present for ${cliVersionMarker} (${checkedDocCount} files, ${requiredMarkerCount} required markers, ${forbiddenMarkerCount} forbidden stale markers)`,
  );
}
