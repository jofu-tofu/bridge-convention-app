import { describe, it, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { AuctionEntry, Auction } from "../../engine/types";
import { createNaturalInferenceProvider } from "../natural-inference";
import {
  SAYC_SYSTEM_CONFIG,
  ACOL_SYSTEM_CONFIG,
  TWO_OVER_ONE_SYSTEM_CONFIG,
} from "../../conventions/definitions/system-config";

const emptyAuction: Auction = { entries: [], isComplete: false };

function opening1NT(seat: Seat): AuctionEntry {
  return { seat, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } };
}

/** Auction with a 1M opening by partner, so a response can follow. */
function auctionAfter1MOpening(openerSeat: Seat): Auction {
  return {
    entries: [
      { seat: openerSeat, call: { type: "bid", level: 1, strain: BidSuit.Hearts } },
    ],
    isComplete: false,
  };
}

function response1NT(seat: Seat): AuctionEntry {
  return { seat, call: { type: "bid", level: 1, strain: BidSuit.NoTrump } };
}

describe("createNaturalInferenceProvider — system-parameterized", () => {
  describe("1NT opening", () => {
    it("SAYC: infers 15–17 HCP", () => {
      const provider = createNaturalInferenceProvider(SAYC_SYSTEM_CONFIG);
      const result = provider.inferFromBid(opening1NT(Seat.North), emptyAuction, Seat.North);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(15);
      expect(result!.maxHcp).toBe(17);
    });

    it("Acol: infers 12–14 HCP", () => {
      const provider = createNaturalInferenceProvider(ACOL_SYSTEM_CONFIG);
      const result = provider.inferFromBid(opening1NT(Seat.North), emptyAuction, Seat.North);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(12);
      expect(result!.maxHcp).toBe(14);
    });

    it("2/1: infers 15–17 HCP (same as SAYC)", () => {
      const provider = createNaturalInferenceProvider(TWO_OVER_ONE_SYSTEM_CONFIG);
      const result = provider.inferFromBid(opening1NT(Seat.North), emptyAuction, Seat.North);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(15);
      expect(result!.maxHcp).toBe(17);
    });
  });

  describe("1NT response to 1M", () => {
    it("SAYC: infers 6–10 HCP", () => {
      const provider = createNaturalInferenceProvider(SAYC_SYSTEM_CONFIG);
      const auction = auctionAfter1MOpening(Seat.North);
      const result = provider.inferFromBid(response1NT(Seat.South), auction, Seat.South);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.maxHcp).toBe(10);
    });

    it("2/1: infers 6–12 HCP", () => {
      const provider = createNaturalInferenceProvider(TWO_OVER_ONE_SYSTEM_CONFIG);
      const auction = auctionAfter1MOpening(Seat.North);
      const result = provider.inferFromBid(response1NT(Seat.South), auction, Seat.South);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.maxHcp).toBe(12);
    });

    it("Acol: infers 6–9 HCP", () => {
      const provider = createNaturalInferenceProvider(ACOL_SYSTEM_CONFIG);
      const auction = auctionAfter1MOpening(Seat.North);
      const result = provider.inferFromBid(response1NT(Seat.South), auction, Seat.South);
      expect(result).not.toBeNull();
      expect(result!.minHcp).toBe(6);
      expect(result!.maxHcp).toBe(9);
    });
  });
});
