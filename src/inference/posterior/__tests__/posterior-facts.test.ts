import { describe, it, expect } from "vitest";
import { POSTERIOR_FACT_HANDLERS } from "../posterior-facts";
import type { PosteriorFactRequest } from "../../../core/contracts/posterior";
import { Suit, Rank } from "../../../engine/types";
import type { Hand, Card } from "../../../engine/types";

function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** Build a 13-card hand with specified suit lengths using low cards. */
function lowHand(spades: number, hearts: number, diamonds: number, clubs: number): Hand {
  const cards: Card[] = [];
  const lowRanks = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace];
  const suits: [Suit, number][] = [
    [Suit.Spades, spades],
    [Suit.Hearts, hearts],
    [Suit.Diamonds, diamonds],
    [Suit.Clubs, clubs],
  ];
  let idx = 0;
  for (const [suit, count] of suits) {
    for (let i = 0; i < count; i++) {
      cards.push(card(suit, lowRanks[idx % lowRanks.length]!));
      idx++;
    }
  }
  return { cards };
}

/** Build a hand with specific HCP: AKQJ of spades = 10 HCP, rest low */
function hcpHand(hcp: number): Hand {
  // Simple approach: put honors in spades to get desired HCP
  const cards: Card[] = [];
  const honors: [Rank, number][] = [[Rank.Ace, 4], [Rank.King, 3], [Rank.Queen, 2], [Rank.Jack, 1]];
  let remaining = hcp;
  for (const [rank, value] of honors) {
    if (remaining >= value) {
      cards.push(card(Suit.Spades, rank));
      remaining -= value;
    }
  }
  // Fill to 13 with low cards across suits
  const fillers: Card[] = [];
  const lowRanks = [Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven, Rank.Eight, Rank.Nine, Rank.Ten];
  const fillSuits = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];
  let fillIdx = 0;
  while (cards.length + fillers.length < 13) {
    const suit = fillSuits[Math.floor(fillIdx / lowRanks.length) % fillSuits.length]!;
    const rank = lowRanks[fillIdx % lowRanks.length]!;
    // Avoid duplicates with existing honor cards
    if (!cards.some(c => c.suit === suit && c.rank === rank)) {
      fillers.push(card(suit, rank));
    }
    fillIdx++;
  }
  return { cards: [...cards, ...fillers] };
}

function makeSample(seatHands: Record<string, Hand>): ReadonlyMap<string, Hand> {
  return new Map(Object.entries(seatHands));
}

function makeRequest(factId: string, seatId = "N", conditionedOn?: string[]): PosteriorFactRequest {
  return { factId, seatId, conditionedOn };
}

const dummyHand = lowHand(4, 3, 3, 3);

describe("POSTERIOR_FACT_HANDLERS registry", () => {
  it("contains exactly 5 handlers", () => {
    expect(POSTERIOR_FACT_HANDLERS.size).toBe(5);
  });

  it("has all expected fact IDs", () => {
    for (const id of [
      "bridge.partnerHas4CardMajorLikely",
      "bridge.nsHaveEightCardFitLikely",
      "bridge.combinedHcpInRangeLikely",
      "bridge.openerStillBalancedLikely",
      "bridge.openerHasSecondMajorLikely",
    ]) {
      expect(POSTERIOR_FACT_HANDLERS.has(id)).toBe(true);
    }
  });
});

describe("partnerHas4CardMajorLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get("bridge.partnerHas4CardMajorLikely")!;

  it("returns 0 for zero samples", () => {
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N", ["H"]), [], dummyHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("returns 1.0 when all samples have 4+ in conditioned suit", () => {
    const samples = [
      makeSample({ N: lowHand(2, 4, 4, 3) }),
      makeSample({ N: lowHand(2, 5, 3, 3) }),
    ];
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N", ["H"]), samples, dummyHand, 2);
    expect(result.expectedValue).toBe(1.0);
    expect(result.confidence).toBe(1.0);
  });

  it("returns 0.0 when no samples have 4+ in conditioned suit", () => {
    const samples = [
      makeSample({ N: lowHand(2, 3, 5, 3) }),
      makeSample({ N: lowHand(3, 2, 4, 4) }),
    ];
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N", ["H"]), samples, dummyHand, 2);
    expect(result.expectedValue).toBe(0.0);
  });

  it("returns proportion for mixed samples with correct confidence", () => {
    const samples = [
      makeSample({ N: lowHand(2, 4, 4, 3) }),
      makeSample({ N: lowHand(3, 2, 4, 4) }),
    ];
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N", ["H"]), samples, dummyHand, 4);
    expect(result.expectedValue).toBe(0.5);
    expect(result.confidence).toBe(0.5);
  });

  it("defaults to hearts when no conditionedOn provided", () => {
    const samples = [makeSample({ N: lowHand(2, 5, 3, 3) })];
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N"), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("respects spades conditionedOn", () => {
    const samples = [makeSample({ N: lowHand(5, 2, 3, 3) })];
    const result = handler(makeRequest("bridge.partnerHas4CardMajorLikely", "N", ["S"]), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });
});

