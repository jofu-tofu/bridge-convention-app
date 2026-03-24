import { describe, it, expect } from "vitest";
import {
  evaluateBidMeaning,
  evaluateAllBidMeanings,
} from "../meaning-evaluator";
import type { BidMeaning } from "../meaning";
import type { EvaluatedFacts, FactValue } from "../../core/fact-catalog";
import { BidSuit } from "../../../engine/types";

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
  overrides: Partial<BidMeaning> = {},
): BidMeaning {
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
      modulePrecedence: 0,
      declarationOrder: 0,
    },
    sourceIntent: { type: "test-intent", params: {} },
    teachingLabel: "Test meaning",
    ...overrides,
  } as BidMeaning;
}

describe("evaluateBidMeaning", () => {
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
    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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
      evaluateBidMeaning(surface, satisfiedFacts).clauses[0]!.satisfied,
    ).toBe(true);

    const notSatisfiedFacts = buildFacts({ "hand.hcp": 6 });
    expect(
      evaluateBidMeaning(surface, notSatisfiedFacts).clauses[0]!.satisfied,
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
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 8 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 10 })).clauses[0]!
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
      evaluateBidMeaning(surface, buildFacts({ "bridge.trumpSuit": "spades" }))
        .clauses[0]!.satisfied,
    ).toBe(true);

    expect(
      evaluateBidMeaning(surface, buildFacts({ "bridge.trumpSuit": "hearts" }))
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
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 8 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 9 })).clauses[0]!
        .satisfied,
    ).toBe(true);

    expect(
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 7 })).clauses[0]!
        .satisfied,
    ).toBe(false);

    expect(
      evaluateBidMeaning(surface, buildFacts({ "hand.hcp": 10 })).clauses[0]!
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
      evaluateBidMeaning(
        surface,
        buildFacts({ "bridge.majorPattern": "one-four" }),
      ).clauses[0]!.satisfied,
    ).toBe(true);

    expect(
      evaluateBidMeaning(
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

    const proposal = evaluateBidMeaning(
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
    const proposal = evaluateBidMeaning(surface, emptyFacts);

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

    const proposal = evaluateBidMeaning(surface, facts);

    expect(proposal.evidence.factDependencies).toEqual(
      expect.arrayContaining(["hand.hcp", "bridge.hasFourCardMajor"]),
    );
    expect(proposal.evidence.factDependencies).toHaveLength(2);

    expect(proposal.evidence.evaluatedConditions).toHaveLength(2);
    expect(proposal.evidence.evaluatedConditions[0]!).toEqual({
      conditionId: "hcp-min",
      satisfied: true,
      description: "At least 8 HCP",
      conditionRole: "semantic",
    });
    expect(proposal.evidence.evaluatedConditions[1]!).toEqual({
      conditionId: "has-major",
      satisfied: true,
      description: "Has a 4-card major",
      conditionRole: "semantic",
    });

    expect(proposal.evidence.provenance).toEqual({
      moduleId: "stayman",
      nodeName: "stayman:ask",
      origin: "meaning-pipeline",
    });
  });

  it("returns correct MeaningProposal structure", () => {
    const surface = makeSurface({
      meaningId: "test:full",
      semanticClassId: "bridge:test-class",
      moduleId: "test-module",
      sourceIntent: { type: "test-type", params: { key: "val" } },
    });

    const proposal = evaluateBidMeaning(surface, buildFacts({}));

    expect(proposal.meaningId).toBe("test:full");
    expect(proposal.semanticClassId).toBe("bridge:test-class");
    expect(proposal.moduleId).toBe("test-module");
    expect(proposal.sourceIntent).toEqual({
      type: "test-type",
      params: { key: "val" },
    });
    // Authored ranking fields are preserved; specificity is derived
    expect(proposal.ranking.recommendationBand).toBe(surface.ranking.recommendationBand);
    expect(proposal.ranking.modulePrecedence).toBe(surface.ranking.modulePrecedence);
    expect(proposal.ranking.declarationOrder).toBe(surface.ranking.declarationOrder);
    expect(proposal.ranking.specificity).toBe(0); // no fact extensions → 0
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
    const allPass = evaluateBidMeaning(surface, allPassFacts);
    expect(allPass.clauses.every((c) => c.satisfied)).toBe(true);

    // One fails
    const oneFailFacts = buildFacts({
      "hand.hcp": 6,
      "bridge.hasFourCardMajor": true,
      "hand.isBalanced": false,
    });
    const oneFail = evaluateBidMeaning(surface, oneFailFacts);
    expect(oneFail.clauses[0]!.satisfied).toBe(false);
    expect(oneFail.clauses[1]!.satisfied).toBe(true);
    expect(oneFail.clauses[2]!.satisfied).toBe(true);
  });
});

describe("evaluateAllBidMeanings", () => {
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
    const proposals = evaluateAllBidMeanings([surface1, surface2], facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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

    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, emptyFacts);

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
    const proposal = evaluateBidMeaning(surface, facts);

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
    const proposal = evaluateBidMeaning(surface, facts);

    expect(proposal.clauses[0]!.observedValue).toBe("one-four");
  });
});

// ═══════════════════════════════════════════════════════════════
// Authored recommendationBand passthrough
// ═══════════════════════════════════════════════════════════════

describe("evaluateBidMeaning preserves authored recommendationBand", () => {
  it("preserves the authored recommendationBand on the output proposal", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "should",
        modulePrecedence: 0,
        declarationOrder: 0,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateBidMeaning(surface, facts);

    expect(proposal.ranking.recommendationBand).toBe("should");
  });

  it("different authored bands produce different output bands", () => {
    const bands = ["must", "should", "may", "avoid"] as const;

    for (const band of bands) {
      const surface = makeSurface({
        ranking: {
          recommendationBand: band,
          modulePrecedence: 0,
          declarationOrder: 0,
        },
      });
      const facts = buildFacts({});
      const proposal = evaluateBidMeaning(surface, facts);

      expect(proposal.ranking.recommendationBand).toBe(band);
    }
  });

  it("preserves all ranking fields alongside the authored band", () => {
    const surface = makeSurface({
      ranking: {
        recommendationBand: "avoid",
        modulePrecedence: 3,
        declarationOrder: 7,
      },
    });
    const facts = buildFacts({});
    const proposal = evaluateBidMeaning(surface, facts);

    expect(proposal.ranking.recommendationBand).toBe("avoid");
    expect(proposal.ranking.specificity).toBe(0); // no fact extensions → 0
    expect(proposal.ranking.modulePrecedence).toBe(3);
    expect(proposal.ranking.declarationOrder).toBe(7);
  });
});

describe("evaluateAllBidMeanings preserves authored recommendationBand", () => {
  it("each surface retains its own authored band", () => {
    const surface1 = makeSurface({
      meaningId: "test:must-band",
      ranking: {
        recommendationBand: "must",
        modulePrecedence: 0,
        declarationOrder: 0,
      },
    });
    const surface2 = makeSurface({
      meaningId: "test:may-band",
      ranking: {
        recommendationBand: "may",
        modulePrecedence: 0,
        declarationOrder: 1,
      },
    });

    const facts = buildFacts({});
    const proposals = evaluateAllBidMeanings([surface1, surface2], facts);

    expect(proposals[0]!.ranking.recommendationBand).toBe("must");
    expect(proposals[1]!.ranking.recommendationBand).toBe("may");
  });
});
