import { BidSuit } from "./types";
import type { Auction, ContractBid, Call, Seat } from "./types";
import { addCall } from "./auction";
import { nextSeat } from "./constants";
import { callsMatch } from "./call-helpers";

/** Returns the most recent contract bid in the auction, or null if none. */
export function lastContractBid(auction: Auction): ContractBid | null {
  for (let i = auction.entries.length - 1; i >= 0; i--) {
    const call = auction.entries[i]!.call;
    if (call.type === "bid") return call;
  }
  return null;
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

/** Internal: match auction entries against pattern calls. */
function matchPattern(
  auction: Auction,
  pattern: readonly string[],
): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const expected = parsePatternCall(pattern[i]!);
    if (!callsMatch(auction.entries[i]!.call, expected)) return false;
  }
  return true;
}

/** Exact-match: auction entries must have exactly the same calls as pattern (same length). @internal */
export function auctionMatchesExact(
  auction: Auction,
  pattern: string[],
): boolean {
  if (auction.entries.length !== pattern.length) return false;
  return matchPattern(auction, pattern);
}
