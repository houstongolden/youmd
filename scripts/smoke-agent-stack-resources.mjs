#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const options = {
  apiBaseUrl: process.env.YOU_API_BASE_URL || process.env.YOUMD_API_BASE_URL || "",
  apiKey: process.env.YOU_API_KEY || process.env.YOUMD_API_KEY || "",
  limit: Number(process.env.YOU_AGENT_STACK_SMOKE_LIMIT || 12),
  timeoutMs: Number(process.env.YOU_AGENT_STACK_SMOKE_TIMEOUT_MS || 15000),
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

if (!Number.isFinite(options.limit) || options.limit < 1 || options.limit > 50) {
  throw new Error("--limit must be a number from 1 to 50");
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
  console.log(`Usage: node scripts/smoke-agent-stack-resources.mjs [options]

Smoke-test the authenticated agent-stack inventory REST endpoints, hosted MCP
tool, and hosted MCP resources without printing credentials or raw report files.

Options:
  --api-base-url URL       API origin; defaults to local You.md config or prod Convex
  --api-key KEY            bearer token; defaults to YOU_API_KEY/YOUMD_API_KEY or local config
  --limit N                persisted inventory rows to inspect; default 12, max 50
  --timeout-ms N           per-request timeout; default 15000
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

function safeJsonParse(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
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

async function fetchRest(pathname) {
  const url = `${options.apiBaseUrl}${pathname}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "user-agent": "youmd-agent-stack-resource-smoke/1.0",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`REST ${pathname} failed: ${response.status} ${text.slice(0, 180)}`);
  }
  return { text, json: safeJsonParse(text, pathname) };
}

