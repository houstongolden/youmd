import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addInventorySkillsToCatalog,
  type SkillCatalog,
} from "../lib/skill-catalog";

describe("skill catalog inventory registration", () => {
  let tmpHome: string | null = null;
  let originalHome: string | undefined;

  afterEach(() => {
    if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
    tmpHome = null;
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    originalHome = undefined;
    vi.resetModules();
  });

  function catalog(): SkillCatalog {
    return {
      version: 1,
      owner: "houston",
      skills: [
        {
          name: "existing",
          description: "Existing manually managed skill",
          version: "1.0.0",
          source: "shared:existing",
          scope: "shared",
          identity_fields: [],
          requires: [],
          installed: true,
        },
      ],
    };
  }

  it("adds inventory-discovered skills as non-destructive catalog references", () => {
    const result = addInventorySkillsToCatalog(
      catalog(),
      [
        {
          name: "agent-runtime-guard",
          ownerClasses: ["houston-owned-shared"],
          provenances: ["canonical ~/.agent-shared"],
          syncPolicies: ["syncable-canonical"],
          samplePaths: ["~/.agent-shared/claude-skills/agent-runtime-guard/SKILL.md"],
        },
        {
          name: "existing",
          ownerClasses: ["houston-owned-shared"],
          syncPolicies: ["syncable-canonical"],
          samplePaths: ["~/.agent-shared/claude-skills/existing/SKILL.md"],
        },
      ],
      { write: false }
    );

    expect(result).toEqual({
      added: 1,
      skipped: 1,
      skills: ["agent-runtime-guard"],
    });
  });

  it("preserves provenance and never marks discovered entries installed", () => {
    const c = catalog();
    addInventorySkillsToCatalog(
      c,
      [
        {
          name: "gstack-reference",
          ownerClasses: ["gstack-managed-reference"],
          provenances: ["GStack local reference stack"],
          syncPolicies: ["catalog-as-external-reference"],
          samplePaths: ["~/.claude/skills/gstack/gstack-reference/SKILL.md"],
        },
      ],
      { write: false }
    );

    const entry = c.skills.find((skill) => skill.name === "gstack-reference");
    expect(entry).toMatchObject({
      source: `local:${os.homedir()}/.claude/skills/gstack/gstack-reference/SKILL.md`,
      scope: "shared",
      installed: false,
      catalog_origin: "agent-stack-inventory",
      owner_classes: ["gstack-managed-reference"],
      provenances: ["GStack local reference stack"],
      sync_policies: ["catalog-as-external-reference"],
    });
  });

  it("hydrates readSkillCatalog from the latest local inventory snapshot", async () => {
    originalHome = process.env.HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "youmd-skill-catalog-"));
    process.env.HOME = tmpHome;
    const inventoryDir = path.join(tmpHome, ".youmd", "agent-stack-inventory");
    fs.mkdirSync(inventoryDir, { recursive: true });
    fs.writeFileSync(
      path.join(inventoryDir, "local-agent-stack-inventory-2026-06-20.json"),
      JSON.stringify({
        missingFromCatalog: [
          {
            name: "machine-sync",
            ownerClasses: ["houston-owned-shared"],
            provenances: ["canonical ~/.agent-shared"],
            syncPolicies: ["syncable-canonical"],
            samplePaths: ["~/.agent-shared/claude-skills/machine-sync/SKILL.md"],
          },
        ],
      })
    );

    vi.resetModules();
    const { readSkillCatalog } = await import("../lib/skill-catalog");
    const hydrated = readSkillCatalog();
    const entry = hydrated.skills.find((skill) => skill.name === "machine-sync");

    expect(entry).toMatchObject({
      source: `local:${tmpHome}/.agent-shared/claude-skills/machine-sync/SKILL.md`,
      installed: false,
      catalog_origin: "agent-stack-inventory",
      owner_classes: ["houston-owned-shared"],
      sync_policies: ["syncable-canonical"],
    });
  });
});
