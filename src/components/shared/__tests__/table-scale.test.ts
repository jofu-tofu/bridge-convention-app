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

/**
 * Characterization tests for mobile and tablet viewports.
 *
 * All tests use sidePanel=false (mobile/tablet layout) with default
 * padding=32 and headerH=64.
 *
 * Formula:
 *   availW = viewportW - 0 - 32   (no side panel)
 *   availH = viewportH - 64 - 32
 *   scale  = max(0.35, min(1.4, availW / 800, availH / 650))
 */
describe("mobile and tablet viewports", () => {
  const mobile = { sidePanel: false } as const;

  // -- iPhone SE (375 x 667) ---------
  // availW = 375 - 32 = 343   -> 343 / 800 = 0.42875
  // availH = 667 - 96 = 571   -> 571 / 650 ~ 0.87846
  // scale  = min(0.42875, 0.87846) = 0.42875  (width-constrained)
  describe("iPhone SE (375x667)", () => {
    const scale = computeTableScale(375, 667, mobile);

    it("produces the expected scale", () => {
      expect(scale).toBe(343 / 800);
    });

    it("stays above minimum", () => {
      expect(scale).toBeGreaterThan(0.35);
    });

    it("is width-constrained", () => {
      const widthRatio = (375 - 32) / 800;
      const heightRatio = (667 - 96) / 650;
      expect(widthRatio).toBeLessThan(heightRatio);
      expect(scale).toBe(widthRatio);
    });
  });

  // -- iPhone 14 (390 x 844) ---------
  // availW = 390 - 32 = 358   -> 358 / 800 = 0.4475
  // availH = 844 - 96 = 748   -> 748 / 650 ~ 1.15077
  // scale  = min(0.4475, 1.15077) = 0.4475  (width-constrained)
  describe("iPhone 14 (390x844)", () => {
    const scale = computeTableScale(390, 844, mobile);

    it("produces the expected scale", () => {
      expect(scale).toBe(358 / 800);
    });

    it("stays above minimum", () => {
      expect(scale).toBeGreaterThan(0.35);
    });

    it("is width-constrained", () => {
      const widthRatio = (390 - 32) / 800;
      const heightRatio = (844 - 96) / 650;
      expect(widthRatio).toBeLessThan(heightRatio);
      expect(scale).toBe(widthRatio);
    });
  });

  // -- iPad Mini (768 x 1024) ---------
  // availW = 768 - 32 = 736   -> 736 / 800 = 0.92
  // availH = 1024 - 96 = 928  -> 928 / 650 ~ 1.42769
  // scale  = min(0.92, 1.42769) = 0.92  (width-constrained)
  describe("iPad Mini (768x1024)", () => {
    const scale = computeTableScale(768, 1024, mobile);

    it("produces the expected scale", () => {
      expect(scale).toBe(736 / 800);
    });

    it("stays above minimum", () => {
      expect(scale).toBeGreaterThan(0.35);
    });

    it("is width-constrained", () => {
      const widthRatio = (768 - 32) / 800;
      const heightRatio = (1024 - 96) / 650;
      expect(widthRatio).toBeLessThan(heightRatio);
      expect(scale).toBe(widthRatio);
    });
  });

  // -- iPad (810 x 1080) ---------
  // availW = 810 - 32 = 778   -> 778 / 800 = 0.9725
  // availH = 1080 - 96 = 984  -> 984 / 650 ~ 1.51385
  // scale  = min(0.9725, 1.51385) = 0.9725  (width-constrained)
  describe("iPad (810x1080)", () => {
    const scale = computeTableScale(810, 1080, mobile);

    it("produces the expected scale", () => {
      expect(scale).toBe(778 / 800);
    });

    it("stays above minimum", () => {
      expect(scale).toBeGreaterThan(0.35);
    });

    it("is width-constrained", () => {
      const widthRatio = (810 - 32) / 800;
      const heightRatio = (1080 - 96) / 650;
      expect(widthRatio).toBeLessThan(heightRatio);
      expect(scale).toBe(widthRatio);
    });
  });

  // -- Small Android (360 x 640) ---------
  // availW = 360 - 32 = 328   -> 328 / 800 = 0.41
  // availH = 640 - 96 = 544   -> 544 / 650 ~ 0.83692
  // scale  = min(0.41, 0.83692) = 0.41  (width-constrained)
  describe("Small Android (360x640)", () => {
    const scale = computeTableScale(360, 640, mobile);

    it("produces the expected scale", () => {
      expect(scale).toBe(328 / 800);
    });

    it("stays above minimum", () => {
      expect(scale).toBeGreaterThan(0.35);
    });

    it("is width-constrained", () => {
      const widthRatio = (360 - 32) / 800;
      const heightRatio = (640 - 96) / 650;
      expect(widthRatio).toBeLessThan(heightRatio);
      expect(scale).toBe(widthRatio);
    });
  });

  // -- GameScreen mobile layout breakpoint (width <= 1023) ------
  // GameScreen uses sidePanel=false when width <= 1023,
  // and sidePanel=true when width > 1023.
  describe("GameScreen layout breakpoint at 1023px", () => {
    const height = 768;

    it("uses sidePanel=false at width=1023 (mobile), giving a larger scale", () => {
      // Mobile: availW = 1023 - 0 - 32 = 991  -> 991/800 = 1.23875
      //         availH = 768 - 96 = 672         -> 672/650 ~ 1.03385
      //         scale = min(1.4, 1.23875, 1.03385) ~ 1.03385
      const mobileScale = computeTableScale(1023, height, { sidePanel: false });
      expect(mobileScale).toBe(Math.max(0.35, Math.min(1.4, 991 / 800, 672 / 650)));
    });

    it("uses sidePanel=true at width=1024 (desktop), giving a smaller scale", () => {
      // Desktop: availW = 1024 - 400 - 32 = 592  -> 592/800 = 0.74
      //          availH = 768 - 96 = 672           -> 672/650 ~ 1.03385
      //          scale = min(1.4, 0.74, 1.03385) = 0.74
      const desktopScale = computeTableScale(1024, height, { sidePanel: true });
      expect(desktopScale).toBe(592 / 800);
    });

    it("mobile layout at breakpoint yields larger table than desktop layout", () => {
      const mobileScale = computeTableScale(1023, height, { sidePanel: false });
      const desktopScale = computeTableScale(1024, height, { sidePanel: true });
      expect(mobileScale).toBeGreaterThan(desktopScale);
    });
  });
});
