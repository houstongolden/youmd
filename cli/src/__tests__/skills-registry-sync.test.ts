import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Mock the API layer so registry resolution is testable offline. The mock
// must cover everything lib/skills imports from lib/api.
vi.mock("../lib/api", () => ({
  getRegistrySkill: vi.fn(async (name: string) =>
    name === "growth-playbook"
      ? {
          ok: true,
          status: 200,
          data: { name, content: "# growth-playbook\n\nvoice: {{voice.overall}}" },
        }
      : { ok: false, status: 404, data: { error: "not found" } }
  ),
  recordSkillInstall: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  trackSkillUsage: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
  removeSkillInstall: vi.fn(async () => ({ ok: true, status: 200, data: {} })),
}));

describe("skills lib", () => {
  let tmpHome: string;
  let workDir: string;
  let originalHome: string | undefined;
  let originalCwd: string;
  let originalSharedSkillsDir: string | undefined;

  beforeEach(() => {
    tmpHome = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "youmd-skills-test-"))
    );
    workDir = path.join(tmpHome, "work");
    fs.mkdirSync(workDir);
    originalHome = process.env.HOME;
    originalCwd = process.cwd();
    originalSharedSkillsDir = process.env.YOUMD_SHARED_SKILLS_DIR;
    process.env.HOME = tmpHome;
    delete process.env.YOUMD_SHARED_SKILLS_DIR;
    // chdir away from the repo so a local .you/.youmd bundle can't leak in
    process.chdir(workDir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env.HOME = originalHome;
    if (originalSharedSkillsDir === undefined) delete process.env.YOUMD_SHARED_SKILLS_DIR;
    else process.env.YOUMD_SHARED_SKILLS_DIR = originalSharedSkillsDir;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe("registry: source resolution (P28)", () => {
    it("resolves registry:<name> through the registry API", async () => {
      const { resolveSkillSourceAsync } = await import("../lib/skills");
      const content = await resolveSkillSourceAsync("registry:growth-playbook");
      expect(content).toContain("# growth-playbook");
    });

    it("returns null for unknown registry skills", async () => {
      const { resolveSkillSourceAsync } = await import("../lib/skills");
      const content = await resolveSkillSourceAsync("registry:does-not-exist");
      expect(content).toBeNull();
    });

    it("returns null for an empty registry name", async () => {
      const { resolveSkillSourceAsync } = await import("../lib/skills");
      expect(await resolveSkillSourceAsync("registry:")).toBeNull();
    });

    it("classifies registry: as a remote source (install falls back to async path)", async () => {
      const { isRemoteSkillSource } = await import("../lib/skills");
      expect(isRemoteSkillSource("registry:growth-playbook")).toBe(true);
      expect(isRemoteSkillSource("github:owner/repo/skill.md")).toBe(true);
      expect(isRemoteSkillSource("https://example.com/skill.md")).toBe(true);
      expect(isRemoteSkillSource("local:/tmp/skill.md")).toBe(false);
      expect(isRemoteSkillSource("bundled:skills/skill.md")).toBe(false);
    });

    it("end-to-end: a catalog entry with a registry: source installs via installSkillAsync", async () => {
      const { writeSkillCatalog } = await import("../lib/skill-catalog");
      writeSkillCatalog({
        version: 1,
        owner: "test",
        skills: [
          {
            name: "growth-playbook",
            description: "test skill",
            version: "1.0.0",
            source: "registry:growth-playbook",
            scope: "shared",
            identity_fields: [],
            requires: [],
            installed: false,
          },
        ],
      });

      const { installSkill, installSkillAsync } = await import("../lib/skills");

      // Sync path must report it as remote (the hint command's resolution logic)
      const syncResult = installSkill("growth-playbook");
      expect(syncResult.ok).toBe(false);
      expect(syncResult.error).toContain("remote source");

      // Async fallback (what `youmd skill install <name>` runs) succeeds
      const asyncResult = await installSkillAsync("growth-playbook");
      expect(asyncResult.ok).toBe(true);

      const installedPath = path.join(
        tmpHome, ".you", "skills", "growth-playbook", "SKILL.md"
      );
      expect(fs.existsSync(installedPath)).toBe(true);
      expect(fs.readFileSync(installedPath, "utf-8")).toContain("# growth-playbook");
    });
  });

  describe("shared: source resolution", () => {
    function seedSharedSkill(name: string): string {
      const skillPath = path.join(
        tmpHome,
        ".agent-shared",
        "claude-skills",
        name,
        "SKILL.md"
      );
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(
        skillPath,
        `---\nname: ${name}\n---\n\n# ${name}\n\nAudits projects without secrets.\n`
      );
      return skillPath;
    }

    it("resolves shared:<name> from the canonical agent-shared skill root", async () => {
      seedSharedSkill("portfolio-graph-auditor");

      const { resolveSkillSource } = await import("../lib/skills");
      const content = resolveSkillSource("shared:portfolio-graph-auditor");

      expect(content).toContain("# portfolio-graph-auditor");
    });

    it("rejects path-like shared skill names", async () => {
      seedSharedSkill("portfolio-graph-auditor");

      const { resolveSkillSource } = await import("../lib/skills");

      expect(resolveSkillSource("shared:../portfolio-graph-auditor")).toBeNull();
      expect(resolveSkillSource("shared:portfolio/graph")).toBeNull();
    });

    it("end-to-end: a catalog entry with a shared: source installs through the sync path", async () => {
      seedSharedSkill("portfolio-graph-auditor");

      const { writeSkillCatalog } = await import("../lib/skill-catalog");
      writeSkillCatalog({
        version: 1,
        owner: "test",
        skills: [
          {
            name: "portfolio-graph-auditor",
            description: "test skill",
            version: "1.0.0",
            source: "shared:portfolio-graph-auditor",
            scope: "shared",
            identity_fields: [],
            requires: [],
            installed: false,
          },
        ],
      });

      const { installSkill } = await import("../lib/skills");
      const result = installSkill("portfolio-graph-auditor");

      expect(result.ok).toBe(true);
      const installedPath = path.join(
        tmpHome,
        ".you",
        "skills",
        "portfolio-graph-auditor",
        "SKILL.md"
      );
      expect(fs.readFileSync(installedPath, "utf-8")).toContain("# portfolio-graph-auditor");
    });
  });

  describe("sync timestamp + identity change detection (L11)", () => {
    function seedInstalledSkill(name: string): void {
      const skillDir = path.join(tmpHome, ".you", "skills", name);
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${name}\n---\n\n# ${name}\n`
      );
      const catalogDir = path.join(tmpHome, ".you", "skills");
      fs.mkdirSync(catalogDir, { recursive: true });
    }

    it("syncAllSkills records lastSyncedAt in skill metrics", async () => {
      const { writeSkillCatalog } = await import("../lib/skill-catalog");
      seedInstalledSkill("test-skill");
      writeSkillCatalog({
        version: 1,
        owner: "test",
        skills: [
          {
            name: "test-skill",
            description: "test",
            version: "1.0.0",
            source: "local:/nowhere.md",
            scope: "shared",
            identity_fields: [],
            requires: [],
            installed: true,
          },
        ],
      });

      const { syncAllSkills, getMetrics } = await import("../lib/skills");
      expect(getMetrics().lastSyncedAt).toBeUndefined();

      const before = Date.now();
      const result = syncAllSkills();
      expect(result.synced).toContain("test-skill");

      const lastSyncedAt = getMetrics().lastSyncedAt;
      expect(lastSyncedAt).toBeDefined();
      expect(Date.parse(lastSyncedAt as string)).toBeGreaterThanOrEqual(before - 1000);
    });

    it("getIdentityLastChangedAt returns null without a bundle", async () => {
      const { getIdentityLastChangedAt } = await import("../lib/skills");
      expect(getIdentityLastChangedAt()).toBeNull();
    });

    it("getIdentityLastChangedAt tracks identity file mtimes", async () => {
      const profileDir = path.join(tmpHome, ".you", "profile");
      fs.mkdirSync(profileDir, { recursive: true });
      fs.writeFileSync(path.join(profileDir, "about.md"), "# About\n\nfounder.\n");

      const { getIdentityLastChangedAt } = await import("../lib/skills");
      const changedAt = getIdentityLastChangedAt();
      expect(changedAt).not.toBeNull();
      expect(changedAt as number).toBeGreaterThan(Date.now() - 60_000);

      // Touch the file with a future mtime — changedAt must move forward
      const future = new Date(Date.now() + 5_000);
      fs.utimesSync(path.join(profileDir, "about.md"), future, future);
      expect(getIdentityLastChangedAt() as number).toBeGreaterThan(changedAt as number);
    });
  });
});
