// Shared helpers across convention definition resolvers.

import { BidSuit } from "../../engine/types";

/** Lookup from suit/strain string name to BidSuit enum value. */
export const STRAIN_TO_BIDSUIT: Readonly<Record<string, BidSuit>> = {
  clubs: BidSuit.Clubs,
  diamonds: BidSuit.Diamonds,
  hearts: BidSuit.Hearts,
  spades: BidSuit.Spades,
  notrump: BidSuit.NoTrump,
};

/** Convert a suit/strain string name to a BidSuit, or undefined if not found. */
export function strainToBidSuit(name: string): BidSuit | undefined {
  return STRAIN_TO_BIDSUIT[name];
}
