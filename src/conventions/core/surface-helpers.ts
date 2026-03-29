import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";
import { ObsSuit } from "../pipeline/bid-action";

// ─── Bid shorthand ──────────────────────────────────────────

/** Shorthand for creating a contract bid Call. */
export function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

// ─── Suit conversion helpers ────────────────────────────────

/** Convert a suit name to its BidSuit enum value. */
export function suitToBidSuit(suit: ObsSuit): BidSuit {
  switch (suit) {
    case ObsSuit.Hearts: return BidSuit.Hearts;
    case ObsSuit.Spades: return BidSuit.Spades;
    case ObsSuit.Diamonds: return BidSuit.Diamonds;
    case ObsSuit.Clubs: return BidSuit.Clubs;
  }
}

/** Return the other major suit's BidSuit. */
export function otherMajorBidSuit(suit: ObsSuit.Hearts | ObsSuit.Spades): BidSuit {
  return suit === ObsSuit.Hearts ? BidSuit.Spades : BidSuit.Hearts;
}
