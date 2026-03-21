/**
 * Tests for composeModules() — generic module composition.
 */
import { describe, it, expect } from "vitest";
import { composeModules } from "../composition/compose-modules";
import type { BundleSkeleton } from "../composition/compose-modules";
import type { ConventionModule } from "../convention-module";
import type { MeaningSurface } from "../../../core/contracts/meaning";
import type { FactEvaluatorFn, FactValue } from "../../../core/contracts/fact-catalog";
import type { FrameStateSpec } from "../protocol/types";
import { BidSuit } from "../../../engine/types";
import type { Call } from "../../../engine/types";

// ── Helpers ─────────────────────────────────────────────────────────

const bid = (level: number, strain: BidSuit): Call => ({
  type: "bid",
  level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
  strain,
});

function makeSurface(meaningId: string, encoding: Call, band: "must" | "should" | "may" = "should"): MeaningSurface {
  return {
    meaningId,
    semanticClassId: `test:${meaningId}`,
    moduleId: "test",
    encoding: { defaultCall: encoding },
    clauses: [],
    ranking: { recommendationBand: band, modulePrecedence: 0, intraModuleOrder: 0 },
    sourceIntent: { type: "Test", params: {} },
    teachingLabel: meaningId,
  };
}

function makeModule(id: string, overrides?: Partial<ConventionModule>): ConventionModule {
  return {
    moduleId: id,
    entrySurfaces: [makeSurface(`${id}:entry`, bid(2, BidSuit.Clubs))],
    surfaceGroups: [],
    entryTransitions: [],
    machineStates: [],
    facts: { definitions: [], evaluators: new Map() },
    explanationEntries: [],
    ...overrides,
  };
}

