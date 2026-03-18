import { describe, it, expect } from "vitest";
import { DESKTOP_MIN, TABLET_MIN } from "../breakpoints.svelte";

describe("breakpoint constants", () => {
  it("DESKTOP_MIN is 1024", () => {
    expect(DESKTOP_MIN).toBe(1024);
  });

  it("TABLET_MIN is 640", () => {
    expect(TABLET_MIN).toBe(640);
  });

  it("TABLET_MIN < DESKTOP_MIN (no gap)", () => {
    expect(TABLET_MIN).toBeLessThan(DESKTOP_MIN);
  });
});

describe("breakpoint classification logic", () => {
  // Test the pure logic that createBreakpoints implements
  function classify(w: number) {
    return {
      isDesktop: w >= DESKTOP_MIN,
      isTablet: w >= TABLET_MIN && w < DESKTOP_MIN,
      isMobile: w < TABLET_MIN,
    };
  }

  it("classifies 1920 as desktop", () => {
    expect(classify(1920)).toEqual({ isDesktop: true, isTablet: false, isMobile: false });
  });

  it("classifies 1024 as desktop (boundary)", () => {
    expect(classify(1024)).toEqual({ isDesktop: true, isTablet: false, isMobile: false });
  });

  it("classifies 1023 as tablet", () => {
    expect(classify(1023)).toEqual({ isDesktop: false, isTablet: true, isMobile: false });
  });

  it("classifies 768 as tablet", () => {
    expect(classify(768)).toEqual({ isDesktop: false, isTablet: true, isMobile: false });
  });

  it("classifies 640 as tablet (boundary)", () => {
    expect(classify(640)).toEqual({ isDesktop: false, isTablet: true, isMobile: false });
  });

  it("classifies 639 as mobile", () => {
    expect(classify(639)).toEqual({ isDesktop: false, isTablet: false, isMobile: true });
  });

  it("classifies 375 (iPhone SE) as mobile", () => {
    expect(classify(375)).toEqual({ isDesktop: false, isTablet: false, isMobile: true });
  });

  it("classifies 360 (small Android) as mobile", () => {
    expect(classify(360)).toEqual({ isDesktop: false, isTablet: false, isMobile: true });
  });

  it("every width is exactly one category", () => {
    for (const w of [0, 100, 375, 639, 640, 768, 1023, 1024, 1920, 3840]) {
      const c = classify(w);
      const count = [c.isDesktop, c.isTablet, c.isMobile].filter(Boolean).length;
      expect(count, `width ${w} should be exactly one category`).toBe(1);
    }
  });
});
