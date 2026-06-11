import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAgentName, setMcpClientName } from "../mcp/server";

describe("MCP agent name attribution", () => {
  const originalEnv = process.env.YOUMD_AGENT_NAME;

  beforeEach(() => {
    delete process.env.YOUMD_AGENT_NAME;
    setMcpClientName(null);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.YOUMD_AGENT_NAME;
    } else {
      process.env.YOUMD_AGENT_NAME = originalEnv;
    }
  });

  it("prefers YOUMD_AGENT_NAME env over everything", () => {
    process.env.YOUMD_AGENT_NAME = "Codex";
    setMcpClientName("claude-code");
    expect(resolveAgentName()).toBe("Codex");
  });

  it("falls back to MCP clientInfo.name, mapped to a friendly name", () => {
    setMcpClientName("claude-code");
    expect(resolveAgentName()).toBe("Claude Code");
  });

  it("passes through unknown client names verbatim", () => {
    setMcpClientName("SomeNewAgent");
    expect(resolveAgentName()).toBe("SomeNewAgent");
  });

  it("uses an honest unknown default instead of misattributing a host", () => {
    expect(resolveAgentName()).toBe("MCP Agent");
  });

  it("ignores empty client names", () => {
    setMcpClientName("   ");
    expect(resolveAgentName()).toBe("MCP Agent");
  });
});
