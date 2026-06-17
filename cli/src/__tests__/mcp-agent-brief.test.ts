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
    expect(brief.portfolioGraph.projects.some((project) => project.slug === "youmd")).toBe(true);
    expect(brief.portfolioGraph.skillPropagation.some((entry) => entry.skill === "portfolio-graph-auditor")).toBe(true);
    expect(brief.nextMoves[0]).toContain("Improve YouStack startup");
    expect(markdown).toContain("# YouStack Agent Brief");
    expect(markdown).toContain("## Portfolio Graph");
    expect(markdown).toContain("portfolio-graph-auditor");
    expect(markdown).toContain("youmd project portfolio-audit --root ~/Desktop/CODE_2025");
    expect(markdown).toContain("project-context/feature-requests-active.md");
  });

  it("maps persisted portfolio graph snapshots into the local agent brief shape", async () => {
    const { portfolioGraphBriefFromSnapshot, formatPortfolioGraphBriefMarkdown } = await import("../lib/portfolio-graph");

    const brief = portfolioGraphBriefFromSnapshot({
      projects: [
        {
          slug: "real-project",
          name: "Real Project",
          stackName: "RealStack",
          goal: "Clone the right repos on a new machine.",
          focus: "30-day active setup gate.",
        },
      ],
      apiSurfaces: [
        {
          slug: "real-api",
          ownerProjectSlug: "real-project",
          ownerStack: "RealStack",
          risk: "high",
          writePolicy: "owner-approved",
          features: ["machine setup", "portfolio graph"],
        },
      ],
      dependencyEdges: [
        {
          fromProjectSlug: "real-project",
          toSurfaceSlug: "real-api",
          tier: "dependent",
          integrationType: "developer-agent",
          features: ["fresh machine bootstrap"],
          failureImpact: "New computer setup loses graph context.",
        },
      ],
      reusablePatterns: [
        {
          slug: "fresh-machine-bootstrap",
          canonicalOwnerProject: "real-project",
          status: "canonical",
        },
      ],
    });
    const markdown = formatPortfolioGraphBriefMarkdown(brief);

    expect(brief.generatedFrom).toContain("authenticated /api/v1/me/portfolio/graph (1 projects)");
    expect(brief.projects[0]).toEqual({
      slug: "real-project",
      stack: "RealStack",
      goal: "Clone the right repos on a new machine.",
      focus: "30-day active setup gate.",
    });
    expect(brief.apiSurfaces[0].ownerProject).toBe("real-project");
    expect(brief.dependencyEdges[0].toSurface).toBe("real-api");
    expect(markdown).toContain("real-project (RealStack): 30-day active setup gate.");
    expect(markdown).toContain("real-api: owner=real-project/RealStack");
  });

  it("returns project-scoped portfolio slices from the persisted graph in get_project_context", async () => {
    const { CLI_MCP_TOOLS } = await import("../mcp/registry");
    const tool = CLI_MCP_TOOLS.find((candidate) => candidate.name === "get_project_context");
    expect(tool).toBeTruthy();

    const result = await tool!.handler(
      { project: "real-project" },
      {
        authenticated: true,
        logActivity: vi.fn(),
        fetchMemoriesEnvelope: vi.fn(),
        fetchPrivateContextEnvelope: vi.fn(),
        apiRequest: vi.fn(async () => ({
          projects: [
            {
              slug: "real-project",
              name: "Real Project",
              stackName: "RealStack",
              focus: "30-day active setup gate.",
            },
          ],
          apiSurfaces: [
            {
              slug: "real-api",
              ownerProjectSlug: "real-project",
              ownerStack: "RealStack",
              features: ["machine setup"],
            },
          ],
          dependencyEdges: [],
          reusablePatterns: [],
        })),
        memoryCategories: [],
        resolveAgentName: () => "test-agent",
        getInstalledSkills: () => [],
        activeBundleExists: () => true,
        fetchActivityLog: vi.fn(),
        getYouJson: () => ({}),
      },
    );
    const parsed = JSON.parse(String(result.content[0].text));

    expect(parsed.portfolioGraph.readiness.ready).toBe(true);
    expect(parsed.portfolioGraph.matchedProject.slug).toBe("real-project");
    expect(parsed.portfolioGraph.ownedSurfaces[0].slug).toBe("real-api");
  });
});
