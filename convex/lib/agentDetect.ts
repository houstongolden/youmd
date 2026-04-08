/**
 * Agent detection from User-Agent headers.
 *
 * Parses incoming HTTP requests to identify which agent (Claude Code, Cursor,
 * ChatGPT, etc.) is talking to you.md, and returns a normalized
 * { name, source } tuple used by the activity logging system.
 *
 * `source` categorizes the transport:
 *   - "mcp"           → MCP-based agents (Claude Code, Cursor, you.md MCP)
 *   - "context-link"  → Crawlers / chat apps following /ctx links
 *   - "api-key"       → Custom scripts using a Bearer API key
 *   - "web-fetch"     → Unknown browsers / generic HTTP clients
 *   - "cli"           → Command-line tools (Codex, youmd CLI)
 */

export interface AgentInfo {
  name: string;
  source: string;
  version?: string;
}

/**
 * Detect the agent from a User-Agent header string.
 * Returns `{ name: "Unknown", source: "web-fetch" }` for unrecognized UAs.
 */
export function detectAgent(userAgent: string | null | undefined): AgentInfo {
  if (!userAgent) {
    return { name: "Unknown", source: "web-fetch" };
  }

  const ua = userAgent.toLowerCase();

  // Try to pull a version token (e.g. "youmd/0.4.2" → "0.4.2")
  const versionMatch = userAgent.match(/\/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
  const version = versionMatch ? versionMatch[1] : undefined;

  // ── MCP clients ────────────────────────────────────────────────
  if (ua.includes("claude-code")) {
    return { name: "Claude Code", source: "mcp", version };
  }
  if (ua.includes("youmd-mcp")) {
    return { name: "you.md MCP", source: "mcp", version };
  }
  if (ua.includes("cursor")) {
    return { name: "Cursor", source: "mcp", version };
  }

  // ── Context-link crawlers & web chat apps ─────────────────────
  if (ua.includes("claudebot") || ua.includes("anthropic")) {
    return { name: "Claude.ai", source: "context-link", version };
  }
  if (ua.includes("chatgpt") || ua.includes("openai")) {
    return { name: "ChatGPT", source: "context-link", version };
  }
  if (ua.includes("gemini") || ua.includes("google")) {
    return { name: "Gemini", source: "context-link", version };
  }
  if (ua.includes("perplexity")) {
    return { name: "Perplexity", source: "context-link", version };
  }
  if (ua.includes("grok") || ua.includes("xai")) {
    return { name: "Grok", source: "context-link", version };
  }

  // ── CLIs ───────────────────────────────────────────────────────
  if (ua.includes("codex")) {
    return { name: "Codex", source: "cli", version };
  }
  if (ua.includes("youmd")) {
    return { name: "youmd CLI", source: "cli", version };
  }

  // ── Custom scripts (Python/Node/etc.) ─────────────────────────
  if (
    ua.includes("python") ||
    ua.includes("node-fetch") ||
    ua.includes("axios") ||
    ua.includes("requests")
  ) {
    return { name: "Custom Agent", source: "api-key", version };
  }

  // ── Default ───────────────────────────────────────────────────
  return { name: "Unknown", source: "web-fetch", version };
}
