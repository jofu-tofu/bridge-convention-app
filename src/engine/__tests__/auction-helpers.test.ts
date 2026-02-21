import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../types";
import type { ContractBid } from "../types";
import {
  lastContractBid,
  bidsInSequence,
  seatBidCount,
  auctionMatchesExact,
} from "../auction-helpers";
import { auctionFromBids } from "../../conventions/__tests__/fixtures";

describe("lastContractBid", () => {
  test("returns most recent contract bid, ignoring passes", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const last = lastContractBid(auction);
    expect(last).not.toBeNull();
    expect(last!.type).toBe("bid");
    expect((last as ContractBid).level).toBe(2);
    expect((last as ContractBid).strain).toBe(BidSuit.Clubs);
  });

  test("returns null for all-pass auction", () => {
    const auction = auctionFromBids(Seat.North, ["P", "P", "P", "P"]);
    const last = lastContractBid(auction);
    expect(last).toBeNull();
  });

  test("returns null for empty auction", () => {
    const auction = { entries: [], isComplete: false };
    const last = lastContractBid(auction);
    expect(last).toBeNull();
  });
});

describe("bidsInSequence", () => {
  test("filters out non-contract bids", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const bids = bidsInSequence(auction);
    expect(bids).toHaveLength(2);
    expect(bids[0]!.level).toBe(1);
    expect(bids[0]!.strain).toBe(BidSuit.NoTrump);
    expect(bids[1]!.level).toBe(2);
    expect(bids[1]!.strain).toBe(BidSuit.Clubs);
  });

  test("returns empty array for all-pass auction", () => {
    const auction = auctionFromBids(Seat.North, ["P", "P", "P", "P"]);
    const bids = bidsInSequence(auction);
    expect(bids).toHaveLength(0);
  });
});

describe("seatBidCount", () => {
  test("counts bids for a specific seat", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    // North bid 1NT (index 0), South bid 2C (index 2)
    expect(seatBidCount(auction, Seat.North)).toBe(1);
    expect(seatBidCount(auction, Seat.South)).toBe(1);
    expect(seatBidCount(auction, Seat.East)).toBe(1); // pass counts as a call
    expect(seatBidCount(auction, Seat.West)).toBe(1);
  });

  test("returns 0 for seat with no entries", () => {
    const auction = auctionFromBids(Seat.North, ["1NT"]);
    expect(seatBidCount(auction, Seat.East)).toBe(0);
  });
});

describe("auctionMatchesExact", () => {
  test("matches when auction has exact same bids as pattern", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    expect(auctionMatchesExact(auction, ["1NT", "P", "2C", "P"])).toBe(true);
  });

  test("rejects when auction is longer than pattern", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    expect(auctionMatchesExact(auction, ["1NT", "P", "2C"])).toBe(false);
  });

  test("rejects when auction is shorter than pattern", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    expect(auctionMatchesExact(auction, ["1NT", "P", "2C", "P"])).toBe(false);
  });

  test("rejects when bids differ", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2D", "P"]);
    expect(auctionMatchesExact(auction, ["1NT", "P", "2C", "P"])).toBe(false);
  });

  test("handles passes and doubles correctly", () => {
    // Build auction with a double: North 1H, East X
    const auction = auctionFromBids(Seat.North, ["1H", "X"]);
    expect(auctionMatchesExact(auction, ["1H", "X"])).toBe(true);
    expect(auctionMatchesExact(auction, ["1H", "P"])).toBe(false);
  });

  test("matches empty auction with empty pattern", () => {
    const auction = { entries: [], isComplete: false };
    expect(auctionMatchesExact(auction, [])).toBe(true);
  });

  test("rejects empty auction with non-empty pattern", () => {
    const auction = { entries: [], isComplete: false };
    expect(auctionMatchesExact(auction, ["1NT"])).toBe(false);
  });

  test("handles redouble in pattern", () => {
    // North 1H, East X, South XX
    const auction = auctionFromBids(Seat.North, ["1H", "X", "XX"]);
    expect(auctionMatchesExact(auction, ["1H", "X", "XX"])).toBe(true);
  });
});
