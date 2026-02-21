import { BidSuit } from "./types";
import type { Auction, ContractBid, Call, Seat } from "./types";
import { addCall } from "./auction";
import { nextSeat } from "./constants";

/** Returns the most recent contract bid in the auction, or null if none. */
export function lastContractBid(auction: Auction): ContractBid | null {
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const call = auction.entries[i]!.call;
    if (call.type === "bid") return call;
  }
  return null;
}

/** Returns all contract bids in order, filtering out passes/doubles/redoubles. */
export function bidsInSequence(auction: Auction): ContractBid[] {
  const bids: ContractBid[] = [];
  for (const entry of auction.entries) {
    if (entry.call.type === "bid") {
      bids.push(entry.call);
    }
  }
  return bids;
}

/** Counts the number of entries (calls) by a specific seat. */
export function seatBidCount(auction: Auction, seat: Seat): number {
  let count = 0;
  for (const entry of auction.entries) {
    if (entry.seat === seat) count++;
  }
  return count;
}

const STRAIN_MAP: Record<string, BidSuit> = {
  C: BidSuit.Clubs,
  D: BidSuit.Diamonds,
  H: BidSuit.Hearts,
  S: BidSuit.Spades,
  NT: BidSuit.NoTrump,
};

/** Parse a bid string ("1C"-"7NT", "P", "X", "XX") into a Call. */
export function parsePatternCall(str: string): Call {
  const upper = str.toUpperCase().trim();
  if (upper === "P" || upper === "PASS") return { type: "pass" };
  if (upper === "XX" || upper === "REDOUBLE") return { type: "redouble" };
  if (upper === "X" || upper === "DOUBLE") return { type: "double" };

  const match = upper.match(/^([1-7])(C|D|H|S|NT)$/);
  if (!match) throw new Error(`Invalid bid pattern: "${str}"`);

  return {
    type: "bid",
    level: Number(match[1]) as ContractBid["level"],
    strain: STRAIN_MAP[match[2]!]!,
  };
}

function callsEqual(a: Call, b: Call): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bid" && b.type === "bid") {
    return a.level === b.level && a.strain === b.strain;
  }
  return true;
}

/** Build an Auction from bid strings, rotating seats from the dealer. */
export function buildAuction(dealer: Seat, bids: string[]): Auction {
  let auction: Auction = { entries: [], isComplete: false };
  let currentSeat = dealer;
  for (const bid of bids) {
    const call = parsePatternCall(bid);
    auction = addCall(auction, { seat: currentSeat, call });
    currentSeat = nextSeat(currentSeat);
  }
  return auction;
}

/** Exact-match: auction entries must have exactly the same calls as pattern (same length). */
export function auctionMatchesExact(
  auction: Auction,
  pattern: string[],
): boolean {
  if (auction.entries.length !== pattern.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    const expected = parsePatternCall(pattern[i]!);
    if (!callsEqual(auction.entries[i]!.call, expected)) return false;
  }
  return true;
}
