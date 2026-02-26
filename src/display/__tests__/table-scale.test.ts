import { describe, it, expect } from "vitest";
import { computeTableScale } from "../table-scale";

describe("computeTableScale", () => {
  it("returns ~1.0 when viewport fits table with room to spare", () => {
    // 800 table + 220 side + 32 padding = 1052 width needed for 1.0
    // 650 table + 64 header + 32 padding = 746 height needed for 1.0
    const scale = computeTableScale(1200, 900);
    expect(scale).toBeGreaterThanOrEqual(0.9);
    expect(scale).toBeLessThanOrEqual(1.2);
  });

  it("scales down proportionally when viewport is smaller", () => {
    const large = computeTableScale(1200, 900);
    const small = computeTableScale(800, 600);
    expect(small).toBeLessThan(large);
  });

  it("constrains by the tighter dimension (width vs height)", () => {
    // Very wide but short
    const wideShort = computeTableScale(2000, 400);
    // Very tall but narrow
    const tallNarrow = computeTableScale(600, 2000);
    // Both should be limited by the tight dimension
    expect(wideShort).toBeLessThan(1.0);
    expect(tallNarrow).toBeLessThan(1.0);
  });

  it("clamps to minimum 0.35", () => {
    const scale = computeTableScale(100, 100);
    expect(scale).toBe(0.35);
  });

  it("clamps to maximum 1.4", () => {
    const scale = computeTableScale(5000, 5000);
    expect(scale).toBe(1.4);
  });

  it("handles zero dimensions gracefully (returns 0.35)", () => {
    expect(computeTableScale(0, 0)).toBe(0.35);
    expect(computeTableScale(0, 800)).toBe(0.35);
    expect(computeTableScale(800, 0)).toBe(0.35);
  });

  it("accounts for side panel width when sidePanel=true", () => {
    const withPanel = computeTableScale(1000, 800, { sidePanel: true });
    const withoutPanel = computeTableScale(1000, 800, { sidePanel: false });
    expect(withoutPanel).toBeGreaterThan(withPanel);
  });

  it("ignores side panel when sidePanel=false (mobile)", () => {
    const scale = computeTableScale(1000, 800, { sidePanel: false });
    // Without side panel: availW = 1000 - 0 - 32 = 968 -> 968/800 = 1.21
    expect(scale).toBeGreaterThan(1.0);
  });
});
