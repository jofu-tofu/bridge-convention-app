import type { InferenceProvider, HandInference } from "./types";
import type { Auction, AuctionEntry, Seat, ContractBid } from "../engine/types";
import { BidSuit, Suit } from "../engine/types";
import { partnerSeat } from "../engine/constants";

/** SAYC-based natural bidding inference provider. */
export function createNaturalInferenceProvider(): InferenceProvider {
  return {
    id: "natural",
    name: "Natural Bidding Theory",
    inferFromBid(
      entry: AuctionEntry,
      auctionBefore: Auction,
      seat: Seat,
    ): HandInference | null {
      const call = entry.call;

      if (call.type === "pass") {
        return inferFromPass(auctionBefore, seat);
      }
      if (call.type !== "bid") return null;

      const hasContractBid = auctionBefore.entries.some(
        (e) => e.call.type === "bid",
      );

      if (!hasContractBid) {
        return inferFromOpening(call, seat);
      }

      return inferFromResponse(call, auctionBefore, seat);
    },
  };
}

/** Infer from an opening bid (no prior contract bids). */
function inferFromOpening(
  call: ContractBid,
  seat: Seat,
): HandInference | null {
  const { level, strain } = call;

  if (level === 1) {
    switch (strain) {
      case BidSuit.Clubs:
        return {
          seat,
          minHcp: 12,
          suits: { [Suit.Clubs]: { minLength: 3 } },
          source: "natural:1C-opening",
        };
      case BidSuit.Diamonds:
        return {
          seat,
          minHcp: 12,
          suits: { [Suit.Diamonds]: { minLength: 4 } },
          source: "natural:1D-opening",
        };
      case BidSuit.Hearts:
        return {
          seat,
          minHcp: 12,
          suits: { [Suit.Hearts]: { minLength: 5 } },
          source: "natural:1H-opening",
        };
      case BidSuit.Spades:
        return {
          seat,
          minHcp: 12,
          suits: { [Suit.Spades]: { minLength: 5 } },
          source: "natural:1S-opening",
        };
      case BidSuit.NoTrump:
        return {
          seat,
          minHcp: 15,
          maxHcp: 17,
          isBalanced: true,
          suits: {},
          source: "natural:1NT-opening",
        };
    }
  }

  if (level === 2) {
    switch (strain) {
      case BidSuit.Clubs:
        return {
          seat,
          minHcp: 22,
          suits: {},
          source: "natural:2C-opening",
        };
      case BidSuit.Hearts:
        return {
          seat,
          minHcp: 5,
          maxHcp: 11,
          suits: { [Suit.Hearts]: { minLength: 6 } },
          source: "natural:2H-opening",
        };
      case BidSuit.Spades:
        return {
          seat,
          minHcp: 5,
          maxHcp: 11,
          suits: { [Suit.Spades]: { minLength: 6 } },
          source: "natural:2S-opening",
        };
      case BidSuit.Diamonds:
        return {
          seat,
          minHcp: 5,
          maxHcp: 11,
          suits: { [Suit.Diamonds]: { minLength: 6 } },
          source: "natural:weak-2D-opening",
        };
      case BidSuit.NoTrump:
        return {
          seat,
          minHcp: 20,
          maxHcp: 21,
          isBalanced: true,
          suits: {},
          source: "natural:2NT-opening",
        };
    }
  }

  return null;
}

/** Infer from a pass. */
function inferFromPass(
  auctionBefore: Auction,
  seat: Seat,
): HandInference | null {
  const hasContractBid = auctionBefore.entries.some(
    (e) => e.call.type === "bid",
  );

  if (hasContractBid) {
    // Pass over an opening/bid: often 0-11 HCP without a suitable call
    return {
      seat,
      maxHcp: 11,
      suits: {},
      source: "natural:pass-over-bid",
    };
  }

  // Pass in first or second seat with no bids: less than 12 HCP
  const passCount = auctionBefore.entries.filter(
    (e) => e.call.type === "pass",
  ).length;
  if (passCount < 2) {
    return {
      seat,
      maxHcp: 11,
      suits: {},
      source: "natural:pass-no-opening",
    };
  }

  return null;
}

/** Infer from a response to a prior bid. */
function inferFromResponse(
  call: ContractBid,
  auctionBefore: Auction,
  seat: Seat,
): HandInference | null {
  const { level, strain } = call;

  // 1NT response: 6-10 HCP
  if (level === 1 && strain === BidSuit.NoTrump) {
    return {
      seat,
      minHcp: 6,
      maxHcp: 10,
      suits: {},
      source: "natural:1NT-response",
    };
  }

  // New suit at 1-level: 6+ HCP, 4+ in suit
  if (level === 1) {
    const suit = bidSuitToSuit(strain);
    if (suit) {
      return {
        seat,
        minHcp: 6,
        suits: { [suit]: { minLength: 4 } },
        source: `natural:1-level-new-suit`,
      };
    }
  }

  // Simple raise (2-level of partner's suit): 6-10 HCP, 3+ support
  // We detect this by checking if the strain matches a prior bid by partner
  if (level === 2 && strain !== BidSuit.NoTrump) {
    const partnerBid = findPartnerLastBid(auctionBefore, seat);
    if (partnerBid && partnerBid.type === "bid" && partnerBid.strain === strain) {
      const suit = bidSuitToSuit(strain);
      if (suit) {
        return {
          seat,
          minHcp: 6,
          maxHcp: 10,
          suits: { [suit]: { minLength: 3 } },
          source: "natural:simple-raise",
        };
      }
    }
  }

  return null;
}

/** Convert BidSuit to Suit (excludes NoTrump). */
function bidSuitToSuit(strain: BidSuit): Suit | null {
  switch (strain) {
    case BidSuit.Clubs:
      return Suit.Clubs;
    case BidSuit.Diamonds:
      return Suit.Diamonds;
    case BidSuit.Hearts:
      return Suit.Hearts;
    case BidSuit.Spades:
      return Suit.Spades;
    default:
      return null;
  }
}

/** Find the last contract bid made by seat's partner. */
function findPartnerLastBid(
  auction: Auction,
  seat: Seat,
): ContractBid | null {
  const partner = partnerSeat(seat);
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const entry = auction.entries[i]!;
    if (entry.seat === partner && entry.call.type === "bid") {
      return entry.call;
    }
  }
  return null;
}
