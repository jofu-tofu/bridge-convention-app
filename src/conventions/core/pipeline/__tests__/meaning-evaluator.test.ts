import { describe, it, expect } from "vitest";
import {
  evaluateMeaningSurface,
  evaluateAllSurfaces,
  resolvePriorityClass,
} from "../meaning-evaluator";
import type { MeaningSurface } from "../../../../core/contracts/meaning-surface";
import type { EvaluatedFacts, FactValue } from "../../../../core/contracts/fact-catalog";
import { BidSuit } from "../../../../engine/types";
import type { PriorityClass } from "../../../../core/contracts/agreement-module";
import { defaultPriorityClassMapping } from "../../../../core/contracts/agreement-module";
import type { RecommendationBand } from "../../../../core/contracts/meaning";

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
    semanticClassId: "test:class",
    moduleId: "test",
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
    teachingLabel: "Test meaning",
    ...overrides,
  } as MeaningSurface;
}

describe("evaluateMeaningSurface", () => {
  it("boolean operator: satisfied when fact is true", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "has-major",
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: true,
          description: "Has a 4-card major",
        },
      ],
    });
    const facts = buildFacts({ "bridge.hasFourCardMajor": true });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.satisfied).toBe(true);
  });

  it("boolean operator: not satisfied when fact is false", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "has-major",
          factId: "bridge.hasFourCardMajor",
          operator: "boolean",
          value: true,
          description: "Has a 4-card major",
        },
      ],
    });
    const facts = buildFacts({ "bridge.hasFourCardMajor": false });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.satisfied).toBe(false);
  });

  it("gte operator: satisfied when fact >= value", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
    });

    const satisfiedFacts = buildFacts({ "hand.hcp": 10 });
    expect(
      evaluateMeaningSurface(surface, satisfiedFacts).clauses[0]!.satisfied,
    ).toBe(true);

    const notSatisfiedFacts = buildFacts({ "hand.hcp": 6 });
    expect(
      evaluateMeaningSurface(surface, notSatisfiedFacts).clauses[0]!.satisfied,
    ).toBe(false);
  });

  it("lte operator: satisfied when fact <= value", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-max",
          factId: "hand.hcp",
          operator: "lte",
          value: 9,
          description: "At most 9 HCP",
        },
      ],
    });

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 8 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 10 })).clauses[0]!
        .satisfied,
    ).toBe(false);
  });

  it("eq operator: satisfied on exact match", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "suit-match",
          factId: "bridge.trumpSuit",
          operator: "eq",
          value: "spades",
          description: "Trump suit is spades",
        },
      ],
    });

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "bridge.trumpSuit": "spades" }))
        .clauses[0]!.satisfied,
    ).toBe(true);

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "bridge.trumpSuit": "hearts" }))
        .clauses[0]!.satisfied,
    ).toBe(false);
  });

  it("range operator: satisfied when value within range (inclusive)", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-range",
          factId: "hand.hcp",
          operator: "range",
          value: { min: 8, max: 9 },
          description: "8-9 HCP",
        },
      ],
    });

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 8 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 9 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 7 })).clauses[0]!
        .satisfied,
    ).toBe(false);

    expect(
      evaluateMeaningSurface(surface, buildFacts({ "hand.hcp": 10 })).clauses[0]!
        .satisfied,
    ).toBe(false);
  });

  it("in operator: satisfied when fact value is in the array", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "pattern-check",
          factId: "bridge.majorPattern",
          operator: "in",
          value: ["one-four", "both-four"],
          description: "Major pattern matches",
        },
      ],
    });

    expect(
      evaluateMeaningSurface(
        surface,
        buildFacts({ "bridge.majorPattern": "one-four" }),
      ).clauses[0]!.satisfied,
    ).toBe(true);

    expect(
      evaluateMeaningSurface(
        surface,
        buildFacts({ "bridge.majorPattern": "none" }),
      ).clauses[0]!.satisfied,
    ).toBe(false);
  });

  it("in operator: maps to eq in the output MeaningClause", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "pattern-check",
          factId: "bridge.majorPattern",
          operator: "in",
          value: ["one-four", "both-four"],
          description: "Major pattern matches",
        },
      ],
    });

    const proposal = evaluateMeaningSurface(
      surface,
      buildFacts({ "bridge.majorPattern": "one-four" }),
    );

    // MeaningClause doesn't have "in" operator — mapped to "eq"
    expect(proposal.clauses[0]!.operator).toBe("eq");
  });

  it("missing fact results in satisfied: false (fail-closed)", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
    });

    const emptyFacts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, emptyFacts);

    expect(proposal.clauses[0]!.satisfied).toBe(false);
  });

  it("evidence bundle has correct factDependencies and evaluatedConditions", () => {
    const surface = makeSurface({
      meaningId: "stayman:ask",
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
      "hand.hcp": 10,
      "bridge.hasFourCardMajor": true,
    });

    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.evidence.factDependencies).toEqual(
      expect.arrayContaining(["hand.hcp", "bridge.hasFourCardMajor"]),
    );
    expect(proposal.evidence.factDependencies).toHaveLength(2);

    expect(proposal.evidence.evaluatedConditions).toHaveLength(2);
    expect(proposal.evidence.evaluatedConditions[0]!).toEqual({
      name: "hcp-min",
      passed: true,
      description: "At least 8 HCP",
      conditionRole: "semantic",
    });
    expect(proposal.evidence.evaluatedConditions[1]!).toEqual({
      name: "has-major",
      passed: true,
      description: "Has a 4-card major",
      conditionRole: "semantic",
    });

    expect(proposal.evidence.provenance).toEqual({
      moduleId: "stayman",
      nodeName: "stayman:ask",
      origin: "tree",
    });
  });

  it("returns correct MeaningProposal structure", () => {
    const surface = makeSurface({
      meaningId: "test:full",
      semanticClassId: "bridge:test-class",
      moduleId: "test-module",
      sourceIntent: { type: "test-type", params: { key: "val" } },
    });

    const proposal = evaluateMeaningSurface(surface, buildFacts({}));

    expect(proposal.meaningId).toBe("test:full");
    expect(proposal.semanticClassId).toBe("bridge:test-class");
    expect(proposal.moduleId).toBe("test-module");
    expect(proposal.sourceIntent).toEqual({
      type: "test-type",
      params: { key: "val" },
    });
    expect(proposal.ranking).toEqual(surface.ranking);
  });

  it("full surface with multiple clauses — all must pass for all satisfied", () => {
    const surface = makeSurface({
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
        {
          clauseId: "balanced",
          factId: "hand.isBalanced",
          operator: "boolean",
          value: false,
          description: "Not balanced",
        },
      ],
    });

    // All satisfied
    const allPassFacts = buildFacts({
      "hand.hcp": 12,
      "bridge.hasFourCardMajor": true,
      "hand.isBalanced": false,
    });
    const allPass = evaluateMeaningSurface(surface, allPassFacts);
    expect(allPass.clauses.every((c) => c.satisfied)).toBe(true);

    // One fails
    const oneFailFacts = buildFacts({
      "hand.hcp": 6,
      "bridge.hasFourCardMajor": true,
      "hand.isBalanced": false,
    });
    const oneFail = evaluateMeaningSurface(surface, oneFailFacts);
    expect(oneFail.clauses[0]!.satisfied).toBe(false);
    expect(oneFail.clauses[1]!.satisfied).toBe(true);
    expect(oneFail.clauses[2]!.satisfied).toBe(true);
  });
});

