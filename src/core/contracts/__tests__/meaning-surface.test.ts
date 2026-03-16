import { describe, it, expect } from "vitest";
import type { MeaningSurface, MeaningSurfaceClause } from "../meaning";
import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";

describe("MeaningSurface", () => {
  it("can construct a MeaningSurface with all required fields", () => {
    const surface: MeaningSurface = {
      meaningId: "stayman:ask-major",
      semanticClassId: "bridge:major-ask",
      moduleId: "stayman",
      encoding: {
        defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
      },
      clauses: [
        {
          clauseId: "hcp-min",
          factId: "hand.hcp",
          operator: "gte",
          value: 8,
          description: "At least 8 HCP",
        },
      ],
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: {
        type: "stayman-ask",
        params: {},
      },
      teachingLabel: "Stayman 2C",
    };

    expect(surface.meaningId).toBe("stayman:ask-major");
    expect(surface.moduleId).toBe("stayman");
    expect(surface.encoding.defaultCall).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });
    expect(surface.clauses).toHaveLength(1);
    expect(surface.ranking.recommendationBand).toBe("should");
  });

  it("can construct with optional fields (alternateEncodings)", () => {
    const surface: MeaningSurface = {
      meaningId: "stayman:ask-major",
      semanticClassId: "bridge:major-ask",
      moduleId: "stayman",
      encoding: {
        defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
        alternateEncodings: [
          {
            call: { type: "bid", level: 3, strain: BidSuit.Clubs },
            condition: "after-interference",
          },
        ],
      },
      clauses: [],
      ranking: {
        recommendationBand: "should",
        specificity: 1,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: {
        type: "stayman-ask",
        params: { level: 2 },
      },
      teachingLabel: "Stayman Convention",
    };

    expect(surface.semanticClassId).toBe("bridge:major-ask");
    expect(surface.encoding.alternateEncodings).toHaveLength(1);
    expect(surface.encoding.alternateEncodings![0]!.condition).toBe(
      "after-interference",
    );
    expect(surface.teachingLabel).toBe("Stayman Convention");
  });

  it("all operator types can be used in clauses (gte, lte, eq, range, boolean, in)", () => {
    const clauses: MeaningSurfaceClause[] = [
      {
        clauseId: "hcp-min",
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        description: "At least 8 HCP",
      },
      {
        clauseId: "hcp-max",
        factId: "hand.hcp",
        operator: "lte",
        value: 14,
        description: "At most 14 HCP",
      },
      {
        clauseId: "exact-length",
        factId: "hand.suitLength.spades",
        operator: "eq",
        value: 5,
        description: "Exactly 5 spades",
      },
      {
        clauseId: "hcp-range",
        factId: "hand.hcp",
        operator: "range",
        value: { min: 8, max: 9 },
        description: "8-9 HCP",
      },
      {
        clauseId: "has-major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "Has a 4-card major",
      },
      {
        clauseId: "pattern-check",
        factId: "bridge.majorPattern",
        operator: "in",
        value: ["one-four", "both-four"],
        description: "Major pattern is one-four or both-four",
      },
    ];

    expect(clauses).toHaveLength(6);
    expect(clauses[0]!.operator).toBe("gte");
    expect(clauses[1]!.operator).toBe("lte");
    expect(clauses[2]!.operator).toBe("eq");
    expect(clauses[3]!.operator).toBe("range");
    expect(clauses[4]!.operator).toBe("boolean");
    expect(clauses[5]!.operator).toBe("in");
    expect(clauses[5]!.value).toEqual(["one-four", "both-four"]);
  });

  it("encoding.defaultCall accepts both contract bids and special calls", () => {
    const contractBidSurface: MeaningSurface = {
      meaningId: "test:contract-bid",
      semanticClassId: "test:contract-bid-class",
      moduleId: "test",
      encoding: {
        defaultCall: { type: "bid", level: 3, strain: BidSuit.NoTrump },
      },
      clauses: [],
      ranking: {
        recommendationBand: "must",
        specificity: 0,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "test", params: {} },
      teachingLabel: "3NT contract bid",
    };

    const passSurface: MeaningSurface = {
      meaningId: "test:pass",
      semanticClassId: "test:pass-class",
      moduleId: "test",
      encoding: {
        defaultCall: { type: "pass" } as Call,
      },
      clauses: [],
      ranking: {
        recommendationBand: "may",
        specificity: 0,
        modulePrecedence: 0,
        intraModuleOrder: 0,
      },
      sourceIntent: { type: "test", params: {} },
      teachingLabel: "Pass",
    };

    expect(contractBidSurface.encoding.defaultCall.type).toBe("bid");
    expect(passSurface.encoding.defaultCall.type).toBe("pass");
  });
});
