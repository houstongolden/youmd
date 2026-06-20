#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const options = {
  apiBaseUrl: process.env.YOU_API_BASE_URL || process.env.YOUMD_API_BASE_URL || "",
  apiKey: process.env.YOU_API_KEY || process.env.YOUMD_API_KEY || "",
  limit: Number(process.env.YOU_SYNC_GRAPH_SMOKE_LIMIT || 12),
  timeoutMs: Number(process.env.YOU_SYNC_GRAPH_SMOKE_TIMEOUT_MS || 15000),
  includePortfolioSignals: true,
  allowMissingAuth: false,
  json: false,
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--api-base-url") {
    options.apiBaseUrl = args[++index] || "";
  } else if (arg === "--api-key") {
    options.apiKey = args[++index] || "";
  } else if (arg === "--limit") {
    options.limit = Number(args[++index] || options.limit);
  } else if (arg === "--timeout-ms") {
    options.timeoutMs = Number(args[++index] || options.timeoutMs);
  } else if (arg === "--no-portfolio-signals") {
    options.includePortfolioSignals = false;
  } else if (arg === "--allow-missing-auth") {
    options.allowMissingAuth = true;
  } else if (arg === "--json") {
    options.json = true;
  } else if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  } else {
    throw new Error(`Unknown option: ${arg}`);
  }
}

if (!Number.isFinite(options.limit) || options.limit < 4 || options.limit > 50) {
  throw new Error("--limit must be a number from 4 to 50");
}
if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
  throw new Error("--timeout-ms must be a positive number");
}

const config = readYouConfig();
if (!options.apiBaseUrl && config?.apiUrl) options.apiBaseUrl = config.apiUrl;
if (!options.apiKey && config?.apiKey) options.apiKey = config.apiKey;

if (!options.apiBaseUrl) options.apiBaseUrl = "https://kindly-cassowary-600.convex.site";
options.apiBaseUrl = options.apiBaseUrl.replace(/\/+$/, "");

if (!options.apiKey && options.allowMissingAuth) {
  emit({
    ok: false,
    skipped: true,
    reason: "missing auth; set YOU_API_KEY/YOUMD_API_KEY or log in with `you login`",
    apiBaseUrl: options.apiBaseUrl,
  });
  process.exit(0);
}
if (!options.apiKey) {
  throw new Error("Missing auth. Set YOU_API_KEY/YOUMD_API_KEY or log in with `you login`.");
}

function printHelp() {
  console.log(`Usage: node scripts/smoke-synced-brain-graph.mjs [options]

Smoke-test the production synced-brain graph REST endpoint and hosted MCP tool
without printing credentials or raw graph payloads.

Options:
  --api-base-url URL       API origin; defaults to local You.md config or prod Convex
  --api-key KEY            bearer token; defaults to YOU_API_KEY/YOUMD_API_KEY or local config
  --limit N                persisted rows per source to inspect; default 12, max 50
  --timeout-ms N           per-request timeout; default 15000
  --no-portfolio-signals   skip portfolio/task signal joins
  --allow-missing-auth     exit 0 with a skipped result when auth is missing
  --json                   print machine-readable JSON
`);
}

function readYouConfig() {
  const candidates = [
    path.join(os.homedir(), ".you", "config.json"),
    path.join(os.homedir(), ".youmd", "config.json"),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const apiKey = [parsed.apiKey, parsed.key, parsed.token].find((value) => typeof value === "string" && value.length > 0) || "";
      return {
        apiUrl: typeof parsed.apiUrl === "string" ? parsed.apiUrl : "",
        apiKey,
        source: file.replace(os.homedir(), "~"),
      };
    } catch {
      // Try the next config candidate.
    }
  }
  return null;
}

function unsafeTextDetected(text) {
  return /ym_[A-Za-z0-9]|OPENROUTER_API_KEY|PRIVATE KEY|BEGIN .*KEY|\.env\.local\s*=/.test(text);
}

function graphSummary(graph, rawText) {
  return {
    schemaVersion: graph?.schemaVersion,
    generatedAtType: typeof graph?.generatedAt,
    nodes: Array.isArray(graph?.nodes) ? graph.nodes.length : null,
    links: Array.isArray(graph?.links) ? graph.links.length : null,
    signals: Array.isArray(graph?.signals) ? graph.signals.length : null,
    latestActivity: Array.isArray(graph?.latestActivity) ? graph.latestActivity.length : null,
    nodeIds: Array.isArray(graph?.nodes) ? graph.nodes.map((node) => node.id).slice(0, 12) : [],
    evidence: graph?.evidence ? {
      inventoryCount: graph.evidence.inventoryCount,
      machineProofCount: graph.evidence.machineProofCount,
      matchedInventoryProofCount: graph.evidence.matchedInventoryProofCount,
      brainActivityCount: graph.evidence.brainActivityCount,
      recentBrainActivityCount: graph.evidence.recentBrainActivityCount,
      projectCount: graph.evidence.projectCount,
      focusedProjectCount: graph.evidence.focusedProjectCount,
      openTaskCount: graph.evidence.openTaskCount,
      secretValuesExposed: graph.evidence.secretValuesExposed,
    } : null,
    unsafeTextDetected: unsafeTextDetected(rawText),
  };
}