describe("evaluateAllSurfaces", () => {
  it("processes multiple surfaces correctly", () => {
    const surface1 = makeSurface({
      meaningId: "test:one",
      clauses: [
        {
          clauseId: "hcp-check",
          factId: "hand.hcp",
          operator: "gte",
          value: 10,
          description: "10+ HCP",
        },
      ],
    });
    const surface2 = makeSurface({
      meaningId: "test:two",
      clauses: [
        {
          clauseId: "balanced",
          factId: "hand.isBalanced",
          operator: "boolean",
          value: true,
          description: "Balanced",
        },
      ],
    });

    const facts = buildFacts({ "hand.hcp": 12, "hand.isBalanced": true });
    const proposals = evaluateAllSurfaces([surface1, surface2], facts);

    expect(proposals).toHaveLength(2);
    expect(proposals[0]!.meaningId).toBe("test:one");
    expect(proposals[0]!.clauses[0]!.satisfied).toBe(true);
    expect(proposals[1]!.meaningId).toBe("test:two");
    expect(proposals[1]!.clauses[0]!.satisfied).toBe(true);
  });
});

describe("surface bindings", () => {
  it("resolves $-prefixed factId via surfaceBindings", () => {
    const surface = makeSurface({
      surfaceBindings: { suit: "hearts" },
      clauses: [
        {
          clauseId: "suit-length",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 5,
          description: "5+ cards in transfer suit",
        },
      ],
    });

    const facts = buildFacts({ "hand.suitLength.hearts": 6 });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.satisfied).toBe(true);
    // The resolved factId should appear in the output clause
    expect(proposal.clauses[0]!.factId).toBe("hand.suitLength.hearts");
    // factDependencies should use the resolved ID
    expect(proposal.evidence.factDependencies).toContain("hand.suitLength.hearts");
    expect(proposal.evidence.factDependencies).not.toContain(
      "hand.suitLength.$suit",
    );
  });

  it("missing binding fails closed — unresolved $key won't match any fact", () => {
    const surface = makeSurface({
      surfaceBindings: {}, // no "suit" binding
      clauses: [
        {
          clauseId: "suit-length",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 5,
          description: "5+ cards in suit",
        },
      ],
    });

    const facts = buildFacts({ "hand.suitLength.hearts": 6 });
    const proposal = evaluateMeaningSurface(surface, facts);

    // $suit stays unresolved, no fact matches → fail-closed
    expect(proposal.clauses[0]!.satisfied).toBe(false);
    expect(proposal.clauses[0]!.factId).toBe("hand.suitLength.$suit");
  });

  it("multiple bindings in one surface resolve correctly", () => {
    const surface = makeSurface({
      surfaceBindings: { suit: "spades", level: "game" },
      clauses: [
        {
          clauseId: "suit-length",
          factId: "hand.suitLength.$suit",
          operator: "gte",
          value: 4,
          description: "4+ in suit",
        },
        {
          clauseId: "strength-check",
          factId: "bridge.$level.values",
          operator: "boolean",
          value: true,
          description: "Has game values",
        },
      ],
    });

    const facts = buildFacts({
      "hand.suitLength.spades": 5,
      "bridge.game.values": true,
    });

    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.satisfied).toBe(true);
    expect(proposal.clauses[0]!.factId).toBe("hand.suitLength.spades");
    expect(proposal.clauses[1]!.satisfied).toBe(true);
    expect(proposal.clauses[1]!.factId).toBe("bridge.game.values");
  });

  it("no bindings — existing surfaces work identically (backward compat)", () => {
    const surface = makeSurface({
      // no surfaceBindings
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
    });

    const facts = buildFacts({ "hand.hcp": 10 });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.satisfied).toBe(true);
    expect(proposal.clauses[0]!.factId).toBe("hand.hcp");
  });
});

