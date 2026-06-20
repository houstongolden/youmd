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
const HOSTED_MCP_REGISTRY_SOURCE = path.join(ROOT, "convex", "lib", "mcpRegistry.ts");
const MCP_SOURCE = path.join(ROOT, "cli", "src", "mcp", "server.ts");
const CLI_PACKAGE = path.join(ROOT, "cli", "package.json");
const CLI_INDEX_SOURCE = path.join(ROOT, "cli", "src", "index.ts");
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

// P25 (honest endpoint counts): routes that ship in convex/http.ts or Next
// route files but are intentionally NOT documented for public agents.
// convex/http.ts cannot carry doc markers (docs tooling must not edit it), so
// this list is the single exclusion point. Every entry needs a reason; an
// entry that no longer matches a parsed route fails generation so the list
// cannot go stale.
const INTERNAL_ROUTES = new Map([
  // Retired auth surface: permanent 410 stubs that only return a migration
  // message to stale CLI builds (convex/http.ts "LEGACY AUTH ROUTES").
  ["POST /api/v1/auth/register", "retired 410 stub after the first-party passwordless migration"],
  ["POST /api/v1/auth/login", "retired 410 stub after the first-party passwordless migration"],
  // Retired webhook: permanent 410 stub kept so stale Clerk deliveries fail loudly.
  ["POST /api/v1/webhooks/clerk", "retired 410 stub; Clerk auth was removed"],
  // Internal admin plumbing: gated by the admin secret / trusted internal
  // auth token, never meant for public agents.
  ["POST /api/admin/reseed", "internal admin helper gated by the admin secret"],
  ["POST /api/admin/profiles/import-targets", "internal admin helper gated by the admin secret"],
  ["POST /api/admin/profiles/fetch-sources", "internal admin helper gated by the admin secret"],
  // Machine-to-machine plumbing: GitHub App webhook receiver authenticated by
  // an HMAC signature; agents cannot usefully call it.
  ["POST /api/github/webhook", "GitHub App webhook receiver authenticated by HMAC signature"],
  // Localhost-only signed-in shell surface for inspecting the current laptop or
  // agent host. This reports local filesystem readiness metadata and is not a
  // hosted/public agent API.
  ["GET /api/local/browser-session", "localhost-only CLI-to-browser session bootstrap for local visual testing"],
  ["GET /api/local/agent-stack-report", "localhost-only signed-in agent stack HTML report viewer"],
  ["GET /api/local/machine-readiness", "localhost-only signed-in machine readiness metadata"],
  ["POST /api/local/skill-mesh-repair", "localhost-only signed-in Skill Mesh repair bridge for whitelisted local CLI actions"],
]);

// Every documented endpoint must land in one of these categories. The docs
// page and llms docs render by category, so an endpoint outside this set
// would be counted but never shown — exactly the dishonest-count bug P25
// fixed. New routes must either get a category here or an INTERNAL_ROUTES
// entry; otherwise generation fails.
const DOCUMENTED_CATEGORIES = new Set([
  "Account",
  "Activity",
  "Auth",
  "Chat",
  "Context Links",
  "Docs",
  "Enrichment",
  "MCP",
  "Memories",
  "Private Context",
  "Public Identity",
  "Schema",
  "Skills",
  "YouStacks",
]);

