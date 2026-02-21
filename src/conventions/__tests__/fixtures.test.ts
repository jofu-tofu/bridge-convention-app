import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import {
  parseCallString,
  auctionFromBids,
  makeOpening,
  expectBid,
} from "./fixtures";

describe("parseCallString", () => {
  test("parses pass", () => {
    expect(parseCallString("P")).toEqual({ type: "pass" });
    expect(parseCallString("Pass")).toEqual({ type: "pass" });
  });

  test("parses double", () => {
    expect(parseCallString("X")).toEqual({ type: "double" });
  });

  test("parses redouble", () => {
    expect(parseCallString("XX")).toEqual({ type: "redouble" });
  });

  test("parses contract bids", () => {
    const oneClub = parseCallString("1C") as ContractBid;
    expect(oneClub.type).toBe("bid");
    expect(oneClub.level).toBe(1);
    expect(oneClub.strain).toBe(BidSuit.Clubs);

    const threeNT = parseCallString("3NT") as ContractBid;
    expect(threeNT.level).toBe(3);
    expect(threeNT.strain).toBe(BidSuit.NoTrump);

    const sevenS = parseCallString("7S") as ContractBid;
    expect(sevenS.level).toBe(7);
    expect(sevenS.strain).toBe(BidSuit.Spades);
  });

  test("throws on invalid bid string", () => {
    expect(() => parseCallString("8C")).toThrow();
    expect(() => parseCallString("0NT")).toThrow();
    expect(() => parseCallString("hello")).toThrow();
  });
});

describe("auctionFromBids", () => {
  test("builds auction with correct seat rotation", () => {
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    expect(auction.entries).toHaveLength(4);
    expect(auction.entries[0]!.seat).toBe(Seat.North);
    expect(auction.entries[1]!.seat).toBe(Seat.East);
    expect(auction.entries[2]!.seat).toBe(Seat.South);
    expect(auction.entries[3]!.seat).toBe(Seat.West);
  });

  test("detects passout", () => {
    const auction = auctionFromBids(Seat.North, ["P", "P", "P", "P"]);
    expect(auction.isComplete).toBe(true);
  });

  test("detects completed auction after 3 passes", () => {
    const auction = auctionFromBids(Seat.North, ["1H", "P", "P", "P"]);
    expect(auction.isComplete).toBe(true);
  });
});

describe("makeOpening", () => {
  test("creates auction with single opening bid", () => {
    const auction = makeOpening(Seat.South, "1NT");
    expect(auction.entries).toHaveLength(1);
    expect(auction.entries[0]!.seat).toBe(Seat.South);
    const bid = auction.entries[0]!.call as ContractBid;
    expect(bid.level).toBe(1);
    expect(bid.strain).toBe(BidSuit.NoTrump);
  });
});

describe("expectBid", () => {
  test("passes for matching bid", () => {
    const auction = auctionFromBids(Seat.North, ["1NT"]);
    expectBid(auction, Seat.North, "1NT");
  });

  test("passes for matching pass", () => {
    const auction = auctionFromBids(Seat.North, ["1H", "P"]);
    expectBid(auction, Seat.East, "P");
  });
});
