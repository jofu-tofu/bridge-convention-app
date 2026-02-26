import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid } from "../../../engine/types";
import { registerConvention, clearRegistry } from "../../core/registry";
import { saycConfig } from "../../definitions/sayc";
import { hand } from "../fixtures";
import { callFromRules } from "./helpers";

beforeEach(() => {
  clearRegistry();
  registerConvention(saycConfig);
});

describe("SAYC responses to 1-level suit openings", () => {
  test("raise 1H to 2H: 6-10 HCP, 3+ hearts", () => {
    // Partner (North) opened 1H, we (South) have 9 HCP 3 hearts
    const responder = hand(
      "SK", "S5", "S3", "S2",  // 4 spades, 3 HCP
      "HQ", "HJ", "H7",        // 3 hearts, 3 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 3 + 3 + 3 + 0 = 9 HCP. In 6-10 range.
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("raise 1S to 2S: 6-10 HCP, 3+ spades", () => {
    const responder = hand(
      "SQ", "SJ", "S7",        // 3 spades, 3 HCP
      "HK", "H5", "H3",        // 3 hearts, 3 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "C5", "C4", "C3", "C2",  // 4 clubs, 0 HCP
    );
    // 8 HCP
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1H over partner's minor: 6+ HCP, 4+ hearts", () => {
    const responder = hand(
      "S5", "S3", "S2",        // 3 spades, 0 HCP
      "HK", "HQ", "HJ", "H3", // 4 hearts, 6 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    const result = callFromRules(responder, Seat.South, ["1D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1h-over-minor");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("1S over partner's 1H: 6+ HCP, 4+ spades", () => {
    const responder = hand(
      "SA", "SK", "SQ", "S3",  // 4 spades, 10 HCP
      "H5", "H3", "H2",        // 3 hearts, 0 HCP
      "DK", "D5", "D3",        // 3 diamonds, 3 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 13 HCP, 4 spades
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1s-over-1h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("1NT response: 6-10 HCP, no fit, partner opened suit", () => {
    // 7 HCP, only 2 hearts (no 3+ support), no 4+ spades
    const responder = hand(
      "SK", "S5", "S3",        // 3 spades, 3 HCP
      "H5", "H3",              // 2 hearts, 0 HCP
      "DK", "D5", "D3", "D2", // 4 diamonds, 3 HCP
      "CJ", "C5", "C3", "C2", // 4 clubs, 1 HCP
    );
    // 7 HCP, 2 hearts — can't raise 1H, no 4+ spades to bid 1S
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(1);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});

describe("SAYC responses to 1NT", () => {
  test("Stayman: 8+ HCP, 4-card major after 1NT", () => {
    const responder = hand(
      "SK", "SQ", "SJ", "S3", // 4 spades, 6 HCP
      "HK", "H5", "H3",        // 3 hearts, 3 HCP
      "D5", "D3", "D2",        // 3 diamonds, 0 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 9 HCP, 4 spades
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt-stayman");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("Pass 1NT: 0-7 HCP", () => {
    const responder = hand(
      "SK", "S5", "S3", "S2",  // 4 spades, 3 HCP
      "H5", "H3", "H2",        // 3 hearts, 0 HCP
      "DQ", "D5", "D3",        // 3 diamonds, 2 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 5 HCP
    const result = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-1nt-pass");
    expect(result!.call.type).toBe("pass");
  });
});

describe("SAYC edge cases - responses", () => {
  test("sayc-respond-1nt-stayman does NOT fire after partner opens 2NT", () => {
    // 10 HCP, 4 hearts — would be Stayman after 1NT but NOT after 2NT
    const responder = hand(
      "SA", "S5", "S2",        // 3 spades, 4 HCP
      "HK", "HQ", "H6", "H2", // 4 hearts, 5 HCP
      "DJ", "D7", "D3",        // 3 diamonds, 1 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    // 10 HCP, 4 hearts — Stayman candidate
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    if (result) {
      expect(result.rule).not.toBe("sayc-respond-1nt-stayman");
    }
  });

  test("sayc-respond-1nt-pass does NOT fire after partner opens 2NT", () => {
    // 5 HCP — would pass 1NT but should not match 1NT-pass rule after 2NT
    const responder = hand(
      "S8", "S5", "S2",        // 3 spades, 0 HCP
      "HK", "HQ", "H6", "H2", // 4 hearts, 5 HCP
      "DT", "D7", "D3",        // 3 diamonds, 0 HCP
      "C5", "C3", "C2",        // 3 clubs, 0 HCP
    );
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    if (result) {
      expect(result.rule).not.toBe("sayc-respond-1nt-pass");
    }
  });

  test("jump raise major: 10-12 HCP, 4+ trump support", () => {
    // After partner opens 1H, respond 3H with 10-12 HCP and 4+ hearts
    // K(3)+Q(2) spades + K(3)+J(1) hearts + Q(2) diamonds = 11 HCP
    const responder = hand(
      "SK", "SQ", "S5",
      "HK", "HJ", "H7", "H3",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-jump-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("game raise major: 13+ HCP, 4+ trump support", () => {
    // After partner opens 1S, respond 4S with 13+ HCP and 4+ spades
    // A(4)+K(3) spades + A(4) hearts + K(3) diamonds = 14 HCP
    const responder = hand(
      "SA", "SK", "S7", "S3",
      "HA", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C3", "C2",
    );
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-game-raise-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("new suit at 2-level: 2C over partner's major, 12+ HCP", () => {
    // After partner opens 1H, bid 2C with 12+ HCP and 4+ clubs
    // A(4)+K(3) spades + J(1) hearts + Q(2) diamonds + K(3) clubs = 13 HCP
    const responder = hand(
      "SA", "SK", "S5",
      "HJ", "H5", "H3",
      "DQ", "D5", "D3",
      "CK", "C7", "C5", "C3",
    );
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-2c-over-major");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("2NT response: 13-15 balanced, no fit", () => {
    // After partner opens 1D, bid 2NT with 13-15 balanced
    // A(4)+K(3) spades + Q(2)+J(1) hearts + J(1) diamonds + K(3) clubs = 14 HCP
    const responder = hand(
      "SA", "SK", "S5",
      "HQ", "HJ", "H5",
      "DJ", "D5", "D3",
      "CK", "C5", "C3", "C2",
    );
    const result = callFromRules(responder, Seat.South, ["1D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("sayc-respond-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });
});
