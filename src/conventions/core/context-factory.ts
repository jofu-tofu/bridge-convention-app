import type { Hand, Auction, HandEvaluation } from "../../engine/types";
import { Seat, Vulnerability } from "../../engine/types";
import type { BiddingContext } from "./types";

/**
 * Canonical factory for BiddingContext construction.
 * All construction sites should use this instead of inline object literals.
 * Future BiddingContext field additions require only a default here.
 */
export function createBiddingContext(params: {
  hand: Hand;
  auction: Auction;
  seat: Seat;
  evaluation: HandEvaluation;
  vulnerability?: Vulnerability;
  dealer?: Seat;
  opponentConventionIds?: readonly string[];
}): BiddingContext {
  return {
    hand: params.hand,
    auction: params.auction,
    seat: params.seat,
    evaluation: params.evaluation,
    vulnerability: params.vulnerability ?? Vulnerability.None,
    // Default North is arbitrary — callers should pass actual dealer for conventions
    // that gate on auction position.
    dealer: params.dealer ?? Seat.North,
    opponentConventionIds: params.opponentConventionIds ?? [],
  };
}
