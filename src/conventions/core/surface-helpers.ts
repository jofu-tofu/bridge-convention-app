import { BidSuit } from "../../engine/types";
import type { Call } from "../../engine/types";

// ─── Bid shorthand ──────────────────────────────────────────

/** Shorthand for creating a contract bid Call. */
export function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

// ─── Suit conversion helpers ────────────────────────────────

/** Convert a suit name to its BidSuit enum value. */
export function suitToBidSuit(suit: "hearts" | "spades" | "diamonds" | "clubs"): BidSuit {
  switch (suit) {
    case "hearts": return BidSuit.Hearts;
    case "spades": return BidSuit.Spades;
    case "diamonds": return BidSuit.Diamonds;
    case "clubs": return BidSuit.Clubs;
  }
}

/** Return the other major suit's BidSuit. */
export function otherMajorBidSuit(suit: "hearts" | "spades"): BidSuit {
  return suit === "hearts" ? BidSuit.Spades : BidSuit.Hearts;
}
