#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const CHECK_ONLY = process.argv.includes("--check");
const DOCS_REFERENCE_FILE = path.join(ROOT, "src", "generated", "docs-reference.ts");
const REFERENCE_LATEST_FILE = path.join(ROOT, "project-context", "reference-intelligence", "LATEST.md");
const LLMS_FILE = path.join(ROOT, "public", "llms.txt");
const LLMS_FULL_FILE = path.join(ROOT, "public", "llms-full.txt");

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function parseDocsReference() {
  const source = read(DOCS_REFERENCE_FILE);
  const match = source.match(/export const docsReference = ([\s\S]*?) as const;/);
  if (!match) {
    throw new Error("Could not parse src/generated/docs-reference.ts. Run npm run docs:generate first.");
  }
  return JSON.parse(match[1]);
}

function parseReferenceIntelligence() {
  const source = read(REFERENCE_LATEST_FILE);
  const repos = [];
  const sectionRegex =
    /## (GStack|GBrain|Agent Scripts|The Library)\n\n- URL: ([^\n]+)\n- Local path: `([^`]+)`\n- Branch: `([^`]+)`\n- Latest commit: `([^`]+)`\n- Mode: ([^\n]+)/g;
  let match;
  while ((match = sectionRegex.exec(source))) {
    repos.push({
      name: match[1],
      url: match[2],
      localPath: match[3],
      branch: match[4],
      commit: match[5],
      mode: match[6],
    });
  }
  return {
    updated: source.match(/Last updated: ([^\n]+)/)?.[1] || "unknown",
    repos,
    hasCandidates: !source.includes("- No task candidates generated."),
  };
}

