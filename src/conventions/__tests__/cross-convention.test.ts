// Sources consulted:
// - All convention sources: bridgebum.com stayman, bergen_raises
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
import { bergenConfig } from "../definitions/bergen-raises";
import { weakTwosConfig } from "../definitions/weak-twos";
import { hand, makeBiddingContext } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(weakTwosConfig);
});

// ─── Stayman isolation ────────────────────────────────────────

describe("Stayman isolation", () => {
  test("[cross-convention] 8 HCP with 4-card major after 1NT-P: Stayman fires", () => {
    // 8 HCP, 4 spades — Stayman (8+) fires
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
    expect(staymanResult).not.toBeNull();
    expect(staymanResult!.rule).toBe("stayman-ask");
  });

  test("[cross-convention] 7 HCP with 4-card major: Stayman does not fire", () => {
    // 7 HCP, 4 hearts — below Stayman (8+)
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

  test("[cross-convention] Bergen hand after 1H-P: Bergen fires, Stayman returns null", () => {
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
  });
});

// ─── Weak Twos isolation ────────────────────────────────────

describe("Weak Twos isolation", () => {
  test("[cross-convention] Weak Two hand in Stayman auction: Weak Twos returns null", () => {
    // 8 HCP, 6 hearts — Weak Two shape, but auction is 1NT-P (Stayman context)
    // HK(3) + HQ(2) + DK(3) = 8 HCP
    const h = hand(
      "S5",
      "S3",
      "S2",
      "HK",
      "HQ",
      "HJ",
      "H7",
      "H5",
      "H3",
      "DK",
      "D2",
      "C5",
      "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT", "P"], Seat.North);

    expect(evaluateBiddingRules(ctx, weakTwosConfig)).toBeNull();
  });

  test("[cross-convention] Bergen hand in Weak Two auction: Bergen returns null", () => {
    // 8 HCP, 4 hearts — Bergen shape, but this is a Weak Two opening context
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
    // Weak Two opening context — South as opener, no prior bids
    const ctx = makeBiddingContext(h, Seat.South, [], Seat.South);

    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });
});

// ─── Cross-convention edge cases ──────────────────────────────

describe("Cross-convention edge cases", () => {
  test("Bergen game-raise hand in Stayman auction (1NT-P): Bergen returns null", () => {
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
});

// ─── All conventions registered simultaneously ────────────

describe("All conventions registered", () => {
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
  });

  test("[cross-convention invariant] 20 random deals per convention: no cross-convention false positives", () => {
    const conventions = [staymanConfig, bergenConfig];

    for (const activeConvention of conventions) {
      for (let i = 0; i < 20; i++) {
        const result = generateDeal(activeConvention.dealConstraints);
        const deal = result.deal;

        // Determine the correct seat and auction for this convention
        let seat: Seat;
        let bids: string[];
        let dealer: Seat;

        if (activeConvention.id === "bergen-raises") {
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
          // Stayman uses 1NT-P from North
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

          const otherResult = evaluateBiddingRules(
            ctx,
            otherConvention,
          );

          expect(otherResult).toBeNull();
        }
      }
    }
  });
});

// ─── Convention Auction Isolation ──────────────────────────────

describe("Convention auction isolation — conventions should not fire for each other's auctions", () => {
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

  test("after 1NT-P — Bergen does not fire (not after 1M)", () => {
    const ctx = makeBiddingContext(versatile, Seat.South, ["1NT", "P"], Seat.North);
    const result = evaluateBiddingRules(ctx, bergenConfig);
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
  const anyHand = hand(
    "SA", "SK", "SQ", "S7", "S2",
    "HK", "HQ", "H5", "H3",
    "DK",
    "C5", "C3", "C2",
  );

  test("all-pass auction — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["P", "P", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("empty auction — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, [], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("very long auction — no convention fires on unrecognized sequence", () => {
    const bids = ["1C", "P", "1D", "P", "1H", "P", "1S", "P", "1NT", "P", "2C", "P"];
    const ctx = makeBiddingContext(anyHand, Seat.South, bids, Seat.North);
    // This 12-bid auction doesn't match any convention's expected pattern
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });

  test("double then redouble — no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "X", "XX"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });
});

// ─── Cross-Convention — Same Hand Multiple Conventions ──────────

describe("Cross-convention — same hand qualifies for multiple conventions", () => {
  test("after 1H-P — Bergen fires but Stayman does not", () => {
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
  });
});

// ─── Multi-Round Sequence Integrity ─────────────────────────────

describe("Multi-round sequence integrity — conventions across 3+ rounds", () => {
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
    expect(rebidResult!.rule).toBe("stayman-rebid-major-fit-h");
    const call = rebidResult!.call as import("../../engine/types").ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
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
  const anyHand = hand(
    "SA", "SK", "SQ", "S7", "S2",
    "HK", "HQ", "H5", "H3",
    "DK",
    "C5", "C3", "C2",
  );

  test("3NT opening — Stayman does not fire (only 1NT/2NT)", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["3NT", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
  });

  test("only passes — no convention fires for any", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["P", "P"], Seat.East);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
    expect(evaluateBiddingRules(ctx, bergenConfig)).toBeNull();
  });

  test("1NT then 4 passes — auction is over, no convention fires", () => {
    const ctx = makeBiddingContext(anyHand, Seat.South, ["1NT", "P", "P", "P"], Seat.North);
    expect(evaluateBiddingRules(ctx, staymanConfig)).toBeNull();
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
});
