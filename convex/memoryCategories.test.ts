/**
 * P15 — canonical memory-category module contract.
 *
 * Pins the ONE category vocabulary (convex/lib/memoryCategories.ts): the
 * canonical list, the durable subset (including the new `correction`
 * category), the frozen CLI-mirror-parity subset, legacy alias resolution
 * for writes, and the tolerant normalization used by the migration.
 */
import { describe, expect, it } from "vitest";

import {
  AGENT_WRITABLE_MEMORY_CATEGORIES,
  DEFAULT_MEMORY_CATEGORY,
  DURABLE_MEMORY_CATEGORIES,
  LEGACY_CATEGORY_ALIASES,
  MEMORY_CATEGORIES,
  MIRROR_PARITY_DURABLE_CATEGORIES,
  invalidMemoryCategoryMessage,
  isCanonicalMemoryCategory,
  normalizeMemoryCategory,
  resolveMemoryCategory,
} from "./lib/memoryCategories";

describe("memoryCategories — canonical list", () => {
  it("contains the canonical vocabulary including the new correction category", () => {
    expect([...MEMORY_CATEGORIES].sort()).toEqual([
      "context",
      "correction",
      "decision",
      "fact",
      "goal",
      "insight",
      "preference",
      "project",
      "relationship",
      "session_summary",
    ]);
  });

  it("durable set is fact/preference/decision/goal/correction", () => {
    expect(Array.from(DURABLE_MEMORY_CATEGORIES).sort()).toEqual([
      "correction",
      "decision",
      "fact",
      "goal",
      "preference",
    ]);
  });

  it("correction is durable — corrections must persist", () => {
    expect(DURABLE_MEMORY_CATEGORIES.has("correction")).toBe(true);
  });

  it("mirror-parity durable set stays frozen at the original four", () => {
    expect(Array.from(MIRROR_PARITY_DURABLE_CATEGORIES).sort()).toEqual([
      "decision",
      "fact",
      "goal",
      "preference",
    ]);
  });

  it("every durable category is canonical", () => {
    for (const category of Array.from(DURABLE_MEMORY_CATEGORIES)) {
      expect(isCanonicalMemoryCategory(category)).toBe(true);
    }
  });

  it("agent-writable categories exclude the platform-internal session_summary", () => {
    expect(AGENT_WRITABLE_MEMORY_CATEGORIES).not.toContain("session_summary");
    expect(AGENT_WRITABLE_MEMORY_CATEGORIES).toContain("correction");
  });

  it("every legacy alias maps to a canonical category", () => {
    for (const target of Object.values(LEGACY_CATEGORY_ALIASES)) {
      expect(isCanonicalMemoryCategory(target)).toBe(true);
    }
  });
});

describe("memoryCategories — resolveMemoryCategory (write paths)", () => {
  it("passes canonical categories through", () => {
    expect(resolveMemoryCategory("fact")).toBe("fact");
    expect(resolveMemoryCategory("correction")).toBe("correction");
  });

  it("trims and lowercases before matching", () => {
    expect(resolveMemoryCategory("  Fact ")).toBe("fact");
    expect(resolveMemoryCategory("PREFERENCE")).toBe("preference");
  });

  it("maps the pre-P15 hosted tool enum to canonical", () => {
    expect(resolveMemoryCategory("identity")).toBe("fact");
    expect(resolveMemoryCategory("work")).toBe("project");
    expect(resolveMemoryCategory("preferences")).toBe("preference");
    expect(resolveMemoryCategory("goals")).toBe("goal");
    expect(resolveMemoryCategory("context")).toBe("context");
  });

  it("returns null for unknown values so writes can reject", () => {
    expect(resolveMemoryCategory("vibes")).toBeNull();
    expect(resolveMemoryCategory("")).toBeNull();
    expect(resolveMemoryCategory(undefined)).toBeNull();
    expect(resolveMemoryCategory(42)).toBeNull();
  });
});

describe("memoryCategories — normalizeMemoryCategory (migration/reads)", () => {
  it("keeps canonical values unchanged", () => {
    expect(normalizeMemoryCategory("fact")).toEqual({
      category: "fact",
      changed: false,
      recognized: true,
    });
  });

  it("flags alias and casing changes", () => {
    expect(normalizeMemoryCategory("identity")).toEqual({
      category: "fact",
      changed: true,
      recognized: true,
    });
    expect(normalizeMemoryCategory("Fact")).toEqual({
      category: "fact",
      changed: true,
      recognized: true,
    });
  });

  it("defaults unknown values to insight, reported not dropped", () => {
    expect(normalizeMemoryCategory("totally-unknown")).toEqual({
      category: DEFAULT_MEMORY_CATEGORY,
      changed: true,
      recognized: false,
    });
    expect(DEFAULT_MEMORY_CATEGORY).toBe("insight");
  });
});

describe("memoryCategories — invalidMemoryCategoryMessage", () => {
  it("names the bad value and lists valid categories", () => {
    const msg = invalidMemoryCategoryMessage("vibes");
    expect(msg).toContain("vibes");
    expect(msg).toContain("correction");
    expect(msg).toContain("fact");
  });

  it("handles missing values", () => {
    expect(invalidMemoryCategoryMessage(undefined)).toContain("(missing)");
    expect(invalidMemoryCategoryMessage("  ")).toContain("(missing)");
  });
});