function asciiText(value) {
  const normalized = String(value || "")
    .replace(/\u2026/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-");
  return normalized.replace(/\s+[A-Za-z]{1,3}\.\.\.$/, "...");
}

function endpointLine(endpoint) {
  return `- \`${endpoint.method} ${endpoint.path}\`: ${asciiText(endpoint.summary)} (${asciiText(endpoint.auth)})`;
}

function categoryLines(docsReference, category, limit = 12) {
  return docsReference.endpoints
    .filter((endpoint) => endpoint.category === category)
    .slice(0, limit)
    .map(endpointLine)
    .join("\n");
}

function mcpToolLines(docsReference, names) {
  const byName = new Map(docsReference.mcpTools.map((tool) => [tool.name, tool]));
  return names
    .map((name) => byName.get(name))
    .filter(Boolean)
    .map((tool) => `- \`${tool.name}\`: ${asciiText(tool.description)}`)
    .join("\n");
}

function referenceRepoLines(reference) {
  return reference.repos
    .map((repo) => `- ${repo.name}: ${repo.url} (${repo.branch} @ ${repo.commit.slice(0, 12)}; ${asciiText(repo.mode)})`)
    .join("\n");
}

function buildLlmsTxt(docsReference, reference) {
  return `# You.md

> Generated agent index. Source hash: ${docsReference.sourceHash}. CLI version: ${docsReference.cli.version}. Reference intelligence: ${reference.updated}.

You.md is the agent brain and expertise-stack layer for the agent internet. It gives AI agents a portable public brain, private memory through scoped access, named YouStacks, a local runtime, HTTP APIs, and MCP tools so agents can start with the right context instead of asking the user to repeat themselves.

## Start Here

- [Homepage](https://you.md/): Simple product entry point for the You.md brain, runtime, and named expertise stacks.
- [Developer Docs](https://you.md/docs): Human and agent documentation for API, MCP, runtime, YouStacks, privacy, and agent workflows.
- [Full Agent Context](https://you.md/llms-full.txt): Full plain-text agent guide for You.md docs, APIs, MCP, runtime, stacks, and smoke checks.
- [Install Runtime](https://you.md/install.sh): Curl-first installer for the local You.md runtime.
- [Public Profiles](https://you.md/profiles): Directory of public agent brains.

## Agent-Readable Surfaces

- [Docs Reference](https://you.md/api/v1/docs/reference): Machine-readable docs manifest generated from ${docsReference.counts.endpoints} shipped routes and ${docsReference.counts.mcpTools} MCP tools.
- [OpenAPI Inventory](https://you.md/api/v1/docs/openapi.json): Generated OpenAPI-style API inventory.
- [MCP Discovery](https://you.md/.well-known/mcp.json): MCP discovery metadata for web-capable agents.
- [MCP Endpoint](https://you.md/api/v1/mcp): Same-origin JSON-RPC endpoint for web-capable MCP clients.
- [You.md Schema](https://you.md/schema/you-md/v1.json): Canonical \`you-md/v1\` public brain schema.
- [YouStacks Capabilities](https://you.md/api/v1/stacks/capabilities): Default capability map for stack-aware routing.

## Core Concepts

- Brain: identity, public profile, preferences, memory, projects, sources, provenance, directives, and trust rules.
- YouStacks: named expertise packages containing skills, prompts, workflows, examples, adapter files, evals, and protected brain scopes.
- Runtime: local \`you\` / \`youmd\` helper installed by curl or npm for CLI, MCP, sync, stack validation, and host adapters.
- Protected API/MCP: authenticated access for private memory, project context, tokens, connected tools, and sensitive mutations.
- Reference Intelligence: local monitoring of GStack, GBrain, Agent Scripts, and The Library for ongoing You.md stack/runtime/docs improvements.

## API Reference

- [Public Identity API](https://you.md/docs#public-endpoints): Public profile JSON, markdown negotiation, schema discovery, and context links.
- [Authenticated API](https://you.md/docs#authenticated-endpoints): Bearer API key endpoints for account, memories, private context, activity, and skills.
- [Skills API](https://you.md/docs#skills-api): Skill registry and installed skill operations.
- [YouStacks API](https://you.md/docs#youstacks-api-mcp): Capability discovery and deterministic stack routing.
- [Errors](https://you.md/docs#errors-troubleshooting): Common HTTP errors and recovery paths.

## MCP

- [MCP Server](https://you.md/docs#mcp-server): Local stdio MCP and same-origin JSON-RPC MCP surfaces.
- Important tools include \`whoami\`, \`get_identity\`, \`get_agent_brief\`, \`get_project_context\`, \`add_memory\`, \`add_project_memory\`, \`get_stack_manifest\`, \`get_stack_capabilities\`, \`route_stack_request\`, and \`smoke_stack\`.
- Preferred local setup: \`curl -fsSL https://you.md/install.sh | bash\`, then \`youmd mcp --install codex --auto\` or \`youmd mcp --install claude --auto\`.

## Agent Workflows

- [Golden Path](https://you.md/docs#workflow-golden-path): Read context first, route stack work, mutate the smallest durable layer, then leave an audit trail.
- [Playbooks](https://you.md/docs#playbooks): New coding repo, new agent handoff, post-session capture, and identity cleanup.
- [Examples](https://you.md/docs#examples): Starter prompt and terminal setup for Claude Code, Codex, Cursor, and similar agents.
- [Agent Docs](https://you.md/docs#agent-docs): How to use \`llms.txt\`, \`llms-full.txt\`, docs reference, OpenAPI, MCP, and stack routes.

## Local Runtime Commands

- \`curl -fsSL https://you.md/install.sh | bash\`: Install the runtime.
- \`you\`: Open the live You.md agent conversation.
- \`youmd whoami\`: Verify authenticated identity.
- \`youmd status\`: Check local bundle status.
- \`youmd mcp --json\`: Print MCP configuration.
- \`youmd stack doctor --path stacks/<name>\`: Static stack readiness check.
- \`youmd stack smoke --path stacks/<name>\`: Local stack smoke test.
- \`youmd stack route --path stacks/<name> "request"\`: Route a request through stack capabilities.

## Privacy

- Public brain data is meant for agents and humans to read.
- Private memory, private project context, tokens, connected tools, and sensitive mutations require scoped auth, context links, API keys, or local MCP access.
- Agents should read the smallest useful scope first and ask for explicit approval before writing private brain context, changing stack visibility, or using connected tools.

## Source Links

- GitHub: https://github.com/houstongolden/youmd
- npm: https://www.npmjs.com/package/youmd
- Production: https://you.md
`;
}

function buildLlmsFullTxt(docsReference, reference) {
  const publicIdentity = categoryLines(docsReference, "Public Identity");
  const docsEndpoints = categoryLines(docsReference, "Docs");
  const mcpEndpoints = categoryLines(docsReference, "MCP");
  const stackEndpoints = categoryLines(docsReference, "YouStacks");
  const schemaEndpoints = categoryLines(docsReference, "Schema");
  const keyMcpTools = mcpToolLines(docsReference, [
    "whoami",
    "get_identity",
    "get_agent_brief",
    "get_project_context",
    "add_memory",
    "add_project_memory",
    "get_stack_manifest",
    "get_stack_capabilities",
    "route_stack_request",
    "smoke_stack",
  ]);

  return `# You.md Full Agent Context

> Generated full agent context. Source hash: ${docsReference.sourceHash}. CLI version: ${docsReference.cli.version}. Endpoints: ${docsReference.counts.endpoints}. MCP tools: ${docsReference.counts.mcpTools}. Reference intelligence: ${reference.updated}.

You.md is the agent brain and expertise-stack layer for the agent internet. It gives AI agents a portable public brain, private memory through scoped access, named YouStacks, a local runtime, HTTP APIs, and MCP tools so agents can start with the right context instead of asking the user to repeat themselves.

This file is the full-context companion to \`/llms.txt\`. Use it when an agent needs one plain-text read before choosing a docs page, API endpoint, MCP tool, or local runtime command.

## Base URLs

- Production: \`https://you.md\`
- Docs: \`https://you.md/docs\`
- Runtime installer: \`https://you.md/install.sh\`
- Docs reference: \`https://you.md/api/v1/docs/reference\`
- OpenAPI inventory: \`https://you.md/api/v1/docs/openapi.json\`
- MCP discovery: \`https://you.md/.well-known/mcp.json\`
- MCP JSON-RPC endpoint: \`https://you.md/api/v1/mcp\`
- Schema: \`https://you.md/schema/you-md/v1.json\`
- YouStacks capabilities: \`https://you.md/api/v1/stacks/capabilities\`

## What You.md Is

You.md is easiest to understand as four layers:

1. Brain: identity, public profile, preferences, memory, projects, sources, provenance, directives, and trust rules.
2. YouStacks: named expertise packages containing skills, prompts, workflows, examples, adapter files, evals, update policy, and protected brain scopes.
3. Runtime: local \`you\` / \`youmd\` helper installed by curl or npm for CLI, MCP, sync, stack validation, and host adapters.
4. Protected API/MCP: authenticated access for private memory, project context, tokens, connected tools, and sensitive mutations.

Identity is one part of the brain. The product should not be treated as only a profile page or only an identity schema. The bigger goal is portable context plus reusable agent expertise.

## Recommended Agent Order Of Operations

When an agent receives a You.md link or works inside a You.md-enabled repo:

1. Read \`/llms.txt\` or this file to understand the platform surfaces.
2. If a public profile is involved, fetch \`GET /api/v1/profiles?username=<username>\` or the human profile at \`https://you.md/<username>\`.
3. If local MCP is configured, call \`whoami\`.
4. For local coding agents, call \`get_agent_brief\` before planning. It combines identity, repo instructions, project context, active requests, open TODOs, installed skills, and recommended next moves.
5. If a stack is involved, inspect the manifest with \`get_stack_manifest\` or \`youmd stack inspect --path <dir>\`.
6. Route ambiguous work through \`route_stack_request\` or \`youmd stack route --path <dir> "request"\`.
7. Run \`youmd stack doctor --path <dir>\` before sharing, improving, publishing, or trusting a stack.
8. Mutate only the smallest durable surface: one memory, one project memory, one section, one stack file, or one visibility setting.
9. Leave an audit trail through MCP/API or project context so the next agent can resume.

## Public Identity And Context

Public routes are designed for agents:

\`\`\`http
GET /api/v1/profiles?username=houstongolden
Accept: application/vnd.you-md.v1+json
\`\`\`

Public identity endpoints:

${publicIdentity || "- No generated public identity endpoints found."}

Use public profile responses for non-sensitive context: name, role, public bio, projects, preferences, public stacks, social links, schema metadata, and public agent-readable profile data.

Context links look like:

\`\`\`text
https://you.md/ctx/<username>/<token>
\`\`\`

Context links can include scoped private context depending on how the user created the link. Treat context-link contents as sensitive if they contain private sections, project context, or explicit trust boundaries.

## Local Runtime

Install:

\`\`\`bash
curl -fsSL https://you.md/install.sh | bash
\`\`\`

Core runtime commands:

\`\`\`bash
you
youmd login
youmd whoami
youmd status
youmd pull
youmd push
youmd sync
youmd diff
youmd export
youmd preview
youmd mcp --json
youmd mcp --install codex --auto
youmd mcp --install claude --auto
youmd mcp --install cursor --auto
\`\`\`

Use \`you\` for the live U conversation. Use \`youmd\` for non-interactive commands inside coding agents.

## MCP

You.md has two MCP surfaces:

- Local stdio MCP through the runtime. This is the preferred surface for Claude Code, Codex, Cursor, and other local coding agents.
- Same-origin JSON-RPC MCP at \`POST /api/v1/mcp\` for web-capable clients.

Discovery:

\`\`\`http
GET /.well-known/mcp.json
\`\`\`

Generated MCP endpoints:

${mcpEndpoints || "- No generated MCP endpoints found."}

Example JSON-RPC request:

\`\`\`json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get_identity",
    "arguments": { "format": "compact" }
  },
  "id": 1
}
\`\`\`

Important MCP tools and resources:

${keyMcpTools || "- No generated MCP tools found."}

## API

Generated docs:

\`\`\`http
GET /api/v1/docs/reference
GET /api/v1/docs/openapi.json
\`\`\`

Generated docs endpoints:

${docsEndpoints || "- No generated docs endpoints found."}

Public identity:

\`\`\`http
GET /api/v1/profiles
GET /api/v1/profiles?username=<username>
GET /schema/you-md/v1.json
GET /ctx/<username>/<token>
\`\`\`

Schema endpoints:

${schemaEndpoints || "- No generated schema endpoints found."}

Authenticated user, private context, and memory endpoints use Bearer API keys:

\`\`\`http
Authorization: Bearer ym_your_api_key_here
Content-Type: application/json
\`\`\`

Common authenticated categories:

- Account: current user, profile, bundles, sources, API keys, publish, rollback, portrait.
- Memories: list, search, add, and manage durable memory.
- Private Context: private notes, projects, preferences, and user-controlled private sections.
- Activity: agent read/write/publish activity.
- Skills: registry and installed skill operations.

Common error recovery:

- \`401\`: missing, expired, invalid, or revoked API key. Re-run \`youmd login\` or rotate the key.
- \`404\`: profile, context token, bundle version, or local section not found.
- \`409 ANCESTOR_MISMATCH\`: remote bundle changed since local parent hash. Pull, inspect diff, then push again.
- \`413\`: chat or compaction payload is too large.
- \`429\`: rate limit hit.
- \`503\`: spend cap or provider kill switch is active.

## YouStacks

YouStacks are named expertise packages. A stack can contain:

- skills
- prompts
- workflows
- examples
- docs
- smoke tests
- evals
- host adapter files
- protected brain scopes
- update policy
- improvement policy
- visibility policy

Local stack commands:

\`\`\`bash
youmd stack inspect --path stacks/<name>
youmd stack doctor --path stacks/<name>
youmd stack smoke --path stacks/<name>
youmd stack capabilities --path stacks/<name>
youmd stack route --path stacks/<name> "review this like me before we ship"
youmd stack link --path stacks/<name> --hosts codex,claude,cursor --target .
\`\`\`

Shared HTTP stack routes:

${stackEndpoints || "- No generated YouStacks endpoints found."}

Route request example:

\`\`\`json
{
  "request": "review this like me before we ship",
  "stack": {
    "slug": "founder-growth-stack",
    "name": "Founder Growth Stack",
    "domain": "growth",
    "tags": ["content", "founder-review"]
  },
  "capabilities": [
    {
      "id": "founder-review",
      "intent": "Review a plan using the user's founder taste.",
      "localOnly": true,
      "requiresAuth": false,
      "scopes": []
    }
  ]
}
\`\`\`

Stack safety rules:

1. Run doctor before smoke, publish, public readiness, or self-improvement work.
2. Keep stacks private by default.
3. Publish only after redaction, smoke checks, manifest review, docs review, and owner approval.
4. Keep protected brain reads behind explicit scopes.
5. Do not copy private memory into public stack examples.

## API/MCP/Stack Documentation Standard

Every important capability should have five surfaces:

- Guide: human explanation and agent order of operations.
- API: HTTP endpoint or explicit reason no endpoint exists.
- MCP: MCP tool/resource when agents need it.
- Stack: local runtime or YouStack command when the capability belongs in a portable stack.
- Smoke: local or hosted check that proves the capability works.

Agents should prefer read-before-write and route-before-action:

1. Read public identity, project context, stack manifest, or docs reference.
2. Route through capabilities if intent is ambiguous.
3. Ask for the smallest private scope needed.
4. Apply the smallest mutation.
5. Run smoke checks before publish or handoff.

## Reference Intelligence

You.md keeps these as first-class inspiration and monitoring sources:

${referenceRepoLines(reference) || "- Reference intelligence has not been generated yet."}

The monitor writes:

\`\`\`text
project-context/reference-intelligence/LATEST.md
project-context/reference-intelligence/TASKS.md
\`\`\`

The generated task list is a review queue, not a mandate. Promote only patterns that make You.md simpler, more powerful, safer, or easier to start.

## Agent Starter Prompt

Use this prompt when starting a Claude Code, Codex, Cursor, or similar agent session:

\`\`\`text
Read my You.md context first.

Use the fastest available path:
1. call the youmd MCP whoami tool if available
2. call get_agent_brief to load identity plus local project state
3. if you need full detail, call get_identity
4. before editing this repo, read project-context/
5. when you learn a durable preference or decision, save it back with add_memory or add_project_memory

Then continue with the actual task.
\`\`\`

## Smoke Checks

Local:

\`\`\`bash
npm run docs:check
npx tsc --noEmit
youmd whoami
youmd status
youmd mcp --json
youmd stack doctor --path cli/examples/youstack-bamfstack-public
youmd stack smoke --path cli/examples/youstack-bamfstack-public
\`\`\`

Hosted:

\`\`\`bash
curl -fsSL https://you.md/llms.txt
curl -fsSL https://you.md/llms-full.txt
curl -fsSL https://you.md/.well-known/mcp.json
curl -fsSL https://you.md/api/v1/docs/reference
curl -fsSL https://you.md/api/v1/docs/openapi.json
curl -fsSL https://you.md/api/v1/stacks/capabilities
\`\`\`

## Privacy And Trust

Public brain data is meant to be read by humans and agents.

Private memory, private project context, API keys, connected tools, and sensitive mutations require scoped auth, context links, API keys, local MCP access, or explicit approval.

Agents must not:

- expose private memory in public docs or public stack examples
- change public/private visibility without owner approval
- invent personal proof, credentials, or private facts
- write broad memory summaries when a small durable fact is enough
- publish stack changes without doctor/smoke/readiness checks

Agents should:

- request the smallest useful context scope
- preserve provenance and source links
- write narrow memories with stable labels
- prefer local files for inspectable stack work
- leave a trail in project context or activity logs

## Important Links

- Homepage: https://you.md/
- Docs: https://you.md/docs
- LLM index: https://you.md/llms.txt
- Full LLM context: https://you.md/llms-full.txt
- Install runtime: https://you.md/install.sh
- Docs reference: https://you.md/api/v1/docs/reference
- OpenAPI inventory: https://you.md/api/v1/docs/openapi.json
- MCP discovery: https://you.md/.well-known/mcp.json
- Schema: https://you.md/schema/you-md/v1.json
- YouStacks capabilities: https://you.md/api/v1/stacks/capabilities
- GitHub: https://github.com/houstongolden/youmd
- npm: https://www.npmjs.com/package/youmd
`;
}

const docsReference = parseDocsReference();
const reference = parseReferenceIntelligence();
const outputs = [
  [LLMS_FILE, buildLlmsTxt(docsReference, reference)],
  [LLMS_FULL_FILE, buildLlmsFullTxt(docsReference, reference)],
];

if (CHECK_ONLY) {
  const stale = outputs.filter(([file, expected]) => read(file) !== expected);
  if (stale.length > 0) {
    console.error(`agent docs are out of date. run: npm run llms:generate`);
    for (const [file] of stale) {
      console.error(`- ${path.relative(ROOT, file)}`);
    }
    process.exit(1);
  }
  console.log("agent docs are current");
  process.exit(0);
}

for (const [file, content] of outputs) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

console.log(`generated agent docs: ${outputs.map(([file]) => path.relative(ROOT, file)).join(", ")}`);
