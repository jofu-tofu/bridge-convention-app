/**
 * DONT edge case tests.
 *
 * Focus areas:
 * 1. Opponent interference — opponent bids/doubles instead of passing
 * 2. Advance after natural 2S (no relay available)
 * 3. Unusual hand shapes — single-suited, two-suited, balanced
 * 4. Overcaller reveal after relay
 * 5. Advance edge cases — bypass, support, relay for each overcall type
 */

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { dontConfig } from "../../definitions/dont";
import { hand, makeBiddingContext } from "../fixtures";

// ─── DONT — opponent interference ────────────────────────────

describe("DONT — opponent interference", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(dontConfig);
  });

  // 10 HCP, 5 hearts + 5 spades — both majors
  const overcaller = hand(
    "SA", "SK", "S7", "S5", "S3",
    "HK", "HQ", "H7", "H5", "H3",
    "D5", "D3",
    "C2",
  );

  test("DONT does NOT fire if opening was not 1NT", () => {
    // 1C instead of 1NT
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1C"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("DONT does NOT fire if opening was 2NT", () => {
    const ctx = makeBiddingContext(overcaller, Seat.South, ["2NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("DONT overcaller — works after 1NT from correct seat (East)", () => {
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2h"); // both majors
  });

  test("advancer — opponent bids after DONT overcall disrupts advance", () => {
    // 1NT - 2H - 2S(opponent) instead of 1NT - 2H - P
    // Advancer with 3 hearts
    const advancer = hand(
      "S5", "S3", "S2",
      "HJ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2H", "2S"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("advancer — opponent doubles after DONT overcall disrupts advance", () => {
    const advancer = hand(
      "S5", "S3", "S2",
      "HJ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2H", "X"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("advancer — opponent bids after DONT double disrupts relay", () => {
    // 1NT - X - 2D(opponent) instead of 1NT - X - P
    const advancer = hand(
      "S5", "S3", "S2",
      "HJ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "X", "2D"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("reveal — opponent bids after relay disrupts reveal", () => {
    // 1NT - X - P - 2C - 2D(opponent) instead of ...2C - P
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "2D"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("DONT does NOT fire if no bids yet (empty auction)", () => {
    const ctx = makeBiddingContext(overcaller, Seat.South, [], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });
});

describe("DONT — advance after natural 2S (no relay available)", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(dontConfig);
  });

  test("after 2S natural — advancer with 2+ spades passes", () => {
    const advancer = hand(
      "SJ", "S5",
      "HK", "H7", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2S", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
  });

  test("after 2S natural — advancer with <2 spades gets fallback (no next-step)", () => {
    // Only 1 spade — can't support, and there's no "next step" after 2S
    const advancer = hand(
      "S5",
      "HK", "H7", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2S", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull(); // fallback — convention doesn't cover this
  });
});

// ─── DONT — unusual hand shapes ────────────────────────────────

describe("DONT — unusual hand shapes [bridgebum/dont]", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(dontConfig);
  });

  test("6+ clubs single-suited — doubles (not 2C), clubs is higher-suit two-suited or single", () => {
    // 10 HCP, 6 clubs — single long suit means double
    // CA(4) + CK(3) + CQ(2) + DJ(1) = 10 HCP
    const overcaller = hand(
      "S5", "S3",
      "H5", "H3",
      "DJ", "D5", "D3",
      "CA", "CK", "CQ", "C7", "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    // 6+ clubs with no other 4+ suit = single long suit -> double
    expect(result!.rule).toBe("dont-double");
  });

  test("5C + 4D — clubs + higher suit = 2C", () => {
    // Actually clubs+higher means clubs + any suit above clubs (D, H, or S)
    // 10 HCP, 5C + 4D
    // CK(3) + CQ(2) + DA(4) + SJ(1) = 10 HCP
    const overcaller = hand(
      "SJ", "S5",
      "H5", "H3",
      "DA", "D7", "D5", "D3",
      "CK", "CQ", "C7", "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2c");
  });

  test("5D + 4H — diamonds + major = 2D", () => {
    // 10 HCP, 5D + 4H
    const overcaller = hand(
      "S5", "S3",
      "HK", "HQ", "H5", "H3",
      "DA", "DK", "D7", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2d");
  });

  test("5H + 4S — both majors = 2H", () => {
    const overcaller = hand(
      "SA", "SK", "S5", "S3",
      "HK", "HQ", "H7", "H5", "H3",
      "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2h");
  });

  test("5S + 4H — both majors = 2H (not 2S)", () => {
    // Even with spades longer, both majors -> 2H per DONT
    const overcaller = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HK", "H7", "H5", "H3",
      "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2h");
  });

  test("6S natural — bids 2S directly (weaker than X then rebid)", () => {
    // 10 HCP, 6 spades — not two-suited, not single-long-suit-clubs
    const overcaller = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3",
      "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-2s");
  });

  test("balanced 4-3-3-3 with enough HCP — no DONT bid (not suited)", () => {
    // 12 HCP, 4-3-3-3 balanced — no 5+ suit, no 6+ suit
    const h = hand(
      "SA", "SK", "SQ", "S3",
      "HK", "H5", "H3",
      "D5", "D4", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(h, Seat.South, ["1NT"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });
});

describe("DONT — overcaller reveal after relay [bridgebum/dont]", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(dontConfig);
  });

  test("reveal with 6+ hearts — bids 2H after 1NT-X-P-2C-P", () => {
    // Overcaller (South) doubled with 6+ hearts, advancer relayed 2C
    const overcaller = hand(
      "S5", "S3",
      "HA", "HK", "HQ", "H7", "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-reveal-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("reveal with 6+ diamonds — bids 2D after 1NT-X-P-2C-P", () => {
    const overcaller = hand(
      "S5", "S3",
      "H5", "H3",
      "DA", "DK", "DQ", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-reveal-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("reveal with 6+ clubs — passes (stay in 2C) after 1NT-X-P-2C-P", () => {
    const overcaller = hand(
      "S5", "S3",
      "H5", "H3",
      "D5", "D3",
      "CA", "CK", "CQ", "C7", "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-reveal-pass");
  });

  test("reveal with 6+ spades — bids 2S after 1NT-X-P-2C-P", () => {
    const overcaller = hand(
      "SA", "SK", "SQ", "S7", "S5", "S3",
      "H5", "H3",
      "DK", "D5",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(overcaller, Seat.South, ["1NT", "X", "P", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-reveal-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

describe("DONT — advance edge cases [bridgebum/dont]", () => {
  beforeEach(() => {
    clearRegistry();
    registerConvention(dontConfig);
  });

  test("advancer with 6+ spades after double — bids 2S directly (bypasses relay)", () => {
    const advancer = hand(
      "SK", "SQ", "SJ", "S7", "S5", "S3",
      "H5", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "X", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-long-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("advancer with 6+ hearts after double — bids 2H directly", () => {
    const advancer = hand(
      "S5", "S3",
      "HK", "HQ", "HJ", "H7", "H5", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "X", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-long-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("advancer with short suits after double — relays 2C", () => {
    // No 6+ suit — must relay to 2C
    const advancer = hand(
      "SK", "S5", "S3",
      "HQ", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "X", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("advancer after 2C: has 6+ spades — bypasses relay, bids 2S", () => {
    const advancer = hand(
      "SK", "SQ", "SJ", "S7", "S5", "S3",
      "H5", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-long-suit");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("advancer after 2C: 3+ clubs support — passes", () => {
    const advancer = hand(
      "S5", "S3",
      "H5", "H3",
      "DK", "D5", "D3",
      "CQ", "CJ", "C7", "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
  });

  test("advancer after 2C: no support, no 6+ suit — next step 2D", () => {
    // 2 clubs (<3, no support), no 6+ suit — should relay to next step
    const advancer = hand(
      "SK", "S5", "S3",
      "HQ", "H5", "H3",
      "DK", "D7", "D5", "D3", "D2",
      "C5", "C3",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2C", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("advancer after 2D: has 6+ spades — bypasses relay, bids 2S", () => {
    const advancer = hand(
      "SQ", "SJ", "S9", "S7", "S5", "S3",
      "H5", "H3",
      "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2D", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-long-suit");
  });

  test("advancer after 2D: 3+ diamond support — passes", () => {
    const advancer = hand(
      "S5", "S3",
      "H5", "H3",
      "DQ", "DJ", "D7", "D5", "D3",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2D", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
  });

  test("advancer after 2D: no support, no 6+ spades — next step 2H", () => {
    const advancer = hand(
      "SK", "S5", "S3",
      "HQ", "H5", "H3", "H2",
      "D5", "D3",
      "CK", "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2D", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("advancer after 2H: 3+ hearts support — passes", () => {
    const advancer = hand(
      "S5", "S3", "S2",
      "HQ", "H8", "H5",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2H", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
  });

  test("advancer after 2H: <3 hearts — bids 2S (prefer spades)", () => {
    const advancer = hand(
      "SK", "SQ", "S7", "S5", "S3",
      "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2H", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-next-step");
    const call = result!.call as import("../../../engine/types").ContractBid;
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("advancer after 2S: 2+ spades — passes", () => {
    const advancer = hand(
      "SJ", "S5",
      "HK", "H7", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2S", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("dont-advance-pass");
  });

  test("advancer after 2S: singleton spade — convention doesn't cover (null)", () => {
    const advancer = hand(
      "S5",
      "HK", "H7", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2S", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });

  test("advancer after 2S: void in spades — convention doesn't cover (null)", () => {
    const advancer = hand(
      "HK", "HQ", "H7", "H5", "H3",
      "DK", "D7", "D5", "D3",
      "C5", "C4", "C3", "C2",
    );
    const ctx = makeBiddingContext(advancer, Seat.North, ["1NT", "2S", "P"], Seat.East);
    const result = evaluateBiddingRules(ctx, dontConfig);
    expect(result).toBeNull();
  });
});
