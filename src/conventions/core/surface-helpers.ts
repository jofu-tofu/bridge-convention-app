import { BidSuit } from "../../engine/types";
import type { Call, Auction, Seat } from "../../engine/types";
import type { MeaningSurface } from "../../core/contracts/meaning";
import type { RoutedSurfaceGroup } from "./bundle/bundle-types";

// ─── Bid shorthand ──────────────────────────────────────────

/** Shorthand for creating a contract bid Call. */
export function bid(level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): Call {
  return { type: "bid", level, strain };
}

// ─── Machine-only sentinel ──────────────────────────────────

/** Empty surface array used when machine-based routing handles surface selection. */
export const MACHINE_ONLY: readonly MeaningSurface[] = [];

// ─── Generic surface router ─────────────────────────────────

/** Generic surface router that filters active groups and returns their surfaces. */
export function createFallbackSurfaceRouter(
  routedGroups: readonly RoutedSurfaceGroup[],
): (auction: Auction, seat: Seat) => readonly MeaningSurface[] {
  return (auction, seat) => {
    const activeGroups = routedGroups.filter((g) => g.isActive?.(auction, seat));
    return activeGroups.flatMap((g) => g.surfaces);
  };
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
