import { describe, it, expect } from "vitest";
import { BidSuit } from "../../../../engine/types";
import type { Call } from "../../../../engine/types";
import type {
  BaseModuleSpec,
  FrameStateSpec,
  OpeningPatternSpec,
  SurfaceFragment,
} from "../types";
import type { FactCatalogExtension } from "../../../../core/contracts/fact-catalog";
import type { MeaningSurface } from "../../../../core/contracts/meaning";
import { assembleConventionSpec } from "../spec-assembler";
import type { ModuleWithSurfaces } from "../spec-assembler";
import { BRIDGE_SEMANTIC_SCHEMA } from "../bridge-schema";
import { getBaseModules, getProtocolModules } from "../types";

// ── Test Helpers ────────────────────────────────────────────────────

/** Minimal fact catalog extension for test fixtures. */
const emptyFacts: FactCatalogExtension = {
  definitions: [],
  evaluators: new Map(),
};

/** Minimal frame state for test fixtures. */
function stubState(id: string, surface?: string): FrameStateSpec {
  return { id, surface, eventTransitions: [] };
}

/** Shorthand for a bid Call. */
function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

/** Build a minimal BaseModuleSpec for testing. */
function makeTrack(
  id: string,
  patterns: readonly OpeningPatternSpec[],
  states?: Readonly<Record<string, FrameStateSpec>>,
): BaseModuleSpec {
  return {
    role: "base" as const,
    id,
    name: id,
    openingPatterns: patterns,
    states: states ?? { init: stubState("init") },
    initialStateId: Object.keys(states ?? { init: stubState("init") })[0]!,
    facts: emptyFacts,
  };
}

/** Build a minimal SurfaceFragment for testing. */
function makeSurfaceFragment(id: string): SurfaceFragment {
  return {
    id,
    relation: "compete",
    layerPriority: 100,
    actionCoverage: "all",
    surfaces: [],
  };
}

/** Build an OpeningPatternSpec from a single call. */
function pattern(
  call: Call,
  startState = "init",
  priority?: number,
): OpeningPatternSpec {
  return {
    prefix: [{ call }],
    startState,
    ...(priority !== undefined && { priority }),
  };
}

// ── assembleConventionSpec ──────────────────────────────────────────

