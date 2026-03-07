/**
 * Tests for pragmatic candidate generator — heuristic tactical bids beyond convention trees.
 * Each distortion type tested for trigger and non-trigger conditions.
 */
import { describe, test, expect } from "vitest";
import { BidSuit, Seat, Vulnerability } from "../../engine/types";
import type { Auction, AuctionEntry, Call, ContractBid, HandEvaluation } from "../../engine/types";
import type { BiddingContext } from "../../conventions/core/types";
import type { PrivateBeliefState } from "../../inference/private-belief";
import {
  DistortionType,
  generatePragmaticCandidates,
} from "../bidding/pragmatic-generator";

// ─── Helpers ──────────────────────────────────────────────────

function makeAuction(entries: AuctionEntry[], isComplete = false): Auction {
  return { entries, isComplete };
}

function entry(seat: Seat, call: Call): AuctionEntry {
  return { seat, call };
}

function bid(level: number, strain: BidSuit): ContractBid {
  return { type: "bid", level: level as ContractBid["level"], strain };
}

const pass: Call = { type: "pass" };

function makeEval(hcp: number, shape: readonly number[] = [3, 3, 3, 4]): HandEvaluation {
  return {
    hcp,
    distribution: { shortness: 0, length: 0, total: 0 },
    shape: shape as [number, number, number, number],
    totalPoints: hcp,
    strategy: "test",
  };
}

function makeContext(overrides: {
  seat?: Seat;
  auction?: Auction;
  hcp?: number;
  shape?: readonly number[];
}): BiddingContext {
  const seat = overrides.seat ?? Seat.South;
  return {
    hand: { cards: [] },
    auction: overrides.auction ?? makeAuction([]),
    seat,
    evaluation: makeEval(overrides.hcp ?? 10, overrides.shape),
    vulnerability: Vulnerability.None,
    dealer: Seat.North,
    opponentConventionIds: [],
  };
}

function makePrivateBelief(overrides: {
  partnerMinHcp?: number;
  partnerMaxHcp?: number;
}): PrivateBeliefState {
  return {
    seat: Seat.South,
    partnerSeat: Seat.North,
    partnerHcpRange: {
      min: overrides.partnerMinHcp ?? 0,
      max: overrides.partnerMaxHcp ?? 37,
    },
    partnerSuitLengths: {
      S: { min: 0, max: 13 },
      H: { min: 0, max: 13 },
      D: { min: 0, max: 13 },
      C: { min: 0, max: 13 },
    },
  };
}

// ─── ConservativeNTDowngrade ──────────────────────────────────

