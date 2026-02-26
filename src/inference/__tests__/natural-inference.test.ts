import { describe, it, expect } from "vitest";
import { createNaturalInferenceProvider } from "../natural-inference";
import { Seat, BidSuit, Suit } from "../../engine/types";
import type { Auction, AuctionEntry } from "../../engine/types";

const provider = createNaturalInferenceProvider();

function emptyAuction(): Auction {
  return { entries: [], isComplete: false };
}

function makeEntry(seat: Seat, call: AuctionEntry["call"]): AuctionEntry {
  return { seat, call };
}

describe("createNaturalInferenceProvider", () => {
  describe("opening bids", () => {
    it("1NT opening → 15-17 HCP, balanced", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 1,
        strain: BidSuit.NoTrump,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(15);
      expect(result!.maxHcp).toBe(17);
      expect(result!.isBalanced).toBe(true);
      expect(result!.source).toContain("1NT");
    });

    it("1H opening → 12+ HCP, 5+ hearts", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 1,
        strain: BidSuit.Hearts,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(12);
      expect(result!.suits[Suit.Hearts]?.minLength).toBe(5);
    });

    it("1S opening → 12+ HCP, 5+ spades", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 1,
        strain: BidSuit.Spades,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(12);
      expect(result!.suits[Suit.Spades]?.minLength).toBe(5);
    });

    it("1C opening → 12+ HCP, 3+ clubs", () => {
      const entry = makeEntry(Seat.South, {
        type: "bid",
        level: 1,
        strain: BidSuit.Clubs,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.South);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(12);
      expect(result!.suits[Suit.Clubs]?.minLength).toBe(3);
    });

    it("1D opening → 12+ HCP, 4+ diamonds", () => {
      const entry = makeEntry(Seat.West, {
        type: "bid",
        level: 1,
        strain: BidSuit.Diamonds,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.West);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(12);
      expect(result!.suits[Suit.Diamonds]?.minLength).toBe(4);
    });

    it("2C opening → 22+ HCP", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 2,
        strain: BidSuit.Clubs,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(22);
    });

    it("2NT opening → 20-21 HCP, balanced", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 2,
        strain: BidSuit.NoTrump,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(20);
      expect(result!.maxHcp).toBe(21);
      expect(result!.isBalanced).toBe(true);
    });

    it("2H opening → 5-11 HCP, 6+ hearts", () => {
      const entry = makeEntry(Seat.North, {
        type: "bid",
        level: 2,
        strain: BidSuit.Hearts,
      });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(5);
      expect(result!.maxHcp).toBe(11);
      expect(result!.suits[Suit.Hearts]?.minLength).toBe(6);
    });
  });

  describe("pass inferences", () => {
    it("pass in first seat → <12 HCP", () => {
      const entry = makeEntry(Seat.North, { type: "pass" });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.North);

      expect(result).not.toBeNull();
      expect(result!.maxHcp).toBe(11);
    });

    it("pass over an opening bid → <12 HCP", () => {
      const auctionBefore: Auction = {
        entries: [
          makeEntry(Seat.North, {
            type: "bid",
            level: 1,
            strain: BidSuit.Hearts,
          }),
        ],
        isComplete: false,
      };
      const entry = makeEntry(Seat.East, { type: "pass" });
      const result = provider.inferFromBid(entry, auctionBefore, Seat.East);

      expect(result).not.toBeNull();
      expect(result!.maxHcp).toBe(11);
    });
  });

  describe("response inferences", () => {
    it("1NT response → 6-10 HCP", () => {
      const auctionBefore: Auction = {
        entries: [
          makeEntry(Seat.North, {
            type: "bid",
            level: 1,
            strain: BidSuit.Hearts,
          }),
          makeEntry(Seat.East, { type: "pass" }),
        ],
        isComplete: false,
      };
      const entry = makeEntry(Seat.South, {
        type: "bid",
        level: 1,
        strain: BidSuit.NoTrump,
      });
      const result = provider.inferFromBid(entry, auctionBefore, Seat.South);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.maxHcp).toBe(10);
    });

    it("1S response to 1H → 6+ HCP, 4+ spades", () => {
      const auctionBefore: Auction = {
        entries: [
          makeEntry(Seat.North, {
            type: "bid",
            level: 1,
            strain: BidSuit.Hearts,
          }),
          makeEntry(Seat.East, { type: "pass" }),
        ],
        isComplete: false,
      };
      const entry = makeEntry(Seat.South, {
        type: "bid",
        level: 1,
        strain: BidSuit.Spades,
      });
      const result = provider.inferFromBid(entry, auctionBefore, Seat.South);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.suits[Suit.Spades]?.minLength).toBe(4);
    });

    it("simple raise (2H over partner 1H) → 6-10 HCP, 3+ support", () => {
      const auctionBefore: Auction = {
        entries: [
          makeEntry(Seat.North, {
            type: "bid",
            level: 1,
            strain: BidSuit.Hearts,
          }),
          makeEntry(Seat.East, { type: "pass" }),
        ],
        isComplete: false,
      };
      const entry = makeEntry(Seat.South, {
        type: "bid",
        level: 2,
        strain: BidSuit.Hearts,
      });
      const result = provider.inferFromBid(entry, auctionBefore, Seat.South);

      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.maxHcp).toBe(10);
      expect(result!.suits[Suit.Hearts]?.minLength).toBe(3);
    });
  });

  describe("edge cases", () => {
    it("double returns null", () => {
      const entry = makeEntry(Seat.East, { type: "double" });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.East);

      expect(result).toBeNull();
    });

    it("redouble returns null", () => {
      const entry = makeEntry(Seat.East, { type: "redouble" });
      const result = provider.inferFromBid(entry, emptyAuction(), Seat.East);

      expect(result).toBeNull();
    });
  });
});
