import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("MCP agent brief", () => {
  let tmpHome: string;
  let tmpRepo: string;
  let originalHome: string | undefined;
  let originalCwd: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-mcp-home-"));
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-mcp-repo-"));
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    process.env.HOME = tmpHome;
    process.chdir(tmpRepo);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    fs.rmSync(tmpHome, { recursive: true, force: true });
    fs.rmSync(tmpRepo, { recursive: true, force: true });
    vi.resetModules();
  });

  it("builds a startup brief from local project context", async () => {
    fs.mkdirSync(path.join(tmpRepo, ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmpRepo, "project-context"), { recursive: true });
    fs.writeFileSync(path.join(tmpRepo, "AGENTS.md"), "# Agent Instructions\n\nRead project-context first.\n");
    fs.writeFileSync(
      path.join(tmpRepo, "project-context", "feature-requests-active.md"),
      [
        "# Active Feature Requests",
        "",
        "### 64. Improve YouStack startup",
        "**Status:** IN PROGRESS",
        "**Request:** Give local agents a first-call context brief.",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(tmpRepo, "project-context", "TODO.md"),
      "# TODO\n\n- [ ] Add get_agent_brief to MCP\n- [x] Keep old whoami tool\n",
    );
    fs.writeFileSync(
      path.join(tmpRepo, "project-context", "CURRENT_STATE.md"),
      "# Current State\n\n## Known Issues\n- local agents still start cold\n",
    );

    const { buildAgentBrief, formatAgentBriefMarkdown } = await import("../mcp/server");
    const brief = await buildAgentBrief();
    const markdown = formatAgentBriefMarkdown(brief);

    expect(brief.project?.activeRequests[0]).toContain("Improve YouStack startup");
    expect(brief.project?.openTodos[0]).toContain("Add get_agent_brief");
    expect(brief.nextMoves[0]).toContain("Improve YouStack startup");
    expect(markdown).toContain("# YouStack Agent Brief");
    expect(markdown).toContain("project-context/feature-requests-active.md");
  });
});
