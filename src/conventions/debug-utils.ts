import type { BiddingContext } from "./types";
import type { Deal, Seat, Auction } from "../engine/types";
import { evaluateHand } from "../engine/hand-evaluator";

/**
 * Reconstruct the BiddingContext for a historical bid.
 * Scoped to DebugDrawer use — not a general-purpose BiddingContext factory.
 */
export function reconstructBiddingContext(
  deal: Deal,
  seat: Seat,
  auctionPrefix: Auction,
): BiddingContext {
  const hand = deal.hands[seat];
  const evaluation = evaluateHand(hand);
  return { hand, auction: auctionPrefix, seat, evaluation };
}