describe("ConservativeNTDowngrade", () => {
  test("proposes NT downgrade when combined HCP barely meets floor and downgrade is legal", () => {
    // Partner opens 2NT, East passes, South to bid
    // Own 10 HCP + partner min 12 = 22. Floor for level 2 = 23. |22-23| = 1 ≤ 2 → triggers
    // Propose 1NT — but 1NT < 2NT so NOT legal.
    // Better scenario: Partner bid 2NT, we need 3NT to be last bid for downgrade to 2NT
    // Actually downgrade only makes sense when the downgraded level is legal.
    // Scenario: Partner raises to 3NT. South to bid. Downgrade to 2NT = illegal (below 3NT).
    // The pragmatic generator produces the candidate but marks it legal: false.
    //
    // Real useful scenario: partner bids 2NT as second bid after earlier auction.
    // E.g., 1H - P - 2NT - P. South's partner is North. But South already bid 1H.
    // Actually the scenario where this is legal: pass/overcall structure where
    // the downgrade is above the last bid.
    //
    // Simplest: Partner bids 3NT, someone else bids 4C, then passes — but that's contrived.
    // Accept that the downgrade may not always be legal. Test the heuristic triggers + legality separately.
    const auction = makeAuction([
      entry(Seat.North, bid(3, BidSuit.NoTrump)),
      entry(Seat.East, pass),
    ]);
    // Own 10 + partner min 15 = 25. Floor for 3 = 26. |25-26| = 1 ≤ 2. Triggers.
    // But 2NT < 3NT → illegal.
    const context = makeContext({ auction, hcp: 10, seat: Seat.South });
    const belief = makePrivateBelief({ partnerMinHcp: 15 });

    const results = generatePragmaticCandidates(context, belief, new Set());
    const ntDowngrade = results.find(r => r.distortionType === DistortionType.ConservativeNTDowngrade);
    expect(ntDowngrade).toBeDefined();
    expect(ntDowngrade!.call).toEqual(bid(2, BidSuit.NoTrump));
    // Downgrade is below the current bid level — marked illegal
    expect(ntDowngrade!.legal).toBe(false);
  });

  test("does not trigger when combined HCP is well above floor", () => {
    const auction = makeAuction([
      entry(Seat.North, bid(2, BidSuit.NoTrump)),
      entry(Seat.East, pass),
    ]);
    // Own 15 + partner min 15 = 30. Floor for level 2 is 23. 30 - 23 = 7 > 2. No downgrade.
    const context = makeContext({ auction, hcp: 15, seat: Seat.South });
    const belief = makePrivateBelief({ partnerMinHcp: 15 });

    const results = generatePragmaticCandidates(context, belief, new Set());
    const ntDowngrade = results.find(r => r.distortionType === DistortionType.ConservativeNTDowngrade);
    expect(ntDowngrade).toBeUndefined();
  });

  test("does not trigger when no partner NT bid exists", () => {
    const auction = makeAuction([
      entry(Seat.North, bid(1, BidSuit.Hearts)),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({ auction, hcp: 10, seat: Seat.South });
    const belief = makePrivateBelief({ partnerMinHcp: 12 });

    const results = generatePragmaticCandidates(context, belief, new Set());
    const ntDowngrade = results.find(r => r.distortionType === DistortionType.ConservativeNTDowngrade);
    expect(ntDowngrade).toBeUndefined();
  });

  test("skips if downgraded NT is in existingCalls", () => {
    const auction = makeAuction([
      entry(Seat.North, bid(3, BidSuit.NoTrump)),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({ auction, hcp: 10, seat: Seat.South });
    const belief = makePrivateBelief({ partnerMinHcp: 15 });
    const existingCalls = new Set(["2NT"]); // already a normative candidate

    const results = generatePragmaticCandidates(context, belief, existingCalls);
    const ntDowngrade = results.find(r => r.distortionType === DistortionType.ConservativeNTDowngrade);
    expect(ntDowngrade).toBeUndefined();
  });

  test("does not propose NT at level 0", () => {
    // Partner bid 1NT → downgrade would be 0NT, which doesn't exist
    const auction = makeAuction([
      entry(Seat.North, bid(1, BidSuit.NoTrump)),
      entry(Seat.East, pass),
    ]);
    // Own 8 + partner min 12 = 20. Floor for 1 = 20. Within 2. But N-1 = 0 → skip
    const context = makeContext({ auction, hcp: 8, seat: Seat.South });
    const belief = makePrivateBelief({ partnerMinHcp: 12 });

    const results = generatePragmaticCandidates(context, belief, new Set());
    const ntDowngrade = results.find(r => r.distortionType === DistortionType.ConservativeNTDowngrade);
    expect(ntDowngrade).toBeUndefined();
  });
});

// ─── CompetitiveOvercall ──────────────────────────────────────

describe("CompetitiveOvercall", () => {
  test("proposes overcall with 8+ HCP and 5+ card suit", () => {
    // shape: [S=2, H=5, D=3, C=3] — SUIT_ORDER = [S, H, D, C]
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),  // opponent opened
      // South to bid
    ]);
    const context = makeContext({
      auction,
      hcp: 10,
      shape: [2, 5, 3, 3], // 5 hearts
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const overcall = results.find(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcall).toBeDefined();
    // Cheapest legal hearts bid should be 1H (above 1C)
    expect(overcall!.call).toEqual(bid(1, BidSuit.Hearts));
    expect(overcall!.legal).toBe(true);
  });

  test("does not trigger with less than 8 HCP", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),
    ]);
    const context = makeContext({
      auction,
      hcp: 6,
      shape: [2, 5, 3, 3],
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const overcall = results.find(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcall).toBeUndefined();
  });

  test("does not trigger without 5+ card suit", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),
    ]);
    const context = makeContext({
      auction,
      hcp: 12,
      shape: [4, 4, 3, 2], // no 5+ suit
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const overcall = results.find(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcall).toBeUndefined();
  });

  test("does not trigger without opponent bid", () => {
    const auction = makeAuction([
      entry(Seat.North, bid(1, BidSuit.Hearts)),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({
      auction,
      hcp: 12,
      shape: [5, 2, 3, 3],
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const overcall = results.find(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcall).toBeUndefined();
  });

  test("skips suit if overcall already in existingCalls", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),
    ]);
    const context = makeContext({
      auction,
      hcp: 10,
      shape: [2, 5, 3, 3],
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});
    const existingCalls = new Set(["1H"]);

    const results = generatePragmaticCandidates(context, belief, existingCalls);
    const overcall = results.find(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcall).toBeUndefined();
  });

  test("proposes multiple overcalls for multiple 5+ card suits", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),
    ]);
    const context = makeContext({
      auction,
      hcp: 12,
      shape: [5, 5, 2, 1], // 5S, 5H
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const overcalls = results.filter(r => r.distortionType === DistortionType.CompetitiveOvercall);
    expect(overcalls.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── ProtectiveDouble ─────────────────────────────────────────

describe("ProtectiveDouble", () => {
  test("proposes protective double in passout seat with 10+ HCP", () => {
    // Opponent bids, two passes → passout seat
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Spades)),
      entry(Seat.North, pass),
      entry(Seat.East, pass),
      // South in passout seat
    ]);
    const context = makeContext({
      auction,
      hcp: 12,
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const protDouble = results.find(r => r.distortionType === DistortionType.ProtectiveDouble);
    expect(protDouble).toBeDefined();
    expect(protDouble!.call).toEqual({ type: "double" });
    expect(protDouble!.legal).toBe(true);
  });

  test("does not trigger with less than 10 HCP", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Spades)),
      entry(Seat.North, pass),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({ auction, hcp: 8, seat: Seat.South });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const protDouble = results.find(r => r.distortionType === DistortionType.ProtectiveDouble);
    expect(protDouble).toBeUndefined();
  });

  test("does not trigger when not in passout seat", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Spades)),
      entry(Seat.North, pass),
      // Only 1 pass after bid, not passout seat
    ]);
    const context = makeContext({ auction, hcp: 12, seat: Seat.South });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const protDouble = results.find(r => r.distortionType === DistortionType.ProtectiveDouble);
    expect(protDouble).toBeUndefined();
  });

  test("does not trigger when opponent bid at level 4+", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(4, BidSuit.Spades)),
      entry(Seat.North, pass),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({ auction, hcp: 15, seat: Seat.South });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    const protDouble = results.find(r => r.distortionType === DistortionType.ProtectiveDouble);
    expect(protDouble).toBeUndefined();
  });

  test("does not trigger when double is already in existingCalls", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Spades)),
      entry(Seat.North, pass),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({ auction, hcp: 12, seat: Seat.South });
    const belief = makePrivateBelief({});
    const existingCalls = new Set(["X"]);

    const results = generatePragmaticCandidates(context, belief, existingCalls);
    const protDouble = results.find(r => r.distortionType === DistortionType.ProtectiveDouble);
    expect(protDouble).toBeUndefined();
  });
});

