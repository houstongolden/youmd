import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

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
      "youmd 0.6.23",
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
      "youmd 0.6.23",
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

console.log("agent docs handoff markers are present");