async function mcp(method, params, id) {
  const response = await fetchWithTimeout(`${options.apiBaseUrl}/api/v1/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      "user-agent": "youmd-agent-stack-resource-smoke/1.0",
    },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`MCP ${method} failed: ${response.status} ${text.slice(0, 180)}`);
  }
  const rpc = safeJsonParse(text, `MCP ${method}`);
  if (rpc.error || rpc.result?.isError) {
    throw new Error(`MCP ${method} JSON-RPC error: ${JSON.stringify(rpc.error || rpc.result?.content?.[0]?.text || "tool error")}`);
  }
  return rpc.result;
}

async function mcpRead(uri, id) {
  const result = await mcp("resources/read", { uri }, id);
  const content = result?.contents?.[0];
  if (!content || typeof content.text !== "string") {
    throw new Error(`MCP resources/read ${uri} returned no text content`);
  }
  return content;
}

function restInventorySummary(restInventories, restDrift, rawText) {
  const inventories = Array.isArray(restInventories?.inventories) ? restInventories.inventories : [];
  const latest = inventories[0] || {};
  return {
    inventories: inventories.length,
    driftSchema: restDrift?.schemaVersion,
    driftMachines: restDrift?.summary?.machineCount ?? null,
    uniqueSkillNames: latest.uniqueSkillNames ?? null,
    uniqueRealSkillFiles: latest.uniqueRealSkillFiles ?? null,
    missingCatalog: latest.missingFromYoumdCatalog ?? null,
    dryReview: latest.duplicateNameDifferentRealpaths ?? null,
    secretValuesExposed: inventories.some((row) => row?.secretValuesExposed === true),
    unsafeTextDetected: unsafeTextDetected(rawText),
  };
}

function mcpToolSummary(payload, rawText) {
  const inventories = Array.isArray(payload?.inventories) ? payload.inventories : [];
  const latest = inventories[0] || {};
  const files = Array.isArray(payload?.repoSnapshot?.files) ? payload.repoSnapshot.files : [];
  return {
    schemaVersion: payload?.schemaVersion,
    inventories: inventories.length,
    driftSchema: payload?.drift?.schemaVersion ?? null,
    repo: payload?.repoSnapshot?.repo ?? null,
    repoFiles: files.map((file) => file.path),
    uniqueSkillNames: latest.uniqueSkillNames ?? null,
    missingCatalog: latest.missingFromYoumdCatalog ?? null,
    secretValuesExposed: payload?.secretValuesExposed,
    unsafeTextDetected: unsafeTextDetected(rawText),
  };
}

function mcpResourceSummary(payload, rawText) {
  const inventories = Array.isArray(payload?.inventories) ? payload.inventories : [];
  const latest = inventories[0] || {};
  return {
    schemaVersion: payload?.schemaVersion,
    inventories: inventories.length,
    driftSchema: payload?.drift?.schemaVersion ?? null,
    repo: payload?.repoSnapshot?.repo ?? null,
    missingPaths: Array.isArray(payload?.repoSnapshot?.missingPaths) ? payload.repoSnapshot.missingPaths : [],
    resourceUris: Array.isArray(payload?.repoSnapshot?.resourceUris) ? payload.repoSnapshot.resourceUris.map((row) => row.uri) : [],
    uniqueSkillNames: latest.uniqueSkillNames ?? null,
    missingCatalog: latest.missingFromYoumdCatalog ?? null,
    secretValuesExposed: payload?.secretValuesExposed,
    unsafeTextDetected: unsafeTextDetected(rawText),
  };
}

function htmlSummary(content) {
  return {
    uri: content.uri,
    mimeType: content.mimeType,
    bytes: content.text.length,
    hasTitle: /<title>You\.md Skill Mesh Report<\/title>/.test(content.text),
    hasNoSecretsCopy: /raw skill bodies, prompt logs, env values, tokens, and vault contents are not included/.test(content.text),
    unsafeTextDetected: unsafeTextDetected(content.text),
  };
}

function repoFileSummary(uri, content) {
  return {
    uri,
    mimeType: content.mimeType,
    bytes: content.text.length,
    unsafeTextDetected: unsafeTextDetected(content.text),
  };
}

function validate(label, summary) {
  const issues = [];
  if (label === "REST agent-stack summaries") {
    if (!summary.inventories || summary.inventories < 1) issues.push("no synced inventories");
    if (summary.driftSchema !== "you-md/agent-stack-drift/v1") issues.push("unexpected drift schema");
    if (!summary.uniqueSkillNames || summary.uniqueSkillNames < 1) issues.push("missing skill counts");
    if (summary.secretValuesExposed !== false) issues.push("secret exposure flag not false");
  }
  if (label === "MCP get_agent_stack_inventory") {
    if (summary.schemaVersion !== "you-md/agent-stack-mcp/v1") issues.push("unexpected MCP schema");
    if (!summary.inventories || summary.inventories < 1) issues.push("no MCP inventories");
    if (!summary.repoFiles?.includes("agent-stack/inventory.json")) issues.push("repo snapshot inventory.json missing");
    if (summary.secretValuesExposed !== false) issues.push("secret exposure flag not false");
  }
  if (label === "MCP agent-stack resource summary") {
    if (summary.schemaVersion !== "you-md/agent-stack-resource-summary/v1") issues.push("unexpected resource schema");
    if (!summary.inventories || summary.inventories < 1) issues.push("no resource inventories");
    if (!summary.resourceUris?.includes("agent-stack://repo/inventory.json")) issues.push("repo resource URI missing");
    if (summary.secretValuesExposed !== false) issues.push("secret exposure flag not false");
  }
  if (label === "MCP generated HTML report") {
    if (summary.mimeType !== "text/html") issues.push("HTML resource mime type mismatch");
    if (!summary.hasTitle) issues.push("HTML title missing");
    if (!summary.hasNoSecretsCopy) issues.push("HTML no-secrets copy missing");
    if (summary.bytes < 1000) issues.push("HTML report unexpectedly small");
  }
  if (label.startsWith("MCP repo resource")) {
    if (summary.bytes < 20) issues.push("repo resource unexpectedly small");
  }
  if (summary.unsafeTextDetected) issues.push("unsafe secret-like text detected");
  return { label, ok: issues.length === 0, issues, summary };
}

function emit(result) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.skipped) {
    console.log(`agent-stack resource smoke skipped: ${result.reason}`);
    return;
  }
  console.log(`agent-stack resource smoke ${result.ok ? "passed" : "failed"}`);
  console.log(`api: ${result.apiBaseUrl}`);
  for (const check of result.checks || []) {
    console.log(`${check.ok ? "✓" : "✗"} ${check.label}`);
    const summary = check.summary;
    if (summary) {
      if ("inventories" in summary) {
        console.log(`  inventories=${summary.inventories} skills=${summary.uniqueSkillNames ?? "?"} gaps=${summary.missingCatalog ?? "?"} drift=${summary.driftSchema ?? "?"}`);
      }
      if ("repoFiles" in summary) console.log(`  repoFiles=${summary.repoFiles.join(",") || "none"}`);
      if ("resourceUris" in summary) console.log(`  resources=${summary.resourceUris.join(",") || "none"}`);
      if ("bytes" in summary) console.log(`  mime=${summary.mimeType} bytes=${summary.bytes}`);
      console.log(`  secretValuesExposed=${summary.secretValuesExposed ?? "n/a"} unsafeTextDetected=${summary.unsafeTextDetected}`);
    }
    if (check.issues?.length) console.log(`  issues: ${check.issues.join(", ")}`);
  }
  if (result.resourcesList) {
    console.log(`✓ resources/list contains ${result.resourcesList.agentStackResources} agent-stack resources`);
  }
}

async function main() {
  const [restInventories, restDrift, toolResult, resourcesList] = await Promise.all([
    fetchRest(`/api/v1/me/agent-stack/inventories?limit=${options.limit}`),
    fetchRest(`/api/v1/me/agent-stack/drift?limit=${options.limit}`),
    mcp("tools/call", {
      name: "get_agent_stack_inventory",
      arguments: { limit: options.limit, include_repo_snapshot: true, include_drift: true },
    }, 1),
    mcp("resources/list", {}, 2),
  ]);

  const toolText = toolResult?.content?.[0]?.text;
  if (typeof toolText !== "string") throw new Error("MCP get_agent_stack_inventory returned no text content");
  const toolPayload = safeJsonParse(toolText, "MCP get_agent_stack_inventory");
  const resources = Array.isArray(resourcesList?.resources) ? resourcesList.resources : [];
  const requiredUris = [
    "agent-stack://inventory/summary",
    "agent-stack://inventory/report.html",
    "agent-stack://repo/README.md",
    "agent-stack://repo/inventory.md",
    "agent-stack://repo/inventory.json",
  ];
  const listedUris = new Set(resources.map((resource) => resource.uri));
  const missingListedUris = requiredUris.filter((uri) => !listedUris.has(uri));
  if (missingListedUris.length) {
    throw new Error(`resources/list missing ${missingListedUris.join(", ")}`);
  }

  const [summaryResource, htmlResource, readmeResource, markdownResource, jsonResource] = await Promise.all([
    mcpRead("agent-stack://inventory/summary", 3),
    mcpRead("agent-stack://inventory/report.html", 4),
    mcpRead("agent-stack://repo/README.md", 5),
    mcpRead("agent-stack://repo/inventory.md", 6),
    mcpRead("agent-stack://repo/inventory.json", 7),
  ]);
  const summaryPayload = safeJsonParse(summaryResource.text, "agent-stack://inventory/summary");

  const checks = [
    validate("REST agent-stack summaries", restInventorySummary(restInventories.json, restDrift.json, `${restInventories.text}\n${restDrift.text}`)),
    validate("MCP get_agent_stack_inventory", mcpToolSummary(toolPayload, toolText)),
    validate("MCP agent-stack resource summary", mcpResourceSummary(summaryPayload, summaryResource.text)),
    validate("MCP generated HTML report", htmlSummary(htmlResource)),
    validate("MCP repo resource README.md", repoFileSummary("agent-stack://repo/README.md", readmeResource)),
    validate("MCP repo resource inventory.md", repoFileSummary("agent-stack://repo/inventory.md", markdownResource)),
    validate("MCP repo resource inventory.json", repoFileSummary("agent-stack://repo/inventory.json", jsonResource)),
  ];
  const result = {
    ok: checks.every((check) => check.ok),
    apiBaseUrl: options.apiBaseUrl,
    configSource: config?.source ?? null,
    limit: options.limit,
    resourcesList: {
      agentStackResources: resources.filter((resource) => typeof resource.uri === "string" && resource.uri.startsWith("agent-stack://")).length,
    },
    checks,
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
