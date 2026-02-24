import type { BiddingStrategy, BidResult } from "../shared/types";
import type { Hand, Auction } from "./types";
import type { BiddingContext } from "../conventions/types";
import { Seat, Vulnerability } from "./types";
import { evaluateHand } from "./hand-evaluator";

/**
 * Suggest a bid using a given strategy.
 * Extracted from EnginePort — lives outside the engine interface because
 * BiddingStrategy contains methods that can't cross IPC/HTTP boundaries.
 */
export function suggestBid(
  hand: Hand,
  auction: Auction,
  seat: Seat,
  strategy: BiddingStrategy,
): BidResult {
  const evaluation = evaluateHand(hand);
  // Inline construction instead of createBiddingContext() — engine must not have
  // runtime imports from conventions/. Update defaults here if BiddingContext changes.
  const context: BiddingContext = {
    hand,
    auction,
    seat,
    evaluation,
    vulnerability: Vulnerability.None,
    dealer: Seat.North,
  };
  const result = strategy.suggest(context);
  if (result) return result;
  return {
    call: { type: "pass" },
    ruleName: null,
    explanation: "No matching rule — defaulting to pass",
  };
}
