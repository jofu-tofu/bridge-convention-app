/**
 * Tests for module-centric learning viewport builder.
 */

import { describe, it, expect } from "vitest";
import {
  buildModuleCatalog,
  buildModuleLearningViewport,
  derivePhaseOrder,
  formatModuleName,
} from "../learning-viewport";
import { getModule } from "../../conventions/definitions/module-registry";

// Side-effect: register all bundles
import "../../conventions/registration";

describe("buildModuleCatalog", () => {
  const catalog = buildModuleCatalog();

  it("returns all 7 registered modules", () => {
    expect(catalog.length).toBe(7);
  });

  it("each entry has displayName, surfaceCount > 0, and bundleIds", () => {
    for (const entry of catalog) {
      expect(entry.displayName).toBeTruthy();
      expect(entry.surfaceCount).toBeGreaterThan(0);
      expect(entry.bundleIds.length).toBeGreaterThan(0);
    }
  });

  it("stayman is in nt-bundle and nt-stayman", () => {
    const stayman = catalog.find((e) => e.moduleId === "stayman")!;
    expect(stayman.bundleIds).toContain("nt-bundle");
    expect(stayman.bundleIds).toContain("nt-stayman");
  });

  it("bergen is in bergen-bundle only", () => {
    const bergen = catalog.find((e) => e.moduleId === "bergen")!;
    expect(bergen.bundleIds).toEqual(["bergen-bundle"]);
  });
});

describe("buildModuleLearningViewport", () => {
  it("returns null for unknown module", () => {
    expect(buildModuleLearningViewport("nonexistent")).toBeNull();
  });

  describe("stayman viewport", () => {
    const viewport = buildModuleLearningViewport("stayman")!;

    it("has correct identity fields", () => {
      expect(viewport.moduleId).toBe("stayman");
      expect(viewport.displayName).toBe("Stayman");
      expect(viewport.description).toContain("Stayman");
    });

    it("has teaching content", () => {
      expect(viewport.teaching.tradeoff).toContain("2C");
      expect(viewport.teaching.principle).toBeTruthy();
      expect(viewport.teaching.commonMistakes.length).toBeGreaterThan(0);
    });

    it("has 5 phases matching Stayman FSM", () => {
      expect(viewport.phases.length).toBe(5);
      const phaseNames = viewport.phases.map((p) => p.phase);
      expect(phaseNames).toEqual(["idle", "asked", "shown-hearts", "shown-spades", "denied"]);
    });

    it("each phase has surfaces with explanation text", () => {
      for (const phase of viewport.phases) {
        expect(phase.surfaces.length).toBeGreaterThan(0);
        for (const surface of phase.surfaces) {
          expect(surface.teachingLabel).toBeTruthy();
          expect(surface.callDisplay).toBeTruthy();
          // Explanation text should resolve for all surfaces
          expect(surface.explanationText).not.toBeNull();
        }
      }
    });

    it("is in nt-bundle", () => {
      expect(viewport.bundleIds).toContain("nt-bundle");
    });
  });

  describe("bergen viewport", () => {
    const viewport = buildModuleLearningViewport("bergen")!;

    it("has phases from Bergen FSM", () => {
      expect(viewport.phases.length).toBeGreaterThan(3);
      // Bergen starts at idle
      expect(viewport.phases[0]!.phase).toBe("idle");
    });

    it("has teaching content", () => {
      expect(viewport.teaching.tradeoff).toContain("3C");
    });
  });
});

describe("derivePhaseOrder", () => {
  it("returns single-phase for trivial FSM", () => {
    const order = derivePhaseOrder({ initial: "idle", transitions: [] });
    expect(order).toEqual(["idle"]);
  });

  it("returns topological BFS order for Stayman FSM", () => {
    const staymanMod = getModule("stayman")!;
    const order = derivePhaseOrder(staymanMod.local);
    expect(order[0]).toBe("idle");
    // "asked" and "inactive" are reachable from idle
    expect(order.indexOf("asked")).toBeLessThan(order.indexOf("shown-hearts"));
    expect(order.indexOf("asked")).toBeLessThan(order.indexOf("denied"));
  });
});

describe("formatModuleName", () => {
  it("converts kebab-case to title case", () => {
    expect(formatModuleName("jacoby-transfers")).toBe("Jacoby Transfers");
  });

  it("uppercases bridge abbreviations", () => {
    expect(formatModuleName("natural-nt")).toBe("Natural NT");
  });

  it("handles empty string", () => {
    expect(formatModuleName("")).toBe("");
  });
});
