import { describe, it, expect, beforeEach } from "vitest";
import {
  registerConvention,
  clearRegistry,
  evaluateAllBiddingRules,
} from "../registry";
import { staymanConfig } from "../stayman";
import { evaluateHand } from "../../engine/hand-evaluator";
import { Suit, Rank, Seat, BidSuit } from "../../engine/types";
import type { Hand, Auction } from "../../engine/types";
import { createBiddingContext } from "../context-factory";

function makeHand(cards: Array<{ suit: Suit; rank: Rank }>): Hand {
  return { cards };
}

// Standard Stayman responder hand: 12 HCP, 4 hearts
const responderHand = makeHand([
  { suit: Suit.Hearts, rank: Rank.Ace },
  { suit: Suit.Hearts, rank: Rank.King },
  { suit: Suit.Hearts, rank: Rank.Queen },
  { suit: Suit.Hearts, rank: Rank.Two },
  { suit: Suit.Spades, rank: Rank.Jack },
  { suit: Suit.Spades, rank: Rank.Three },
  { suit: Suit.Spades, rank: Rank.Two },
  { suit: Suit.Diamonds, rank: Rank.Ten },
  { suit: Suit.Diamonds, rank: Rank.Five },
  { suit: Suit.Diamonds, rank: Rank.Four },
  { suit: Suit.Clubs, rank: Rank.Nine },
  { suit: Suit.Clubs, rank: Rank.Seven },
  { suit: Suit.Clubs, rank: Rank.Three },
]);

const auction1NT: Auction = {
  entries: [
    { seat: Seat.North, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } },
    { seat: Seat.East, call: { type: "pass" } },
  ],
  isComplete: false,
};

describe("evaluateAllBiddingRules", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
  });

  it("returns results for all rules, not just the winner", () => {
    const context = createBiddingContext({
      hand: responderHand,
      auction: auction1NT,
      seat: Seat.South,
      evaluation: evaluateHand(responderHand),
    });

    const results = evaluateAllBiddingRules(staymanConfig.biddingRules, context, staymanConfig);
    expect(results.length).toBe(staymanConfig.biddingRules.length);
  });

  it("matching rule has matched: true and isLegal reflects legality", () => {
    const context = createBiddingContext({
      hand: responderHand,
      auction: auction1NT,
      seat: Seat.South,
      evaluation: evaluateHand(responderHand),
    });

    const results = evaluateAllBiddingRules(staymanConfig.biddingRules, context, staymanConfig);
    const staymanAsk = results.find((r) => r.ruleName === "stayman-ask");
    expect(staymanAsk).toBeDefined();
    expect(staymanAsk!.matched).toBe(true);
    expect(staymanAsk!.isLegal).toBe(true);
    expect(staymanAsk!.call).toBeDefined();
  });

  it("non-matching rules have matched: false", () => {
    const context = createBiddingContext({
      hand: responderHand,
      auction: auction1NT,
      seat: Seat.South,
      evaluation: evaluateHand(responderHand),
    });

    const results = evaluateAllBiddingRules(staymanConfig.biddingRules, context, staymanConfig);
    // Response rules shouldn't match for responder
    const nonMatching = results.filter((r) => !r.matched);
    expect(nonMatching.length).toBeGreaterThan(0);
    for (const result of nonMatching) {
      expect(result.isLegal).toBe(false);
    }
  });

  it("conditioned rules have conditionResults populated", () => {
    const context = createBiddingContext({
      hand: responderHand,
      auction: auction1NT,
      seat: Seat.South,
      evaluation: evaluateHand(responderHand),
    });

    const results = evaluateAllBiddingRules(staymanConfig.biddingRules, context, staymanConfig);
    // All Stayman rules use conditionedRule()
    const withConditions = results.filter((r) => r.conditionResults !== undefined);
    expect(withConditions.length).toBeGreaterThan(0);
  });
});
