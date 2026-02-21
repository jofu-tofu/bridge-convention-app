/**
 * Convention Test Template
 *
 * Copy this file when implementing a new convention's tests.
 * Replace "Convention Name" with the actual convention (e.g., "Stayman").
 *
 * Structure:
 *   1. Deal constraints — opener/responder requirements (HCP, shape)
 *   2. Bidding sequences — correct responses to partner's bids
 *   3. Edge cases — interference, borderline hands, wrong shape
 *
 * All tests use test.todo() — they compile but skip until convention is implemented.
 *
 * Fixture API:
 *   - hand('SA', 'SK', ...) — create a 13-card Hand from notation
 *   - card('SA') — create a single Card
 *   - auctionFromBids(Seat.North, ["1NT", "P", "2C"]) — build auction from shorthand
 *   - makeOpening(Seat.North, "1NT") — create auction with one opening bid
 *   - expectBid(auction, Seat.South, "2C") — assert last bid matches
 */

import { describe, test } from "vitest";
// import { Seat } from "../../engine/types";
// import { hand, auctionFromBids, makeOpening, expectBid } from "./fixtures";

describe("Convention Name", () => {
  describe("deal constraints", () => {
    // Test that opener meets convention requirements
    test.todo("opener has required HCP range for convention");

    // Test that responder meets convention requirements
    test.todo("responder has required HCP range for convention");

    // Test shape requirements
    test.todo("opener has required shape for convention");
    test.todo("responder has required shape for convention");
  });

  describe("bidding sequences", () => {
    // Test the main convention sequence
    // Example for Stayman:
    //   const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C"]);
    //   expectBid(auction, Seat.South, "2C");
    test.todo("responder makes correct convention bid");

    // Test opener's responses
    test.todo("opener responds correctly with 4-card major");
    test.todo("opener responds correctly without 4-card major");

    // Test continuation after convention response
    test.todo("responder places final contract after opener response");
  });

  describe("edge cases", () => {
    // Test with opponent interference
    // Example: opponent overcalls between convention bids
    test.todo("convention response after opponent interference");

    // Test with wrong shape (should NOT trigger convention)
    test.todo("convention not triggered with wrong shape");

    // Test borderline HCP
    test.todo("convention triggered at minimum HCP");
    test.todo("convention not triggered below minimum HCP");
  });
});
