import type { MeaningSurface } from "../../core/contracts/meaning-surface";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { createBiddingContext } from "../../conventions/core";
import { Seat, BidSuit } from "../../engine/types";

export function makeTestSurface(
  overrides: Partial<MeaningSurface> = {},
): MeaningSurface {
  return {
    meaningId: "test:ask",
    moduleId: "test",
    encoding: {
      defaultCall: { type: "bid", level: 2, strain: BidSuit.Clubs },
    },
    clauses: [
      {
        clauseId: "hcp",
        factId: "hand.hcp",
        operator: "gte",
        value: 8,
        description: "8+ HCP",
      },
      {
        clauseId: "major",
        factId: "bridge.hasFourCardMajor",
        operator: "boolean",
        value: true,
        description: "Has 4-card major",
      },
    ],
    ranking: {
      recommendationBand: "should",
      specificity: 2,
      modulePrecedence: 1,
      intraModuleOrder: 0,
    },
    sourceIntent: { type: "test-ask", params: {} },
    ...overrides,
  };
}

// 10 HCP hand with 4 spades: SA SK S3 S2 HA H3 DA D4 D2 CA C5 C4 C3
export const strongHandWith4Spades = hand(
  "SA", "SK", "S3", "S2",
  "HA", "H3",
  "DA", "D4", "D2",
  "CA", "C5", "C4", "C3",
);

export function makeContext(testHand: ReturnType<typeof hand>, bids: string[] = ["1NT", "pass"]) {
  const evaluation = evaluateHand(testHand);
  const auction = buildAuction(Seat.North, bids);
  return createBiddingContext({
    hand: testHand,
    auction,
    seat: Seat.South,
    evaluation,
  });
}
