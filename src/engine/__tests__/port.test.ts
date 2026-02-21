import { describe, test, expect } from "vitest";
import { Seat, BidSuit, Suit, Vulnerability } from "../types";
import type { Auction, Contract, Trick } from "../types";
import type { EnginePort } from "../port";
import { TsEngine } from "../ts-engine";
import { hand, card } from "./fixtures";

const testHand = hand(
  "SA",
  "SK",
  "S3",
  "S2",
  "HK",
  "HJ",
  "H3",
  "DA",
  "D3",
  "D2",
  "C3",
  "C2",
  "C4",
); // 15 HCP balanced

describe("TsEngine", () => {
  test("is constructible and satisfies EnginePort", () => {
    const engine: EnginePort = new TsEngine();
    expect(engine).toBeDefined();
  });

  test("generateDeal returns a Deal with 4 hands of 13 cards", async () => {
    const engine = new TsEngine();
    const deal = await engine.generateDeal({ seats: [] });
    for (const seat of [Seat.North, Seat.East, Seat.South, Seat.West]) {
      expect(deal.hands[seat].cards).toHaveLength(13);
    }
  });

  test("evaluateHand returns HandEvaluation with correct HCP", async () => {
    const engine = new TsEngine();
    const result = await engine.evaluateHand(testHand);
    expect(result.hcp).toBe(15);
    expect(result.totalPoints).toBeGreaterThanOrEqual(15);
  });

  test("getSuitLength returns correct tuple", async () => {
    const engine = new TsEngine();
    const shape = await engine.getSuitLength(testHand);
    expect(shape).toEqual([4, 3, 3, 3]);
  });

  test("isBalanced returns true for balanced hand", async () => {
    const engine = new TsEngine();
    const balanced = await engine.isBalanced(testHand);
    expect(balanced).toBe(true);
  });

  // Phase 2 — Bidding (real implementations)
  test("getLegalCalls returns all 36 calls for empty auction", async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    const calls = await engine.getLegalCalls(auction, Seat.North);
    // Pass + 35 bids = 36
    expect(calls.length).toBe(36);
  });

  test("addCall appends a pass to empty auction", async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    const entry = { seat: Seat.North, call: { type: "pass" as const } };
    const result = await engine.addCall(auction, entry);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.call.type).toBe("pass");
  });

  test("isAuctionComplete returns false for empty auction", async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    expect(await engine.isAuctionComplete(auction)).toBe(false);
  });

  test("getContract returns null for passout", async () => {
    const engine = new TsEngine();
    const auction: Auction = {
      entries: [
        { seat: Seat.North, call: { type: "pass" } },
        { seat: Seat.East, call: { type: "pass" } },
        { seat: Seat.South, call: { type: "pass" } },
        { seat: Seat.West, call: { type: "pass" } },
      ],
      isComplete: true,
    };
    expect(await engine.getContract(auction)).toBeNull();
  });

  test("calculateScore returns positive for making contract", async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    // 4S making exact (10 tricks), not vulnerable
    const score = await engine.calculateScore(contract, 10, Vulnerability.None);
    expect(score).toBe(420); // 120 trick points + 300 game bonus
  });

  test("calculateScore returns negative for going down", async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    // 4S down 2, not vulnerable
    const score = await engine.calculateScore(contract, 8, Vulnerability.None);
    expect(score).toBe(-100); // 2 undertricks × 50
  });

  test("calculateScore handles NS-only vulnerability", async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    // South is NS, vulnerable: 4S making = 620 (120 + 500 vul game bonus)
    const score = await engine.calculateScore(contract, 10, Vulnerability.NorthSouth);
    expect(score).toBe(620);
  });

  test("calculateScore handles EW-only vulnerability", async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    // South is NS, EW vulnerable means declarer is NOT vulnerable
    const score = await engine.calculateScore(contract, 10, Vulnerability.EastWest);
    expect(score).toBe(420);
  });

  test("calculateScore handles Both vulnerability", async () => {
    const engine = new TsEngine();
    const contract: Contract = {
      level: 4,
      strain: BidSuit.Spades,
      doubled: false,
      redoubled: false,
      declarer: Seat.South,
    };
    // Both vulnerable: 4S making = 620
    const score = await engine.calculateScore(contract, 10, Vulnerability.Both);
    expect(score).toBe(620);
  });

  // Phase 2 — Play
  test("getLegalPlays returns all cards when leading", async () => {
    const engine = new TsEngine();
    const plays = await engine.getLegalPlays(testHand);
    expect(plays).toHaveLength(13);
  });

  test("getLegalPlays returns only follow-suit cards", async () => {
    const engine = new TsEngine();
    // testHand has 4 spades
    const plays = await engine.getLegalPlays(testHand, Suit.Spades);
    expect(plays).toHaveLength(4);
    expect(plays.every((c) => c.suit === Suit.Spades)).toBe(true);
  });

  test("getTrickWinner returns highest card of led suit in NT", async () => {
    const engine = new TsEngine();
    const trick: Trick = {
      plays: [
        { card: card("HK"), seat: Seat.North },
        { card: card("HA"), seat: Seat.East },
        { card: card("H2"), seat: Seat.South },
        { card: card("H3"), seat: Seat.West },
      ],
    };
    expect(await engine.getTrickWinner(trick)).toBe(Seat.East);
  });

  // V2 — DDS (still not available)
  test("solveDeal is not yet implemented", async () => {
    const engine = new TsEngine();
    const deal = await engine.generateDeal({ seats: [] });
    await expect(engine.solveDeal(deal)).rejects.toThrow();
  });

  test("suggestBid returns pass for null-returning strategy", async () => {
    const engine = new TsEngine();
    const auction: Auction = { entries: [], isComplete: false };
    const nullStrategy = { id: "test", name: "Test", suggest() { return null; } };
    const result = await engine.suggestBid(testHand, auction, Seat.North, nullStrategy);
    expect(result.call.type).toBe("pass");
  });

  test("suggestPlay is not yet implemented", async () => {
    const engine = new TsEngine();
    await expect(engine.suggestPlay(testHand, [], null, [])).rejects.toThrow();
  });
});
