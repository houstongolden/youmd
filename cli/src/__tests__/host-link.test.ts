/**
 * Host-link engine tests (P11): one engine, per-host adapter configs,
 * Claude Code discovery layout, and the empirical discovery release gate.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildHostLinkPlan,
  ensureSkillFrontmatter,
  hasLinkedClaudeSkills,
  hostLinkRelativePath,
  installedSkillsHostAdapterConfig,
  verifySkillDiscovery,
  verifySkillDiscoveryEntry,
  verifySkillFilesOnDisk,
  writeHostLinkPlan,
  youStackHostAdapterConfig,
} from "../lib/host-link";

const GOOD_SKILL = [
  "---",
  "name: alpha",
  "description: Alpha skill",
  "---",
  "",
  "# alpha",
  "",
  "Body.",
  "",
].join("\n");

describe("host-link engine", () => {
  describe("link plans per host", () => {
    const unit = { name: "alpha", description: "Alpha skill", content: GOOD_SKILL };

    it("stack configs: claude-code emits .claude/skills/<name>/SKILL.md", () => {
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("claude-code"));
      expect(plan).toHaveLength(1);
      expect(plan[0].relativePath).toBe(path.join(".claude", "skills", "alpha", "SKILL.md"));
      expect(plan[0].host).toBe("claude-code");
    });

    it("stack configs: codex keeps the youstacks namespace", () => {
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("codex"));
      expect(plan[0].relativePath).toBe(
        path.join(".codex", "skills", "youstacks", "alpha", "SKILL.md")
      );
    });

    it("stack configs: cursor keeps flat prefixed rules files", () => {
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("cursor"));
      expect(plan[0].relativePath).toBe(path.join(".cursor", "rules", "youstacks-alpha.md"));
      // cursor config does not ensure frontmatter — content passes through untouched
      expect(plan[0].content).toBe(unit.content);
    });

    it("stack configs: unknown hosts fall back to .you/adapters/<host>/", () => {
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("windsurf"));
      expect(plan[0].relativePath).toBe(path.join(".you", "adapters", "windsurf", "alpha.md"));
    });

    it("installed-skill configs: claude emits the discovery layout per skill", () => {
      const beta = { name: "beta", description: "Beta skill", content: "# beta\n\nBody.\n" };
      const plan = buildHostLinkPlan([unit, beta], installedSkillsHostAdapterConfig("claude"));
      expect(plan.map((entry) => entry.relativePath)).toEqual([
        path.join(".claude", "skills", "alpha", "SKILL.md"),
        path.join(".claude", "skills", "beta", "SKILL.md"),
      ]);
      // frontmatter is ensured even when the source had none
      expect(plan[1].content.startsWith("---\nname: beta\ndescription: Beta skill\n---\n\n")).toBe(
        true
      );
    });

    it("installed-skill configs: cursor concatenates into one rules file", () => {
      const beta = { name: "beta", content: "# beta\n" };
      const plan = buildHostLinkPlan([unit, beta], installedSkillsHostAdapterConfig("cursor"));
      expect(plan).toHaveLength(1);
      expect(plan[0].relativePath).toBe(path.join(".cursor", "rules", "youmd.md"));
      expect(plan[0].content).toContain("# You.md Identity Skills");
      expect(plan[0].content).toContain("## alpha");
      expect(plan[0].content).toContain("## beta");
    });

    it("manifest-declared adapter paths override the default layout", () => {
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("claude-code"), {
        explicitRelativePaths: ["custom/dir/SKILL.md"],
      });
      expect(plan).toHaveLength(1);
      expect(plan[0].relativePath).toBe("custom/dir/SKILL.md");
    });

    it("rejects unsafe skill names and adapter paths", () => {
      expect(() =>
        buildHostLinkPlan(
          [{ name: "../escape", content: "x" }],
          youStackHostAdapterConfig("claude-code")
        )
      ).toThrow(/Unsafe skill name/);
      expect(() =>
        buildHostLinkPlan([unit], youStackHostAdapterConfig("claude-code"), {
          explicitRelativePaths: ["../outside/SKILL.md"],
        })
      ).toThrow(/Unsafe adapter path/);
    });

    it("hostLinkRelativePath matches plan output", () => {
      const config = youStackHostAdapterConfig("claude-code");
      expect(hostLinkRelativePath(config, "alpha")).toBe(
        path.join(".claude", "skills", "alpha", "SKILL.md")
      );
    });
  });

  describe("ensureSkillFrontmatter", () => {
    it("passes compliant content through byte-identical", () => {
      expect(ensureSkillFrontmatter(GOOD_SKILL, "alpha")).toBe(GOOD_SKILL);
    });

    it("synthesizes minimal frontmatter when missing", () => {
      const out = ensureSkillFrontmatter("# body\n", "alpha", "Alpha skill");
      expect(out).toBe("---\nname: alpha\ndescription: Alpha skill\n---\n\n# body\n");
    });

    it("rewrites a mismatched name while preserving extra keys", () => {
      const input = [
        "---",
        "name: wrong-name",
        "version: 1.0.0",
        "description: Alpha skill",
        "---",
        "",
        "# alpha",
        "",
      ].join("\n");
      const out = ensureSkillFrontmatter(input, "alpha");
      expect(out).toContain("name: alpha");
      expect(out).toContain("version: 1.0.0");
      expect(out).toContain("description: Alpha skill");
      expect(out).not.toContain("wrong-name");
    });
  });

  describe("discovery release gate", () => {
    it("passes a compliant SKILL.md", () => {
      const check = verifySkillDiscoveryEntry(".claude/skills/alpha/SKILL.md", GOOD_SKILL);
      expect(check.ok).toBe(true);
      expect(check.name).toBe("alpha");
      expect(check.problems).toEqual([]);
    });

    it("fails when frontmatter is missing name or description", () => {
      const noDesc = "---\nname: alpha\n---\n\nBody.\n";
      const check = verifySkillDiscoveryEntry(".claude/skills/alpha/SKILL.md", noDesc);
      expect(check.ok).toBe(false);
      expect(check.problems.join("\n")).toContain("missing description");

      const noFm = "# alpha\n\nBody.\n";
      const check2 = verifySkillDiscoveryEntry(".claude/skills/alpha/SKILL.md", noFm);
      expect(check2.ok).toBe(false);
      expect(check2.problems.join("\n")).toContain("missing name");
    });

    it("fails when the frontmatter name does not match the directory", () => {
      const check = verifySkillDiscoveryEntry(".claude/skills/beta/SKILL.md", GOOD_SKILL);
      expect(check.ok).toBe(false);
      expect(check.problems.join("\n")).toContain('does not match its directory "beta"');
    });

    it("fails on empty bodies and unparseable frontmatter", () => {
      const empty = "---\nname: alpha\ndescription: Alpha skill\n---\n\n   \n";
      expect(
        verifySkillDiscoveryEntry(".claude/skills/alpha/SKILL.md", empty).problems.join("\n")
      ).toContain("body is empty");

      const broken = "---\nname: [unclosed\ndescription: x\n---\n\nBody.\n";
      const check = verifySkillDiscoveryEntry(".claude/skills/alpha/SKILL.md", broken);
      expect(check.ok).toBe(false);
      expect(check.problems.join("\n")).toContain("frontmatter does not parse");
    });

    it("verifies only SKILL.md entries in a link plan", () => {
      const report = verifySkillDiscovery([
        { relativePath: ".claude/skills/alpha/SKILL.md", content: GOOD_SKILL },
        { relativePath: ".cursor/rules/youmd.md", content: "no frontmatter, not a skill" },
      ]);
      expect(report.checks).toHaveLength(1);
      expect(report.ok).toBe(true);
    });

    it("reports failures across a mixed plan", () => {
      const report = verifySkillDiscovery([
        { relativePath: ".claude/skills/alpha/SKILL.md", content: GOOD_SKILL },
        { relativePath: ".claude/skills/beta/SKILL.md", content: "# beta\n" },
      ]);
      expect(report.ok).toBe(false);
      expect(report.checks).toHaveLength(2);
      expect(report.checks[0].ok).toBe(true);
      expect(report.checks[1].ok).toBe(false);
    });
  });

  describe("filesystem helpers", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-host-link-engine-"));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("writes plans to disk and supports dry-run", () => {
      const unit = { name: "alpha", description: "Alpha skill", content: GOOD_SKILL };
      const plan = buildHostLinkPlan([unit], youStackHostAdapterConfig("claude-code"));

      const dry = writeHostLinkPlan(plan, tmpDir, { dryRun: true });
      expect(dry[0].wrote).toBe(false);
      expect(fs.existsSync(dry[0].targetPath)).toBe(false);

      const wet = writeHostLinkPlan(plan, tmpDir);
      expect(wet[0].wrote).toBe(true);
      expect(fs.readFileSync(wet[0].targetPath, "utf-8")).toBe(GOOD_SKILL);
    });

    it("verifySkillFilesOnDisk audits emitted SKILL.md files (CI use)", () => {
      const skillsRoot = path.join(tmpDir, ".claude", "skills");
      fs.mkdirSync(path.join(skillsRoot, "alpha"), { recursive: true });
      fs.writeFileSync(path.join(skillsRoot, "alpha", "SKILL.md"), GOOD_SKILL);
      fs.mkdirSync(path.join(skillsRoot, "broken"), { recursive: true });
      fs.writeFileSync(path.join(skillsRoot, "broken", "SKILL.md"), "no frontmatter\n");

      const report = verifySkillFilesOnDisk(skillsRoot);
      expect(report.ok).toBe(false);
      expect(report.checks).toHaveLength(2);
      const broken = report.checks.find((check) => check.path.includes("broken"));
      expect(broken?.ok).toBe(false);
    });

    it("hasLinkedClaudeSkills detects new layout and legacy youmd dir", () => {
      expect(hasLinkedClaudeSkills(tmpDir, ["alpha"])).toBe(false);

      const skillDir = path.join(tmpDir, ".claude", "skills", "alpha");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), GOOD_SKILL);
      expect(hasLinkedClaudeSkills(tmpDir, ["alpha"])).toBe(true);

      // legacy layout still counts as linked
      const legacyDir = path.join(tmpDir, ".claude", "skills", "youmd");
      fs.rmSync(path.join(tmpDir, ".claude"), { recursive: true, force: true });
      fs.mkdirSync(legacyDir, { recursive: true });
      expect(hasLinkedClaudeSkills(tmpDir, ["alpha"])).toBe(true);
    });
  });
});
