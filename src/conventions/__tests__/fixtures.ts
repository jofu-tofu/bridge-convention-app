import { BidSuit, Seat } from "../../engine/types";
import type { Auction, AuctionEntry, Call, ContractBid } from "../../engine/types";
import { nextSeat } from "../../engine/constants";
import { addCall } from "../../engine/auction";
import { expect } from "vitest";

// Re-export engine test helpers for convenience
export { card, hand } from "../../engine/__tests__/fixtures";

/** Parse a bid string into a Call. Supported: "1C"-"7NT", "P", "X", "XX". */
export function parseCallString(str: string): Call {
  const upper = str.toUpperCase().trim();

  if (upper === "P" || upper === "PASS") {
    return { type: "pass" };
  }
  if (upper === "XX" || upper === "REDOUBLE") {
    return { type: "redouble" };
  }
  if (upper === "X" || upper === "DOUBLE") {
    return { type: "double" };
  }

  // Contract bid: "1C", "2NT", "3H", etc.
  const match = upper.match(/^([1-7])(C|D|H|S|NT)$/);
  if (!match) {
    throw new Error(`Invalid bid string: "${str}"`);
  }

  const level = Number(match[1]) as ContractBid["level"];
  const strainMap: Record<string, BidSuit> = {
    C: BidSuit.Clubs,
    D: BidSuit.Diamonds,
    H: BidSuit.Hearts,
    S: BidSuit.Spades,
    NT: BidSuit.NoTrump,
  };
  const strain = strainMap[match[2]!]!;

  return { type: "bid", level, strain };
}

/**
 * Build an Auction from shorthand bid strings.
 * Dealer is always required (explicit > implicit).
 * Bids rotate clockwise from dealer: dealer, next, next, next, ...
 *
 * Example: auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"])
 */
export function auctionFromBids(dealer: Seat, bids: string[]): Auction {
  let auction: Auction = { entries: [], isComplete: false };
  let currentSeat = dealer;

  for (const bidStr of bids) {
    const call = parseCallString(bidStr);
    const entry: AuctionEntry = { seat: currentSeat, call };
    auction = addCall(auction, entry);
    currentSeat = nextSeat(currentSeat);
  }

  return auction;
}

/**
 * Creates an opening auction state with one bid from the dealer.
 * Example: makeOpening(Seat.North, "1NT")
 */
export function makeOpening(dealer: Seat, bid: string): Auction {
  return auctionFromBids(dealer, [bid]);
}

/**
 * Assertion helper: verify that a specific seat's response in the auction
 * matches the expected call string.
 * Checks the last entry in the auction matches seat and expected call.
 */
export function expectBid(auction: Auction, seat: Seat, expected: string): void {
  const lastEntry = auction.entries[auction.entries.length - 1];
  expect(lastEntry).toBeDefined();
  expect(lastEntry!.seat).toBe(seat);

  const expectedCall = parseCallString(expected);
  expect(lastEntry!.call.type).toBe(expectedCall.type);
  if (expectedCall.type === "bid" && lastEntry!.call.type === "bid") {
    const lastBid = lastEntry!.call as ContractBid;
    const expBid = expectedCall as ContractBid;
    expect(lastBid.level).toBe(expBid.level);
    expect(lastBid.strain).toBe(expBid.strain);
  }
}
