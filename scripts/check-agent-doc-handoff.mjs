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
