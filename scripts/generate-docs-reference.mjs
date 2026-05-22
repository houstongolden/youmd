#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const OUT_FILE = path.join(ROOT, "src", "generated", "docs-reference.ts");
const OUT_OPENAPI_FILE = path.join(ROOT, "src", "generated", "openapi.ts");
const CHECK_ONLY = process.argv.includes("--check");

const HTTP_SOURCE = path.join(ROOT, "convex", "http.ts");
const MCP_SOURCE = path.join(ROOT, "cli", "src", "mcp", "server.ts");
const CLI_PACKAGE = path.join(ROOT, "cli", "package.json");
const NEXT_API_ROOTS = [
  path.join(ROOT, "src", "app", "api"),
  path.join(ROOT, "src", "app", "(app)"),
  path.join(ROOT, "src", "app", ".well-known"),
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function trimDescription(value, max = 220) {
  const oneLine = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—\s]+/, "")
    .trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}

function trailingRouteComment(source, index, method, routePath) {
  const before = source.slice(0, index).split("\n");
  const comments = [];

  for (let i = before.length - 1; i >= 0; i -= 1) {
    const line = before[i].trim();
    if (!line && comments.length === 0) continue;
    if (!line.startsWith("//")) break;
    comments.unshift(line.replace(/^\/\/\s?/, ""));
    if (comments.length >= 4) break;
  }

  const joined = comments.join(" ");
  const explicit = joined.match(
    new RegExp(`${method}\\s+${routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[—-]\\s*(.+)`, "i")
  );
  if (explicit?.[1]) return trimDescription(explicit[1]);

  const loose = joined.match(/(?:GET|POST|PUT|PATCH|DELETE)\s+[^\s]+(?:\s*[—-]\s*)?(.+)/i);
  if (loose?.[1]) return trimDescription(loose[1]);

  return trimDescription(joined || "Convex HTTP action");
}

function categoryFor(routePath) {
  if (routePath.startsWith("/api/admin")) return "Admin";
  if (routePath === "/.well-known/mcp.json" || routePath === "/api/v1/mcp") return "MCP";
  if (routePath.startsWith("/api/auth") || routePath.startsWith("/api/v1/auth")) return "Auth";
  if (routePath.startsWith("/ctx")) return "Context Links";
  if (routePath.startsWith("/api/v1/me/skills") || routePath === "/api/v1/skills") return "Skills";
  if (routePath.startsWith("/api/v1/me/memories")) return "Memories";
  if (routePath.startsWith("/api/v1/me/context-links")) return "Context Links";
  if (routePath.startsWith("/api/v1/me/private") || routePath.startsWith("/api/v1/me/vault")) return "Private Context";
  if (routePath.startsWith("/api/v1/me/activity") || routePath.startsWith("/api/v1/me/agents")) return "Activity";
  if (routePath.startsWith("/api/v1/me")) return "Account";
  if (routePath.startsWith("/api/v1/chat")) return "Chat";
  if (routePath.startsWith("/api/v1/docs")) return "Docs";
  if (
    routePath.startsWith("/api/v1/scrape") ||
    routePath.startsWith("/api/v1/research") ||
    routePath.startsWith("/api/v1/enrich") ||
    routePath.startsWith("/api/v1/verify")
  ) {
    return "Enrichment";
  }
  if (routePath.startsWith("/api/v1/profiles") || routePath.startsWith("/api/v1/check-username")) return "Public Identity";
  if (routePath.startsWith("/schema")) return "Schema";
  return "Other";
}

function authFor(routePath, method) {
  if (method === "OPTIONS") return "CORS preflight";
  if (routePath.startsWith("/api/admin")) return "Admin secret";
  if (routePath.startsWith("/api/v1/me")) return "Bearer API key";
  if (routePath === "/api/v1/chat/compact") return "Bearer API key";
  if (routePath === "/api/v1/mcp") return "JSON-RPC, optional Bearer API key";
  if (routePath.startsWith("/api/auth")) return "HTTP-only session flow";
  if (routePath.startsWith("/ctx")) return "Scoped context token";
  return "Public or rate-limited";
}

const SUMMARY_OVERRIDES = new Map([
  ["GET /.well-known/mcp.json", "MCP discovery metadata for agent clients"],
  ["GET /api/v1/mcp", "MCP discovery ping and HTTP transport metadata"],
  ["POST /api/v1/mcp", "JSON-RPC MCP endpoint for web-capable clients"],
  ["POST /api/v1/chat", "Non-streaming You Agent chat route"],
  ["POST /api/v1/auth/login", "Legacy CLI auth route with migration response"],
  ["POST /api/v1/auth/register", "Legacy CLI registration route with migration response"],
  ["POST /api/v1/webhooks/clerk", "Deprecated Clerk webhook route"],
]);