function makeSkeleton(overrides?: Partial<BundleSkeleton>): BundleSkeleton {
  return {
    openingPatterns: [
      { prefix: [{ call: bid(1, BidSuit.NoTrump) }], startState: "opened" },
    ],
    openingSurface: "sf:opener",
    skeletonStates: [
      {
        id: "opened",
        eventTransitions: [
          { transitionId: "opened-pass", when: { callType: "pass" }, goto: "entry" },
        ],
      },
      {
        id: "entry",
        surface: "sf:entry",
        eventTransitions: [
          { transitionId: "entry-pass", when: { callType: "pass" }, goto: "terminal" },
        ],
      },
      {
        id: "terminal",
        eventTransitions: [],
      },
    ],
    entryStateId: "entry",
    initialStateId: "opened",
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("composeModules", () => {
  it("assigns positional precedence from module order", () => {
    const modA = makeModule("mod-a");
    const modB = makeModule("mod-b");

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    // mod-a is index 0 → precedence 0, mod-b is index 1 → precedence 1
    const entryGroup = result.meaningSurfaceGroups.find((g) => g.groupId === "entry")!;
    expect(entryGroup.surfaces[0]!.ranking.modulePrecedence).toBe(0);
    expect(entryGroup.surfaces[1]!.ranking.modulePrecedence).toBe(1);
  });

  it("merges entry surfaces from all modules", () => {
    const modA = makeModule("mod-a");
    const modB = makeModule("mod-b");

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    const entryGroup = result.meaningSurfaceGroups.find((g) => g.groupId === "entry")!;
    expect(entryGroup.surfaces).toHaveLength(2);
  });

  it("merges surface groups by groupId across modules", () => {
    const modA = makeModule("mod-a", {
      surfaceGroups: [
        { groupId: "shared-group", surfaces: [makeSurface("a:surf", bid(3, BidSuit.Hearts))] },
      ],
    });
    const modB = makeModule("mod-b", {
      surfaceGroups: [
        { groupId: "shared-group", surfaces: [makeSurface("b:surf", bid(3, BidSuit.Spades))] },
      ],
    });

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    const sharedGroup = result.meaningSurfaceGroups.find((g) => g.groupId === "shared-group")!;
    expect(sharedGroup.surfaces).toHaveLength(2);
    // Precedence stamped
    expect(sharedGroup.surfaces[0]!.ranking.modulePrecedence).toBe(0);
    expect(sharedGroup.surfaces[1]!.ranking.modulePrecedence).toBe(1);
  });

  it("creates surface fragments with sf: prefix", () => {
    const modA = makeModule("mod-a", {
      surfaceGroups: [
        { groupId: "my-group", surfaces: [makeSurface("a:surf", bid(2, BidSuit.Hearts))] },
      ],
    });

    const result = composeModules([modA], makeSkeleton(), "test", "Test");

    expect(result.surfaceFragments["sf:my-group"]).toBeDefined();
    expect(result.surfaceFragments["sf:my-group"]!.surfaces).toHaveLength(1);
  });

  it("injects entry transitions into skeleton entry state", () => {
    const modA = makeModule("mod-a", {
      entryTransitions: [
        {
          transitionId: "entry-2c",
          match: { kind: "call", level: 2, strain: BidSuit.Clubs },
          target: "opener-response",
        },
      ],
    });

    const result = composeModules([modA], makeSkeleton(), "test", "Test");

    const entryState = result.baseTrack.states["entry"]!;
    // Module entry transition should be prepended before skeleton transitions
    expect(entryState.eventTransitions[0]!.transitionId).toBe("entry-2c");
    expect(entryState.eventTransitions[0]!.goto).toBe("opener-response");
    // Original skeleton transitions still present
    expect(entryState.eventTransitions.some((t) => t.transitionId === "entry-pass")).toBe(true);
  });

  it("converts module machine states to frame states", () => {
    const modA = makeModule("mod-a", {
      machineStates: [
        {
          stateId: "opener-response",
          parentId: null,
          transitions: [
            {
              transitionId: "resp-pass",
              match: { kind: "pass" },
              target: "terminal",
            },
          ],
          surfaceGroupId: "opener-group",
          exportTags: ["agreement.pending"],
        },
      ],
    });

    const result = composeModules([modA], makeSkeleton(), "test", "Test");

    const openerState = result.baseTrack.states["opener-response"]!;
    expect(openerState).toBeDefined();
    expect(openerState.surface).toBe("sf:opener-group");
    expect(openerState.exportTags).toEqual(["agreement.pending"]);
  });

  it("applies hook transitions to target states", () => {
    const modA = makeModule("mod-a", {
      machineStates: [
        {
          stateId: "target-state",
          parentId: null,
          transitions: [
            {
              transitionId: "original",
              match: { kind: "pass" },
              target: "terminal",
            },
          ],
          surfaceGroupId: "target-group",
        },
      ],
    });
    const modB = makeModule("mod-b", {
      hookTransitions: [
        {
          targetStateId: "target-state",
          transitions: [
            {
              transitionId: "hooked",
              match: { kind: "call", level: 3, strain: BidSuit.Hearts },
              target: "hook-dest",
            },
          ],
        },
      ],
    });

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    const targetState = result.baseTrack.states["target-state"]!;
    // Hook transitions prepended before original
    expect(targetState.eventTransitions[0]!.transitionId).toBe("hooked");
    expect(targetState.eventTransitions[1]!.transitionId).toBe("original");
  });

  it("merges facts from all modules", () => {
    const modA = makeModule("mod-a", {
      facts: {
        definitions: [{ id: "fact.a", layer: "module-derived", world: "acting-hand", description: "A", valueType: "boolean", constrainsDimensions: [] }],
        evaluators: new Map([["fact.a", (() => true) as unknown as FactEvaluatorFn]]),
      },
    });
    const modB = makeModule("mod-b", {
      facts: {
        definitions: [{ id: "fact.b", layer: "module-derived", world: "acting-hand", description: "B", valueType: "boolean", constrainsDimensions: [] }],
        evaluators: new Map([["fact.b", (() => false) as unknown as FactEvaluatorFn]]),
      },
    });

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    expect(result.mergedFacts.definitions).toHaveLength(2);
    expect(result.mergedFacts.evaluators.has("fact.a")).toBe(true);
    expect(result.mergedFacts.evaluators.has("fact.b")).toBe(true);
  });

  it("merges explanation entries from all modules", () => {
    const modA = makeModule("mod-a", {
      explanationEntries: [
        { explanationId: "exp.a", factId: "f.a", templateKey: "t.a", displayText: "A", preferredLevel: "semantic" as const, roles: [] },
      ],
    });
    const modB = makeModule("mod-b", {
      explanationEntries: [
        { explanationId: "exp.b", factId: "f.b", templateKey: "t.b", displayText: "B", preferredLevel: "semantic" as const, roles: [] },
      ],
    });

    const result = composeModules([modA, modB], makeSkeleton(), "test", "Test");

    expect(result.mergedExplanations).toHaveLength(2);
  });

  it("produces valid BaseModuleSpec", () => {
    const result = composeModules(
      [makeModule("mod-a")],
      makeSkeleton(),
      "test-bundle",
      "Test Bundle",
    );

    expect(result.baseTrack.role).toBe("base");
    expect(result.baseTrack.id).toBe("test-bundle");
    expect(result.baseTrack.name).toBe("Test Bundle");
    expect(result.baseTrack.openingPatterns).toHaveLength(1);
    expect(result.baseTrack.initialStateId).toBe("opened");
    // Has both skeleton and module states
    expect(result.baseTrack.states["opened"]).toBeDefined();
    expect(result.baseTrack.states["entry"]).toBeDefined();
    expect(result.baseTrack.states["terminal"]).toBeDefined();
  });
});
