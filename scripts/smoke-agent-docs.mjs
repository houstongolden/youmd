#!/usr/bin/env node

import process from "node:process";

const args = process.argv.slice(2);
const options = {
  baseUrl: process.env.YOUMD_AGENT_DOCS_BASE_URL || "https://www.you.md",
  timeoutMs: Number(process.env.YOUMD_AGENT_DOCS_TIMEOUT_MS || 10000),
  json: false,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--base-url") {
    options.baseUrl = args[++index];
  } else if (arg === "--timeout-ms") {
    options.timeoutMs = Number(args[++index] || options.timeoutMs);
  } else if (arg === "--json") {
    options.json = true;
  } else if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  } else {
    throw new Error(`Unknown option: ${arg}`);
  }
}

if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
  throw new Error("--timeout-ms must be a positive number");
}

const baseUrl = options.baseUrl.replace(/\/+$/, "");
const checks = [];

function printHelp() {
  console.log(`Usage: node scripts/smoke-agent-docs.mjs [options]

Smoke-test the public agent-readable docs surfaces against a running You.md
origin. Defaults to production.

Options:
  --base-url URL       origin to check; default https://www.you.md
  --timeout-ms N       per-request timeout; default 10000
  --json               print machine-readable JSON instead of text
`);
}

async function fetchText(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "youmd-agent-docs-smoke/1.0" },
      signal: controller.signal,
    });
    const body = await response.text();
    return { url, response, body };
  } finally {
    clearTimeout(timeout);
  }
}

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
}

function includesAll(body, markers) {
  return markers.filter((marker) => !body.includes(marker));
}

async function main() {
  const docsRefResult = await fetchText("/api/v1/docs/reference");
  record("docs reference returns 200", docsRefResult.response.ok, `${docsRefResult.response.status} ${docsRefResult.url}`);

  let docsReference = null;
  try {
    docsReference = JSON.parse(docsRefResult.body);
    record("docs reference parses as JSON", true, docsReference.sourceHash || "missing sourceHash");
  } catch (error) {
    record("docs reference parses as JSON", false, error.message);
  }

  const llmsResult = await fetchText("/llms.txt");
  record("llms.txt returns 200", llmsResult.response.ok, `${llmsResult.response.status} ${llmsResult.url}`);

  const llmsFullResult = await fetchText("/llms-full.txt");
  record("llms-full.txt returns 200", llmsFullResult.response.ok, `${llmsFullResult.response.status} ${llmsFullResult.url}`);

  if (docsReference) {
    const expected = [
      `Source hash: ${docsReference.sourceHash}`,
      `CLI version: ${docsReference.cli.version}`,
      `${docsReference.counts.endpoints} shipped routes`,
      `${docsReference.counts.mcpTools} MCP tools`,
      "README, AGENTS.md, and CLAUDE.md",
    ];
    const missing = includesAll(llmsResult.body, expected);
    record("llms.txt matches generated docs reference", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : expected.join(", "));

    const fullExpected = [
      `Source hash: ${docsReference.sourceHash}`,
      `CLI version: ${docsReference.cli.version}`,
      `Endpoints: ${docsReference.counts.endpoints}`,
      `MCP tools: ${docsReference.counts.mcpTools}`,
      "Generated MCP endpoints:",
      "Generated docs endpoints:",
      "Generated full agent context",
      "Source Repo Handoff",
      "scripts/check-agent-doc-handoff.mjs",
    ];
    const fullMissing = includesAll(llmsFullResult.body, fullExpected);
    record("llms-full.txt matches generated docs reference", fullMissing.length === 0, fullMissing.length ? `missing: ${fullMissing.join(", ")}` : fullExpected.join(", "));
  }

  const requiredFullMarkers = [
    "Recommended Agent Order Of Operations",
    "YouStacks",
    "Privacy And Trust",
    "GStack: https://github.com/garrytan/gstack",
    "GBrain: https://github.com/garrytan/gbrain",
    "Agent Scripts: https://github.com/steipete/agent-scripts",
    "The Library: https://github.com/disler/the-library",
  ];
  const missingFullMarkers = includesAll(llmsFullResult.body, requiredFullMarkers);
  record("llms-full.txt includes workflow, privacy, and upstream markers", missingFullMarkers.length === 0, missingFullMarkers.length ? `missing: ${missingFullMarkers.join(", ")}` : `${requiredFullMarkers.length} markers`);

  const sourceRepoHandoffMarkers = [
    "README.md: short \"For Agents\" section",
    "AGENTS.md: cross-agent operating manual",
    "CLAUDE.md: Claude-specific operating manual",
    "PRD, and architecture docs",
    "stale stack/auth language",
    "npm run agent-docs:syntax",
    "npm run agent-docs:handoff",
    "npm run agent-docs:lint",
  ];
  const missingSourceRepoHandoffMarkers = includesAll(llmsFullResult.body, sourceRepoHandoffMarkers);
  record("llms-full.txt includes source-repo guardrail markers", missingSourceRepoHandoffMarkers.length === 0, missingSourceRepoHandoffMarkers.length ? `missing: ${missingSourceRepoHandoffMarkers.join(", ")}` : `${sourceRepoHandoffMarkers.length} markers`);

  const mcpResult = await fetchText("/.well-known/mcp.json");
  let mcp = null;
  try {
    mcp = JSON.parse(mcpResult.body);
  } catch {
    mcp = null;
  }
  record("MCP discovery returns expected endpoint", mcpResult.response.ok && mcp?.server?.url?.endsWith("/api/v1/mcp"), `${mcpResult.response.status} ${mcp?.server?.url || "missing server.url"}`);

  const robotsResult = await fetchText("/robots.txt");
  const missingRobots = includesAll(robotsResult.body, ["/llms.txt", "/llms-full.txt", "/api/v1/docs/reference", "/api/v1/docs/openapi.json"]);
  record("robots.txt allows agent docs", robotsResult.response.ok && missingRobots.length === 0, missingRobots.length ? `missing: ${missingRobots.join(", ")}` : `${robotsResult.response.status}`);

  const sitemapResult = await fetchText("/sitemap.xml");
  const missingSitemap = includesAll(sitemapResult.body, ["https://you.md/llms.txt", "https://you.md/llms-full.txt"]);
  record("sitemap includes root agent docs", sitemapResult.response.ok && missingSitemap.length === 0, missingSitemap.length ? `missing: ${missingSitemap.join(", ")}` : `${sitemapResult.response.status}`);

  const docsResult = await fetchText("/docs");
  const missingDocs = includesAll(docsResult.body, [
    "Agent Docs",
    "npm run llms:check",
    "npm run llms:generate",
    "GET /llms.txt",
    "GET /llms-full.txt",
    "README.md / AGENTS.md / CLAUDE.md",
    "node scripts/check-agent-doc-handoff.mjs",
    "npm run agent-docs:syntax",
    "npm run agent-docs:handoff",
    "npm run agent-docs:lint",
    "npm run agent-docs:ci",
    "PRD, and architecture docs",
    "stale stack/auth language",
    "required/forbidden handoff marker checks",
  ]);
  record("docs page documents agent-docs workflow", docsResult.response.ok && missingDocs.length === 0, missingDocs.length ? `missing: ${missingDocs.join(", ")}` : `${docsResult.response.status}`);

  const failed = checks.filter((check) => !check.ok);
  if (options.json) {
    console.log(JSON.stringify({ baseUrl, ok: failed.length === 0, checks }, null, 2));
  } else {
    console.log(`agent docs smoke: ${baseUrl}`);
    for (const check of checks) {
      console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name} - ${check.detail}`);
    }
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
