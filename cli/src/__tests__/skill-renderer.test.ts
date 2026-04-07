import { describe, it, expect } from "vitest";
import { renderSkillTemplate, checkTemplateReadiness } from "../lib/skill-renderer";

describe("skill-renderer", () => {
  const mockIdentity = {
    profile: {
      about: "Houston Golden. Founder of You.md.",
      projects: "You.md, BAMF Media",
      now: "Building identity protocol",
      values: "Ship fast, build in public",
      links: "https://you.md",
    },
    preferences: {
      agent: "Direct, no fluff, terminal-native",
      writing: "Short paragraphs, punchy sentences",
    },
    voice: {
      overall: "Direct, high-energy, founder-coded",
      writing: "Concise and opinionated",
    },
    directives: {
      agent: "No emoji. No forms. No corporate speak.",
    },
    project_name: "youmd",
    username: "houstongolden",
  };

  describe("renderSkillTemplate", () => {
    it("interpolates {{var}} placeholders", () => {
      const template = "Hello {{username}}, your voice is: {{voice.overall}}";
      const result = renderSkillTemplate(template, mockIdentity);
      expect(result).toContain("houstongolden");
      expect(result).toContain("Direct, high-energy");
    });

    it("preserves text without placeholders", () => {
      const template = "No variables here, just text.";
      const result = renderSkillTemplate(template, mockIdentity);
      expect(result).toBe("No variables here, just text.");
    });

    it("handles missing variables gracefully", () => {
      const template = "Name: {{profile.about}}, Missing: {{nonexistent.field}}";
      const result = renderSkillTemplate(template, mockIdentity);
      expect(result).toContain("Houston Golden");
      // Missing vars should remain as placeholder or empty
      expect(result).toBeDefined();
    });

    it("handles nested dot notation", () => {
      const template = "Prefs: {{preferences.agent}}";
      const result = renderSkillTemplate(template, mockIdentity);
      expect(result).toContain("Direct, no fluff");
    });
  });

  describe("checkTemplateReadiness", () => {
    it("reports all filled when identity is complete", () => {
      const template = "{{profile.about}} {{voice.overall}} {{username}}";
      const readiness = checkTemplateReadiness(template, mockIdentity);
      expect(readiness.total).toBe(3);
      expect(readiness.filled).toBe(3);
      expect(readiness.missing).toHaveLength(0);
    });

    it("reports missing fields", () => {
      const template = "{{profile.about}} {{nonexistent.thing}}";
      const readiness = checkTemplateReadiness(template, mockIdentity);
      expect(readiness.missing.length).toBeGreaterThan(0);
    });
  });
});
