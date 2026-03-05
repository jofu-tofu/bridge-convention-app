import { describe, it, expect } from "vitest";
import { Seat, Suit, BidSuit } from "../../engine/types";
import type { Call, HandEvaluation } from "../../engine/types";
import type { ResolvedCandidate } from "../../conventions/core/candidate-generator";
import type { EffectiveConventionContext, BeliefData } from "../../conventions/core/effective-context";
import type { BiddingContext } from "../../conventions/core/types";
import { createFitConfidenceRanker } from "../bidding/fit-ranker";

// Helper: create a minimal ResolvedCandidate with the given resolved call
function makeCandidate(
  resolvedCall: Call,
  name: string,
): ResolvedCandidate {
  return {
    bidName: name,
    nodeId: name,
    meaning: `test ${name}`,
    call: resolvedCall,
    failedConditions: [],
    intent: { type: "ShowHeldSuit", params: {} },
    source: { conventionId: "test", roundName: "r1", nodeName: name },
    resolvedCall,
    isDefaultCall: true,
    legal: true,
    isMatched: false,
  };
}

// Helper: create a minimal EffectiveConventionContext with given shape and belief
function makeCtx(
  ownShape: readonly [number, number, number, number],
  publicBelief?: BeliefData,
): EffectiveConventionContext {
  const raw = {
    seat: Seat.South,
    evaluation: { shape: ownShape } as HandEvaluation,
  } as BiddingContext;

  // any: minimal mock — only raw and publicBelief are used by the ranker
  return {
    raw,
    publicBelief,
  } as unknown as EffectiveConventionContext;
}

function makeBeliefData(
  partnerSeat: Seat,
  partnerSuitMins: Record<Suit, number>,
): BeliefData {
  const beliefs = {} as BeliefData["beliefs"];
  for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
    if (seat === partnerSeat) {
      beliefs[seat] = {
        hcpRange: { min: 0, max: 40 },
        suitLengths: {
          [Suit.Spades]: { min: partnerSuitMins[Suit.Spades], max: 13 },
          [Suit.Hearts]: { min: partnerSuitMins[Suit.Hearts], max: 13 },
          [Suit.Diamonds]: { min: partnerSuitMins[Suit.Diamonds], max: 13 },
          [Suit.Clubs]: { min: partnerSuitMins[Suit.Clubs], max: 13 },
        },
      };
    } else {
      beliefs[seat] = {
        hcpRange: { min: 0, max: 40 },
        suitLengths: {
          [Suit.Spades]: { min: 0, max: 13 },
          [Suit.Hearts]: { min: 0, max: 13 },
          [Suit.Diamonds]: { min: 0, max: 13 },
          [Suit.Clubs]: { min: 0, max: 13 },
        },
      };
    }
  }
  return { beliefs };
}

describe("createFitConfidenceRanker", () => {
  const ranker = createFitConfidenceRanker();

  it("returns candidates unchanged when no belief data", () => {
    const candidates = [
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Hearts }, "2H"),
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Spades }, "2S"),
    ];
    const ctx = makeCtx([4, 5, 2, 2]); // no publicBelief

    const result = ranker(candidates, ctx);

    // Same order, same references
    expect(result).toEqual(candidates);
  });

  it("scores suit candidates by fit — heart candidate ranked higher with strong partner hearts", () => {
    // Own shape: 3 spades, 5 hearts, 3 diamonds, 2 clubs
    const ownShape = [3, 5, 3, 2] as const;
    // Partner has 4+ hearts, 2+ spades
    const belief = makeBeliefData(Seat.North, {
      [Suit.Spades]: 2,
      [Suit.Hearts]: 4,
      [Suit.Diamonds]: 2,
      [Suit.Clubs]: 2,
    });
    const ctx = makeCtx(ownShape, belief);

    const candidates = [
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Spades }, "2S"),
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Hearts }, "2H"),
    ];

    const result = ranker(candidates, ctx);

    // Heart fit: own 5 + partner min 4 = 9
    // Spade fit: own 3 + partner min 2 = 5
    // Heart candidate should be first
    expect(result[0]!.bidName).toBe("2H");
    expect(result[1]!.bidName).toBe("2S");
  });

  it("NT candidates get score 0", () => {
    const ownShape = [4, 4, 3, 2] as const;
    const belief = makeBeliefData(Seat.North, {
      [Suit.Spades]: 4,
      [Suit.Hearts]: 0,
      [Suit.Diamonds]: 0,
      [Suit.Clubs]: 0,
    });
    const ctx = makeCtx(ownShape, belief);

    const candidates = [
      makeCandidate({ type: "bid", level: 3, strain: BidSuit.NoTrump }, "3NT"),
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Spades }, "2S"),
    ];

    const result = ranker(candidates, ctx);

    // Spade fit: own 4 + partner min 4 = 8
    // NT fit: 0
    // Spade candidate should be first
    expect(result[0]!.bidName).toBe("2S");
    expect(result[1]!.bidName).toBe("3NT");
  });

  it("stable sort preserves order for equal scores", () => {
    const ownShape = [4, 4, 3, 2] as const;
    const belief = makeBeliefData(Seat.North, {
      [Suit.Spades]: 3,
      [Suit.Hearts]: 3,
      [Suit.Diamonds]: 0,
      [Suit.Clubs]: 0,
    });
    const ctx = makeCtx(ownShape, belief);

    // Both suits have same fit: own 4 + partner 3 = 7
    const candidates = [
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Spades }, "2S"),
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Hearts }, "2H"),
    ];

    const result = ranker(candidates, ctx);

    // Equal scores — original order preserved
    expect(result[0]!.bidName).toBe("2S");
    expect(result[1]!.bidName).toBe("2H");
  });

  it("handles pass/double candidates gracefully", () => {
    const ownShape = [4, 4, 3, 2] as const;
    const belief = makeBeliefData(Seat.North, {
      [Suit.Spades]: 3,
      [Suit.Hearts]: 3,
      [Suit.Diamonds]: 0,
      [Suit.Clubs]: 0,
    });
    const ctx = makeCtx(ownShape, belief);

    const candidates = [
      makeCandidate({ type: "pass" }, "pass"),
      makeCandidate({ type: "double" }, "double"),
      makeCandidate({ type: "bid", level: 2, strain: BidSuit.Spades }, "2S"),
    ];

    const result = ranker(candidates, ctx);

    // No crash — pass/double get score 0, spade has fit score 7
    expect(result).toHaveLength(3);
    expect(result[0]!.bidName).toBe("2S");
    // pass and double both score 0, original order preserved
    expect(result[1]!.bidName).toBe("pass");
    expect(result[2]!.bidName).toBe("double");
  });
});