describe("nsHaveEightCardFitLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get("bridge.nsHaveEightCardFitLikely")!;

  it("returns 0 for zero samples", () => {
    const result = handler(makeRequest("bridge.nsHaveEightCardFitLikely", "N"), [], dummyHand, 100);
    expect(result.expectedValue).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it("detects 8-card heart fit (own 4H + partner 4H)", () => {
    const ownHand = lowHand(3, 4, 3, 3);
    const samples = [makeSample({ N: lowHand(3, 4, 3, 3) })];
    const result = handler(makeRequest("bridge.nsHaveEightCardFitLikely", "N"), samples, ownHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("detects 8-card spade fit (own 5S + partner 3S)", () => {
    const ownHand = lowHand(5, 3, 3, 2);
    const samples = [makeSample({ N: lowHand(3, 3, 4, 3) })];
    const result = handler(makeRequest("bridge.nsHaveEightCardFitLikely", "N"), samples, ownHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0 when no 8-card fit exists", () => {
    const ownHand = lowHand(3, 3, 4, 3);
    const samples = [makeSample({ N: lowHand(3, 3, 4, 3) })];
    const result = handler(makeRequest("bridge.nsHaveEightCardFitLikely", "N"), samples, ownHand, 1);
    expect(result.expectedValue).toBe(0);
  });
});

describe("combinedHcpInRangeLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get("bridge.combinedHcpInRangeLikely")!;

  it("returns 0 for zero samples", () => {
    const result = handler(makeRequest("bridge.combinedHcpInRangeLikely", "N", ["25", "30"]), [], dummyHand, 100);
    expect(result.expectedValue).toBe(0);
  });

  it("returns 1.0 when combined HCP in range", () => {
    const ownHand = hcpHand(10);
    const partnerHand = hcpHand(10);
    const samples = [makeSample({ N: partnerHand })];
    const result = handler(makeRequest("bridge.combinedHcpInRangeLikely", "N", ["15", "25"]), samples, ownHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0 when combined HCP below range", () => {
    const ownHand = hcpHand(3);
    const partnerHand = hcpHand(3);
    const samples = [makeSample({ N: partnerHand })];
    const result = handler(makeRequest("bridge.combinedHcpInRangeLikely", "N", ["25", "30"]), samples, ownHand, 1);
    expect(result.expectedValue).toBe(0);
  });
});

describe("openerStillBalancedLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get("bridge.openerStillBalancedLikely")!;

  it("returns 0 for zero samples", () => {
    const result = handler(makeRequest("bridge.openerStillBalancedLikely", "N"), [], dummyHand, 100);
    expect(result.expectedValue).toBe(0);
  });

  it("returns 1.0 for balanced hands (4-3-3-3)", () => {
    const balanced = lowHand(4, 3, 3, 3);
    const samples = [makeSample({ N: balanced })];
    const result = handler(makeRequest("bridge.openerStillBalancedLikely", "N"), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0 for unbalanced hands (6-3-2-2)", () => {
    const unbalanced = lowHand(6, 3, 2, 2);
    const samples = [makeSample({ N: unbalanced })];
    const result = handler(makeRequest("bridge.openerStillBalancedLikely", "N"), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(0);
  });
});

describe("openerHasSecondMajorLikely", () => {
  const handler = POSTERIOR_FACT_HANDLERS.get("bridge.openerHasSecondMajorLikely")!;

  it("returns 0 for zero samples", () => {
    const result = handler(makeRequest("bridge.openerHasSecondMajorLikely", "N"), [], dummyHand, 100);
    expect(result.expectedValue).toBe(0);
  });

  it("returns 1.0 when partner has 4+ in both majors", () => {
    const bothMajors = lowHand(4, 4, 3, 2);
    const samples = [makeSample({ N: bothMajors })];
    const result = handler(makeRequest("bridge.openerHasSecondMajorLikely", "N"), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(1.0);
  });

  it("returns 0 when partner has only one 4-card major", () => {
    const oneMajor = lowHand(4, 3, 3, 3);
    const samples = [makeSample({ N: oneMajor })];
    const result = handler(makeRequest("bridge.openerHasSecondMajorLikely", "N"), samples, dummyHand, 1);
    expect(result.expectedValue).toBe(0);
  });

  it("returns proportion for mixed samples with correct confidence", () => {
    const bothMajors = lowHand(4, 4, 3, 2);
    const oneMajor = lowHand(4, 3, 3, 3);
    const samples = [makeSample({ N: bothMajors }), makeSample({ N: oneMajor })];
    const result = handler(makeRequest("bridge.openerHasSecondMajorLikely", "N"), samples, dummyHand, 4);
    expect(result.expectedValue).toBe(0.5);
    expect(result.confidence).toBe(0.5);
  });
});