function summaryFor(method, routePath, fallback) {
  return SUMMARY_OVERRIDES.get(`${method} ${routePath}`) || fallback;
}

function parseConvexRoutes() {
  const source = read(HTTP_SOURCE);
  const routes = [];
  const routeRegex = /http\.route\(\{\s*([\s\S]*?)handler\s*:/g;
  let match;

  while ((match = routeRegex.exec(source))) {
    const body = match[1];
    const routePath = body.match(/path:\s*"([^"]+)"/)?.[1];
    const method = body.match(/method:\s*"([^"]+)"/)?.[1];
    if (!routePath || !method || method === "OPTIONS") continue;

    routes.push({
      method,
      path: routePath,
      category: categoryFor(routePath),
      auth: authFor(routePath, method),
      source: "convex",
      summary: summaryFor(method, routePath, trailingRouteComment(source, match.index, method, routePath)),
    });
  }

  return routes;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function routePathFromNextFile(file) {
  let rel = path.relative(path.join(ROOT, "src", "app"), file);
  rel = rel.replace(/\/route\.ts$/, "");
  const segments = rel
    .split(path.sep)
    .filter((segment) => segment && !/^\(.+\)$/.test(segment))
    .map((segment) => {
      if (/^\[\.\.\.(.+)\]$/.test(segment)) return `{${segment.slice(4, -1)}...}`;
      if (/^\[(.+)\]$/.test(segment)) return `{${segment.slice(1, -1)}}`;
      return segment;
    });
  return "/" + segments.join("/");
}

function parseNextRoutes() {
  const routeFiles = NEXT_API_ROOTS
    .flatMap((root) => walk(root))
    .filter((file) => file.endsWith(`${path.sep}route.ts`));

  const routes = [];
  for (const file of routeFiles) {
    const source = read(file);
    const methods = [...source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)]
      .map((m) => m[1])
      .filter((method) => method !== "OPTIONS" && method !== "HEAD");

    const uniqueMethods = [...new Set(methods)];
    for (const method of uniqueMethods) {
      const routePath = routePathFromNextFile(file);
      routes.push({
        method,
        path: routePath,
        category: categoryFor(routePath),
        auth: authFor(routePath, method),
        source: "next",
        summary:
          routePath === "/api/v1/docs/reference"
            ? "Machine-readable docs manifest generated from routes and MCP tools"
            : routePath === "/api/v1/mcp"
            ? "Same-origin MCP proxy to the Convex JSON-RPC endpoint"
            : routePath.startsWith("/api/v1/chat")
              ? "Same-origin web chat proxy to Convex"
              : "Next.js route",
      });
    }
  }
  return routes;
}

function mergeRoutes(routes) {
  const byKey = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...route, sources: [route.source] });
      continue;
    }
    existing.sources = [...new Set([...existing.sources, route.source])];
    existing.source = existing.sources.join(" + ");
    if (existing.summary === "Next.js route" && route.summary !== "Next.js route") {
      existing.summary = route.summary;
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const category = a.category.localeCompare(b.category);
    if (category !== 0) return category;
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    return a.method.localeCompare(b.method);
  });
}

function extractBalanced(source, startIndex, openChar, closeChar) {
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;
    if (depth === 0) return source.slice(startIndex, i + 1);
  }
  return "";
}

function splitTopLevelObjects(arraySource) {
  const objects = [];
  for (let i = 0; i < arraySource.length; i += 1) {
    if (arraySource[i] !== "{") continue;
    const objectSource = extractBalanced(arraySource, i, "{", "}");
    if (objectSource) {
      objects.push(objectSource);
      i += objectSource.length - 1;
    }
  }
  return objects;
}

