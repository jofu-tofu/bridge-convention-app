import { BidSuit, Seat } from "./types";
import type { Auction, AuctionEntry, Call, Contract, ContractBid } from "./types";
import { partnerSeat } from "./constants";

/**
 * Bid strain rank for comparison.
 * NOT same as SUIT_ORDER which is for SuitLength tuples.
 */
const STRAIN_RANK: Record<BidSuit, number> = {
  [BidSuit.Clubs]: 1,
  [BidSuit.Diamonds]: 2,
  [BidSuit.Hearts]: 3,
  [BidSuit.Spades]: 4,
  [BidSuit.NoTrump]: 5,
};

/** All 35 possible contract bids in ascending order. */
const ALL_BIDS: readonly ContractBid[] = (() => {
  const bids: ContractBid[] = [];
  const strains = [BidSuit.Clubs, BidSuit.Diamonds, BidSuit.Hearts, BidSuit.Spades, BidSuit.NoTrump];
  for (let level = 1; level <= 7; level++) {
    for (const strain of strains) {
      bids.push({ type: "bid", level: level as ContractBid["level"], strain });
    }
  }
  return bids;
})();

/**
 * Returns negative if a < b, 0 if equal, positive if a > b.
 * Compares by level first, then strain rank.
 */
export function compareBids(a: ContractBid, b: ContractBid): number {
  if (a.level !== b.level) {
    return a.level - b.level;
  }
  return STRAIN_RANK[a.strain] - STRAIN_RANK[b.strain];
}

/** Find the last non-pass call in the auction, or undefined if all passes. */
function lastNonPassCall(auction: Auction): AuctionEntry | undefined {
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const entry = auction.entries[i]!;
    if (entry.call.type !== "pass") {
      return entry;
    }
  }
  return undefined;
}

/** Find the last contract bid in the auction, or undefined. */
function lastBid(auction: Auction): AuctionEntry | undefined {
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const entry = auction.entries[i]!;
    if (entry.call.type === "bid") {
      return entry;
    }
  }
  return undefined;
}

/** Check if two seats are on the same partnership (NS or EW). */
function sameSide(a: Seat, b: Seat): boolean {
  return a === b || partnerSeat(a) === b;
}

export function isLegalCall(auction: Auction, call: Call, seat: Seat): boolean {
  if (auction.isComplete) {
    return false;
  }

  if (call.type === "pass") {
    return true;
  }

  if (call.type === "bid") {
    const last = lastBid(auction);
    if (!last) {
      return true;
    }
    return compareBids(call, last.call as ContractBid) > 0;
  }

  if (call.type === "double") {
    const lastNonPass = lastNonPassCall(auction);
    if (!lastNonPass) {
      return false;
    }
    // Last non-pass must be an opponent's bid
    if (lastNonPass.call.type !== "bid") {
      return false;
    }
    return !sameSide(lastNonPass.seat, seat);
  }

  if (call.type === "redouble") {
    const lastNonPass = lastNonPassCall(auction);
    if (!lastNonPass) {
      return false;
    }
    // Last non-pass must be a double
    if (lastNonPass.call.type !== "double") {
      return false;
    }
    // The double must have been made by an opponent (not our side)
    // And the underlying bid must be our side's bid
    // Simplification: the doubler is on the opponent side relative to the redoubler
    return !sameSide(lastNonPass.seat, seat);
  }

  return false;
}

export function isAuctionComplete(auction: Auction): boolean {
  const entries = auction.entries;
  const len = entries.length;

  if (len < 4) {
    return false;
  }

  // Check if last 3 calls are passes
  const lastThreePasses =
    entries[len - 1]!.call.type === "pass" &&
    entries[len - 2]!.call.type === "pass" &&
    entries[len - 3]!.call.type === "pass";

  if (!lastThreePasses) {
    return false;
  }

  // 4 initial passes (passout)
  if (len === 4 && entries[len - 4]!.call.type === "pass") {
    return true;
  }

  // 3 passes after at least one bid: need at least one non-pass call before the last 3
  const hasBid = entries.some((e, i) => i < len - 3 && e.call.type !== "pass");
  return hasBid;
}

export function addCall(auction: Auction, entry: AuctionEntry): Auction {
  if (auction.isComplete) {
    throw new Error("Cannot add call to completed auction");
  }

  if (!isLegalCall(auction, entry.call, entry.seat)) {
    throw new Error(`Illegal call: ${JSON.stringify(entry.call)} by ${entry.seat}`);
  }

  const newEntries = [...auction.entries, entry];
  const newAuction: Auction = {
    entries: newEntries,
    isComplete: false,
  };

  return {
    entries: newEntries,
    isComplete: isAuctionComplete(newAuction),
  };
}

export function getDeclarer(auction: Auction): Seat {
  const last = lastBid(auction);
  if (!last) {
    throw new Error("No bids in auction — cannot determine declarer");
  }

  const finalStrain = (last.call as ContractBid).strain;
  const declaringSide = last.seat;

  // Find the FIRST player on the declaring side to bid this strain
  for (const entry of auction.entries) {
    if (
      entry.call.type === "bid" &&
      entry.call.strain === finalStrain &&
      sameSide(entry.seat, declaringSide)
    ) {
      return entry.seat;
    }
  }

  // Should never reach here if lastBid found something
  return declaringSide;
}

export function getContract(auction: Auction): Contract | null {
  const last = lastBid(auction);
  if (!last) {
    return null;
  }

  const finalBid = last.call as ContractBid;
  const lastNonPass = lastNonPassCall(auction);

  let doubled = false;
  let redoubled = false;

  if (lastNonPass && lastNonPass.call.type === "double") {
    doubled = true;
  } else if (lastNonPass && lastNonPass.call.type === "redouble") {
    redoubled = true;
  }

  return {
    level: finalBid.level,
    strain: finalBid.strain,
    doubled,
    redoubled,
    declarer: getDeclarer(auction),
  };
}

export function getLegalCalls(auction: Auction, seat: Seat): Call[] {
  if (auction.isComplete) {
    return [];
  }

  const legal: Call[] = [];

  // Pass
  if (isLegalCall(auction, { type: "pass" }, seat)) {
    legal.push({ type: "pass" });
  }

  // All 35 bids
  for (const b of ALL_BIDS) {
    if (isLegalCall(auction, b, seat)) {
      legal.push(b);
    }
  }

  // Double
  if (isLegalCall(auction, { type: "double" }, seat)) {
    legal.push({ type: "double" });
  }

  // Redouble
  if (isLegalCall(auction, { type: "redouble" }, seat)) {
    legal.push({ type: "redouble" });
  }

  return legal;
}
