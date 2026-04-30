import { describe, expect, it } from "vitest";
import { getPortraitEncounterBounds } from "../lib/ascii";

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
});
