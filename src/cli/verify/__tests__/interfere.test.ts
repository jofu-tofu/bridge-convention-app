import { describe, it, expect } from "vitest";
import type { ConventionModule } from "../../../conventions";
import type { BidMeaning } from "../../../conventions/pipeline/evaluation/meaning";
import type { InterferenceEdge } from "../types";
import {
  detectActivationOverlap,
  detectEncodingCollision,
  detectObservationCrosstalk,
  detectKernelConflict,
  analyzeBundle,
  classifyPairRisk,
} from "../interfere";

import { bidName, bidSummary, moduleDescription, modulePurpose, teachingTradeoff, teachingPrinciple } from "../../../conventions/core/authored-text";
import type { TeachingLabel } from "../../../conventions/core/authored-text";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

// ── Fixture factories ─────────────────────────────────────────────

function makeModule(id: string, overrides: Partial<ConventionModule> = {}): ConventionModule {
  return {
    moduleId: id,
    description: moduleDescription("test module description for interfere"),
    purpose: modulePurpose("test purpose for interfere module"),
    teaching: { tradeoff: teachingTradeoff("test tradeoff for module"), principle: teachingPrinciple("test principle for module"), commonMistakes: [] },
    local: { initial: "idle", transitions: [] },
    states: [],
    facts: { definitions: [], evaluators: new Map() },
    explanationEntries: [],
    ...overrides,
  };
}

function makeSurface(
  meaningId: string,
  callType?: { type: "bid"; level: number; strain: string },
): BidMeaning {
  return {
    meaningId,
    semanticClassId: `test:${meaningId}`,
    teachingLabel: tl(meaningId),
    sourceIntent: { type: "TestIntent", params: {} },
    clauses: [],
    encoding: {
      kind: "direct",
      defaultCall: callType ?? { type: "bid", level: 1, strain: "NT" },
    },
    ranking: { recommendationBand: "should", declarationOrder: 0 },
  } as unknown as BidMeaning;
}

// ── detectActivationOverlap ───────────────────────────────────────

describe("detectActivationOverlap", () => {
  it("detects overlap when both modules have compatible turn+phase guards", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("a1")] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("b1")] },
      ],
    });

    const edges = detectActivationOverlap(a, b);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]!.kind).toBe("activation-overlap");
    expect(edges[0]!.risk).toBe("low");
  });

  it("detects overlap when one module has wildcard turn guard", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", surfaces: [makeSurface("a1")] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("b1")] },
      ],
    });

    const edges = detectActivationOverlap(a, b);
    expect(edges.length).toBeGreaterThan(0);
  });

  it("reports no overlap when turn guards are incompatible", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "opener", surfaces: [makeSurface("a1")] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "opponent", surfaces: [makeSurface("b1")] },
      ],
    });

    const edges = detectActivationOverlap(a, b);
    expect(edges).toHaveLength(0);
  });
});

// ── detectEncodingCollision ───────────────────────────────────────

describe("detectEncodingCollision", () => {
  it("detects collision when two modules claim the same bid", () => {
    const sameBid = { type: "bid" as const, level: 2, strain: "C" };
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("a1", sameBid)] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("b1", sameBid)] },
      ],
    });

    const edges = detectEncodingCollision(a, b);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]!.kind).toBe("encoding-collision");
    expect(edges[0]!.risk).toBe("high");
  });

  it("reports no collision when bids differ", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("a1", { type: "bid", level: 2, strain: "C" })] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("b1", { type: "bid", level: 3, strain: "D" })] },
      ],
    });

    const edges = detectEncodingCollision(a, b);
    expect(edges).toHaveLength(0);
  });
});

// ── detectObservationCrosstalk ────────────────────────────────────

