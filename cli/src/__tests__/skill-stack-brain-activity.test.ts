import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
}));

const recordBrainActivityMock = vi.fn(async () => ({
  ok: true,
  status: 200,
  data: { success: true, secretValuesExposed: false },
}));

vi.mock("../lib/api", () => ({
  apiErrorMessage: vi.fn(() => undefined),
  browseSkills: vi.fn(async () => ({ ok: true, status: 200, data: { skills: [] } })),
  publishSkill: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  getMySkills: vi.fn(async () => ({ ok: true, status: 200, data: { skills: [] } })),
  getRegistrySkill: vi.fn(async () => ({ ok: false, status: 404, data: {} })),
  getSkillInsights: vi.fn(async () => ({ ok: true, status: 200, data: { insights: [] } })),
  getFleetSnapshot: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  listMaintainerProposals: vi.fn(async () => ({ ok: true, status: 200, data: { proposals: [] } })),
  setProposalDecision: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  listBrainConsent: vi.fn(async () => ({ ok: true, status: 200, data: { consents: [] } })),
  setBrainConsent: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  recordBrainActivity: recordBrainActivityMock,
}));

vi.mock("child_process", () => ({
  spawnSync: spawnSyncMock,
}));

describe("skill/stack brain activity producers", () => {
  let tmpHome: string;
  let originalHome: string | undefined;
  let originalApiKey: string | undefined;
  let originalCwd: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "youmd-activity-test-")));
    originalHome = process.env.HOME;
    originalApiKey = process.env.YOUMD_API_KEY;
    originalCwd = process.cwd();
    process.env.HOME = tmpHome;
    process.env.YOUMD_API_KEY = "ym_test_activity_key";
    process.chdir(tmpHome);
    recordBrainActivityMock.mockClear();
    spawnSyncMock.mockReset();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    if (originalApiKey === undefined) delete process.env.YOUMD_API_KEY;
    else process.env.YOUMD_API_KEY = originalApiKey;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function seedSkillCatalog(): void {
    const catalogDir = path.join(tmpHome, ".youmd", "skills");
    fs.mkdirSync(path.join(catalogDir, "project-clarity-audit"), { recursive: true });
    fs.writeFileSync(
      path.join(catalogDir, "project-clarity-audit", "SKILL.md"),
      "---\nname: project-clarity-audit\n---\n\n# {{profile.name}}\n",
    );
    fs.writeFileSync(
      path.join(catalogDir, "youmd-skills.yaml"),
      [
        "version: 1",
        "owner: test",
        "skills:",
        "  - name: project-clarity-audit",
        "    description: Project clarity",
        "    version: 1.0.0",
        "    source: shared:project-clarity-audit",
        "    scope: shared",
        "    identity_fields: []",
        "    requires: []",
        "    installed: true",
      ].join("\n") + "\n",
    );
  }

  it("records shared skill sync metadata for the live log", async () => {
    seedSkillCatalog();
    const { skillCommand } = await import("../commands/skill");

    await skillCommand("sync");

    expect(recordBrainActivityMock).toHaveBeenCalledTimes(1);
    expect(recordBrainActivityMock).toHaveBeenCalledWith(expect.objectContaining({
      source: "skill-sync",
      channel: "skills",
      kind: "shared-skill-sync",
      status: "ok",
      entityType: "sharedSkillSync",
      metadata: expect.objectContaining({
        syncedCount: 1,
        sharedSkillCount: 1,
        sharedSkills: ["project-clarity-audit"],
        sourcePrefixes: { shared: 1 },
        scopes: { shared: 1 },
        canonicalSharedRoot: "~/.agent-shared/claude-skills",
        secretValuesExposed: false,
      }),
    }));
    expect(logSpy).toHaveBeenCalled();
  });

  it("records stack sync metadata without command logs or secret material", async () => {
    const sharedRoot = path.join(tmpHome, ".agent-shared");
    fs.mkdirSync(path.join(sharedRoot, ".git"), { recursive: true });
    fs.mkdirSync(path.join(sharedRoot, "claude-skills", "project-clarity-audit"), { recursive: true });
    fs.writeFileSync(path.join(sharedRoot, "claude-skills", "project-clarity-audit", "SKILL.md"), "# skill\n");
    fs.writeFileSync(path.join(sharedRoot, "STACK-MAP.md"), "# stack map\n");

    spawnSyncMock.mockImplementation((cmd: string, args?: readonly string[]) => {
      if (cmd === "bash") {
        return { status: 0 };
      }
      if (cmd === "git" && args?.includes("rev-parse")) {
        return { status: 0, stdout: "abc123def456\n" };
      }
      if (cmd === "git" && args?.includes("branch")) {
        return { status: 0, stdout: "main\n" };
      }
      if (cmd === "git" && args?.includes("status")) {
        return { status: 0, stdout: "" };
      }
      return { status: 1, stdout: "" };
    });

    const { stackCommand } = await import("../commands/stack");
    await stackCommand("sync");

    expect(spawnSyncMock).toHaveBeenCalledWith("bash", [expect.stringContaining("skillstack-sync/sync.sh")], {
      stdio: "inherit",
    });
    expect(recordBrainActivityMock).toHaveBeenCalledTimes(1);
    expect(recordBrainActivityMock).toHaveBeenCalledWith(expect.objectContaining({
      source: "stack-sync",
      channel: "skills",
      kind: "shared-stack-sync",
      status: "ok",
      entityType: "sharedAgentStack",
      entityId: "~/.agent-shared",
      metadata: expect.objectContaining({
        exitCode: 0,
        dryRun: false,
        sharedSkillCount: 1,
        recentSharedSkills: ["project-clarity-audit"],
        stackMapPresent: true,
        rootExists: true,
        gitHead: "abc123def456",
        gitBranch: "main",
        dirty: false,
        canonicalSharedRoot: "~/.agent-shared/claude-skills",
        secretValuesExposed: false,
      }),
    }));
    const payload = JSON.stringify(recordBrainActivityMock.mock.calls[0]?.[0]);
    expect(payload).not.toContain("YOUMD_API_KEY");
    expect(payload).not.toContain("ym_test_activity_key");
  });
});