function categoryFor(routePath) {
  if (routePath.startsWith("/api/admin")) return "Admin";
  if (routePath === "/.well-known/jwks.json") return "Auth";
  if (routePath === "/{username}/you.json" || routePath === "/{username}/you.txt") {
    return "Public Identity";
  }
  if (routePath === "/.well-known/mcp.json" || routePath === "/api/v1/mcp") return "MCP";
  if (routePath.startsWith("/api/auth") || routePath.startsWith("/api/v1/auth")) return "Auth";
  if (routePath.startsWith("/ctx")) return "Context Links";
  if (routePath.startsWith("/api/v1/stacks")) return "YouStacks";
  if (routePath.startsWith("/api/v1/me/skills") || routePath === "/api/v1/skills") return "Skills";
  if (routePath.startsWith("/api/v1/me/memories")) return "Memories";
  if (routePath.startsWith("/api/v1/me/context-links")) return "Context Links";
  if (routePath.startsWith("/api/v1/me/private") || routePath.startsWith("/api/v1/me/vault")) return "Private Context";
  if (routePath.startsWith("/api/v1/me/activity") || routePath.startsWith("/api/v1/me/agents")) return "Activity";
  if (routePath.startsWith("/api/v1/me")) return "Account";
  if (routePath.startsWith("/api/v1/chat")) return "Chat";
  // T13 — service health probe; documented alongside the docs/meta surface.
  if (routePath === "/api/v1/health") return "Docs";
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
  ["GET /api/v1/docs/openapi.json", "OpenAPI-style inventory generated from shipped You.md API routes"],
  ["GET /schema/you-md/v1.json", "Canonical you-md/v1 public brain JSON Schema"],
  ["POST /api/v1/chat", "Non-streaming You Agent chat route"],
  ["GET /api/v1/stacks/capabilities", "Shared YouStack capability contract and API/MCP threshold map"],
  ["POST /api/v1/stacks/route", "Deterministically route a request against default or manifest-supplied YouStack capabilities"],
  ["GET /.well-known/jwks.json", "Public JWKS used to verify first-party session JWTs"],
  ["GET /{username}/you.json", "Direct public brain JSON for a username (no JS required; ETag + schema Link preserved)"],
  ["GET /{username}/you.txt", "Direct public brain markdown for a username (no JS required; ETag + schema Link preserved)"],
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
      const fallbackSummary =
        routePath === "/api/v1/docs/reference"
          ? "Machine-readable docs manifest generated from routes and MCP tools"
          : routePath === "/api/v1/mcp"
            ? "Same-origin MCP proxy to the Convex JSON-RPC endpoint"
            : routePath.startsWith("/api/v1/chat")
              ? "Same-origin web chat proxy to Convex"
              : "Next.js route";

      routes.push({
        method,
        path: routePath,
        category: categoryFor(routePath),
        auth: authFor(routePath, method),
        source: "next",
        summary: summaryFor(method, routePath, fallbackSummary),
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

// P25: split merged routes into the documented set (what every count, docs
// page table, llms file, and OpenAPI path reflects) and the internal set.
// Fails loudly when the exclusion list is stale or a route has no documented
// category, so the published count always equals what is actually documented.
function partitionRoutes(mergedRoutes) {
  const documented = [];
  const internal = [];
  const matchedExclusions = new Set();

  for (const route of mergedRoutes) {
    const key = `${route.method} ${route.path}`;
    const reason = INTERNAL_ROUTES.get(key);
    if (reason) {
      matchedExclusions.add(key);
      internal.push({ method: route.method, path: route.path, reason });
      continue;
    }
    documented.push(route);
  }

  const staleExclusions = [...INTERNAL_ROUTES.keys()].filter(
    (key) => !matchedExclusions.has(key)
  );
  if (staleExclusions.length > 0) {
    console.error(
      `INTERNAL_ROUTES entries no longer match any parsed route:\n${staleExclusions
        .map((key) => `- ${key}`)
        .join("\n")}\nRemove them from scripts/generate-docs-reference.mjs.`
    );
    process.exit(1);
  }

  const uncategorized = documented.filter(
    (route) => !DOCUMENTED_CATEGORIES.has(route.category)
  );
  if (uncategorized.length > 0) {
    console.error(
      `Routes without a documented category (would be counted but never shown):\n${uncategorized
        .map((route) => `- ${route.method} ${route.path} (${route.category})`)
        .join("\n")}\nAdd a category in categoryFor() or an INTERNAL_ROUTES entry.`
    );
    process.exit(1);
  }

  return { documented, internal };
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

// Object keys directly inside the outermost braces of `objectSource`
// (a balanced "{ ... }" slice). Used to read inputSchema.properties keys.
function topLevelKeys(objectSource) {
  const keys = [];
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let escaped = false;

  for (let i = 0; i < objectSource.length; i += 1) {
    const ch = objectSource[i];
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
    if (ch === "{" || ch === "[" || ch === "(") {
      depth += 1;
      continue;
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth -= 1;
      continue;
    }
    if (depth === 1) {
      const match = objectSource.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (match) {
        keys.push(match[1]);
        i += match[1].length;
      }
    }
  }
  return [...new Set(keys)];
}

// U8/T14: hosted MCP tools are registered in convex/lib/mcpRegistry.ts and
// convex/http.ts tools/list maps directly from that registry. Parse the
// registry read-only so docs can state hosted vs local tool counts distinctly.
function parseHostedMcpTools() {
  const source = read(HOSTED_MCP_REGISTRY_SOURCE);
  const toolsIndex = source.indexOf("export const HOSTED_MCP_TOOLS");
  if (toolsIndex === -1) return [];

  const assignmentIndex = source.indexOf("=", toolsIndex);
  const arrayStart = source.indexOf("[", assignmentIndex);
  const arraySource = extractBalanced(source, arrayStart, "[", "]");

  return splitTopLevelObjects(arraySource)
    .map((objectSource) => {
      const name = objectSource.match(/name:\s*"([^"]+)"/)?.[1];
      const description = objectSource.match(/description:\s*"((?:[^"\\]|\\.)*)"/s)?.[1];
      if (!name || !description) return null;

      const requiredMatch = objectSource.match(/required:\s*\[([^\]]*)\]/s);
      const required = requiredMatch
        ? [...requiredMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
        : [];

      const propertiesIndex = objectSource.indexOf("properties: {");
      const propertiesSource =
        propertiesIndex === -1
          ? ""
          : extractBalanced(objectSource, objectSource.indexOf("{", propertiesIndex), "{", "}");
      const inputFields = propertiesSource ? topLevelKeys(propertiesSource) : [];
      const scopesMatch = objectSource.match(/scopes:\s*\[([^\]]*)\]/s);
      const scopes = scopesMatch
        ? [...scopesMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
        : [];

      return {
        name,
        description: trimDescription(description, 360),
        inputFields,
        required,
        requiresAuth: scopes.length > 0 || /requires a you\.md api key/i.test(description),
      };
    })
    .filter(Boolean);
}

// P34: CLI command inventory generated from the commander registrations in
// cli/src/index.ts (`.command("...")` + `.description("...")` pairs) plus the
// HELP_GROUPS metadata that buckets them for `youmd --help`. Because this
// feeds the drift-checked generated output, a new commander command that is
// not regenerated into the docs fails `npm run docs:check`.
function parseCliCommands() {
  const source = read(CLI_INDEX_SOURCE);

  const groupsBlock = source.match(/const HELP_GROUPS[\s\S]*?\n\];/)?.[0] || "";
  const groupOrder = [];
  const groupMeta = new Map();
  for (const groupMatch of groupsBlock.matchAll(
    /title:\s*"([^"]+)",\s*commands:\s*\[([\s\S]*?)\]/g
  )) {
    const title = groupMatch[1];
    groupOrder.push(title);
    for (const commandMatch of groupMatch[2].matchAll(
      /\{\s*name:\s*"([^"]+)",\s*summary:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
    )) {
      groupMeta.set(commandMatch[1], { group: title, summary: commandMatch[2] });
    }
  }

  const registered = new Map();
  for (const match of source.matchAll(
    /\.command\(\s*"([^"]+)"\s*\)\s*\.description\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g
  )) {
    const usage = match[1];
    const name = usage.split(/\s+/)[0];
    registered.set(name, {
      name,
      usage,
      description: trimDescription(match[2].replace(/\\"/g, '"')),
    });
  }

  // P34 docs:check assertion — commander registrations and HELP_GROUPS must
  // stay in lockstep, so a new command cannot ship without help/docs coverage.
  const missingFromHelp = [...registered.keys()].filter((name) => !groupMeta.has(name));
  const missingFromCommander = [...groupMeta.keys()].filter((name) => !registered.has(name));
  if (registered.size === 0 || missingFromHelp.length > 0 || missingFromCommander.length > 0) {
    if (registered.size === 0) {
      console.error("No commander commands parsed from cli/src/index.ts.");
    }
    if (missingFromHelp.length > 0) {
      console.error(
        `Commander commands missing from HELP_GROUPS in cli/src/index.ts: ${missingFromHelp.join(", ")}`
      );
    }
    if (missingFromCommander.length > 0) {
      console.error(
        `HELP_GROUPS entries without a commander registration: ${missingFromCommander.join(", ")}`
      );
    }
    process.exit(1);
  }

  // Emit in `youmd --help` order: group order, then group-internal order.
  const commands = [];
  for (const group of groupOrder) {
    for (const [name, meta] of groupMeta) {
      if (meta.group !== group) continue;
      const command = registered.get(name);
      commands.push({
        name: command.name,
        usage: command.usage,
        group: meta.group,
        summary: trimDescription(meta.summary),
        description: command.description,
      });
    }
  }
  return commands;
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
    // Internal/retired routes are excluded centrally in partitionRoutes, so
    // the OpenAPI inventory always matches the documented endpoint count.
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
const { documented: endpoints, internal: internalRoutes } = partitionRoutes(
  mergeRoutes([...convexRoutes, ...nextRoutes])
);
const mcpTools = parseMcpTools();
const hostedMcpTools = parseHostedMcpTools();
const cliCommands = parseCliCommands();
const cli = parseCliMetadata();
const openApiSpec = buildOpenApiSpec(endpoints, cli);

const sourceHash = sha256(
  JSON.stringify({
    endpoints,
    internalRoutes,
    mcpTools,
    hostedMcpTools,
    cliCommands,
    cli,
  })
);

const generated = `// This file is generated by scripts/generate-docs-reference.mjs.\n// Do not edit by hand; update the route/tool source and run npm run docs:generate.\n\nexport type DocsEndpoint = {\n  method: string;\n  path: string;\n  category: string;\n  auth: string;\n  source: string;\n  sources: readonly string[];\n  summary: string;\n};\n\nexport type DocsMcpTool = {\n  name: string;\n  description: string;\n  inputFields: readonly string[];\n  required: readonly string[];\n};\n\nexport type DocsHostedMcpTool = {\n  name: string;\n  description: string;\n  inputFields: readonly string[];\n  required: readonly string[];\n  requiresAuth: boolean;\n};\n\nexport type DocsCliCommand = {\n  name: string;\n  usage: string;\n  group: string;\n  summary: string;\n  description: string;\n};\n\nexport type DocsInternalRoute = {\n  method: string;\n  path: string;\n  reason: string;\n};\n\nexport const docsReference = ${JSON.stringify(
  {
    sourceHash,
    cli,
    counts: {
      // Documented endpoints only; internal/retired routes are excluded in
      // partitionRoutes and listed under internalRoutes for transparency.
      endpoints: endpoints.length,
      internalRoutes: internalRoutes.length,
      mcpTools: mcpTools.length,
      hostedMcpTools: hostedMcpTools.length,
      cliCommands: cliCommands.length,
      convexRoutes: endpoints.filter((endpoint) => endpoint.sources.includes("convex")).length,
      nextRoutes: endpoints.filter((endpoint) => endpoint.sources.includes("next")).length,
    },
    endpoints,
    internalRoutes,
    mcpTools,
    hostedMcpTools,
    cliCommands,
  },
  null,
  2
)} as const;\n`;

const generatedOpenApi = `// This file is generated by scripts/generate-docs-reference.mjs.\n// Do not edit by hand; update the route source and run npm run docs:generate.\n\nexport const openApiSpec = ${JSON.stringify(openApiSpec, null, 2)} as const;\n`;

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
  `generated docs reference: ${endpoints.length} documented endpoints (${internalRoutes.length} internal/retired excluded), ${mcpTools.length} local MCP tools, ${hostedMcpTools.length} hosted MCP tools, ${cliCommands.length} CLI commands`
);