describe("assembleConventionSpec", () => {
  describe("single base track", () => {
    it("assembles a spec from a single base track without surfaces", () => {
      const track = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);

      const spec = assembleConventionSpec({
        id: "test-spec",
        name: "Test Spec",
        modules: [track],
      });

      expect(spec.id).toBe("test-spec");
      expect(spec.name).toBe("Test Spec");
      expect(getBaseModules(spec)).toHaveLength(1);
      expect(getBaseModules(spec)[0]!.id).toBe("nt-1");
      expect(getProtocolModules(spec)).toHaveLength(0);
      expect(Object.keys(spec.surfaces)).toHaveLength(0);
    });

    it("assembles a spec from a single track with surface fragments", () => {
      const track = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))], {
        opened: stubState("opened", "sf:opener"),
        response: stubState("response", "sf:response"),
      });

      const surfaces: Readonly<Record<string, SurfaceFragment>> = {
        "sf:opener": makeSurfaceFragment("sf:opener"),
        "sf:response": makeSurfaceFragment("sf:response"),
      };

      const spec = assembleConventionSpec({
        id: "test-spec",
        name: "Test Spec",
        modules: [{ module: track, surfaces }],
      });

      expect(Object.keys(spec.surfaces)).toHaveLength(2);
      expect(spec.surfaces["sf:opener"]).toBeDefined();
      expect(spec.surfaces["sf:response"]).toBeDefined();
      expect(spec.surfaces["sf:opener"]!.id).toBe("sf:opener");
    });

    it("uses BRIDGE_SEMANTIC_SCHEMA by default", () => {
      const track = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);

      const spec = assembleConventionSpec({
        id: "test",
        name: "Test",
        modules: [track],
      });

      expect(spec.schema).toBe(BRIDGE_SEMANTIC_SCHEMA);
    });

    it("uses a custom schema when provided", () => {
      const track = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);
      const customSchema = { registers: {}, capabilities: {} };

      const spec = assembleConventionSpec({
        id: "test",
        name: "Test",
        modules: [track],
        schema: customSchema,
      });

      expect(spec.schema).toBe(customSchema);
    });
  });

  describe("multiple base tracks with disjoint patterns", () => {
    it("assembles from two tracks with non-overlapping opening patterns", () => {
      const ntTrack = makeTrack("nt-1", [
        pattern(bid(1, BidSuit.NoTrump)),
      ]);
      const weakTwoTrack = makeTrack("weak-two", [
        pattern(bid(2, BidSuit.Hearts)),
        pattern(bid(2, BidSuit.Spades)),
      ]);

      const spec = assembleConventionSpec({
        id: "combined",
        name: "Combined",
        modules: [ntTrack, weakTwoTrack],
      });

      expect(getBaseModules(spec)).toHaveLength(2);
      expect(getBaseModules(spec)[0]!.id).toBe("nt-1");
      expect(getBaseModules(spec)[1]!.id).toBe("weak-two");
    });

    it("merges surface fragments from multiple tracks", () => {
      const ntTrack = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);
      const ntSurfaces = {
        "sf:nt-opener": makeSurfaceFragment("sf:nt-opener"),
      };

      const bergenTrack = makeTrack("bergen", [
        pattern(bid(1, BidSuit.Hearts)),
      ]);
      const bergenSurfaces = {
        "sf:bergen-r1": makeSurfaceFragment("sf:bergen-r1"),
      };

      const spec = assembleConventionSpec({
        id: "combined",
        name: "Combined",
        modules: [
          { module: ntTrack, surfaces: ntSurfaces },
          { module: bergenTrack, surfaces: bergenSurfaces },
        ],
      });

      expect(Object.keys(spec.surfaces)).toHaveLength(2);
      expect(spec.surfaces["sf:nt-opener"]).toBeDefined();
      expect(spec.surfaces["sf:bergen-r1"]).toBeDefined();
    });

    it("allows mixing plain tracks and tracks with surfaces", () => {
      const ntTrack = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);
      const bergenTrack = makeTrack("bergen", [
        pattern(bid(1, BidSuit.Hearts)),
      ]);
      const bergenSurfaces = {
        "sf:bergen-r1": makeSurfaceFragment("sf:bergen-r1"),
      };

      const spec = assembleConventionSpec({
        id: "combined",
        name: "Combined",
        modules: [
          ntTrack, // plain — no surfaces
          { module: bergenTrack, surfaces: bergenSurfaces },
        ],
      });

      expect(getBaseModules(spec)).toHaveLength(2);
      expect(Object.keys(spec.surfaces)).toHaveLength(1);
      expect(spec.surfaces["sf:bergen-r1"]).toBeDefined();
    });
  });

  describe("surface fragment collision detection", () => {
    it("throws on surface fragment ID collision between tracks", () => {
      const trackA = makeTrack("track-a", [pattern(bid(1, BidSuit.NoTrump))]);
      const trackB = makeTrack("track-b", [pattern(bid(2, BidSuit.Clubs))]);

      const sharedFragmentId = "sf:collision";
      const surfacesA = {
        [sharedFragmentId]: makeSurfaceFragment(sharedFragmentId),
      };
      const surfacesB = {
        [sharedFragmentId]: makeSurfaceFragment(sharedFragmentId),
      };

      expect(() => {
        assembleConventionSpec({
          id: "colliding",
          name: "Colliding",
          modules: [
            { module: trackA, surfaces: surfacesA },
            { module: trackB, surfaces: surfacesB },
          ],
        });
      }).toThrow(/Surface fragment ID collision/);
    });

    it("includes track IDs in collision error message", () => {
      const trackA = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);
      const trackB = makeTrack("bergen", [pattern(bid(1, BidSuit.Hearts))]);

      const surfaces = {
        "sf:duplicate": makeSurfaceFragment("sf:duplicate"),
      };

      expect(() => {
        assembleConventionSpec({
          id: "test",
          name: "Test",
          modules: [
            { module: trackA, surfaces },
            { module: trackB, surfaces },
          ],
        });
      }).toThrow(/nt-1.*bergen|bergen.*nt-1/);
    });

    it("does not throw when tracks have disjoint surface fragment IDs", () => {
      const trackA = makeTrack("nt-1", [pattern(bid(1, BidSuit.NoTrump))]);
      const trackB = makeTrack("bergen", [pattern(bid(1, BidSuit.Hearts))]);

      expect(() => {
        assembleConventionSpec({
          id: "test",
          name: "Test",
          modules: [
            { module: trackA, surfaces: { "sf:a": makeSurfaceFragment("sf:a") } },
            { module: trackB, surfaces: { "sf:b": makeSurfaceFragment("sf:b") } },
          ],
        });
      }).not.toThrow();
    });
  });

  describe("surfaces map correctness", () => {
    it("preserves all fragment properties", () => {
      const fragment: SurfaceFragment = {
        id: "sf:detailed",
        relation: "shadow",
        layerPriority: 200,
        actionCoverage: "all",
        surfaces: [],
        factEvaluatorIds: ["fact-a", "fact-b"],
        actionMeanings: { P: "Pass" },
      };

      const track = makeTrack("track", [pattern(bid(1, BidSuit.Clubs))]);

      const spec = assembleConventionSpec({
        id: "test",
        name: "Test",
        modules: [{ module: track, surfaces: { "sf:detailed": fragment } }],
      });

      const stored = spec.surfaces["sf:detailed"]!;
      expect(stored.id).toBe("sf:detailed");
      expect(stored.relation).toBe("shadow");
      expect(stored.layerPriority).toBe(200);
      expect(stored.factEvaluatorIds).toEqual(["fact-a", "fact-b"]);
      expect(stored.actionMeanings).toEqual({ P: "Pass" });
    });

    it("surfaces from multiple tracks are all accessible", () => {
      const tracks: ModuleWithSurfaces[] = [
        {
          module: makeTrack("t1", [pattern(bid(1, BidSuit.Clubs))]),
          surfaces: {
            "sf:t1-a": makeSurfaceFragment("sf:t1-a"),
            "sf:t1-b": makeSurfaceFragment("sf:t1-b"),
          },
        },
        {
          module: makeTrack("t2", [pattern(bid(2, BidSuit.Clubs))]),
          surfaces: {
            "sf:t2-a": makeSurfaceFragment("sf:t2-a"),
          },
        },
        {
          module: makeTrack("t3", [pattern(bid(3, BidSuit.Clubs))]),
          surfaces: {
            "sf:t3-a": makeSurfaceFragment("sf:t3-a"),
            "sf:t3-b": makeSurfaceFragment("sf:t3-b"),
            "sf:t3-c": makeSurfaceFragment("sf:t3-c"),
          },
        },
      ];

      const spec = assembleConventionSpec({
        id: "multi",
        name: "Multi",
        modules: tracks,
      });

      expect(Object.keys(spec.surfaces)).toHaveLength(6);
      expect(spec.surfaces["sf:t1-a"]).toBeDefined();
      expect(spec.surfaces["sf:t1-b"]).toBeDefined();
      expect(spec.surfaces["sf:t2-a"]).toBeDefined();
      expect(spec.surfaces["sf:t3-a"]).toBeDefined();
      expect(spec.surfaces["sf:t3-b"]).toBeDefined();
      expect(spec.surfaces["sf:t3-c"]).toBeDefined();
    });
  });

  describe("boot router compilation", () => {
    it("throws on ambiguous opening patterns with equal priority", () => {
      const trackA = makeTrack("a", [pattern(bid(1, BidSuit.NoTrump))]);
      const trackB = makeTrack("b", [pattern(bid(1, BidSuit.NoTrump))]);

      expect(() => {
        assembleConventionSpec({
          id: "ambiguous",
          name: "Ambiguous",
          modules: [trackA, trackB],
        });
      }).toThrow(/[Aa]mbiguous/);
    });

    it("does not throw when tracks have disjoint opening patterns", () => {
      expect(() => {
        assembleConventionSpec({
          id: "disjoint",
          name: "Disjoint",
          modules: [
            makeTrack("nt", [pattern(bid(1, BidSuit.NoTrump))]),
            makeTrack("weak-2h", [pattern(bid(2, BidSuit.Hearts))]),
            makeTrack("weak-2s", [pattern(bid(2, BidSuit.Spades))]),
          ],
        });
      }).not.toThrow();
    });
  });
});