describe("detectObservationCrosstalk", () => {
  it("detects crosstalk when module A claim obs matches module B transition", () => {
    // StaymanAsk normalizes to [{ act: "inquire", feature: "majorSuit" }]
    const a = makeModule("mod-a", {
      states: [
        {
          phase: "idle",
          turn: "responder",
          surfaces: [
            {
              ...makeSurface("a1"),
              sourceIntent: { type: "StaymanAsk", params: {} },
            } as unknown as BidMeaning,
          ],
        },
      ],
    });
    const b = makeModule("mod-b", {
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "responded", on: { act: "inquire", feature: "majorSuit" } },
        ],
      },
      states: [],
      facts: { definitions: [], evaluators: new Map() },
    });

    const edges = detectObservationCrosstalk(a, b);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]!.kind).toBe("observation-crosstalk");
    expect(edges[0]!.risk).toBe("medium");
  });

  it("reports no crosstalk for unknown intents (empty canonical obs)", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "responder", surfaces: [makeSurface("a1")] },
      ],
    });
    const b = makeModule("mod-b", {
      local: {
        initial: "idle",
        transitions: [
          { from: "idle", to: "responded", on: { act: "inquire", feature: "majorSuit" } },
        ],
      },
      states: [],
      facts: { definitions: [], evaluators: new Map() },
    });

    const edges = detectObservationCrosstalk(a, b);
    expect(edges).toHaveLength(0);
  });
});

// ── detectKernelConflict ──────────────────────────────────────────

describe("detectKernelConflict", () => {
  it("detects conflict when both modules write the same kernel field", () => {
    const a = makeModule("mod-a", {
      states: [
        {
          phase: "idle",
          turn: "responder",
          surfaces: [makeSurface("a1")],
          negotiationDelta: { forcing: "game" },
        },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        {
          phase: "idle",
          turn: "responder",
          surfaces: [makeSurface("b1")],
          negotiationDelta: { forcing: "one-round" },
        },
      ],
    });

    const edges = detectKernelConflict(a, b);
    expect(edges.length).toBeGreaterThan(0);
    expect(edges[0]!.kind).toBe("kernel-conflict");
    expect(edges[0]!.risk).toBe("medium");
  });

  it("reports no conflict when kernel fields differ", () => {
    const a = makeModule("mod-a", {
      states: [
        {
          phase: "idle",
          turn: "responder",
          surfaces: [makeSurface("a1")],
          negotiationDelta: { forcing: "game" },
        },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        {
          phase: "idle",
          turn: "responder",
          surfaces: [makeSurface("b1")],
          negotiationDelta: { captain: "responder" },
        },
      ],
    });

    const edges = detectKernelConflict(a, b);
    expect(edges).toHaveLength(0);
  });
});

// ── analyzeBundle ────────────────────────────────────────────────

describe("analyzeBundle", () => {
  it("returns no edges for two clean modules with no overlap", () => {
    const a = makeModule("mod-a", {
      states: [
        { phase: "idle", turn: "opener", surfaces: [makeSurface("a1", { type: "bid", level: 1, strain: "H" })] },
      ],
    });
    const b = makeModule("mod-b", {
      states: [
        { phase: "idle", turn: "opponent", surfaces: [makeSurface("b1", { type: "bid", level: 2, strain: "D" })] },
      ],
    });

    const interactions = analyzeBundle([a, b]);
    expect(interactions).toHaveLength(1);
    expect(interactions[0]!.edges).toHaveLength(0);
    expect(interactions[0]!.riskLevel).toBe("none");
  });
});

// ── classifyPairRisk ─────────────────────────────────────────────

describe("classifyPairRisk", () => {
  it("returns 'none' for empty edges", () => {
    expect(classifyPairRisk([])).toBe("none");
  });

  it("returns max risk across edges", () => {
    const edges: InterferenceEdge[] = [
      { kind: "activation-overlap", description: "test", risk: "low" },
      { kind: "encoding-collision", description: "test", risk: "high" },
      { kind: "observation-crosstalk", description: "test", risk: "medium" },
    ];
    expect(classifyPairRisk(edges)).toBe("high");
  });

  it("returns 'medium' when that is the max risk", () => {
    const edges: InterferenceEdge[] = [
      { kind: "activation-overlap", description: "test", risk: "low" },
      { kind: "observation-crosstalk", description: "test", risk: "medium" },
    ];
    expect(classifyPairRisk(edges)).toBe("medium");
  });

  it("returns 'low' when only low-risk edges exist", () => {
    const edges: InterferenceEdge[] = [
      { kind: "activation-overlap", description: "test", risk: "low" },
    ];
    expect(classifyPairRisk(edges)).toBe("low");
  });
});
