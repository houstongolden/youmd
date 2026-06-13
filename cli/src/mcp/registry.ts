/**
 * T14 — CLI stdio MCP tool registry.
 *
 * Mirrors the shape of convex/lib/mcpRegistry.ts for the local stdio server.
 * The CLI is a separate npm package that cannot import Convex modules, so this
 * is an independent definition with the same ergonomics.
 *
 * Adding a tool: add one entry to CLI_MCP_TOOLS. The ListToolsRequestSchema
 * and CallToolRequestSchema handlers in server.ts both drive from this array —
 * no more editing two places.
 *
 * NOTE: Migrating all 20+ handlers from server.ts into this registry is a
 * follow-up task. This file establishes the type and the dispatch pattern;
 * server.ts already uses it for list + call routing.
 */

/** Content item returned by a CLI tool handler (MCP SDK shape). */
export interface CliToolContent {
  type: "text";
  text: string;
}

/** Result returned by every CLI registry handler. */
export interface CliToolResult {
  content: CliToolContent[];
  isError?: boolean;
}

/** Single CLI MCP tool specification (metadata + handler). */
export interface CliToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Async handler. args is the raw arguments object from the MCP call. */
  handler: (args: Record<string, unknown>) => Promise<CliToolResult>;
}

/**
 * CLI tool registry. Each entry is the single source of truth for a tool's
 * metadata and implementation.
 *
 * Currently empty — tools are being migrated from the inline list in
 * server.ts. Add entries here; server.ts picks them up automatically via
 * the REGISTRY_TOOL_NAMES set it uses for routing.
 *
 * Migration order (highest-value first):
 *   1. list_skills       — pure local read, no side effects
 *   2. get_stack_manifest / get_stack_capabilities / route_stack_request / smoke_stack
 *   3. get_identity / whoami / get_agent_brief
 *   4. Remaining tools
 */
export const CLI_MCP_TOOLS: CliToolSpec[] = [];