describe("observedValue on MeaningClause", () => {
  it("populates observedValue from fact lookup", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
    });

    const facts = buildFacts({ "hand.hcp": 12 });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.observedValue).toBe(12);
  });

  it("observedValue is undefined when fact is missing", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
    });

    const emptyFacts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, emptyFacts);

    expect(proposal.clauses[0]!.observedValue).toBeUndefined();
  });

  it("observedValue is populated for boolean operators", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "balanced",
          factId: "hand.isBalanced",
          operator: "boolean",
          value: true,
          description: "Is balanced",
        },
      ],
    });

    const facts = buildFacts({ "hand.isBalanced": false });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.observedValue).toBe(false);
  });

  it("observedValue is populated for string facts with in operator", () => {
    const surface = makeSurface({
      clauses: [
        {
          clauseId: "pattern-check",
          factId: "bridge.majorPattern",
          operator: "in",
          value: ["one-four", "both-four"],
          description: "Major pattern matches",
        },
      ],
    });

    const facts = buildFacts({ "bridge.majorPattern": "one-four" });
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.clauses[0]!.observedValue).toBe("one-four");
  });
});

// ═══════════════════════════════════════════════════════════════
// resolvePriorityClass tests
// ═══════════════════════════════════════════════════════════════

describe("resolvePriorityClass", () => {
  const mapping = defaultPriorityClassMapping();

  it("resolves obligatory → must via profile mapping", () => {
    expect(resolvePriorityClass("obligatory", mapping, "may")).toBe("must");
  });

  it("resolves preferredConventional → should via profile mapping", () => {
    expect(resolvePriorityClass("preferredConventional", mapping, "may")).toBe("should");
  });

  it("resolves preferredNatural → should via profile mapping", () => {
    expect(resolvePriorityClass("preferredNatural", mapping, "may")).toBe("should");
  });

  it("resolves neutralCorrect → may via profile mapping", () => {
    expect(resolvePriorityClass("neutralCorrect", mapping, "must")).toBe("may");
  });

  it("resolves fallbackCorrect → avoid via profile mapping", () => {
    expect(resolvePriorityClass("fallbackCorrect", mapping, "must")).toBe("avoid");
  });

  it("falls back to fallbackBand when no profileMapping", () => {
    expect(resolvePriorityClass("obligatory", undefined, "should")).toBe("should");
  });

  it("falls back to fallbackBand when no priorityClass", () => {
    expect(resolvePriorityClass(undefined, mapping, "must")).toBe("must");
  });

  it("falls back to fallbackBand when both are undefined", () => {
    expect(resolvePriorityClass(undefined, undefined, "avoid")).toBe("avoid");
  });

  it("uses custom profile mapping when provided", () => {
    const customMapping: Record<PriorityClass, RecommendationBand> = {
      obligatory: "must",
      preferredConventional: "must",  // profile upgrades conventional to must
      preferredNatural: "may",         // profile downgrades natural to may
      neutralCorrect: "avoid",
      fallbackCorrect: "avoid",
    };
    expect(resolvePriorityClass("preferredConventional", customMapping, "should")).toBe("must");
    expect(resolvePriorityClass("preferredNatural", customMapping, "should")).toBe("may");
  });
});

