import { describe, expect, it } from "vitest";

import { buildAgentStackRepoSnapshotFiles } from "./agentStackRepoSnapshot";

describe("buildAgentStackRepoSnapshotFiles", () => {
  it("renders secret-safe repo-backed agent stack inventory markdown and JSON", () => {
    const files = buildAgentStackRepoSnapshotFiles(
      [
        {
          machineKey: "houstons-mbp-agent-stack",
          hostName: "Houstons-MBP.lan",
          platform: "darwin 25.0.0",
          rootDir: "/Users/houston/Desktop/CODE_2025",
          inventorySchemaVersion: "local-agent-stack-inventory/v1",
          uniqueSkillNames: 427,
          uniqueRealSkillFiles: 824,
          directExposureSkillRecords: 409,
          canonicalSkillFiles: 814,
          youmdCatalogSkills: 12,
          missingFromYoumdCatalog: 415,
          duplicateNameDifferentRealpaths: 73,
          sameRealpathMirrors: 133,
          projectSignals: 91,
          ownershipRollup: { "houston-owned": 80, external: 300 },
          syncPolicyRollup: { mirror: 133, "catalog-as-external-reference": 415 },
          provenanceRollup: { gstack: 40, scistack: 91 },
          missingCatalogSamples: ["academic-paper", "OPENAI_API_KEY=sk_test_should_redact_1234567890"],
          duplicateNameSamples: ["autoplan", "ghp_should_redact_12345678901234567890"],
          mirrorSamples: ["agent-stack-inventory"],
          source: "youmd-cli",
          agentName: "youmd skill inventory",
          secretValuesExposed: false,
          generatedAt: Date.UTC(2026, 5, 19, 20),
          updatedAt: Date.UTC(2026, 5, 19, 20),
        },
      ],
      "2026-06-19T20:00:00.000Z"
    );

    expect(files.map((file) => file.path)).toEqual([
      "agent-stack/README.md",
      "agent-stack/inventory.md",
      "agent-stack/inventory.json",
    ]);

    const markdown = files.find((file) => file.path.endsWith("inventory.md"))?.content ?? "";
    expect(markdown).toContain("# Agent Stack Inventory Snapshot");
    expect(markdown).toContain("| Houstons-MBP.lan | darwin 25.0.0 | /Users/houston/Desktop/CODE_2025 | 427 | 12 | 415 | 73 | 133 |");
    expect(markdown).toContain("- academic-paper");
    expect(markdown).toContain("- houston-owned: 80");
    expect(markdown).toContain("Security contract");

    for (const file of files) {
      expect(file.content).not.toContain("sk_test");
      expect(file.content).not.toContain("ghp_should");
      expect(file.content).not.toContain("OPENAI_API_KEY=sk_test");
      expect(file.content).not.toContain(".env.local=");
    }

    const inventoryJson = files.find((file) => file.path.endsWith("inventory.json"))?.content ?? "{}";
    const parsed = JSON.parse(inventoryJson) as {
      schemaVersion: string;
      counts: {
        machines: number;
        latestUniqueSkillNames: number;
        latestYoumdCatalogSkills: number;
        latestMissingFromYoumdCatalog: number;
        latestDryReviewCases: number;
      };
      inventories: Array<{ counts: { uniqueSkillNames: number }; missingCatalogSamples: string[] }>;
      security: { secretValuesExposed: boolean };
    };

    expect(parsed.schemaVersion).toBe("you-md/agent-stack-repo-snapshot/v1");
    expect(parsed.counts).toMatchObject({
      machines: 1,
      latestUniqueSkillNames: 427,
      latestYoumdCatalogSkills: 12,
      latestMissingFromYoumdCatalog: 415,
      latestDryReviewCases: 73,
    });
    expect(parsed.inventories[0].counts.uniqueSkillNames).toBe(427);
    expect(parsed.inventories[0].missingCatalogSamples).toContain("OPENAI_API_KEY=[REDACTED_SECRET]");
    expect(parsed.security.secretValuesExposed).toBe(false);
  });
});
