import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import {
  calculateHcp,
  getSuitLength,
  isBalanced,
} from "../../../engine/hand-evaluator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import type { BiddingContext } from "../../core/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { hand, auctionFromBids } from "../fixtures";
import { refDescribe, policyDescribe } from "../../../test-support/tiers";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
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
    opponentConventionIds: [],
  };
}

function callFromRules(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const context = makeBiddingContext(h, seat, bids, dealer);
  return evaluateBiddingRules(context, staymanConfig);
}

// ─── Edge Cases ─────────────────────────────────────────────

refDescribe("[ref:bridgebum/stayman]", "Stayman edge cases", () => {
  test("minimum HCP responder (exactly 8)", () => {
    const minResponder = hand(
      "SK",
      "SQ",
      "S8",
      "S3", // 5 HCP (4 spades)
      "HJ",
      "H8",
      "H5", // 1 HCP (3 hearts)
      "DT",
      "D9",
      "D4", // 0 HCP (3 diamonds)
      "CQ",
      "C5",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(minResponder)).toBe(8);
    const result = callFromRules(minResponder, Seat.South, ["1NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask");
  });

  test("minimum HCP opener (exactly 15)", () => {
    // 15 HCP, balanced, 4 hearts
    const minOpener = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "HQ",
      "H5",
      "H2", // 5 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(minOpener)).toBe(15);
    // Should still respond to Stayman ask
    const result = callFromRules(minOpener, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts");
  });

  test("maximum HCP opener (exactly 17)", () => {
    const maxOpener2 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HA",
      "HQ",
      "H5",
      "H2", // 6 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "CJ",
      "C3",
      "C2", // 1 HCP (3 clubs)
    );
    expect(calculateHcp(maxOpener2)).toBe(17);
    const result = callFromRules(maxOpener2, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
  });

  test("4-3-3-3 opener shape", () => {
    // Valid 1NT opener with 4-3-3-3
    const opener433 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "HQ",
      "HJ", // 6 HCP (3 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "CA",
      "C5",
      "C3",
      "C2", // 4 HCP (4 clubs)
    );
    // That's 4-3-3-3 (clubs, spades, hearts, diamonds)
    const shape = getSuitLength(opener433);
    expect(isBalanced(shape)).toBe(true);
    // No 4-card major in this hand: 3 spades, 3 hearts
    const result = callFromRules(opener433, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-denial");
  });

  test("4-4-3-2 opener shape", () => {
    // Valid 1NT opener with 4-4-3-2
    const opener442 = hand(
      "SA",
      "SK",
      "SQ",
      "S2", // 10 HCP (4 spades)
      "HK",
      "HQ",
      "H5",
      "H2", // 5 HCP (4 hearts)
      "D5",
      "D3", // 0 HCP (2 diamonds)
      "CK",
      "C5",
      "C2", // 3 HCP (3 clubs)
    );
    const shape = getSuitLength(opener442);
    expect(isBalanced(shape)).toBe(true);
    // Both majors — should show hearts first
    const result = callFromRules(opener442, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result!.rule).toBe("stayman-response-hearts");
  });

  test("5-3-3-2 opener (5-card minor OK)", () => {
    // Valid 1NT: 5 diamonds (minor is fine), 3-3-2 in others
    const opener532v2 = hand(
      "SA",
      "SK",
      "S2", // 7 HCP (3 spades)
      "HK",
      "H5", // 3 HCP (2 hearts)
      "DQ",
      "DJ",
      "D8",
      "D5",
      "D3", // 3 HCP (5 diamonds)
      "CQ",
      "C5",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(opener532v2)).toBe(15);
    const shape = getSuitLength(opener532v2);
    expect(isBalanced(shape)).toBe(true);
    // No 4-card major
    const result = callFromRules(opener532v2, Seat.North, [
      "1NT",
      "P",
      "2C",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-denial");
  });

  test("3 cards in both majors does NOT trigger Stayman", () => {
    // 18 HCP, 3-3-4-3 shape — no 4-card major despite high HCP
    const noMajor = hand(
      "SA",
      "SK",
      "SQ", // 9 HCP (3 spades)
      "HA",
      "HK",
      "H5", // 7 HCP (3 hearts)
      "DQ",
      "D7",
      "D5",
      "D3", // 2 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(noMajor)).toBe(18);
    const shape = getSuitLength(noMajor);
    expect(shape[0]).toBe(3); // spades
    expect(shape[1]).toBe(3); // hearts
    const result = callFromRules(noMajor, Seat.South, ["1NT", "P"]);
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });

  test("both majors with 2S response: responder bids 4S (spade fit)", () => {
    // Responder has 4H + 4S, opener shows 2S → fit in spades
    const responderBothMajors = hand(
      "SJ",
      "ST",
      "S9",
      "S3", // 1 HCP (4 spades)
      "HA",
      "HQ",
      "H9",
      "H3", // 6 HCP (4 hearts)
      "DA",
      "D4", // 4 HCP (2 diamonds)
      "CQ",
      "C9",
      "C3", // 2 HCP (3 clubs)
    );
    const result = callFromRules(responderBothMajors, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("responder bids 3H (invite) after opener shows 2H with 8-9 HCP heart fit", () => {
    // 9 HCP, 4 hearts — invitational, not game-forcing
    const inviteResponder = hand(
      "SK",
      "S5",
      "S2", // 3 HCP (3 spades)
      "HQ",
      "HJ",
      "HT",
      "H3", // 3 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-invite-h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("responder bids 3S (invite) after opener shows 2S with 8 HCP spade fit", () => {
    // 8 HCP, 4 spades — invitational
    const inviteResponder = hand(
      "SQ",
      "SJ",
      "ST",
      "S3", // 3 HCP (4 spades)
      "HK",
      "H5",
      "H2", // 3 HCP (3 hearts)
      "DQ",
      "D5",
      "D3", // 2 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(8);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-major-fit-invite-s");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("responder bids 2NT (invite) after 2D denial with 8-9 HCP", () => {
    // 9 HCP, 4 hearts — invitational after denial
    const inviteResponder = hand(
      "SK",
      "S5",
      "S2", // 3 HCP (3 spades)
      "HQ",
      "HJ",
      "HT",
      "H3", // 3 HCP (4 hearts)
      "DK",
      "D5",
      "D3", // 3 HCP (3 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite-d");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("responder bids 2NT (invite) after 2H with no heart fit and 9 HCP", () => {
    // 9 HCP, 4 spades no hearts — invitational after 2H shows no heart fit
    const inviteResponder = hand(
      "SQ",
      "SJ",
      "ST",
      "S3", // 3 HCP (4 spades)
      "H5",
      "H3",
      "H2", // 0 HCP (3 hearts)
      "DK",
      "DJ",
      "D3", // 4 HCP (3 diamonds)
      "CQ",
      "C4",
      "C2", // 2 HCP (3 clubs)
    );
    expect(calculateHcp(inviteResponder)).toBe(9);
    const result = callFromRules(inviteResponder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-invite-h");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(2);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("full denial sequence: 1NT-P-2C-P-2D-P-3NT completes", () => {
    // Responder with 4 hearts asks Stayman, opener denies, responder bids 3NT
    const responder = hand(
      "SQ",
      "S5",
      "S3", // 2 HCP (3 spades)
      "HA",
      "HQ",
      "HJ",
      "H2", // 8 HCP (4 hearts)
      "DQ",
      "D8",
      "D4", // 2 HCP (3 diamonds)
      "C9",
      "C3",
      "C6", // 0 HCP (3 clubs)
    );
    // Step 1: Ask
    const ask = callFromRules(responder, Seat.South, ["1NT", "P"]);
    expect(ask).not.toBeNull();
    expect(ask!.rule).toBe("stayman-ask");

    // Step 2: Denial already tested — just verify rebid
    const rebid = callFromRules(responder, Seat.South, [
      "1NT",
      "P",
      "2C",
      "P",
      "2D",
      "P",
    ]);
    expect(rebid).not.toBeNull();
    expect(rebid!.rule).toBe("stayman-rebid-no-fit-d");
    const call = rebid!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.NoTrump);
  });

  test("non-trigger: responder with no 4-card major does not invoke Stayman", () => {
    // Responder with 10 HCP but no 4-card major should not trigger stayman-ask
    const noMajorResponder = hand(
      "SA",
      "S5",
      "S2", // 4 HCP (3 spades)
      "HK",
      "H8",
      "H3", // 3 HCP (3 hearts)
      "DA",
      "DQ",
      "D7",
      "D4", // 6 HCP (4 diamonds)
      "C5",
      "C3",
      "C2", // 0 HCP (3 clubs)
    );
    expect(calculateHcp(noMajorResponder)).toBe(13);
    const result = callFromRules(noMajorResponder, Seat.South, ["1NT", "P"]);
    // Should return null (no matching Stayman rule) since no 4-card major
    if (result !== null) {
      expect(result.rule).not.toBe("stayman-ask");
    }
  });
});

// ─── Smolen after 2D denial [bridgebum/stayman] ───────────

refDescribe("[ref:bridgebum/stayman]", "Stayman Smolen bids after 2D denial", () => {
  test("[bridgebum/stayman] 3H Smolen: 4S+5H GF after 2D denial", () => {
    // 10+ HCP, 4 spades + 5 hearts, game-forcing
    // K(3)+Q(2) spades = 5, A(4)+J(1) hearts = 5, Q(2) diamonds = 2 → 12 HCP
    const responder = hand(
      "SK", "SQ", "S7", "S3",
      "HA", "HJ", "H7", "H5", "H3",
      "DQ", "D5",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    expect(getSuitLength(responder)[1]).toBe(5); // 5 hearts
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-hearts");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/stayman] 3S Smolen: 5S+4H GF after 2D denial", () => {
    // 10+ HCP, 5 spades + 4 hearts, game-forcing
    // A(4)+K(3)+Q(2) spades = 9, J(1) hearts = 1, K(3) diamonds = 3 → 13 HCP
    const responder = hand(
      "SA", "SK", "SQ", "S7", "S3",
      "HJ", "H7", "H5", "H3",
      "DK", "D5",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(13);
    expect(getSuitLength(responder)[0]).toBe(5); // 5 spades
    expect(getSuitLength(responder)[1]).toBe(4); // 4 hearts
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-smolen-spades");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/stayman] no Smolen with 4-4: bids 3NT after 2D denial", () => {
    // 10+ HCP, 4 spades + 4 hearts (not 5-4), no Smolen — just 3NT
    // A(4)+K(3) spades = 7, Q(2) hearts = 2, K(3) diamonds = 3 → 12 HCP
    const responder = hand(
      "SA", "SK", "S7", "S3",
      "HQ", "H7", "H5", "H3",
      "DK", "D5", "D3",
      "C5", "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    const result = callFromRules(responder, Seat.South, [
      "1NT", "P", "2C", "P", "2D", "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-rebid-no-fit-d");
  });
});

// ─── Stayman after 2NT opening [bridgebum/stayman] ────────

refDescribe("[ref:bridgebum/stayman]", "Stayman after 2NT opening", () => {
  test("[bridgebum/stayman] 3C Stayman ask after 2NT-P", () => {
    // 5+ HCP with 4-card major after 2NT opening
    // K(3)+Q(2) spades = 5, J(1) hearts = 1, Q(2) diamonds = 2 → 8 HCP
    const responder = hand(
      "SK", "SQ", "S7", "S3",
      "HJ", "H5", "H3",
      "DQ", "D5", "D3",
      "C5", "C3", "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    const result = callFromRules(responder, Seat.South, ["2NT", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-ask-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Clubs);
  });

  test("[bridgebum/stayman] opener responds 3H after 2NT-P-3C-P", () => {
    // Opener with 4 hearts responds 3H
    // A(4)+K(3) spades + K(3)+Q(2)+J(1) hearts + A(4)+K(3) diamonds = 20 HCP
    const opener = hand(
      "SA", "SK", "S5",
      "HK", "HQ", "HJ", "H3",
      "DA", "DK", "D5",
      "C5", "C3", "C2",
    );
    expect(getSuitLength(opener)[1]).toBe(4); // 4 hearts
    const result = callFromRules(opener, Seat.North, ["2NT", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("stayman-response-hearts-2nt");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});
