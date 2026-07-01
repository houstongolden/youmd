/**
 * Tests for the orchestrator's READ-ONLY brain tools (buildBrainTools):
 *   get_identity  — who the user is / current context (reuses api.getMe/getMeUser)
 *   list_projects — portfolio-graph projects (reuses api.getPortfolioGraph)
 *   get_project   — one project's goal/stack/repo (reuses api.getPortfolioGraph)
 *
 * These give U enough brain to route a goal to the right project/repo/machine BEFORE spawning a
 * worker. The tests assert tool shape, graceful unauthenticated behavior, string-only returns, and
 * that the tools never throw. The api client and config auth are MOCKED — no network is touched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mutable state so each test can flip auth + control the fake api responses.
const state = vi.hoisted(() => ({
  authenticated: false,
  getMe: undefined as unknown,
  getPortfolioGraph: undefined as unknown,
}));

vi.mock("../lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/config")>();
  return {
    ...actual,
    isAuthenticated: () => state.authenticated,
    readGlobalConfig: () => ({}),
  };
});

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getMe: async () => state.getMe,
    getPortfolioGraph: async () => state.getPortfolioGraph,
  };
});

// Import AFTER the mocks are registered.
import { buildBrainTools } from "../lib/orchestrator/tools";

const okMe = {
  ok: true,
  data: {
    user: { username: "houston", email: "houston@bamf.ai", displayName: "Houston Golden", plan: "pro", createdAt: 1 },
    latestBundle: { version: 7, isPublished: true, createdAt: 1 },
    publishedBundle: null,
    bundleCount: 7,
  },
};

const okGraph = {
  ok: true,
  data: {
    schemaVersion: "you-md/portfolio-graph/v1",
    projects: [
      {
        slug: "youmd",
        name: "You.md",
        stackName: "YouStack",
        status: "active",
        goal: "Identity context protocol for the agent internet.",
        focus: "Portfolio graph + orchestrator.",
        repoFullName: "houstongolden/youmd",
        repoUrl: "https://github.com/houstongolden/youmd",
        productUrl: "https://you.md",
        environments: ["prod", "dev"],
        tags: ["mcp", "cli"],
      },
      {
        slug: "hubify",
        name: "Hubify",
        stackName: "HubStack",
        status: "research",
        goal: "Durable research operations.",
        repoName: "hubify",
      },
    ],
    recentTrackedProjects: [],
  },
};

function toolByName(name: string) {
  const t = buildBrainTools().find((x) => x.name === name);
  if (!t) throw new Error(`missing tool ${name}`);
  return t;
}

beforeEach(() => {
  state.authenticated = false;
  state.getMe = { ok: false, error: "unset" };
  state.getPortfolioGraph = { ok: false, error: "unset" };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("buildBrainTools — shape", () => {
  it("exposes exactly the three read-only brain tools with LoopTool shape", () => {
    const tools = buildBrainTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_identity", "get_project", "list_projects"]);
    for (const t of tools) {
      expect(typeof t.name).toBe("string");
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(0);
      expect(typeof t.parameters).toBe("object");
      expect(typeof t.run).toBe("function");
      // Read-only: descriptions advertise it and there is no spawn/mutation vocabulary.
      expect(t.description).toMatch(/READ-ONLY/);
    }
  });

  it("get_project declares a project parameter; identity/list take none", () => {
    expect(Object.keys(toolByName("get_project").parameters)).toContain("project");
    expect(Object.keys(toolByName("get_identity").parameters)).toHaveLength(0);
    expect(Object.keys(toolByName("list_projects").parameters)).toHaveLength(0);
  });
});

describe("buildBrainTools — unauthenticated degrades gracefully (mirrors list_machines)", () => {
  it("every tool returns a clear not-authenticated string and never throws", async () => {
    state.authenticated = false;
    for (const t of buildBrainTools()) {
      const out = await t.run({ project: "youmd" });
      expect(typeof out).toBe("string");
      expect(out.toLowerCase()).toContain("not authenticated");
    }
  });
});

describe("get_identity", () => {
  it("summarizes the user from api.getMe/getMeUser", async () => {
    state.authenticated = true;
    state.getMe = okMe;
    const out = await toolByName("get_identity").run({});
    expect(typeof out).toBe("string");
    expect(out).toContain("Houston Golden");
    expect(out).toContain("houston");
    expect(out).toContain("v7");
  });

  it("returns a readable error string (not a throw) when the api call fails", async () => {
    state.authenticated = true;
    state.getMe = { ok: false, error: "boom" };
    const out = await toolByName("get_identity").run({});
    expect(typeof out).toBe("string");
    expect(out.toLowerCase()).toContain("error");
  });

  it("does not throw if the api client itself rejects", async () => {
    state.authenticated = true;
    // A thenable that rejects — awaiting it inside run() must be caught, not propagated.
    state.getMe = { then: (_res: unknown, rej: (e: Error) => void) => rej(new Error("network down")) };
    const out = await toolByName("get_identity").run({});
    expect(typeof out).toBe("string");
    expect(out.toLowerCase()).toContain("error");
  });
});

describe("list_projects", () => {
  it("lists portfolio-graph projects with slug/status/stack/repo", async () => {
    state.authenticated = true;
    state.getPortfolioGraph = okGraph;
    const out = await toolByName("list_projects").run({});
    expect(typeof out).toBe("string");
    expect(out).toContain("youmd");
    expect(out).toContain("hubify");
    expect(out).toContain("active");
    expect(out).toContain("YouStack");
  });

  it("reports empty portfolio gracefully", async () => {
    state.authenticated = true;
    state.getPortfolioGraph = { ok: true, data: { projects: [], recentTrackedProjects: [] } };
    const out = await toolByName("list_projects").run({});
    expect(out.toLowerCase()).toContain("no projects");
  });
});

describe("get_project", () => {
  it("requires a project name", async () => {
    state.authenticated = true;
    const out = await toolByName("get_project").run({});
    expect(out.toLowerCase()).toContain("requires a project");
  });

  it("resolves a goal to the right repo + stack by slug", async () => {
    state.authenticated = true;
    state.getPortfolioGraph = okGraph;
    const out = await toolByName("get_project").run({ project: "youmd" });
    expect(out).toContain("houstongolden/youmd");
    expect(out).toContain("YouStack");
    expect(out).toContain("Identity context protocol");
  });

  it("matches case/format-insensitively and by display name", async () => {
    state.authenticated = true;
    state.getPortfolioGraph = okGraph;
    const out = await toolByName("get_project").run({ project: "You.md" });
    expect(out).toContain("houstongolden/youmd");
  });

  it("returns a helpful miss with known projects when no match", async () => {
    state.authenticated = true;
    state.getPortfolioGraph = okGraph;
    const out = await toolByName("get_project").run({ project: "does-not-exist" });
    expect(out.toLowerCase()).toContain("no project matched");
    expect(out).toContain("youmd");
  });
});
