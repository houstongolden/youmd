import { describe, expect, it } from "vitest";
import {
  buildMachineProjectPlan,
  githubRepoFromUrl,
} from "../lib/machine-projects";

describe("machine project bootstrap planner", () => {
  it("normalizes GitHub URL shapes into clone specs", () => {
    expect(githubRepoFromUrl("https://github.com/houstongolden/youmd.git")).toEqual({
      owner: "houstongolden",
      repo: "youmd",
      url: "https://github.com/houstongolden/youmd",
      cloneSpec: "houstongolden/youmd",
    });
    expect(githubRepoFromUrl("git@github.com:houstongolden/foldermd.git")?.cloneSpec).toBe("houstongolden/foldermd");
    expect(githubRepoFromUrl("Hubify-Projects/scistack")?.url).toBe("https://github.com/Hubify-Projects/scistack");
  });

  it("uses repo names as target directories and separates older projects", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          {
            name: "You.md",
            status: "active",
            githubUrl: "https://github.com/houstongolden/youmd",
            updatedAt: "2026-06-10T00:00:00.000Z",
          },
          {
            name: "Old thing",
            status: "paused",
            url: "https://github.com/houstongolden/old-thing",
            updatedAt: "2025-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        rootDir: "/Users/houston/Desktop/CODE_2026",
        activeDays: 90,
        now: new Date("2026-06-16T00:00:00.000Z"),
      },
    );

    expect(plan.rootDir).toBe("/Users/houston/Desktop/CODE_2026");
    expect(plan.recent).toHaveLength(1);
    expect(plan.recent[0].targetDirName).toBe("youmd");
    expect(plan.recent[0].cloneSpec).toBe("houstongolden/youmd");
    expect(plan.recent[0].apiDocsUrl).toBe("https://you.md/api/v1/docs/reference");
    expect(plan.recent[0].stackName).toBe("YouStack");
    expect(plan.older).toHaveLength(1);
    expect(plan.older[0].targetDirName).toBe("old-thing");
  });

  it("keeps active undated projects in the default selected group", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          {
            name: "BAMF.ai",
            status: "active",
            description: "main agency product repo https://github.com/houstongolden/bamfaiapp",
          },
        ],
      },
      {
        rootDir: "/tmp/CODE_2026",
        activeDays: 30,
        now: new Date("2026-06-16T00:00:00.000Z"),
      },
    );

    expect(plan.recent).toHaveLength(1);
    expect(plan.recent[0].recency).toBe("active-undated");
    expect(plan.recent[0].targetDirName).toBe("bamfaiapp");
  });

  it("dedupes projects that point at the same repo", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          { name: "You.md", url: "https://github.com/houstongolden/youmd" },
          { name: "U", repo: "houstongolden/youmd" },
        ],
      },
      { rootDir: "/tmp/CODE_2026", now: new Date("2026-06-16T00:00:00.000Z") },
    );

    expect(plan.recent).toHaveLength(1);
    expect(plan.skipped).toEqual([{ name: "U", reason: "duplicate repo/project target" }]);
  });

  it("hydrates cloneable recent projects from authenticated GitHub repo data", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          { name: "BAMF.ai", status: "active", description: "LinkedIn product" },
        ],
      },
      {
        rootDir: "/tmp/CODE_YOU",
        activeDays: 90,
        now: new Date("2026-06-16T00:00:00.000Z"),
        githubProjects: [
          {
            name: "bamfaiapp",
            fullName: "houstongolden/bamfaiapp",
            url: "https://github.com/houstongolden/bamfaiapp",
            pushedAt: "2026-06-15T00:00:00.000Z",
            homepage: "https://bamf.ai",
            description: "BAMF app",
            isPrivate: true,
          },
        ],
      },
    );

    expect(plan.recent).toHaveLength(1);
    const bamfRepo = plan.recent.find((project) => project.fullName === "houstongolden/bamfaiapp");
    expect(bamfRepo?.targetDirName).toBe("bamfaiapp");
    expect(bamfRepo?.projectUrl).toBe("https://bamf.ai");
    expect(bamfRepo?.source).toBe("github");
    expect(bamfRepo?.stackName).toBe("BAMFStack");
    expect(plan.skipped).toEqual([{ name: "BAMF.ai", reason: "covered by recent BAMFStack repo" }]);
  });

  it("uses persisted portfolio graph projects even when the local identity bundle is thin", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [],
      },
      {
        rootDir: "/tmp/CODE_YOU",
        activeDays: 90,
        now: new Date("2026-06-16T00:00:00.000Z"),
        portfolioGraph: {
          projects: [
            {
              slug: "badapp",
              name: "Bad.app",
              stackName: "BadStack",
              status: "active",
              focusStatus: "focusing",
              focusRank: 2,
              goal: "Fitness app with watch/iPhone agent capture loops.",
              focus: "Workout braindump capture into You.md task routing.",
              repoFullName: "houstongolden/badapp",
              repoUrl: "https://github.com/houstongolden/badapp",
              docs: ["project-context/PRD.md"],
              environments: ["local", "iOS", "watchOS"],
              tags: ["fitness", "watchos", "youmd"],
              lastActivityAt: Date.parse("2026-06-14T00:00:00.000Z"),
            },
          ],
          recentTrackedProjects: [],
        },
      },
    );

    expect(plan.sourceCounts.portfolioGraphProjects).toBe(1);
    expect(plan.recent).toHaveLength(1);
    expect(plan.recent[0]).toMatchObject({
      slug: "badapp",
      targetDirName: "badapp",
      cloneSpec: "houstongolden/badapp",
      source: "portfolio-graph",
      stackName: "BadStack",
      goal: "Fitness app with watch/iPhone agent capture loops.",
      focus: "Workout braindump capture into You.md task routing.",
      docs: ["project-context/PRD.md"],
      environments: ["local", "iOS", "watchOS"],
    });
  });

  it("uses active focused portfolio graph projects as the default fresh-machine setup gate", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          {
            name: "Local legacy idea",
            status: "active",
            url: "https://github.com/houstongolden/local-legacy-idea",
          },
        ],
      },
      {
        rootDir: "/tmp/CODE_YOU",
        activeDays: 30,
        now: new Date("2026-06-16T00:00:00.000Z"),
        portfolioGraph: {
          projects: [
            {
              slug: "youmd",
              name: "You.md",
              stackName: "YouStack",
              status: "active",
              focusStatus: "top-priority",
              focusRank: 1,
              repoUrl: "https://github.com/houstongolden/youmd",
              lastActivityAt: Date.parse("2026-06-15T00:00:00.000Z"),
            },
            {
              slug: "one-off-active",
              name: "One-off Active Repo",
              stackName: "Project Stack",
              status: "active",
              focusStatus: "unset",
              repoUrl: "https://github.com/houstongolden/one-off-active",
              lastActivityAt: Date.parse("2026-06-15T00:00:00.000Z"),
            },
            {
              slug: "paused-focus",
              name: "Paused Focus Repo",
              stackName: "Project Stack",
              status: "inactive",
              focusStatus: "focusing",
              repoUrl: "https://github.com/houstongolden/paused-focus",
              lastActivityAt: Date.parse("2026-06-15T00:00:00.000Z"),
            },
          ],
          recentTrackedProjects: [
            {
              name: "scratch-recent",
              fullName: "houstongolden/scratch-recent",
              url: "https://github.com/houstongolden/scratch-recent",
              pushedAt: "2026-06-15T00:00:00.000Z",
              isPrivate: true,
            },
          ],
        },
      },
    );

    expect(plan.recent.map((project) => project.slug)).toEqual(["youmd"]);
    expect(plan.recent[0]).toMatchObject({
      status: "active",
      focusStatus: "top-priority",
      focusRank: 1,
      machineSetupEligible: true,
    });
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        { name: "scratch-recent", reason: "not in focused portfolio graph for machine setup" },
        { name: "One-off Active Repo", reason: "focus not setup-eligible (unset)" },
        { name: "Paused Focus Repo", reason: "not active (inactive)" },
        { name: "Local legacy idea", reason: "superseded by focused portfolio graph selection gate" },
      ]),
    );
  });

  it("can include inactive and non-focused portfolio projects when explicitly requested", () => {
    const plan = buildMachineProjectPlan(
      { projects: [] },
      {
        rootDir: "/tmp/CODE_YOU",
        activeDays: 30,
        now: new Date("2026-06-16T00:00:00.000Z"),
        includeInactive: true,
        portfolioGraph: {
          projects: [
            {
              slug: "paused-focus",
              name: "Paused Focus Repo",
              status: "inactive",
              focusStatus: "focusing",
              repoUrl: "https://github.com/houstongolden/paused-focus",
              lastActivityAt: Date.parse("2026-06-15T00:00:00.000Z"),
            },
          ],
          recentTrackedProjects: [],
        },
      },
    );

    expect(plan.recent).toHaveLength(1);
    expect(plan.recent[0]).toMatchObject({
      slug: "paused-focus",
      status: "inactive",
      focusStatus: "focusing",
      machineSetupEligible: false,
    });
  });

  it("does not infer fake GitHub repos from non-GitHub slash paths in summaries", () => {
    const plan = buildMachineProjectPlan(
      {
        projects: [
          {
            name: "Docs-only project",
            status: "active",
            summary: "README has a badge at img.shields.io/badge/build-green and docs at nextjs.org/docs.",
          },
        ],
      },
      {
        rootDir: "/tmp/CODE_YOU",
        activeDays: 90,
        now: new Date("2026-06-16T00:00:00.000Z"),
      },
    );

    expect(plan.recent).toHaveLength(1);
    expect(plan.recent[0].githubUrl).toBeUndefined();
    expect(plan.recent[0].cloneSpec).toBeUndefined();
    expect(plan.recent[0].targetDirName).toBe("Docs-only-project");
  });
});
