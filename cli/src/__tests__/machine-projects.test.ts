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
});
