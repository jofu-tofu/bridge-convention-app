import type { Auction, ContractBid } from "../../engine/types";
import { Seat } from "../../engine/types";
import {
  buildAuction,
  parsePatternCall,
} from "../../engine/auction-helpers";
import { expect } from "vitest";

// Re-export engine test helpers for convenience
export { card, hand } from "../../engine/__tests__/fixtures";

// Re-export production helpers as the test fixture API
export { buildAuction, parsePatternCall };

/** Alias for buildAuction — kept for existing test call sites. */
export const auctionFromBids = buildAuction;

/** Alias for parsePatternCall — kept for existing test call sites. */
export const parseCallString = parsePatternCall;

/**
 * Creates an opening auction state with one bid from the dealer.
 * Example: makeOpening(Seat.North, "1NT")
 */
export function makeOpening(dealer: Seat, bid: string): Auction {
  return buildAuction(dealer, [bid]);
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

  const expectedCall = parsePatternCall(expected);
  expect(lastEntry!.call.type).toBe(expectedCall.type);
  if (expectedCall.type === "bid" && lastEntry!.call.type === "bid") {
    const lastBid = lastEntry!.call as ContractBid;
    const expBid = expectedCall as ContractBid;
    expect(lastBid.level).toBe(expBid.level);
    expect(lastBid.strain).toBe(expBid.strain);
  }
}
