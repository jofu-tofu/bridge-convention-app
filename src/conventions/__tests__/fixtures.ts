import type { Auction } from "../../engine/types";
import type { Seat } from "../../engine/types";
import { buildAuction, parsePatternCall } from "../../engine/auction-helpers";
import { expect } from "vitest";

// Re-export engine test helpers for convenience
export { hand } from "../../engine/__tests__/fixtures";
import { hand } from "../../engine/__tests__/fixtures";

// --- Named Stayman test hands ---

/** Responder: 13 HCP, 4 hearts (should bid 2C Stayman after 1NT-P) */
export const staymanResponder = () =>
  hand(
    "SK",
    "S5",
    "S2",
    "HA",
    "HK",
    "HQ",
    "H3",
    "D5",
    "D3",
    "D2",
    "C5",
    "C3",
    "C2",
  );

// Re-export production helpers as the test fixture API
// buildAuction and parsePatternCall are used locally via aliases below

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
export function expectBid(
  auction: Auction,
  seat: Seat,
  expected: string,
): void {
  const lastEntry = auction.entries[auction.entries.length - 1];
  expect(lastEntry).toBeDefined();
  expect(lastEntry!.seat).toBe(seat);

  const expectedCall = parsePatternCall(expected);
  expect(lastEntry!.call.type).toBe(expectedCall.type);
  if (expectedCall.type === "bid" && lastEntry!.call.type === "bid") {
    const lastBid = lastEntry!.call;
    const expBid = expectedCall;
    expect(lastBid.level).toBe(expBid.level);
    expect(lastBid.strain).toBe(expBid.strain);
  }
}
