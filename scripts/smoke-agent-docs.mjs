#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

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

async function fetchText(requestPath, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = `${baseUrl}${requestPath}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "youmd-agent-docs-smoke/1.0", ...extraHeaders },
      signal: controller.signal,
    });
    const body = await response.text();
    return { url, response, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function postJson(requestPath, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = `${baseUrl}${requestPath}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "youmd-agent-docs-smoke/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    return { url, response, body, parsed };
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

function readLocal(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

function parseLocalDocsReference() {
  const source = readLocal(path.join("src", "generated", "docs-reference.ts"));
  const match = source.match(/export const docsReference = ([\s\S]*?) as const;/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// Documented examples are read from the LOCAL generated llms-full.txt (so new
// or fixed examples are validated before they deploy) and replayed against the
// LIVE base URL. Only public (no-auth) examples are replayed.
function extractReplayExamples(llmsFullBody) {
  const examples = [];
  const seenGets = new Set();

  for (const block of llmsFullBody.matchAll(/```(\w+)\n([\s\S]*?)```/g)) {
    const lang = block[1];
    const body = block[2].trim();

    if (lang === "json") {
      let parsed = null;
      try {
        parsed = JSON.parse(body);
      } catch {
        continue;
      }
      if (parsed && parsed.jsonrpc === "2.0" && typeof parsed.method === "string") {
        examples.push({ kind: "jsonrpc", payload: parsed });
      } else if (parsed && typeof parsed.request === "string" && Array.isArray(parsed.capabilities)) {
        examples.push({ kind: "stack-route", payload: parsed });
      }
      continue;
    }

    if (lang === "http") {
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        const requestMatch = lines[i].trim().match(/^GET\s+(\/\S*)$/);
        if (!requestMatch) continue;
        const requestPath = requestMatch[1];
        // Skip templated examples (placeholders cannot be replayed verbatim).
        if (requestPath.includes("<") || requestPath.includes("{")) continue;
        const headers = {};
        for (let j = i + 1; j < lines.length; j += 1) {
          const headerMatch = lines[j].trim().match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.+)$/);
          if (!headerMatch) break;
          headers[headerMatch[1]] = headerMatch[2];
          i = j;
        }
        const key = `${requestPath} ${JSON.stringify(headers)}`;
        if (seenGets.has(key)) continue;
        seenGets.add(key);
        examples.push({ kind: "get", path: requestPath, headers });
      }
    }
  }

  return examples;
}

const PUBLIC_JSONRPC_METHODS = new Set(["initialize", "ping", "tools/list", "resources/list"]);

function jsonRpcExampleIsPublic(payload, publicTools) {
  if (payload.method === "tools/call") {
    const tool = payload?.params?.name;
    return typeof tool === "string" && publicTools.has(tool);
  }
  return PUBLIC_JSONRPC_METHODS.has(payload.method);
}

async function replayDocumentedExamples() {
  const llmsFullLocal = readLocal(path.join("public", "llms-full.txt"));
  if (!llmsFullLocal) {
    record("local llms-full.txt readable for example replay", false, "missing public/llms-full.txt — run npm run docs:generate");
    return;
  }

  const localDocsReference = parseLocalDocsReference();
  const publicTools = new Set(
    (localDocsReference?.hostedMcpTools || [])
      .filter((tool) => !tool.requiresAuth)
      .map((tool) => tool.name)
  );
  if (publicTools.size === 0) {
    // Fallback if the local manifest predates hosted-tool generation.
    publicTools.add("get_identity");
    publicTools.add("search_profiles");
  }

  const examples = extractReplayExamples(llmsFullLocal).filter((example) =>
    example.kind === "jsonrpc" ? jsonRpcExampleIsPublic(example.payload, publicTools) : true
  );
  record(
    "llms-full.txt documents public examples to replay",
    examples.length > 0,
    `${examples.length} public examples found in local public/llms-full.txt`
  );

  for (const example of examples) {
    if (example.kind === "jsonrpc") {
      const tool = example.payload?.params?.name;
      const label = `replay JSON-RPC ${example.payload.method}${tool ? ` ${tool}` : ""} via POST /api/v1/mcp`;
      try {
        const { response, parsed, url } = await postJson("/api/v1/mcp", example.payload);
        const ok =
          response.ok && parsed != null && !parsed.error && parsed.result?.isError !== true;
        record(
          label,
          ok,
          ok
            ? `${response.status} ${url}`
            : `${response.status} ${url} ${parsed?.error ? `jsonrpc error: ${JSON.stringify(parsed.error)}` : parsed?.result?.isError ? `tool error: ${JSON.stringify(parsed.result.content?.[0]?.text || "")}` : "unparseable response"}`
        );
      } catch (error) {
        record(label, false, error.message);
      }
      continue;
    }

    if (example.kind === "stack-route") {
      const label = "replay stack route example via POST /api/v1/stacks/route";
      try {
        const { response, parsed, url } = await postJson("/api/v1/stacks/route", example.payload);
        const ok = response.ok && parsed != null && !parsed.error;
        record(label, ok, `${response.status} ${url}${ok ? "" : ` ${JSON.stringify(parsed?.error || "unparseable response")}`}`);
      } catch (error) {
        record(label, false, error.message);
      }
      continue;
    }

    const label = `replay GET ${example.path}`;
    try {
      const { response, url } = await fetchText(example.path, example.headers);
      record(label, response.ok, `${response.status} ${url}`);
    } catch (error) {
      record(label, false, error.message);
    }
  }
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
    // U8: once the deployed docs manifest carries split hosted/local counts,
    // hold the deployed llms docs to the split-count phrasing. Until that
    // deploy lands, keep checking the previous phrasing so live smoke stays
    // green against currently deployed docs.
    const hasSplitCounts = typeof docsReference.counts?.hostedMcpTools === "number";

    const expected = hasSplitCounts
      ? [
          `Source hash: ${docsReference.sourceHash}`,
          `CLI version: ${docsReference.cli.version}`,
          `${docsReference.counts.endpoints} documented routes`,
          `${docsReference.counts.internalRoutes} internal/retired routes excluded`,
          `${docsReference.counts.mcpTools} local MCP tools`,
          `${docsReference.counts.hostedMcpTools} hosted MCP tools`,
          `${docsReference.counts.cliCommands} CLI commands`,
          "README, AGENTS.md, and CLAUDE.md",
        ]
      : [
          `Source hash: ${docsReference.sourceHash}`,
          `CLI version: ${docsReference.cli.version}`,
          `${docsReference.counts.endpoints} shipped routes`,
          `${docsReference.counts.mcpTools} MCP tools`,
          "README, AGENTS.md, and CLAUDE.md",
        ];
    const missing = includesAll(llmsResult.body, expected);
    record("llms.txt matches generated docs reference", missing.length === 0, missing.length ? `missing: ${missing.join(", ")}` : expected.join(", "));

    const fullExpected = hasSplitCounts
      ? [
          `Source hash: ${docsReference.sourceHash}`,
          `CLI version: ${docsReference.cli.version}`,
          `Endpoints: ${docsReference.counts.endpoints} documented (${docsReference.counts.internalRoutes} internal/retired routes excluded)`,
          `Local MCP tools: ${docsReference.counts.mcpTools}`,
          `Hosted MCP tools: ${docsReference.counts.hostedMcpTools}`,
          `CLI commands: ${docsReference.counts.cliCommands}`,
          "Hosted MCP tools (`POST /api/v1/mcp`):",
          "## CLI Commands",
          "Generated MCP endpoints:",
          "Generated docs endpoints:",
          "Generated full agent context",
          "Source Repo Handoff",
          "scripts/check-agent-doc-handoff.mjs",
        ]
      : [
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
    "Sanitize cached or generated shell-facing identifiers",
    "Keep repo/branch/runtime metadata local",
    "honest readiness state such as not built, indexing, or ready",
    "narrower retrieval fallback",
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
    "npm run agent-docs:handoff:json",
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
  // Host-agnostic: the sitemap uses the canonical host (www.you.md), so
  // assert the llms paths are present rather than pinning the host.
  const missingSitemap = includesAll(sitemapResult.body, ["/llms.txt", "/llms-full.txt"]);
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
    "npm run agent-docs:handoff:json",
    "npm run agent-docs:lint",
    "npm run agent-docs:ci",
    "PRD, and architecture docs",
    "stale stack/auth language",
    "required/forbidden handoff marker checks",
    "local metadata should stay local by default",
    "protected reads should report honest readiness",
    "retrieval should fall back before it goes silent",
  ]);
  record("docs page documents agent-docs workflow", docsResult.response.ok && missingDocs.length === 0, missingDocs.length ? `missing: ${missingDocs.join(", ")}` : `${docsResult.response.status}`);

  // U8: replay every public documented example from the local generated
  // llms-full.txt against the live base URL.
  await replayDocumentedExamples();

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
