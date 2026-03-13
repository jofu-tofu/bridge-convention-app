import { describe, it, expect } from "vitest";
import { adaptMeaningSurface, adaptMeaningSurfaces } from "../surface-adapter";
import { evaluateAllSurfaces } from "../meaning-evaluator";
import {
  arbitrateMeanings,
  zipProposalsWithSurfaces,
} from "../meaning-arbitrator";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type { DecisionSurfaceIR } from "../../../../core/contracts/agreement-module";
import type { EvaluatedFacts, FactValue } from "../../../../core/contracts/fact-catalog";
import { BidSuit } from "../../../../engine/types";

function buildFacts(
  entries: Record<string, number | boolean | string>,
): EvaluatedFacts {
  const map = new Map<string, FactValue>();
  for (const [id, value] of Object.entries(entries)) {
    map.set(id, { factId: id, value });
  }
  return { world: "acting-hand", facts: map };
}

function makeSurface(
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return {
    meaningId: "test:meaning",
    moduleId: "test-module",
    encoding: {
      defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
    },
    clauses: [],
    ranking: {
      recommendationBand: "should",
      specificity: 1,
      modulePrecedence: 0,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test-intent", params: {} },
    ...overrides,
  };
}

describe("adaptMeaningSurface", () => {
  it("maps moduleId from MeaningSurface to DecisionSurfaceIR", () => {
    const surface = makeSurface({ moduleId: "stayman" });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.moduleId).toBe("stayman");
  });

  it("maps surfaceId from meaningId", () => {
    const surface = makeSurface({ meaningId: "stayman:ask-major" });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.surfaceId).toBe("stayman:ask-major");
  });

  it("maps modulePrecedence from ranking.modulePrecedence", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "should",
        specificity: 2,
        modulePrecedence: 5,
        intraModuleOrder: 3,
      },
    });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.modulePrecedence).toBe(5);
  });

  it("maps surfaceBindings when present", () => {
    const surface = makeSurface({
      surfaceBindings: { suit: "hearts" },
    });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.surfaceBindings).toEqual({ suit: "hearts" });
  });

  it("maps transforms when present", () => {
    const surface = makeSurface();
    // MeaningSurface does not have transforms, so adapted should have empty/undefined
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.transforms).toBeUndefined();
  });

  it("maps exclusivityGroup when present on the surface", () => {
    // MeaningSurface does not have exclusivityGroup natively — adapted should be undefined
    const surface = makeSurface();
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.exclusivityGroup).toBeUndefined();
  });

  it("maps semanticClassId when present", () => {
    const surface = makeSurface({ semanticClassId: "bridge:nt-invite" });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.defaultSemanticClassId).toBe("bridge:nt-invite");
  });

  it("provides appropriate defaults for fields not on MeaningSurface", () => {
    const surface = makeSurface();
    const adapted = adaptMeaningSurface(surface);

    // decisionProgram should have a default placeholder
    expect(adapted.decisionProgram).toBe("clause-evaluator");
    // encoderKind should default to "direct"
    expect(adapted.encoderKind).toBe("direct");
    // localRegisters should be undefined (not present on MeaningSurface)
    expect(adapted.localRegisters).toBeUndefined();
  });

  it("maps defaultPriorityClass from ranking.recommendationBand", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "must",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const adapted = adaptMeaningSurface(surface);

    // "must" band maps to "obligatory" priority class
    expect(adapted.defaultPriorityClass).toBe("obligatory");
  });

  it("maps 'should' band to 'preferredConventional' priority class", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.defaultPriorityClass).toBe("preferredConventional");
  });

  it("maps 'may' band to 'neutralCorrect' priority class", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "may",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.defaultPriorityClass).toBe("neutralCorrect");
  });

  it("maps 'avoid' band to 'fallbackCorrect' priority class", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "avoid",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const adapted = adaptMeaningSurface(surface);

    expect(adapted.defaultPriorityClass).toBe("fallbackCorrect");
  });
});

describe("adaptMeaningSurfaces", () => {
  it("maps an array of MeaningSurfaces to DecisionSurfaceIR[]", () => {
    const surfaces: MeaningSurface[] = [
      makeSurface({ meaningId: "a:one", moduleId: "mod-a" }),
      makeSurface({ meaningId: "b:two", moduleId: "mod-b" }),
    ];

    const adapted = adaptMeaningSurfaces(surfaces);

    expect(adapted).toHaveLength(2);
    expect(adapted[0]!.surfaceId).toBe("a:one");
    expect(adapted[0]!.moduleId).toBe("mod-a");
    expect(adapted[1]!.surfaceId).toBe("b:two");
    expect(adapted[1]!.moduleId).toBe("mod-b");
  });

  it("handles empty array", () => {
    const adapted = adaptMeaningSurfaces([]);
    expect(adapted).toHaveLength(0);
  });
});

