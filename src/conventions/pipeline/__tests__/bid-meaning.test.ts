import { describe, it, expect } from "vitest";
import type { BidMeaning, BidMeaningClause } from "../evaluation/meaning";
import { Disclosure } from "../evaluation/meaning";
import type { Call } from "../../../engine/types";
import { BidSuit } from "../../../engine/types";
import { bidName, bidSummary } from "../../core/authored-text";
import type { TeachingLabel } from "../../core/authored-text";
import { FactOperator, RecommendationBand } from "../evaluation/meaning";

const tl = (name: string): TeachingLabel => ({ name: bidName(name), summary: bidSummary("[TODO] test") });

describe("BidMeaning", () => {
  it("can construct a BidMeaning with all required fields", () => {
    const surface: BidMeaning = {
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
          operator: FactOperator.Gte,
          value: 8,
        },
      ],
      ranking: {
        recommendationBand: RecommendationBand.Should,
        modulePrecedence: 0,
        declarationOrder: 0,
      },
      sourceIntent: {
        type: "stayman-ask",
        params: {},
      },
      disclosure: Disclosure.Alert,
      teachingLabel: tl("Stayman 2C"),
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
    const surface: BidMeaning = {
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
        recommendationBand: RecommendationBand.Should,
        modulePrecedence: 0,
        declarationOrder: 0,
      },
      sourceIntent: {
        type: "stayman-ask",
        params: { level: 2 },
      },
      disclosure: Disclosure.Alert,
      teachingLabel: tl("Stayman Convention"),
    };

    expect(surface.semanticClassId).toBe("bridge:major-ask");
    expect(surface.encoding.alternateEncodings).toHaveLength(1);
    expect(surface.encoding.alternateEncodings![0]!.condition).toBe(
      "after-interference",
    );
    expect(surface.teachingLabel).toEqual(tl("Stayman Convention"));
  });

  it("all operator types can be used in clauses (gte, lte, eq, range, boolean, in)", () => {
    const clauses: BidMeaningClause[] = [
      {
        clauseId: "hcp-min",
        factId: "hand.hcp",
        operator: FactOperator.Gte,
        value: 8,
      },
      {
        clauseId: "hcp-max",
        factId: "hand.hcp",
        operator: FactOperator.Lte,
        value: 14,
      },
      {
        clauseId: "exact-length",
        factId: "hand.suitLength.spades",
        operator: FactOperator.Eq,
        value: 5,
      },
      {
        clauseId: "hcp-range",
        factId: "hand.hcp",
        operator: FactOperator.Range,
        value: { min: 8, max: 9 },
      },
      {
        clauseId: "has-major",
        factId: "bridge.hasFourCardMajor",
        operator: FactOperator.Boolean,
        value: true,
      },
      {
        clauseId: "pattern-check",
        factId: "bridge.majorPattern",
        operator: FactOperator.In,
        value: ["one-four", "both-four"],
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
    const contractBidSurface: BidMeaning = {
      meaningId: "test:contract-bid",
      semanticClassId: "test:contract-bid-class",
      moduleId: "test",
      encoding: {
        defaultCall: { type: "bid", level: 3, strain: BidSuit.NoTrump },
      },
      clauses: [],
      ranking: {
        recommendationBand: RecommendationBand.Must,
        modulePrecedence: 0,
        declarationOrder: 0,
      },
      sourceIntent: { type: "test", params: {} },
      disclosure: Disclosure.Alert,
      teachingLabel: tl("3NT contract bid"),
    };

    const passSurface: BidMeaning = {
      meaningId: "test:pass",
      semanticClassId: "test:pass-class",
      moduleId: "test",
      encoding: {
        defaultCall: { type: "pass" } as Call,
      },
      clauses: [],
      ranking: {
        recommendationBand: RecommendationBand.May,
        modulePrecedence: 0,
        declarationOrder: 0,
      },
      sourceIntent: { type: "test", params: {} },
      disclosure: Disclosure.Alert,
      teachingLabel: tl("Pass"),
    };

    expect(contractBidSurface.encoding.defaultCall.type).toBe("bid");
    expect(passSurface.encoding.defaultCall.type).toBe("pass");
  });
});
