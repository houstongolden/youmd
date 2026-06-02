import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

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
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run agent-docs:ci",
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
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run agent-docs:ci",
      cliVersionMarker,
      cliPackageMarker,
      ...rootManualStackMarkers,
    ],
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
      "npm run llms:smoke -- --base-url https://www.you.md",
      "npm run agent-docs:ci",
      cliVersionMarker,
      cliPackageMarker,
      ...rootManualStackMarkers,
    ],
  },
  {
    file: "src/app/(app)/docs/docs-content.tsx",
    markers: [
      "Agent Docs",
      "README.md / AGENTS.md / CLAUDE.md",
      "node scripts/check-agent-doc-handoff.mjs",
      "npm run agent-docs:ci",
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
  },
  {
    file: "project-context/PRD.md",
    markers: [
      "users (1:1 first-party auth subject) → profiles (1:1, claimable)",
      "**Web:** First-party passwordless email-code auth with signed session cookies and Convex custom JWTs",
    ],
  },
];

const failures = [];

for (const doc of requiredDocs) {
  const fullPath = path.join(ROOT, doc.file);
  const content = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";

  if (!content) {
    failures.push(`${doc.file}: missing or empty`);
    continue;
  }

  for (const marker of doc.markers) {
    if (!content.includes(marker)) {
      failures.push(`${doc.file}: missing marker ${JSON.stringify(marker)}`);
    }
  }
}

if (failures.length > 0) {
  console.error("agent docs handoff check failed");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`agent docs handoff markers are present for ${cliVersionMarker}`);