function parseMcpTools() {
  const source = read(MCP_SOURCE);
  const listToolsIndex = source.indexOf("ListToolsRequestSchema");
  const toolsIndex = source.indexOf("tools: [", listToolsIndex);
  if (toolsIndex === -1) return [];

  const arrayStart = source.indexOf("[", toolsIndex);
  const arraySource = extractBalanced(source, arrayStart, "[", "]");

  return splitTopLevelObjects(arraySource)
    .map((objectSource) => {
      const name = objectSource.match(/name:\s*"([^"]+)"/)?.[1];
      const description = objectSource.match(/description:\s*"([^"]+)"/s)?.[1];
      const requiredMatch = objectSource.match(/required:\s*\[([^\]]*)\]/s);
      const required = requiredMatch
        ? [...requiredMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
        : [];
      const fieldMatches = [...objectSource.matchAll(/^\s{14,}([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm)]
        .map((m) => m[1])
        .filter((field) => !["type", "properties", "items"].includes(field));

      if (!name || !description) return null;
      return {
        name,
        description: trimDescription(description, 360),
        inputFields: [...new Set(fieldMatches)],
        required,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseCliMetadata() {
  const pkg = JSON.parse(read(CLI_PACKAGE) || "{}");
  return {
    version: pkg.version || "unknown",
  };
}

function openApiPath(routePath) {
  return routePath.replace(/\{([^}.]+)\.\.\.\}/g, "{$1}");
}

function operationId(method, routePath) {
  const name = `${method.toLowerCase()}_${routePath}`
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return name || `${method.toLowerCase()}Root`;
}

function buildOpenApiSpec(endpoints, cli) {
  const paths = {};
  for (const endpoint of endpoints) {
    if (["Admin", "Other"].includes(endpoint.category)) continue;

    const apiPath = openApiPath(endpoint.path);
    paths[apiPath] ||= {};
    paths[apiPath][endpoint.method.toLowerCase()] = {
      operationId: operationId(endpoint.method, endpoint.path),
      summary: endpoint.summary,
      tags: [endpoint.category],
      "x-youmd-auth": endpoint.auth,
      "x-youmd-source": endpoint.source,
      responses: {
        "200": {
          description: "Successful response",
        },
        default: {
          description: "Error response",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: { type: "string" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
      },
    };

    if (endpoint.auth.includes("Bearer")) {
      paths[apiPath][endpoint.method.toLowerCase()].security = [{ bearerAuth: [] }];
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "You.md API",
      version: cli.version,
      description:
        "Generated source-of-truth API inventory for the You.md identity context protocol.",
    },
    servers: [
      { url: "https://www.you.md", description: "Production web origin" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "You.md API key, usually prefixed with ym_.",
        },
      },
    },
    paths,
  };
}

const convexRoutes = parseConvexRoutes();
const nextRoutes = parseNextRoutes();
const endpoints = mergeRoutes([...convexRoutes, ...nextRoutes]);
const mcpTools = parseMcpTools();
const cli = parseCliMetadata();
const openApiSpec = buildOpenApiSpec(endpoints, cli);

const sourceHash = sha256(
  JSON.stringify({
    endpoints,
    mcpTools,
    cli,
  })
);

const generated = `/* eslint-disable */\n// This file is generated by scripts/generate-docs-reference.mjs.\n// Do not edit by hand; update the route/tool source and run npm run docs:generate.\n\nexport type DocsEndpoint = {\n  method: string;\n  path: string;\n  category: string;\n  auth: string;\n  source: string;\n  sources: readonly string[];\n  summary: string;\n};\n\nexport type DocsMcpTool = {\n  name: string;\n  description: string;\n  inputFields: readonly string[];\n  required: readonly string[];\n};\n\nexport const docsReference = ${JSON.stringify(
  {
    sourceHash,
    cli,
    counts: {
      endpoints: endpoints.length,
      mcpTools: mcpTools.length,
      convexRoutes: convexRoutes.length,
      nextRoutes: nextRoutes.length,
    },
    endpoints,
    mcpTools,
  },
  null,
  2
)} as const;\n`;

const generatedOpenApi = `/* eslint-disable */\n// This file is generated by scripts/generate-docs-reference.mjs.\n// Do not edit by hand; update the route source and run npm run docs:generate.\n\nexport const openApiSpec = ${JSON.stringify(openApiSpec, null, 2)} as const;\n`;

if (CHECK_ONLY) {
  const current = read(OUT_FILE);
  const currentOpenApi = read(OUT_OPENAPI_FILE);
  if (current !== generated || currentOpenApi !== generatedOpenApi) {
    console.error("docs reference is out of date. run: npm run docs:generate");
    process.exit(1);
  }
  console.log("docs reference is current");
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, generated);
fs.writeFileSync(OUT_OPENAPI_FILE, generatedOpenApi);
console.log(
  `generated docs reference: ${endpoints.length} endpoints, ${mcpTools.length} MCP tools`
);