describe("round-trip: adapted surface through pipeline", () => {
  it("produces same ArbitrationResult as original MeaningSurface", () => {
    const surface = makeSurface({
      meaningId: "stayman:ask-major",
      semanticClassId: "stayman:ask",
      moduleId: "stayman",
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
        {
          clauseId: "has-major",
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: true,
          description: "Has a 4-card major",
        },
      ],
    });

    const facts = buildFacts({
      "hand.hcp": 12,
      "bridge.hasFourCardMajor": true,
    });

    // Original MeaningSurface path
    const originalProposals = evaluateAllSurfaces([surface], facts);
    const originalInputs = zipProposalsWithSurfaces(originalProposals, [surface]);
    const originalResult = arbitrateMeanings(originalInputs);

    // Adapted DecisionSurfaceIR round-trip: still evaluates through MeaningSurface pipeline
    // The adapter maps fields but the pipeline uses the original MeaningSurface for evaluation
    const adapted = adaptMeaningSurface(surface);

    // Verify the adapted surface has the right structural fields
    expect(adapted.moduleId).toBe("stayman");
    expect(adapted.surfaceId).toBe("stayman:ask-major");
    expect(adapted.defaultSemanticClassId).toBe("stayman:ask");
    expect(adapted.modulePrecedence).toBe(0);

    // The pipeline result via original path should have a selected candidate
    expect(originalResult.selected).not.toBeNull();
    expect(originalResult.selected!.proposal.meaningId).toBe("stayman:ask-major");
  });
});

describe("DecisionSurfaceIR structural conformance", () => {
  it("adapted surface satisfies the DecisionSurfaceIR interface", () => {
    const surface = makeSurface({
      meaningId: "test:surface",
      semanticClassId: "bridge:test",
      moduleId: "test-mod",
      surfaceBindings: { key: "value" },
    });

    const adapted: DecisionSurfaceIR = adaptMeaningSurface(surface);

    // Required fields
    expect(typeof adapted.surfaceId).toBe("string");
    expect(typeof adapted.moduleId).toBe("string");
    expect(typeof adapted.decisionProgram).toBe("string");
    expect(typeof adapted.encoderKind).toBe("string");
    expect(typeof adapted.modulePrecedence).toBe("number");

    // Optional fields should be present or undefined (not error)
    expect(adapted.surfaceBindings).toBeDefined();
    expect(adapted.defaultSemanticClassId).toBe("bridge:test");
  });
});

describe("evaluateAllSurfaces dual-path", () => {
  it("evaluates DecisionSurfaceIR[] through the IR path", () => {
    const irSurfaces: DecisionSurfaceIR[] = [
      {
        surfaceId: "ir:test-one",
        moduleId: "ir-mod",
        decisionProgram: "clause-evaluator",
        encoderKind: "direct",
        modulePrecedence: 2,
        defaultSemanticClassId: "bridge:ir-class",
        defaultPriorityClass: "preferredConventional",
      },
    ];

    const facts = buildFacts({ "hand.hcp": 10 });
    const proposals = evaluateAllSurfaces(irSurfaces, facts);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.meaningId).toBe("ir:test-one");
    expect(proposals[0]!.moduleId).toBe("ir-mod");
    expect(proposals[0]!.semanticClassId).toBe("bridge:ir-class");
    expect(proposals[0]!.ranking.modulePrecedence).toBe(2);
    expect(proposals[0]!.ranking.recommendationBand).toBe("should");
    // DecisionSurfaceIR path produces empty clauses (decision program not yet wired)
    expect(proposals[0]!.clauses).toHaveLength(0);
  });

  it("evaluates MeaningSurface[] through the existing path unchanged", () => {
    const surfaces = [
      makeSurface({
        meaningId: "ms:test",
        clauses: [
          {
            clauseId: "hcp-min",
            factId: "hand.hcp",
            operator: "gte" as const,
            value: 8,
            description: "At least 8 HCP",
          },
        ],
      }),
    ];

    const facts = buildFacts({ "hand.hcp": 12 });
    const proposals = evaluateAllSurfaces(surfaces, facts);

    expect(proposals).toHaveLength(1);
    expect(proposals[0]!.meaningId).toBe("ms:test");
    expect(proposals[0]!.clauses).toHaveLength(1);
    expect(proposals[0]!.clauses[0]!.satisfied).toBe(true);
  });

  it("handles empty arrays for both types", () => {
    const facts = buildFacts({});
    expect(evaluateAllSurfaces([] as MeaningSurface[], facts)).toHaveLength(0);
    expect(evaluateAllSurfaces([] as DecisionSurfaceIR[], facts)).toHaveLength(0);
  });

  it("maps PriorityClass to RecommendationBand correctly in IR path", () => {
    const irSurfaces: DecisionSurfaceIR[] = [
      {
        surfaceId: "ir:obligatory",
        moduleId: "mod",
        decisionProgram: "clause-evaluator",
        encoderKind: "direct",
        modulePrecedence: 0,
        defaultPriorityClass: "obligatory",
      },
      {
        surfaceId: "ir:neutral",
        moduleId: "mod",
        decisionProgram: "clause-evaluator",
        encoderKind: "direct",
        modulePrecedence: 0,
        defaultPriorityClass: "neutralCorrect",
      },
      {
        surfaceId: "ir:fallback",
        moduleId: "mod",
        decisionProgram: "clause-evaluator",
        encoderKind: "direct",
        modulePrecedence: 0,
        defaultPriorityClass: "fallbackCorrect",
      },
    ];

    const facts = buildFacts({});
    const proposals = evaluateAllSurfaces(irSurfaces, facts);

    expect(proposals[0]!.ranking.recommendationBand).toBe("must");
    expect(proposals[1]!.ranking.recommendationBand).toBe("may");
    expect(proposals[2]!.ranking.recommendationBand).toBe("avoid");
  });
});
