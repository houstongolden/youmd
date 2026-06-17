import { describe, expect, it } from "vitest";

import { buildPortfolioRepoSnapshotFiles } from "./portfolioRepoSnapshot";

describe("buildPortfolioRepoSnapshotFiles", () => {
  it("renders secret-safe repo-backed portfolio graph markdown and JSON", () => {
    const files = buildPortfolioRepoSnapshotFiles(
      {
        projects: [
          {
            slug: "youmd",
            name: "You.md",
            stackName: "YouStack",
            status: "active",
            summary: "Identity context protocol for agents. Accidental OPENAI_API_KEY=sk_test_should_never_land_here_1234567890",
            goal: "Make every agent start with the right context.",
            vision: "Portable owner-controlled context graph.",
            repoFullName: "houstongolden/youmd",
            repoUrl: "https://github.com/houstongolden/youmd",
            tags: ["identity", "mcp"],
            painPoints: ["Agents forget project context"],
            metrics: ["55 active projects hydrated"],
            constraints: ["Never expose .env.local"],
            notBuilding: ["generic CRM"],
            competitors: [{ name: "Notion", note: "workspace docs, not agent context" }],
            docs: ["https://you.md/docs"],
            environments: ["local", "prod"],
            source: "github",
            lastActivityAt: Date.UTC(2026, 5, 17),
            updatedAt: Date.UTC(2026, 5, 17),
          },
        ],
        recentTrackedProjects: [
          {
            fullName: "houstongolden/bamfsite",
            name: "bamfsite",
            url: "https://github.com/houstongolden/bamfsite",
            stackName: "BAMFOSStack",
            primaryLanguage: "TypeScript",
            pushedAt: Date.UTC(2026, 5, 16),
            commitsLast90d: 42,
            visibility: "private",
          },
        ],
        apiSurfaces: [
          {
            slug: "youmd-mcp",
            name: "You.md MCP",
            kind: "mcp",
            ownerProjectSlug: "youmd",
            trust: "protected",
            writePolicy: "approved-write",
            features: ["get_project_context", "hydrate_portfolio_graph"],
            risk: "medium",
            docsUrls: ["https://you.md/.well-known/mcp.json"],
            integrationTypes: ["local-agent"],
          },
        ],
        dependencyEdges: [
          {
            fromProjectSlug: "bamfsite",
            toProjectSlug: "youmd",
            tier: "dependent",
            integrationType: "developer-agent",
            features: ["project context"],
            failureImpact: "Agents lose shared portfolio awareness.",
          },
        ],
        reusablePatterns: [
          {
            slug: "agentic-sidebar",
            name: "Agentic Sidebar",
            status: "candidate",
            techStacks: ["Next.js"],
            canonicalOwnerProject: "youmd",
            summary: "Full-height left navigation with project and chat recents.",
            usageProjects: ["youmd", "bamfaiapp"],
          },
        ],
        tasks: [
          {
            projectSlug: "youmd",
            title: "Export portfolio graph snapshots",
            ownerType: "agent",
            status: "in_progress",
            priority: "high",
            tags: ["portfolio"],
            updatedAt: Date.UTC(2026, 5, 17),
          },
        ],
        projectActivities: [
          {
            projectSlug: "youmd",
            kind: "commit",
            title: "Add repo-backed graph export",
            source: "local-git",
            occurredAt: Date.UTC(2026, 5, 17),
          },
        ],
      },
      "2026-06-17T12:00:00.000Z"
    );

    expect(files.map((file) => file.path)).toEqual([
      "projects/_portfolio/README.md",
      "projects/_portfolio/graph.md",
      "projects/_portfolio/graph.json",
    ]);

    const markdown = files.find((file) => file.path.endsWith("graph.md"))?.content ?? "";
    expect(markdown).toContain("# Portfolio Graph Snapshot");
    expect(markdown).toContain("| You.md | youmd | active | YouStack | houstongolden/youmd |");
    expect(markdown).toContain("| You.md MCP | mcp | youmd | protected | approved-write |");
    expect(markdown).toContain("| bamfsite | youmd | dependent | developer-agent |");
    expect(markdown).toContain("| Export portfolio graph snapshots | youmd | agent | in_progress | high |");

    for (const file of files) {
      expect(file.content).not.toContain("sk_test_");
      expect(file.content).not.toContain("OPENAI_API_KEY=sk_test");
      expect(file.content).not.toContain(".env.local=");
      expect(file.content).not.toContain("rawText");
    }

    const graphJson = files.find((file) => file.path.endsWith("graph.json"))?.content ?? "{}";
    const parsed = JSON.parse(graphJson) as {
      schemaVersion: string;
      counts: { projects: number; apiSurfaces: number; dependencyEdges: number; tasks: number };
      projects: Array<{ slug: string; constraints: string[] }>;
    };
    expect(parsed.schemaVersion).toBe("you-md/portfolio-graph-repo-snapshot/v1");
    expect(parsed.counts).toMatchObject({
      projects: 1,
      apiSurfaces: 1,
      dependencyEdges: 1,
      tasks: 1,
    });
    expect(parsed.projects[0]).toMatchObject({
      slug: "youmd",
      constraints: ["Never expose .env.local"],
    });
    expect(JSON.stringify(parsed)).toContain("OPENAI_API_KEY=[REDACTED_SECRET]");
  });

  it("keeps the machine-readable JSON snapshot below the repo mirror file cap", () => {
    const projects = Array.from({ length: 90 }, (_, index) => ({
      slug: `project-${index}`,
      name: `Project ${index}`,
      stackName: "YouStack",
      status: "active",
      summary: "A long but bounded project summary. ".repeat(40),
      goal: "A long but bounded project goal. ".repeat(40),
      vision: "A long but bounded project vision. ".repeat(40),
      positioning: "A long but bounded positioning statement. ".repeat(40),
      repoFullName: `houstongolden/project-${index}`,
      tags: ["portfolio", "agentic", "mcp"],
      painPoints: ["Repeated context loss ".repeat(20)],
      metrics: ["Time to useful local context ".repeat(20)],
      constraints: ["No secrets in repo snapshots ".repeat(20)],
      updatedAt: Date.UTC(2026, 5, 17) - index,
    }));
    const projectActivities = Array.from({ length: 160 }, (_, index) => ({
      projectSlug: `project-${index % 90}`,
      kind: "commit",
      title: `Activity ${index} ${"with verbose context ".repeat(30)}`,
      summary: "Detailed activity summary. ".repeat(40),
      source: "local-git",
      occurredAt: Date.UTC(2026, 5, 17) - index,
    }));

    const files = buildPortfolioRepoSnapshotFiles({
      projects,
      projectActivities,
      apiSurfaces: Array.from({ length: 40 }, (_, index) => ({
        slug: `surface-${index}`,
        name: `Surface ${index}`,
        kind: "mcp",
        ownerProjectSlug: `project-${index}`,
        trust: "protected",
        writePolicy: "approved-write",
        features: ["get_project_context", "hydrate_portfolio_graph", "sync_repo"],
        risk: "medium",
        integrationTypes: ["local-agent"],
      })),
      dependencyEdges: Array.from({ length: 40 }, (_, index) => ({
        fromProjectSlug: `project-${index}`,
        toProjectSlug: `project-${(index + 1) % 90}`,
        tier: "dependent",
        integrationType: "developer-agent",
        features: ["shared project context"],
        failureImpact: "Agent loses context. ".repeat(20),
      })),
    });

    const graphJson = files.find((file) => file.path.endsWith("graph.json"));
    expect(graphJson).toBeDefined();
    expect(new TextEncoder().encode(graphJson?.content ?? "").byteLength).toBeLessThan(128 * 1024);

    const parsed = JSON.parse(graphJson?.content ?? "{}") as {
      mirrorNote?: string;
      projects: Array<{ slug: string; repoFullName?: string }>;
      apiSurfaces: Array<{ slug: string; features: string[] }>;
      dependencyEdges: Array<{ fromProjectSlug: string; toProjectSlug?: string }>;
    };
    expect(parsed.mirrorNote).toContain("Slimmed");
    expect(parsed.projects[0]).toMatchObject({
      slug: "project-0",
      repoFullName: "houstongolden/project-0",
    });
    expect(parsed.apiSurfaces[0].features).toContain("get_project_context");
    expect(parsed.dependencyEdges[0]).toMatchObject({
      fromProjectSlug: "project-0",
      toProjectSlug: "project-1",
    });
  });
});
