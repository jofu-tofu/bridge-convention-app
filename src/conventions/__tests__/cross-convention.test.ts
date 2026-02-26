// Sources consulted:
// - All convention sources: bridgebum.com stayman, gerber, bergen_raises, dont
// - Cross-convention isolation is a system design invariant, not a published bridge rule

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import { generateDeal } from "../../engine/deal-generator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../core/registry";
import { staymanConfig } from "../definitions/stayman";
import { gerberConfig } from "../definitions/gerber";
import { bergenConfig } from "../definitions/bergen-raises";
import { dontConfig } from "../definitions/dont";
import { landyConfig } from "../definitions/landy";
import { hand, makeBiddingContext } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(gerberConfig);
  registerConvention(bergenConfig);
  registerConvention(dontConfig);
  registerConvention(landyConfig);
});

// ─── Stayman vs Gerber after 1NT ────────────────────────────

describe("Stayman vs Gerber after 1NT", () => {
  test("[cross-convention] 16+ HCP with 4-card major: Stayman produces 2C, Gerber produces 4C", () => {
    // 16 HCP, 4 hearts — qualifies for both Stayman (8+ HCP, 4M) and Gerber (16+ HCP)
    // SA(4) + HK(3) + HQ(2) + HJ(1) + DK(3) + CK(3) = 16 HCP
    const h = hand(
      "SA",
      "S5",
      "S2",
      "HK",
      "HQ",
      "HJ",
      "H3",
      "DK",
      "D3",
      "D2",
      "CK",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    const staymanResult = evaluateBiddingRules(ctx, staymanConfig);
    const gerberResult = evaluateBiddingRules(ctx, gerberConfig);

    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
    expect(staymanResult!.call).toEqual({
      type: "bid",
      level: 2,
      strain: BidSuit.Clubs,
    });

    expect(gerberResult).not.toBeNull();
    expect(gerberResult!.rule).toBe("gerber-ask");
    expect(gerberResult!.call).toEqual({
      type: "bid",
      level: 4,
      strain: BidSuit.Clubs,
    });
  });

  test("[cross-convention] 8 HCP with 4-card major: only Stayman fires, Gerber returns null", () => {
    // 8 HCP, 4 spades — Stayman (8+) fires, Gerber (16+) does not
    const h = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "H5",
      "H3",
      "H2",
      "DK",
      "D5",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    const staymanResult = evaluateBiddingRules(ctx, staymanConfig);
    const gerberResult = evaluateBiddingRules(ctx, gerberConfig);

    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
    expect(gerberResult).toBeNull();
  });

  test("[cross-convention] 16+ HCP no 4-card major: only Gerber fires, Stayman returns null", () => {
    // 17 HCP, 3-3-4-3 shape (no 4-card major)
    // SA(4)+SK(3)+HA(4)+DK(3)+CK(3) = 17
    const h = hand(
      "SA",
      "SK",
      "S2",
      "HA",
      "H5",
      "H2",
      "DK",
      "D5",
      "D3",
      "D2",
      "CK",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    const staymanResult = evaluateBiddingRules(ctx, staymanConfig);
    const gerberResult = evaluateBiddingRules(ctx, gerberConfig);

    expect(staymanResult).toBeNull();
    expect(gerberResult).not.toBeNull();
    expect(gerberResult!.rule).toBe("gerber-ask");
  });

  test("[cross-convention] 7 HCP with 4-card major: neither Stayman nor Gerber fires", () => {
    // 7 HCP, 4 hearts — below Stayman (8+) and Gerber (16+)
    const h = hand(
      "S5",
      "S3",
      "S2",
      "HK",
      "HQ",
      "H5",
      "H2",
      "D5",
      "D3",
      "D2",
      "C5",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });
});

// ─── Bergen isolation ───────────────────────────────────────

describe("Bergen isolation", () => {
  test("[cross-convention] Bergen hand after 1NT-P: Bergen returns null (wrong auction)", () => {
    // 8 HCP, 4 hearts — Bergen hand, but auction is 1NT-P (not 1H-P)
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("[cross-convention] Bergen hand after 1H-P: Bergen fires, Stayman/Gerber return null", () => {
    // 8 HCP, 4 hearts — Bergen constructive raise after 1H
    // SQ(2) + DK(3) + CK(3) = 8 HCP, 4 hearts
    const h = hand(
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
      "CK",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);

    const bergenResult = evaluateBiddingRules(ctx, bergenConfig);
    expect(bergenResult).not.toBeNull();
    expect(bergenResult!.rule).toBe("bergen-constructive-raise");

    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });

  test("[cross-convention] Bergen hand after 1S-P: Bergen fires, others return null", () => {
    // 10 HCP, 4 spades — Bergen limit raise after 1S
    // SK(3) + SQ(2) + DK(3) + CQ(2) = 10 HCP, 4 spades
    const h = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "H5",
      "H3",
      "H2",
      "DK",
      "D7",
      "D3",
      "CQ",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1S", "P"], Seat.North);

    const bergenResult = evaluateBiddingRules(ctx, bergenConfig);
    expect(bergenResult).not.toBeNull();
    expect(bergenResult!.rule).toBe("bergen-limit-raise");

    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("[cross-convention] DONT hand in Bergen auction: DONT returns null", () => {
    // 10 HCP, 6 hearts — DONT single-suited hand, but auction is 1H-P (Bergen context)
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);

    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });
});

// ─── DONT seat isolation ────────────────────────────────────

describe("DONT seat isolation", () => {
  test("[cross-convention] DONT overcall after North's 1NT: DONT returns null (wrong seat/dealer)", () => {
    // DONT only triggers when East opens 1NT (dealer=East)
    // North opening 1NT uses dealer=North, so auction pattern differs
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    // DONT checks auctionMatchesExact(["1NT"]) — this passes because it only checks
    // the call sequence, not dealer. BUT DONT's deal constraints require East as dealer.
    // The rule-level check is auction-based, so let's verify rules don't match on the
    // wrong auction length. After North 1NT-P, there are 2 calls, DONT expects 1 call.
    // Actually auctionMatchesExact(["1NT"]) checks for exactly 1 entry.
    // ctx has ["1NT", "P"] = 2 entries, so auctionMatchesExact(["1NT"]) returns false!
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("[cross-convention] DONT overcall after East's 1NT: DONT fires correctly", () => {
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-double"); // 6 hearts, single-suited
  });

  test("[cross-convention] Stayman hand after East's 1NT: Stayman returns null", () => {
    // Stayman checks for ["1NT", "P"] which has 2 entries
    // After East's 1NT alone (1 entry), Stayman won't match
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });

  test("[cross-convention] Bergen hand in DONT auction: Bergen returns null", () => {
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("[cross-convention] Gerber hand in DONT auction: Gerber returns null", () => {
    const h = hand(
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
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });
});

// ─── Cross-convention edge cases ──────────────────────────────

describe("Cross-convention edge cases", () => {
  test("Bergen game-raise hand in Gerber auction (1NT-P): Bergen returns null", () => {
    // 14 HCP + 4 hearts — qualifies for Bergen game-raise, but auction is 1NT-P
    // SA(4) + SK(3) + HQ(2) + DK(3) + DQ(2) = 14 HCP, 4 hearts
    const bergenGameHand = hand(
      "SA",
      "SK",
      "S2",
      "HQ",
      "HT",
      "H6",
      "H2",
      "DK",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    const ctx = makeBiddingContext(bergenGameHand, Seat.South, ["1NT", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("DONT hand shape in Bergen auction (1H-P): DONT returns null", () => {
    // 10 HCP, 6 hearts single-suited — DONT shape, but auction is 1H-P
    const dontShape = hand(
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
    const ctx = makeBiddingContext(dontShape, Seat.South, ["1H", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });
});

// ─── All 4 conventions registered simultaneously ────────────

describe("All 4 conventions registered", () => {
  test("[cross-convention] each convention's deal produces correct bids, others return null", () => {
    // Stayman context: 1NT-P, 10 HCP, 4 hearts
    // SA(4) + HK(3) + DK(3) = 10 HCP, 4 hearts
    const staymanHand = hand(
      "SA",
      "S5",
      "S2",
      "HK",
      "H5",
      "H4",
      "H3",
      "DK",
      "D3",
      "D2",
      "C5",
      "C3",
      "C2",
    );
    const staymanCtx = makeBiddingContext(staymanHand, Seat.South, [
      "1NT",
      "P",
    ], Seat.North);
    expect(
      evaluateBiddingRules(staymanCtx, staymanConfig),
    ).not.toBeNull();
    expect(
      evaluateBiddingRules(staymanCtx, bergenConfig),
    ).toBeNull();
    expect(
      evaluateBiddingRules(staymanCtx, dontConfig),
    ).toBeNull();

    // Bergen context: 1H-P, 8 HCP, 4 hearts
    // SQ(2) + DK(3) + CK(3) = 8 HCP, 4 hearts
    const bergenHand = hand(
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
      "CK",
      "C3",
      "C2",
    );
    const bergenCtx = makeBiddingContext(bergenHand, Seat.South, ["1H", "P"], Seat.North);
    expect(
      evaluateBiddingRules(bergenCtx, bergenConfig),
    ).not.toBeNull();
    expect(
      evaluateBiddingRules(bergenCtx, staymanConfig),
    ).toBeNull();
    expect(
      evaluateBiddingRules(bergenCtx, gerberConfig),
    ).toBeNull();
    expect(evaluateBiddingRules(bergenCtx, dontConfig)).toBeNull();

    // DONT context: 1NT (East dealer), 10 HCP, 6 hearts
    const dontHand = hand(
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
    const dontCtx = makeBiddingContext(
      dontHand,
      Seat.South,
      ["1NT"],
      Seat.East,
    );
    expect(
      evaluateBiddingRules(dontCtx, dontConfig),
    ).not.toBeNull();
    expect(
      evaluateBiddingRules(dontCtx, staymanConfig),
    ).toBeNull();
    expect(evaluateBiddingRules(dontCtx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(dontCtx, bergenConfig)).toBeNull();
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
          if (
            auction &&
            auction.entries.length >= 1 &&
            auction.entries[0]!.call.type === "bid"
          ) {
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
        const activeResult = evaluateBiddingRules(
          ctx,
          activeConvention,
        );

        // The active convention should produce a result in most cases.
        // Bergen may not match if responder has 4+ in the wrong major (e.g., 4S after 1H).
        // Skip cross-convention check when active convention doesn't match.
        if (activeResult === null) continue;

        // Other conventions should NOT fire in this auction context
        for (const otherConvention of conventions) {
          if (otherConvention.id === activeConvention.id) continue;
          // Bergen and Stayman/Gerber are on different auction patterns, so they won't conflict
          // DONT uses single "1NT" entry vs Stayman/Gerber's "1NT-P" (2 entries), so they won't conflict
          const otherResult = evaluateBiddingRules(
            ctx,
            otherConvention,
          );

          // Stayman and Gerber can BOTH fire on 1NT-P context (different bids, same trigger)
          // This is NOT a conflict — they're independent conventions evaluated separately
          if (
            (activeConvention.id === "stayman" &&
              otherConvention.id === "gerber") ||
            (activeConvention.id === "gerber" &&
              otherConvention.id === "stayman")
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

// ─── Convention Auction Isolation ──────────────────────────────

describe("Convention auction isolation — conventions should not fire for each other's auctions", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);
    registerConvention(landyConfig);
  });

  // A hand that qualifies for multiple conventions
  const versatile = hand(
    "SA", "SK", "SQ", "S7", "S2",
    "HK", "HQ", "H5", "H3",
    "DK",
    "C5", "C3", "C2",
  );

  test("after 1H-P — Stayman does not fire (not after 1NT)", () => {
    const ctx = makeBiddingContext(versatile, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });

  test("after 1H-P — Gerber does not fire (not after NT)", () => {
    const ctx = makeBiddingContext(versatile, Seat.South, ["1H", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, gerberConfig);
    expect(result).toBeNull();
  });

  test("after 1NT-P — Bergen does not fire (not after 1M)", () => {
    const ctx = makeBiddingContext(versatile, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
    expect(result).toBeNull();
  });

  test("after 1NT-P — DONT does not fire (different auction shape)", () => {
    // DONT expects ["1NT"] only (South after East opens), not ["1NT", "P"]
    const ctx = makeBiddingContext(versatile, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("after 1NT (no pass) — Stayman does not fire (auction too short for ask)", () => {
    // Stayman needs ["1NT", "P"], just ["1NT"] is too short
    const ctx = makeBiddingContext(versatile, Seat.South, ["1NT"], Seat.North);
    const result = evaluateBiddingRules(ctx, staymanConfig);
    expect(result).toBeNull();
  });
});

// ─── General Robustness ─────────────────────────────────────

describe("General robustness — degenerate auctions", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);
    registerConvention(landyConfig);
  });

  const anyHand = hand(
    "SA", "SK", "SQ", "S7", "S2",
    "HK", "HQ", "H5", "H3",
    "DK",
    "C5", "C3", "C2",
  );

  test("all-pass auction — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["P", "P", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });

  test("empty auction — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, [], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });

  test("very long auction — no convention fires on unrecognized sequence", () => {
    const bids = ["1C", "P", "1D", "P", "1H", "P", "1S", "P", "1NT", "P", "2C", "P"];
    const ctx = makeBiddingContext(anyHand, Seat.South, bids, Seat.North);
    // This 12-bid auction doesn't match any convention's expected pattern
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });

  test("double then redouble — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "X", "XX"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });
});

// ─── Cross-Convention — Same Hand Multiple Conventions ──────────

describe("Cross-convention — same hand qualifies for multiple conventions", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);
    registerConvention(landyConfig);
  });

  test("16+ HCP, 4-card major, no void after 1NT-P — both Stayman and Gerber could apply", () => {
    // This hand qualifies for both Stayman ask (8+ HCP, 4M) and Gerber ask (16+ HCP, no void)
    // Each convention is evaluated independently
    // SA(4)+SK(3)+SQ(2)+HA(4)+HK(3) = 16 HCP, 4S + 2H
    const h = hand(
      "SA", "SK", "SQ", "S3",
      "HA", "HK", "H5",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    const staymanResult = evaluateBiddingRules(ctx, staymanConfig);
    const gerberResult = evaluateBiddingRules(ctx, gerberConfig);

    // Both should independently fire for this hand+auction
    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
    expect(gerberResult).not.toBeNull();
    expect(gerberResult!.rule).toBe("gerber-ask");
  });

  test("DONT and Landy — same auction position after 1NT, different bids", () => {
    // 12 HCP, 5S + 5H — qualifies for both DONT 2H (both majors) and Landy 2C
    // SA(4) + SK(3) + HK(3) + HQ(2) = 12 HCP
    const h = hand(
      "SA", "SK", "S7", "S5", "S3",
      "HK", "HQ", "H7", "H5", "H3",
      "D5", "D3",
      "C2",
    );
    const dontCtx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);
    const landyCtx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);

    const dontResult = evaluateBiddingRules(dontCtx, dontConfig);
    const landyResult = evaluateBiddingRules(landyCtx, landyConfig);

    // DONT bids 2H for both majors
    expect(dontResult).not.toBeNull();
    expect(dontResult!.rule).toBe("dont-2h");

    // Landy bids 2C for both majors
    expect(landyResult).not.toBeNull();
    expect(landyResult!.rule).toBe("landy-2c");

    // Different bids for same hand — conventions are correctly independent
    expect((dontResult!.call as import("../../engine/types").ContractBid).strain).toBe(BidSuit.Spades === BidSuit.Spades ? BidSuit.Hearts : BidSuit.Hearts);
    expect((landyResult!.call as import("../../engine/types").ContractBid).strain).toBe(BidSuit.Clubs);
  });

  test("after 1H-P — Bergen fires but Stayman/Gerber/DONT/Landy do not", () => {
    // 8 HCP, 4 hearts — Bergen responder
    const h = hand(
      "SQ", "S5", "S2",
      "HJ", "HT", "H6", "H2",
      "DK", "D7", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1H", "P"], Seat.North);

    expect(evaluateBiddingRules(ctx, bergenConfig)).not.toBeNull();
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });
});

// ─── Multi-Round Sequence Integrity ─────────────────────────────

describe("Multi-round sequence integrity — conventions across 3+ rounds", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
  });

  test("[bridgebum/stayman] full 3-round Stayman: 1NT-P-2C-P-2H-P -> 4H (fit + game)", () => {
    // Round 1: Responder asks
    const responder = hand(
      "SA", "S5", "S3",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const askCtx = makeBiddingContext(responder, Seat.South, ["1NT", "P"], Seat.North);
    const askResult = evaluateBiddingRules(askCtx, staymanConfig);
    expect(askResult).not.toBeNull();
    expect(askResult!.rule).toBe("stayman-ask");

    // Round 2: Opener responds 2H
    const opener = hand(
      "SK", "SQ", "S3",
      "HA", "HK", "HJ", "H2",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const respCtx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "2C", "P"], Seat.North);
    const respResult = evaluateBiddingRules(respCtx, staymanConfig);
    expect(respResult).not.toBeNull();
    expect(respResult!.rule).toBe("stayman-response-hearts");

    // Round 3: Responder bids 4H (fit + game)
    const rebidCtx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "2C", "P", "2H", "P"], Seat.North);
    const rebidResult = evaluateBiddingRules(rebidCtx, staymanConfig);
    expect(rebidResult).not.toBeNull();
    expect(rebidResult!.rule).toBe("stayman-rebid-major-fit");
    const call = rebidResult!.call as import("../../engine/types").ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/gerber] full 4-round Gerber: ask -> ace resp -> king ask -> king resp", () => {
    // Round 1: Responder asks 4C
    const responder = hand(
      "SA", "SK", "SQ", "S3",
      "HA", "HK", "H5",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const askCtx = makeBiddingContext(responder, Seat.South, ["1NT", "P"], Seat.North);
    const askResult = evaluateBiddingRules(askCtx, gerberConfig);
    expect(askResult).not.toBeNull();
    expect(askResult!.rule).toBe("gerber-ask");

    // Round 2: Opener responds (2 aces -> 4S)
    const opener = hand(
      "SQ", "SJ", "S3",
      "HQ", "HJ", "H7", "H2",
      "DA", "D7", "D4",
      "CA", "C7", "C4",
    );
    const respCtx = makeBiddingContext(opener, Seat.North, ["1NT", "P", "4C", "P"], Seat.North);
    const respResult = evaluateBiddingRules(respCtx, gerberConfig);
    expect(respResult).not.toBeNull();
    expect(respResult!.rule).toBe("gerber-response-two");

    // Round 3: Responder asks for kings (5C) — has 3+ aces total (3 own + 2 opener = 5)
    const kingAskCtx = makeBiddingContext(responder, Seat.South, ["1NT", "P", "4C", "P", "4S", "P"], Seat.North);
    const kingAskResult = evaluateBiddingRules(kingAskCtx, gerberConfig);
    expect(kingAskResult).not.toBeNull();
    expect(kingAskResult!.rule).toBe("gerber-king-ask");

    // Round 4: Opener responds with kings (2 kings -> 5S... but opener has 0 kings here)
    // Let's fix opener to have 1 king for a more interesting test
    const openerWithKing = hand(
      "SK", "SJ", "S3",
      "HQ", "HJ", "H7", "H2",
      "DA", "D7", "D4",
      "CA", "C7", "C4",
    );
    const kingRespCtx = makeBiddingContext(openerWithKing, Seat.North, ["1NT", "P", "4C", "P", "4S", "P", "5C", "P"], Seat.North);
    const kingRespResult = evaluateBiddingRules(kingRespCtx, gerberConfig);
    expect(kingRespResult).not.toBeNull();
    expect(kingRespResult!.rule).toBe("gerber-king-response-one");
    const kingCall = kingRespResult!.call as import("../../engine/types").ContractBid;
    expect(kingCall.level).toBe(5);
    expect(kingCall.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/bergen] full Bergen 3-round: 1H-P-3C-P-3D(try)-P-4H(accept)", () => {
    // Round 1: Responder bids 3C constructive (7-10 HCP, 4 hearts)
    // SK(3) + HJ(1) + DK(3) + CJ(1) = 8 HCP
    const responder = hand(
      "SK", "S5", "S2",
      "HJ", "HT", "H6", "H2",
      "DK", "D7", "D3",
      "CJ", "C3", "C2",
    );
    const respCtx = makeBiddingContext(responder, Seat.South, ["1H", "P"], Seat.North);
    const respResult = evaluateBiddingRules(respCtx, bergenConfig);
    expect(respResult).not.toBeNull();
    expect(respResult!.rule).toBe("bergen-constructive-raise");

    // Round 2: Opener bids 3D game try (14-16 HCP)
    // SA(4) + HA(4) + HK(3) + HQ(2) + DJ(1) = 14 HCP
    const opener = hand(
      "SA", "S5", "S2",
      "HA", "HK", "HQ", "H7", "H3",
      "DJ", "D3",
      "C5", "C3", "C2",
    );
    const openerCtx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3C", "P"], Seat.North);
    const openerResult = evaluateBiddingRules(openerCtx, bergenConfig);
    expect(openerResult).not.toBeNull();
    expect(openerResult!.rule).toBe("bergen-rebid-try-after-constructive");

    // Round 3: Responder with 9-10 HCP accepts game try -> 4H
    // SA(4) + HJ(1) + DK(3) + CJ(1) = 9 HCP
    const responder9 = hand(
      "SA", "S5", "S2",
      "HJ", "HT", "H6", "H2",
      "DK", "D7", "D3",
      "CJ", "C3", "C2",
    );
    const tryCtx = makeBiddingContext(responder9, Seat.South, ["1H", "P", "3C", "P", "3D", "P"], Seat.North);
    const tryResult = evaluateBiddingRules(tryCtx, bergenConfig);
    expect(tryResult).not.toBeNull();
    expect(tryResult!.rule).toBe("bergen-try-accept");
  });
});

// ─── Degenerate / Adversarial Auctions ──────────────────────────

describe("Degenerate auctions — adversarial or unusual patterns", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(staymanConfig);
    registerConvention(gerberConfig);
    registerConvention(bergenConfig);
    registerConvention(dontConfig);
    registerConvention(landyConfig);
  });

  const anyHand = hand(
    "SA", "SK", "SQ", "S7", "S2",
    "HK", "HQ", "H5", "H3",
    "DK",
    "C5", "C3", "C2",
  );

  test("two consecutive doubles — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "X"], Seat.East);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("3NT opening — Stayman does not fire (only 1NT/2NT)", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["3NT", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });

  test("3NT opening — Gerber does not fire (only 1NT/2NT)", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["3NT", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });

  test("2NT opening — DONT does not fire (DONT is only against 1NT)", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["2NT"], Seat.East);
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("2NT opening — Landy does not fire (Landy is only against 1NT)", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["2NT"], Seat.East);
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });

  test("only passes — no convention fires for any", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["P", "P"], Seat.East);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });

  test("1NT then 4 passes — auction is over, no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "P", "P", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, gerberConfig)).toBeNull();
  });

  test("opponent opens 1NT, partner passes, opponent's partner passes — DONT in balancing seat", () => {
    // 1NT-P-P — South in balancing seat after 1NT, both opponents passed
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "P", "P"], Seat.East);
    // DONT expects ["1NT"] only — 1NT-P-P doesn't match
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("interference mid-convention kills entire Stayman sequence", () => {
    // 1NT-P-2C-P-2D-2S(opp) — opponent bids in middle of Stayman round 3
    const h = hand(
      "SA", "SK", "S7", "S3",
      "HK", "HQ", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P", "2C", "P", "2D", "2S"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });

  test("interference mid-convention kills entire Bergen sequence", () => {
    // 1H-P-3C-3D(opp) — opponent bids after Bergen constructive
    const opener = hand(
      "SK", "S5", "S2",
      "HA", "HK", "HQ", "H7", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(opener, Seat.North, ["1H", "P", "3C", "3D"], Seat.North);
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("interference mid-DONT — opponent bids after advancer relay", () => {
    // 1NT-X-P-2C-2H(opp) — opponent interferes after relay
    const overcaller = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3",
      "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "2H"], Seat.East);
    expect(evaluateBiddingRules(ctx, dontConfig)).toBeNull();
  });

  test("interference mid-Landy — opponent doubles Landy 2C", () => {
    // 1NT-2C-X — opponent doubles the Landy bid
    const advancer = hand(
      "SQ", "SJ", "S7", "S5",
      "HK", "H8", "H5", "H3",
      "D7", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2C", "X"], Seat.East);
    expect(evaluateBiddingRules(ctx, landyConfig)).toBeNull();
  });
});
