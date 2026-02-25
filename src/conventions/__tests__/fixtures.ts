import type { Auction, ContractBid, Hand } from "../../engine/types";
import { Seat } from "../../engine/types";
import { buildAuction, parsePatternCall } from "../../engine/auction-helpers";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../types";
import { expect } from "vitest";

// Re-export engine test helpers for convenience
export { card, hand } from "../../engine/__tests__/fixtures";
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

/** Opener: 16 HCP, balanced, 4 hearts (responds 2H to Stayman) */
export const staymanOpener = () =>
  hand(
    "SA",
    "SK",
    "S3",
    "HK",
    "HQ",
    "HJ",
    "H2",
    "DK",
    "D5",
    "D3",
    "C7",
    "C5",
    "C2",
  );

/** No 4-card major — no Stayman rule matches */
export const noMajorHand = () =>
  hand(
    "SA",
    "S5",
    "S2",
    "HK",
    "H8",
    "H3",
    "DA",
    "DQ",
    "D7",
    "D4",
    "C5",
    "C3",
    "C2",
  );

// --- Named Gerber test hands ---

/** Gerber responder: 14 HCP, no particular shape requirement (slam interest) */
export const gerberResponder = () =>
  hand(
    "SA",
    "SK",
    "S5",
    "S2",
    "HA",
    "H3",
    "DK",
    "D5",
    "D3",
    "CQ",
    "C5",
    "C3",
    "C2",
  );

/** Gerber opener: 16 HCP, balanced, 2 aces */
export const gerberOpener = () =>
  hand(
    "SQ",
    "SJ",
    "S3",
    "HK",
    "HQ",
    "HJ",
    "H2",
    "DA",
    "D7",
    "D4",
    "CA",
    "C7",
    "C4",
  );

// --- Named Bergen test hands ---

/** Bergen opener: 14 HCP, 5 hearts (opens 1H) */
export const bergenOpener = () =>
  hand(
    "SK",
    "S5",
    "S2",
    "HA",
    "HK",
    "HQ",
    "H7",
    "H3",
    "D5",
    "D3",
    "C5",
    "C3",
    "C2",
  );

/** Bergen responder: 8 HCP, 4 hearts (constructive raise range) */
export const bergenResponder = () =>
  hand(
    "SQ",
    "S5",
    "S2",
    "HJ",
    "HT",
    "H6",
    "H2",
    "DK",
    "D7",
    "D3",
    "C5",
    "C3",
    "C2",
  );

// --- Named DONT test hands ---

/** DONT overcaller: 10 HCP, 6 hearts single-suited */
export const dontOvercaller = () =>
  hand(
    "S5",
    "S3",
    "S2",
    "HA",
    "HK",
    "HQ",
    "HJ",
    "H7",
    "H3",
    "D5",
    "D2",
    "C5",
    "C2",
  );

/** DONT opponent (East opener): 16 HCP, balanced */
export const dontOpponent = () =>
  hand(
    "SA",
    "SK",
    "S4",
    "HT",
    "H5",
    "H2",
    "DA",
    "DK",
    "D6",
    "D3",
    "CQ",
    "CJ",
    "C4",
  );

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
 * Creates a BiddingContext from a hand, seat, bid sequence, and dealer.
 * Shared helper used by edge-case tests across all conventions.
 */
export function makeBiddingContext(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat,
): BiddingContext {
  return {
    hand: h,
    auction: auctionFromBids(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
  };
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
    const lastBid = lastEntry!.call as ContractBid;
    const expBid = expectedCall as ContractBid;
    expect(lastBid.level).toBe(expBid.level);
    expect(lastBid.strain).toBe(expBid.strain);
  }
}