function validateGraphSummary(label, summary) {
  const issues = [];
  if (summary.schemaVersion !== "you-md/synced-brain-graph/v1") issues.push("unexpected schemaVersion");
  if (summary.generatedAtType !== "number") issues.push("generatedAt is not numeric");
  if (!summary.nodes || summary.nodes < 5) issues.push("too few graph nodes");
  if (!summary.links || summary.links < 4) issues.push("too few graph links");
  if (!summary.signals || summary.signals < 4) issues.push("too few graph signals");
  if (!summary.evidence) issues.push("missing evidence");
  if (summary.evidence?.secretValuesExposed !== false) issues.push("secretValuesExposed is not false");
  if (summary.unsafeTextDetected) issues.push("unsafe secret-like text detected");
  return {
    label,
    ok: issues.length === 0,
    issues,
    summary,
  };
}

function summariesMatch(rest, mcp) {
  return rest.schemaVersion === mcp.schemaVersion &&
    rest.nodes === mcp.nodes &&
    rest.links === mcp.links &&
    rest.signals === mcp.signals &&
    rest.latestActivity === mcp.latestActivity &&
    rest.evidence?.secretValuesExposed === mcp.evidence?.secretValuesExposed;
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRestGraph() {
  const params = new URLSearchParams({
    limit: String(options.limit),
    includePortfolioSignals: options.includePortfolioSignals ? "true" : "false",
  });
  const url = `${options.apiBaseUrl}/api/v1/me/synced-brain/graph?${params.toString()}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "user-agent": "youmd-synced-brain-graph-smoke/1.0",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`REST graph failed: ${response.status} ${text.slice(0, 180)}`);
  }
  return { text, graph: JSON.parse(text) };
}

async function fetchMcpGraph() {
  const url = `${options.apiBaseUrl}/api/v1/mcp`;
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "get_synced_brain_graph",
      arguments: {
        limit: options.limit,
        include_portfolio_signals: options.includePortfolioSignals,
      },
    },
    id: 1,
  };
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      "user-agent": "youmd-synced-brain-graph-smoke/1.0",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MCP graph failed: ${response.status} ${text.slice(0, 180)}`);
  }
  const rpc = JSON.parse(text);
  if (rpc.error || rpc.result?.isError) {
    throw new Error(`MCP graph JSON-RPC error: ${JSON.stringify(rpc.error || rpc.result?.content?.[0]?.text || "tool error")}`);
  }
  const graphText = rpc.result?.content?.[0]?.text;
  if (typeof graphText !== "string") throw new Error("MCP graph returned no text content");
  return { text: graphText, graph: JSON.parse(graphText) };
}

function emit(result) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.skipped) {
    console.log(`synced-brain graph smoke skipped: ${result.reason}`);
    return;
  }
  console.log(`synced-brain graph smoke ${result.ok ? "passed" : "failed"}`);
  console.log(`api: ${result.apiBaseUrl}`);
  for (const check of result.checks || []) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
    const summary = check.summary;
    if (summary) {
      console.log(`  schema=${summary.schemaVersion} nodes=${summary.nodes} links=${summary.links} signals=${summary.signals} latest=${summary.latestActivity}`);
      console.log(`  evidence inventories=${summary.evidence?.inventoryCount ?? "?"} proofs=${summary.evidence?.machineProofCount ?? "?"} activities=${summary.evidence?.brainActivityCount ?? "?"} projects=${summary.evidence?.projectCount ?? "?"} tasks=${summary.evidence?.openTaskCount ?? "?"}`);
      console.log(`  secretValuesExposed=${summary.evidence?.secretValuesExposed} unsafeTextDetected=${summary.unsafeTextDetected}`);
    }
    if (check.issues?.length) console.log(`  issues: ${check.issues.join(", ")}`);
  }
  if (result.parity) console.log(`${result.parity.ok ? "✓" : "✗"} ${result.parity.label}`);
}

async function main() {
  const [rest, mcp] = await Promise.all([fetchRestGraph(), fetchMcpGraph()]);
  const restCheck = validateGraphSummary("REST /api/v1/me/synced-brain/graph", graphSummary(rest.graph, rest.text));
  const mcpCheck = validateGraphSummary("MCP get_synced_brain_graph", graphSummary(mcp.graph, mcp.text));
  const parity = {
    label: "REST and MCP graph summaries match",
    ok: summariesMatch(restCheck.summary, mcpCheck.summary),
  };
  const result = {
    ok: restCheck.ok && mcpCheck.ok && parity.ok,
    apiBaseUrl: options.apiBaseUrl,
    configSource: config?.source ?? null,
    includePortfolioSignals: options.includePortfolioSignals,
    limit: options.limit,
    checks: [restCheck, mcpCheck],
    parity,
  };
  emit(result);
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  emit({
    ok: false,
    apiBaseUrl: options.apiBaseUrl,
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
