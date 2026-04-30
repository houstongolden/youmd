import { describe, expect, it } from "vitest";
import { fitAsciiLines, getPortraitEncounterBounds } from "../lib/ascii";

describe("portrait encounter bounds", () => {
  it("keeps compact launcher portraits under roughly 30% terminal width", () => {
    const small = getPortraitEncounterBounds(80, true);
    const medium = getPortraitEncounterBounds(100, true);
    const large = getPortraitEncounterBounds(120, true);

    expect(small.maxPortraitCols).toBeLessThanOrEqual(24);
    expect(medium.maxPortraitCols).toBeLessThanOrEqual(28);
    expect(large.maxPortraitCols).toBeLessThanOrEqual(28);
    expect(large.maxPortraitRows).toBeLessThanOrEqual(12);
  });

  it("keeps a readable floor on compact layouts", () => {
    const tiny = getPortraitEncounterBounds(50, true);
    expect(tiny.maxPortraitCols).toBeGreaterThanOrEqual(18);
    expect(tiny.maxPortraitRows).toBeGreaterThanOrEqual(8);
  });

  it("allows the non-compact layout to stay larger than the launcher scene", () => {
    const regular = getPortraitEncounterBounds(120, false);
    const compact = getPortraitEncounterBounds(120, true);

    expect(regular.maxPortraitCols).toBeGreaterThan(compact.maxPortraitCols);
    expect(regular.maxPortraitRows).toBeGreaterThanOrEqual(compact.maxPortraitRows);
  });

  it("downsamples the full portrait height instead of cropping the top rows", () => {
    const source = Array.from({ length: 55 }, (_, index) => `row-${index.toString().padStart(2, "0")}`);
    const fitted = fitAsciiLines(source, 20, 12);

    expect(fitted).toHaveLength(12);
    expect(fitted[0]).toBe("row-00");
    expect(fitted.at(-1)).toBe("row-54");
    expect(fitted).toContain("row-49");
  });
});
