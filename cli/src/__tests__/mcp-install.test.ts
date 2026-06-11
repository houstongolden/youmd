import { describe, expect, it } from "vitest";
import {
  getPublishedMcpEntry,
  parseClaudeMcpListForYoumd,
  upsertCodexMcpServerConfig,
} from "../commands/mcp";

describe("getPublishedMcpEntry", () => {
  it("includes a per-host YOUMD_AGENT_NAME env block when an agent name is given", () => {
    const entry = getPublishedMcpEntry("Claude Code");
    expect(entry.command).toBe("npx");
    expect(entry.args).toEqual(["--yes", "youmd@latest", "mcp"]);
    expect(entry.env).toEqual({ YOUMD_AGENT_NAME: "Claude Code" });
  });

  it("omits env when no agent name is given", () => {
    const entry = getPublishedMcpEntry();
    expect(entry).not.toHaveProperty("env");
  });
});

describe("parseClaudeMcpListForYoumd", () => {
  // Format captured from a real `claude mcp list` run (Claude Code 2.1.x)
  const realOutput = [
    "Checking MCP server health…",
    "",
    "figma: https://mcp.figma.com/mcp (HTTP) - ! Needs authentication",
    "bamf: https://mcp.bamf.ai (HTTP) - ✓ Connected",
    "youmd: npx --yes youmd@latest mcp - ✓ Connected",
  ].join("\n");

  it("detects youmd in real claude mcp list output", () => {
    expect(parseClaudeMcpListForYoumd(realOutput)).toBe(true);
  });

  it("returns false when youmd is absent", () => {
    expect(
      parseClaudeMcpListForYoumd(
        "Checking MCP server health…\n\nbamf: https://mcp.bamf.ai (HTTP) - ✓ Connected"
      )
    ).toBe(false);
  });

  it("does not false-positive on similarly named servers", () => {
    expect(
      parseClaudeMcpListForYoumd("youmd-other: npx other mcp - ✓ Connected")
    ).toBe(false);
  });
});

describe("upsertCodexMcpServerConfig", () => {
  it("appends a youmd block with env to an empty config", () => {
    const result = upsertCodexMcpServerConfig("");
    expect(result).toContain("[mcp_servers.youmd]");
    expect(result).toContain('command = "npx"');
    expect(result).toContain('args = ["--yes", "youmd@latest", "mcp"]');
    expect(result).toContain('env = { YOUMD_AGENT_NAME = "Codex" }');
  });

  it("replaces an existing youmd block instead of duplicating it", () => {
    const existing = [
      "[mcp_servers.youmd]",
      'command = "npx"',
      'args = ["--yes", "youmd@0.5.0", "mcp"]',
      "",
      "[mcp_servers.other]",
      'command = "other"',
    ].join("\n");

    const result = upsertCodexMcpServerConfig(existing);
    expect(result.match(/\[mcp_servers\.youmd\]/g)).toHaveLength(1);
    expect(result).not.toContain("youmd@0.5.0");
    expect(result).toContain('env = { YOUMD_AGENT_NAME = "Codex" }');
    expect(result).toContain("[mcp_servers.other]");
    expect(result).toContain('command = "other"');
  });

  it("removes stale youmd sub-tables (e.g. a previous env table)", () => {
    const existing = [
      "[mcp_servers.youmd]",
      'command = "npx"',
      "",
      "[mcp_servers.youmd.env]",
      'YOUMD_AGENT_NAME = "Old Name"',
      "",
      "[mcp_servers.other]",
      'command = "other"',
    ].join("\n");

    const result = upsertCodexMcpServerConfig(existing);
    expect(result.match(/\[mcp_servers\.youmd\]/g)).toHaveLength(1);
    expect(result).not.toContain("[mcp_servers.youmd.env]");
    expect(result).not.toContain("Old Name");
    expect(result).toContain("[mcp_servers.other]");
  });
});
