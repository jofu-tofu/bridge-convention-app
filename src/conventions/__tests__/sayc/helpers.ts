import { Seat } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { evaluateBiddingRules } from "../../registry";
import { saycConfig } from "../../sayc";
import type { BiddingContext } from "../../types";
import { auctionFromBids } from "../fixtures";

export function makeBiddingContext(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
): BiddingContext {
  return {
    hand: h,
    auction: auctionFromBids(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
  };
}

export function callFromRules(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, saycConfig);
}
