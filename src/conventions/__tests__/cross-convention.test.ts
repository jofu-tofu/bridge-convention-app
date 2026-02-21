// Sources consulted:
// - All convention sources: bridgebum.com stayman, gerber, bergen_raises, dont
// - Cross-convention isolation is a system design invariant, not a published bridge rule

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { Hand } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { generateDeal } from "../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../registry";
import { staymanConfig } from "../stayman";
import { gerberConfig } from "../gerber";
import { bergenConfig } from "../bergen-raises";
import { dontConfig } from "../dont";
import type { BiddingContext } from "../types";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(gerberConfig);
  registerConvention(bergenConfig);
  registerConvention(dontConfig);
});

// ─── Helpers ────────────────────────────────────────────────

function makeBiddingContext(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
): BiddingContext {
  return {
    hand: h,
    auction: auctionFromBids(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
  };
}

// ─── Stayman vs Gerber after 1NT ────────────────────────────

describe("Stayman vs Gerber after 1NT", () => {
  test("[cross-convention] 13+ HCP with 4-card major: Stayman produces 2C, Gerber produces 4C", () => {
    // 13 HCP, 4 hearts — qualifies for both Stayman (8+ HCP, 4M) and Gerber (13+ HCP)
    // SA(4) + HK(3) + HQ(2) + HJ(1) + DK(3) = 13 HCP
    const h = hand("SA", "S5", "S2", "HK", "HQ", "HJ", "H3", "DK", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"]);

    const staymanResult = evaluateBiddingRules(staymanConfig.biddingRules, ctx);
    const gerberResult = evaluateBiddingRules(gerberConfig.biddingRules, ctx);

    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
    expect(staymanResult!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Clubs });

    expect(gerberResult).not.toBeNull();
    expect(gerberResult!.rule).toBe("gerber-ask");
    expect(gerberResult!.call).toEqual({ type: "bid", level: 4, strain: BidSuit.Clubs });
  });

  test("[cross-convention] 8 HCP with 4-card major: only Stayman fires, Gerber returns null", () => {
    // 8 HCP, 4 spades — Stayman (8+) fires, Gerber (13+) does not
    const h = hand("SK", "SQ", "S5", "S2", "H5", "H3", "H2", "DK", "D5", "D3", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"]);

    const staymanResult = evaluateBiddingRules(staymanConfig.biddingRules, ctx);
    const gerberResult = evaluateBiddingRules(gerberConfig.biddingRules, ctx);

    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
    expect(gerberResult).toBeNull();
  });

  test("[cross-convention] 13+ HCP no 4-card major: only Gerber fires, Stayman returns null", () => {
    // 14 HCP, 3-3-4-3 shape (no 4-card major)
    const h = hand("SA", "SK", "S2", "HA", "H5", "H2", "DK", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"]);

    const staymanResult = evaluateBiddingRules(staymanConfig.biddingRules, ctx);
    const gerberResult = evaluateBiddingRules(gerberConfig.biddingRules, ctx);

    expect(staymanResult).toBeNull();
    expect(gerberResult).not.toBeNull();
    expect(gerberResult!.rule).toBe("gerber-ask");
  });

  test("[cross-convention] 7 HCP with 4-card major: neither Stayman nor Gerber fires", () => {
    // 7 HCP, 4 hearts — below Stayman (8+) and Gerber (13+)
    const h = hand("S5", "S3", "S2", "HK", "HQ", "H5", "H2", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"]);

    expect(evaluateBiddingRules(staymanConfig.biddingRules, ctx)).toBeNull();
    expect(evaluateBiddingRules(gerberConfig.biddingRules, ctx)).toBeNull();
  });
});

// ─── Bergen isolation ───────────────────────────────────────

describe("Bergen isolation", () => {
  test("[cross-convention] Bergen hand after 1NT-P: Bergen returns null (wrong auction)", () => {
    // 8 HCP, 4 hearts — Bergen hand, but auction is 1NT-P (not 1H-P)
    const h = hand("SQ", "S5", "S2", "HJ", "HT", "H6", "H2", "DK", "D7", "D3", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"]);

    expect(evaluateBiddingRules(bergenConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] Bergen hand after 1H-P: Bergen fires, Stayman/Gerber return null", () => {
    // 8 HCP, 4 hearts — Bergen constructive raise after 1H
    // SQ(2) + DK(3) + CK(3) = 8 HCP, 4 hearts
    const h = hand("SQ", "S5", "S2", "HJ", "HT", "H6", "H2", "DK", "D7", "D3", "CK", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"]);

    const bergenResult = evaluateBiddingRules(bergenConfig.biddingRules, ctx);
    expect(bergenResult).not.toBeNull();
    expect(bergenResult!.rule).toBe("bergen-constructive-raise");

    expect(evaluateBiddingRules(staymanConfig.biddingRules, ctx)).toBeNull();
    expect(evaluateBiddingRules(gerberConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] Bergen hand after 1S-P: Bergen fires, others return null", () => {
    // 10 HCP, 4 spades — Bergen limit raise after 1S
    // SK(3) + SQ(2) + DK(3) + CQ(2) = 10 HCP, 4 spades
    const h = hand("SK", "SQ", "S5", "S2", "H5", "H3", "H2", "DK", "D7", "D3", "CQ", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"]);

    const bergenResult = evaluateBiddingRules(bergenConfig.biddingRules, ctx);
    expect(bergenResult).not.toBeNull();
    expect(bergenResult!.rule).toBe("bergen-limit-raise");

    expect(evaluateBiddingRules(staymanConfig.biddingRules, ctx)).toBeNull();
    expect(evaluateBiddingRules(gerberConfig.biddingRules, ctx)).toBeNull();
    expect(evaluateBiddingRules(dontConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] DONT hand in Bergen auction: DONT returns null", () => {
    // 10 HCP, 6 hearts — DONT single-suited hand, but auction is 1H-P (Bergen context)
    const h = hand("S5", "S3", "S2", "HA", "HK", "HQ", "HJ", "H7", "H3", "D5", "D2", "C5", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"]);

    expect(evaluateBiddingRules(dontConfig.biddingRules, ctx)).toBeNull();
  });
});

// ─── DONT seat isolation ────────────────────────────────────

describe("DONT seat isolation", () => {
  test("[cross-convention] DONT overcall after North's 1NT: DONT returns null (wrong seat/dealer)", () => {
    // DONT only triggers when East opens 1NT (dealer=East)
    // North opening 1NT uses dealer=North, so auction pattern differs
    const h = hand("S5", "S3", "S2", "HA", "HK", "HQ", "HJ", "H7", "H3", "D5", "D2", "C5", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    // DONT checks auctionMatchesExact(["1NT"]) — this passes because it only checks
    // the call sequence, not dealer. BUT DONT's deal constraints require East as dealer.
    // The rule-level check is auction-based, so let's verify rules don't match on the
    // wrong auction length. After North 1NT-P, there are 2 calls, DONT expects 1 call.
    // Actually auctionMatchesExact(["1NT"]) checks for exactly 1 entry.
    // ctx has ["1NT", "P"] = 2 entries, so auctionMatchesExact(["1NT"]) returns false!
    expect(evaluateBiddingRules(dontConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] DONT overcall after East's 1NT: DONT fires correctly", () => {
    const h = hand("S5", "S3", "S2", "HA", "HK", "HQ", "HJ", "H7", "H3", "D5", "D2", "C5", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    const result = evaluateBiddingRules(dontConfig.biddingRules, ctx);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double"); // 6 hearts, single-suited
  });

  test("[cross-convention] Stayman hand after East's 1NT: Stayman returns null", () => {
    // Stayman checks for ["1NT", "P"] which has 2 entries
    // After East's 1NT alone (1 entry), Stayman won't match
    const h = hand("SK", "S5", "S2", "HA", "HK", "HQ", "H3", "D5", "D3", "D2", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(staymanConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] Bergen hand in DONT auction: Bergen returns null", () => {
    const h = hand("SQ", "S5", "S2", "HJ", "HT", "H6", "H2", "DK", "D7", "D3", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(bergenConfig.biddingRules, ctx)).toBeNull();
  });

  test("[cross-convention] Gerber hand in DONT auction: Gerber returns null", () => {
    const h = hand("SA", "SK", "S5", "S2", "HA", "H3", "DK", "D5", "D3", "CQ", "C5", "C3", "C2");
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(gerberConfig.biddingRules, ctx)).toBeNull();
  });
});

// ─── Cross-convention edge cases ──────────────────────────────

describe("Cross-convention edge cases", () => {
  test("Bergen game-raise hand in Gerber auction (1NT-P): Bergen returns null", () => {
    // 14 HCP + 4 hearts — qualifies for Bergen game-raise, but auction is 1NT-P
    // SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14 HCP, 4 hearts
    const bergenGameHand = hand("SA", "SK", "S2", "HQ", "HT", "H6", "H2", "DK", "DQ", "D3", "C5", "C3", "C2");
    const ctx = makeBiddingContext(bergenGameHand, Seat.South, ["1NT", "P"]);
    expect(evaluateBiddingRules(bergenConfig.biddingRules, ctx)).toBeNull();
  });

  test("DONT hand shape in Bergen auction (1H-P): DONT returns null", () => {
    // 10 HCP, 6 hearts single-suited — DONT shape, but auction is 1H-P
    const dontShape = hand("S5", "S3", "S2", "HA", "HK", "HQ", "HJ", "H7", "H3", "D5", "D2", "C5", "C2");
    const ctx = makeBiddingContext(dontShape, Seat.South, ["1H", "P"]);
    expect(evaluateBiddingRules(dontConfig.biddingRules, ctx)).toBeNull();
  });
});

// ─── All 4 conventions registered simultaneously ────────────

describe("All 4 conventions registered", () => {
  test("[cross-convention] each convention's deal produces correct bids, others return null", () => {
    // Stayman context: 1NT-P, 10 HCP, 4 hearts
    // SA(4) + HK(3) + DK(3) = 10 HCP, 4 hearts
    const staymanHand = hand("SA", "S5", "S2", "HK", "H5", "H4", "H3", "DK", "D3", "D2", "C5", "C3", "C2");
    const staymanCtx = makeBiddingContext(staymanHand, Seat.South, ["1NT", "P"]);
    expect(evaluateBiddingRules(staymanConfig.biddingRules, staymanCtx)).not.toBeNull();
    expect(evaluateBiddingRules(bergenConfig.biddingRules, staymanCtx)).toBeNull();
    expect(evaluateBiddingRules(dontConfig.biddingRules, staymanCtx)).toBeNull();

    // Bergen context: 1H-P, 8 HCP, 4 hearts
    // SQ(2) + DK(3) + CK(3) = 8 HCP, 4 hearts
    const bergenHand = hand("SQ", "S5", "S2", "HJ", "HT", "H6", "H2", "DK", "D7", "D3", "CK", "C3", "C2");
    const bergenCtx = makeBiddingContext(bergenHand, Seat.South, ["1H", "P"]);
    expect(evaluateBiddingRules(bergenConfig.biddingRules, bergenCtx)).not.toBeNull();
    expect(evaluateBiddingRules(staymanConfig.biddingRules, bergenCtx)).toBeNull();
    expect(evaluateBiddingRules(gerberConfig.biddingRules, bergenCtx)).toBeNull();
    expect(evaluateBiddingRules(dontConfig.biddingRules, bergenCtx)).toBeNull();

    // DONT context: 1NT (East dealer), 10 HCP, 6 hearts
    const dontHand = hand("S5", "S3", "S2", "HA", "HK", "HQ", "HJ", "H7", "H3", "D5", "D2", "C5", "C2");
    const dontCtx = makeBiddingContext(dontHand, Seat.South, ["1NT"], Seat.East);
    expect(evaluateBiddingRules(dontConfig.biddingRules, dontCtx)).not.toBeNull();
    expect(evaluateBiddingRules(staymanConfig.biddingRules, dontCtx)).toBeNull();
    expect(evaluateBiddingRules(gerberConfig.biddingRules, dontCtx)).toBeNull();
    expect(evaluateBiddingRules(bergenConfig.biddingRules, dontCtx)).toBeNull();
  });

  test("[cross-convention invariant] 20 random deals per convention: no cross-convention false positives", () => {
    const conventions = [staymanConfig, gerberConfig, bergenConfig, dontConfig];

    for (const activeConvention of conventions) {
      for (let i = 0; i < 20; i++) {
        const result = generateDeal(activeConvention.dealConstraints);
        const deal = result.deal;

        // Determine the correct seat and auction for this convention
        let seat: Seat;
        let bids: string[];
        let dealer: Seat;

        if (activeConvention.id === "dont") {
          seat = Seat.South;
          bids = ["1NT"];
          dealer = Seat.East;
        } else if (activeConvention.id === "bergen-raises") {
          seat = Seat.South;
          const auction = activeConvention.defaultAuction?.(Seat.South, deal);
          // Extract the opening bid from the auction
          if (auction && auction.entries.length >= 1 && auction.entries[0]!.call.type === "bid") {
            const openBid = auction.entries[0]!.call;
            bids = [`${openBid.level}${openBid.strain}`, "P"];
          } else {
            bids = ["1H", "P"];
          }
          dealer = Seat.North;
        } else {
          // Stayman and Gerber both use 1NT-P from North
          seat = Seat.South;
          bids = ["1NT", "P"];
          dealer = Seat.North;
        }

        const ctx = makeBiddingContext(deal.hands[seat], seat, bids, dealer);
        const activeResult = evaluateBiddingRules(activeConvention.biddingRules, ctx);

        // The active convention should produce a result in most cases.
        // Bergen may not match if responder has 4+ in the wrong major (e.g., 4S after 1H).
        // Skip cross-convention check when active convention doesn't match.
        if (activeResult === null) continue;

        // Other conventions should NOT fire in this auction context
        for (const otherConvention of conventions) {
          if (otherConvention.id === activeConvention.id) continue;
          // Bergen and Stayman/Gerber are on different auction patterns, so they won't conflict
          // DONT uses single "1NT" entry vs Stayman/Gerber's "1NT-P" (2 entries), so they won't conflict
          const otherResult = evaluateBiddingRules(otherConvention.biddingRules, ctx);

          // Stayman and Gerber can BOTH fire on 1NT-P context (different bids, same trigger)
          // This is NOT a conflict — they're independent conventions evaluated separately
          if (
            (activeConvention.id === "stayman" && otherConvention.id === "gerber") ||
            (activeConvention.id === "gerber" && otherConvention.id === "stayman")
          ) {
            // Both may fire on 1NT-P — this is expected, not a false positive
            continue;
          }

          expect(otherResult).toBeNull();
        }
      }
    }
  });
});