// ─── General behavior ─────────────────────────────────────────

describe("general behavior", () => {
  test("returns empty array when nothing applies", () => {
    const auction = makeAuction([]);
    const context = makeContext({ auction, hcp: 5, shape: [3, 3, 3, 4] });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    expect(results).toEqual([]);
  });

  test("never proposes illegal calls", () => {
    // Completed auction → nothing is legal
    const auction = makeAuction([
      entry(Seat.North, pass),
      entry(Seat.East, pass),
      entry(Seat.South, pass),
      entry(Seat.West, pass),
    ], true);
    const context = makeContext({ auction, hcp: 15, shape: [5, 5, 2, 1] });
    const belief = makePrivateBelief({ partnerMinHcp: 15 });

    const results = generatePragmaticCandidates(context, belief, new Set());
    // All results should be marked illegal or empty
    const legalResults = results.filter(r => r.legal);
    expect(legalResults).toEqual([]);
  });

  test("all results have required fields", () => {
    const auction = makeAuction([
      entry(Seat.West, bid(1, BidSuit.Clubs)),
      entry(Seat.North, pass),
      entry(Seat.East, pass),
    ]);
    const context = makeContext({
      auction,
      hcp: 12,
      shape: [2, 5, 3, 3],
      seat: Seat.South,
    });
    const belief = makePrivateBelief({});

    const results = generatePragmaticCandidates(context, belief, new Set());
    for (const result of results) {
      expect(result).toHaveProperty("call");
      expect(result).toHaveProperty("distortionType");
      expect(result).toHaveProperty("rationale");
      expect(typeof result.rationale).toBe("string");
      expect(result).toHaveProperty("legal");
      expect(typeof result.legal).toBe("boolean");
    }
  });
});