// ═══════════════════════════════════════════════════════════════
// Pipeline integration: priorityClass resolution
// ═══════════════════════════════════════════════════════════════

describe("evaluateMeaningSurface with priorityClass", () => {
  const mapping = defaultPriorityClassMapping();

  it("resolves priorityClass to override recommendationBand when mapping provided", () => {
    const surface = makeSurface({
      priorityClass: "obligatory",
      ranking: {
        recommendationBand: "may",  // surface says "may" but priorityClass says "obligatory" → "must"
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, facts, mapping);

    expect(proposal.ranking.recommendationBand).toBe("must");
  });

  it("preserves other ranking fields when priorityClass overrides band", () => {
    const surface = makeSurface({
      priorityClass: "fallbackCorrect",
      ranking: {
        recommendationBand: "must",
        specificity: 5,
        modulePrecedence: 3,
        intraModuleOrder: 7,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, facts, mapping);

    expect(proposal.ranking.recommendationBand).toBe("avoid");
    expect(proposal.ranking.specificity).toBe(5);
    expect(proposal.ranking.modulePrecedence).toBe(3);
    expect(proposal.ranking.intraModuleOrder).toBe(7);
  });

  it("uses surface band when priorityClass is set but no mapping provided", () => {
    const surface = makeSurface({
      priorityClass: "obligatory",
      ranking: {
        recommendationBand: "may",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, facts);  // no mapping

    expect(proposal.ranking.recommendationBand).toBe("may");
  });

  it("backward compat: surfaces without priorityClass use surface band", () => {
    const surface = makeSurface({
      // no priorityClass
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, facts, mapping);

    expect(proposal.ranking.recommendationBand).toBe("should");
  });

  it("backward compat: surfaces without priorityClass and no mapping work unchanged", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "must",
        specificity: 2,
        modulePrecedence: 1,
        intraModuleOrder: 3,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateMeaningSurface(surface, facts);

    expect(proposal.ranking).toEqual(surface.ranking);
  });
});

describe("evaluateAllSurfaces with priorityClass", () => {
  const mapping = defaultPriorityClassMapping();

  it("passes profileMapping through to MeaningSurface evaluation", () => {
    const surface1 = makeSurface({
      meaningId: "test:with-pc",
      priorityClass: "obligatory",
      ranking: {
        recommendationBand: "may",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
    });
    const surface2 = makeSurface({
      meaningId: "test:without-pc",
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 1,
      },
    });

    const facts = buildFacts({});
    const proposals = evaluateAllSurfaces([surface1, surface2], facts, mapping);

    expect(proposals[0]!.ranking.recommendationBand).toBe("must");  // resolved via priorityClass
    expect(proposals[1]!.ranking.recommendationBand).toBe("should");  // unchanged (no priorityClass)
  });
});
