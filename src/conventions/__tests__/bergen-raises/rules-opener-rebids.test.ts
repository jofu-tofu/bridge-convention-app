// Sources consulted:
// - bridgebum.com/bergen_raises.php [bridgebum/bergen]
// - ACBL Standard American Yellow Card [SAYC]

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { ContractBid, Hand } from "../../../engine/types";
import {
  calculateHcp,
  getSuitLength,
  evaluateHand,
} from "../../../engine/hand-evaluator";
import {
  registerConvention,
  clearRegistry,
  evaluateBiddingRules,
} from "../../core/registry";
import { bergenConfig } from "../../definitions/bergen-raises";
import type { BiddingContext } from "../../core/types";
import { hand, auctionFromBids } from "../fixtures";
import { refDescribe, policyDescribe } from "../../../test-support/tiers";

beforeEach(() => {
  clearRegistry();
  registerConvention(bergenConfig);
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
  return evaluateBiddingRules(context, bergenConfig);
}

// HCP reference: A=4, K=3, Q=2, J=1

// ─── Opener Rebids After Constructive ─────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — opener rebids after constructive (1M P 3C P)", () => {
  // Opener hands for North seat (12-21 HCP, 5+ hearts)
  // 18 HCP: SA(4) + HA(4) + HK(3) + HQ(2) + DK(3) + DQ(2) = 18
  const strongOpener = () =>
    hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "DQ",
      "C5",
      "C3",
      "C2",
    );

  // 15 HCP: SA(4) + HA(4) + HK(3) + HQ(2) + DQ(2) = 15
  const mediumOpener = () =>
    hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );

  // 13 HCP: SK(3) + HA(4) + HK(3) + HQ(2) + DJ(1) = 13
  const minOpener = () =>
    hand(
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DJ",
      "D3",
      "C5",
      "C3",
      "C2",
    );

  test("18 HCP opener bids 4H after 1H-P-3C-P (game)", () => {
    const opener = strongOpener();
    expect(calculateHcp(opener)).toBe(18);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-constructive");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("15 HCP opener bids 3D after 1H-P-3C-P (game try)", () => {
    const opener = mediumOpener();
    expect(calculateHcp(opener)).toBe(15);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-try-after-constructive");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Diamonds);
  });

  test("13 HCP opener passes after 1H-P-3C-P (signoff)", () => {
    const opener = minOpener();
    expect(calculateHcp(opener)).toBe(13);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-signoff-after-constructive");
    expect(result!.call.type).toBe("pass");
  });

  test("1S path: 18 HCP opener bids 4S after 1S-P-3C-P", () => {
    // SA(4) + SK(3) + SQ(2) + SJ(1) + S7 + HA(4) + DA(4) = 18, 5S
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S7",
      "HA",
      "H3",
      "DA",
      "D3",
      "C5",
      "C4",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(18);
    const result = callFromRules(opener, Seat.North, ["1S", "P", "3C", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-constructive");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

// ─── Opener Rebid HCP Boundaries (Constructive) ──────────────

policyDescribe("[policy]", "constructive rebid HCP boundaries: 16+ game, 14-15 try, 12-13 signoff", "Bergen Raises — constructive rebid HCP boundaries", () => {
  // Template: North opener with 5 hearts, varying HCP
  // 13 HCP → pass (12-13 range)
  test("boundary: 13 HCP opener passes after constructive (top of signoff)", () => {
    // SK(3) + HA(4) + HK(3) + HQ(2) + DJ(1) = 13
    const opener = hand(
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DJ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(13);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result!.rule).toBe("bergen-rebid-signoff-after-constructive");
  });

  test("boundary: 14 HCP opener bids 3D game try (bottom of try)", () => {
    // SK(3) + HA(4) + HK(3) + HQ(2) + DQ(2) = 14
    const opener = hand(
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(14);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result!.rule).toBe("bergen-rebid-try-after-constructive");
  });

  test("boundary: 16 HCP opener bids 3D game try (top of try)", () => {
    // SA(4) + HA(4) + HK(3) + HQ(2) + DK(3) = 16
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(16);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result!.rule).toBe("bergen-rebid-try-after-constructive");
  });

  test("boundary: 17 HCP opener bids 4H game (bottom of game)", () => {
    // SA(4) + HA(4) + HK(3) + HQ(2) + DK(3) + DJ(1) = 17
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "DJ",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(17);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3C", "P"]);
    expect(result!.rule).toBe("bergen-rebid-game-after-constructive");
  });
});

// ─── Game Try Continuation ───────────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — game try continuation (1M P 3C P 3D P)", () => {
  test("9 HCP responder accepts game try → 4H", () => {
    // HK(3) + HQ(2) + DK(3) + CJ(1) = 9 HCP, 4 hearts
    const responder = hand(
      "S8",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H6",
      "H2",
      "DK",
      "D7",
      "D3",
      "CJ",
      "C5",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(9);
    const result = callFromRules(responder, Seat.South, [
      "1H",
      "P",
      "3C",
      "P",
      "3D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-try-accept");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("8 HCP responder rejects game try → 3H", () => {
    // HK(3) + DK(3) + DQ(2) = 8 HCP, 4 hearts
    const responder = hand(
      "S8",
      "S5",
      "S2",
      "HK",
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
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, [
      "1H",
      "P",
      "3C",
      "P",
      "3D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-try-reject");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("7 HCP responder rejects game try → 3H (bottom of range)", () => {
    // HK(3) + HQ(2) + DJ(1) + CJ(1) = 7 HCP, 4 hearts
    const responder = hand(
      "S8",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H6",
      "H2",
      "DJ",
      "D7",
      "D3",
      "CJ",
      "C5",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(7);
    const result = callFromRules(responder, Seat.South, [
      "1H",
      "P",
      "3C",
      "P",
      "3D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-try-reject");
  });

  test("1S path: 9 HCP responder accepts → 4S", () => {
    // SK(3) + SQ(2) + DK(3) + CJ(1) = 9 HCP, 4 spades
    const responder = hand(
      "SK",
      "SQ",
      "S6",
      "S2",
      "H8",
      "H5",
      "H2",
      "DK",
      "D7",
      "D3",
      "CJ",
      "C5",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(9);
    const result = callFromRules(responder, Seat.South, [
      "1S",
      "P",
      "3C",
      "P",
      "3D",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-try-accept");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

// ─── Opener Rebids After Limit ───────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — opener rebids after limit (1M P 3D P)", () => {
  test("16 HCP opener bids 4H after limit raise (game)", () => {
    // SA(4) + HA(4) + HK(3) + HQ(2) + DK(3) = 16
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(16);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-limit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("13 HCP opener bids 3H after limit raise (signoff)", () => {
    // SK(3) + HA(4) + HK(3) + HQ(2) + DJ(1) = 13
    const opener = hand(
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DJ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(13);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-signoff-after-limit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("boundary: 14 HCP → signoff, 15 HCP → game", () => {
    // 14 HCP: SK(3) + HA(4) + HK(3) + HQ(2) + DQ(2) = 14
    const opener14 = hand(
      "SK",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener14)).toBe(14);
    const result14 = callFromRules(opener14, Seat.North, ["1H", "P", "3D", "P"]);
    expect(result14!.rule).toBe("bergen-rebid-signoff-after-limit");

    // 15 HCP: SA(4) + HA(4) + HK(3) + HQ(2) + DQ(2) = 15
    const opener15 = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener15)).toBe(15);
    const result15 = callFromRules(opener15, Seat.North, ["1H", "P", "3D", "P"]);
    expect(result15!.rule).toBe("bergen-rebid-game-after-limit");
  });

  test("1S path: 16 HCP opener bids 4S after 1S-P-3D-P", () => {
    // SA(4) + SK(3) + SQ(2) + SJ(1) + S7 + HA(4) + DQ(2) = 16, 5S
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S7",
      "HA",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C4",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(16);
    const result = callFromRules(opener, Seat.North, ["1S", "P", "3D", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-limit");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

// ─── Opener Rebids After Preemptive ──────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — opener rebids after preemptive (1M P 3M P)", () => {
  test("19 HCP opener bids 4H after 1H-P-3H-P (game)", () => {
    // SA(4) + SK(3) + HA(4) + HK(3) + HQ(2) + DK(3) = 19, 5H
    const opener = hand(
      "SA",
      "SK",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(19);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-preemptive");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("15 HCP opener passes after 1H-P-3H-P (signoff)", () => {
    // SA(4) + HA(4) + HK(3) + HQ(2) + DQ(2) = 15
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(15);
    const result = callFromRules(opener, Seat.North, ["1H", "P", "3H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-pass-after-preemptive");
    expect(result!.call.type).toBe("pass");
  });

  test("boundary: 17 HCP → pass, 18 HCP → game", () => {
    // 17 HCP: SA(4) + HA(4) + HK(3) + HQ(2) + DK(3) + DJ(1) = 17
    const opener17 = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DK",
      "DJ",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener17)).toBe(17);
    const result17 = callFromRules(opener17, Seat.North, ["1H", "P", "3H", "P"]);
    expect(result17!.rule).toBe("bergen-rebid-pass-after-preemptive");

    // 18 HCP: SA(4) + SK(3) + HA(4) + HK(3) + HQ(2) + DQ(2) = 18
    const opener18 = hand(
      "SA",
      "SK",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener18)).toBe(18);
    const result18 = callFromRules(opener18, Seat.North, ["1H", "P", "3H", "P"]);
    expect(result18!.rule).toBe("bergen-rebid-game-after-preemptive");
  });

  test("1S path: 19 HCP opener bids 4S after 1S-P-3S-P", () => {
    // SA(4) + SK(3) + SQ(2) + SJ(1) + S7 + HA(4) + HK(3) + DQ(2) = 19, 5S
    const opener = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "S7",
      "HA",
      "HK",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(19);
    const result = callFromRules(opener, Seat.North, ["1S", "P", "3S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-rebid-game-after-preemptive");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(4);
    expect(call.strain).toBe(BidSuit.Spades);
  });
});

// ─── Rebid Invariants ────────────────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — rebid invariants", () => {
  test("responder initial rules don't fire on 4-entry auctions", () => {
    // 8 HCP responder hand — would match constructive on 2-entry, but not on 4-entry
    const responder = hand(
      "S8",
      "S5",
      "S2",
      "HK",
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
    // South evaluating after "1H P 3C P" — responder already bid, not round 0
    const result = callFromRules(responder, Seat.South, ["1H", "P", "3C", "P"]);
    // Responder initial rules require auctionMatches(["1H","P"]) which won't match 4-entry
    expect(result).toBeNull();
  });

  test("opener rebid rules don't fire on 2-entry auctions", () => {
    // 18 HCP opener — would match game rebid on 4-entry, but not on 2-entry
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DA",
      "DK",
      "C5",
      "C3",
      "C2",
    );
    // North evaluating after just "1H P" — biddingRound(1) requires 1 prior bid but this is round 0
    const result = callFromRules(opener, Seat.North, ["1H", "P"]);
    // isOpener() passes but biddingRound(1) fails (opener at round 0)
    expect(result).toBeNull();
  });

  test("game try rules don't fire on 4-entry auctions (need 6-entry)", () => {
    // 9 HCP responder — would accept game try on 6-entry
    const responder = hand(
      "S8",
      "S5",
      "S2",
      "HK",
      "HQ",
      "H6",
      "H2",
      "DK",
      "D7",
      "D3",
      "CJ",
      "C5",
      "C2",
    );
    // Only 4 entries, not 6 — biddingRound(1) requires responder to have bid once already
    const result = callFromRules(responder, Seat.South, ["1H", "P", "3C", "P"]);
    expect(result).toBeNull();
  });
});

// ─── Acceptance Passes ───────────────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen Raises — acceptance passes (closing the auction)", () => {
  test("responder passes after opener bids game 4H (accept game)", () => {
    // 11 HCP limit hand, after 1H-P-3D-P-4H-P — South passes to close
    const responder = hand(
      "SA",
      "S5",
      "S2",
      "HK",
      "HJ",
      "H6",
      "H2",
      "DQ",
      "D7",
      "D3",
      "CJ",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(11);
    const result = callFromRules(responder, Seat.South, [
      "1H",
      "P",
      "3D",
      "P",
      "4H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-accept-game");
    expect(result!.call.type).toBe("pass");
  });

  test("responder passes after opener signs off 3H (accept signoff)", () => {
    // 11 HCP limit hand, after 1H-P-3D-P-3H-P — South passes
    const responder = hand(
      "SA",
      "S5",
      "S2",
      "HK",
      "HJ",
      "H6",
      "H2",
      "DQ",
      "D7",
      "D3",
      "CJ",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(11);
    const result = callFromRules(responder, Seat.South, [
      "1H",
      "P",
      "3D",
      "P",
      "3H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-accept-signoff");
    expect(result!.call.type).toBe("pass");
  });

  test("responder passes after opener bids 4S (spades path)", () => {
    // 8 HCP constructive, after 1S-P-3C-P-4S-P
    const responder = hand(
      "SK",
      "ST",
      "S6",
      "S2",
      "H8",
      "H5",
      "H2",
      "DK",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(8);
    const result = callFromRules(responder, Seat.South, [
      "1S",
      "P",
      "3C",
      "P",
      "4S",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-accept-game");
    expect(result!.call.type).toBe("pass");
  });

  test("opener passes after game try rejection 3H (accept try result)", () => {
    // 15 HCP opener, after 1H-P-3C-P-3D-P-3H-P — North passes to close
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(15);
    const result = callFromRules(opener, Seat.North, [
      "1H",
      "P",
      "3C",
      "P",
      "3D",
      "P",
      "3H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-opener-accept-after-try");
    expect(result!.call.type).toBe("pass");
  });

  test("opener passes after game try acceptance 4H (accept try result)", () => {
    // 15 HCP opener, after 1H-P-3C-P-3D-P-4H-P — North passes
    const opener = hand(
      "SA",
      "S5",
      "S2",
      "HA",
      "HK",
      "HQ",
      "H7",
      "H3",
      "DQ",
      "D3",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(opener)).toBe(15);
    const result = callFromRules(opener, Seat.North, [
      "1H",
      "P",
      "3C",
      "P",
      "3D",
      "P",
      "4H",
      "P",
    ]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-opener-accept-after-try");
    expect(result!.call.type).toBe("pass");
  });
});

// ─── Splinter Bids ────────────────────────────────────────────

refDescribe("[ref:bridgebum/bergen]", "Bergen splinter bids", () => {
  test("[bridgebum/bergen] 12+ HCP with singleton bids 3S after 1H (splinter)", () => {
    // 12 HCP, 4 hearts, singleton diamond: KQ=5, KQ=5, -=0, K=3 but need 12
    // A=4, Q=2: spades=6, K=3 Q=2: hearts=5... let's build carefully
    // SK SQ S5 S2 (5 HCP) + HK HJ H7 H3 (4 HCP) + D5 (0) + CQ C5 C3 (2 HCP) = 11
    // Need 12: SK SQ S5 S2 (5) + HK HQ H7 H3 (5) + D5 (0) + CJ C5 (1) = 11
    // SK SQ S5 (5) + HA HQ H7 H3 (6) + D5 (0) + C5 C3 C2 (0) = 11 -- nope
    // A=4 K=3 Q=2 J=1. Target 12 HCP, 4 hearts, singleton diamond, 13 cards
    // S: K Q 5 2 = 5 HCP, 4 cards. H: A J 7 3 = 5 HCP, 4 cards. D: 5 = 0, 1 card. C: Q 5 3 2 = 2, 4 cards. Total=12
    const responder = hand(
      "SK",
      "SQ",
      "S5",
      "S2",
      "HA",
      "HJ",
      "H7",
      "H3",
      "D5",
      "CQ",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(12);
    expect(getSuitLength(responder)[1]).toBe(4); // 4 hearts
    expect(getSuitLength(responder)[2]).toBe(1); // singleton diamond
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-splinter");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Spades);
  });

  test("[bridgebum/bergen] 13+ HCP with void bids 3H after 1S (splinter)", () => {
    // 13 HCP, 4 spades, void in clubs
    // S: A K 7 3 = 7 HCP, 4 cards. H: Q J 5 2 = 3 HCP, 4 cards. D: K 7 5 2 = 3 HCP, 4 cards. C: 5 = 0 HCP, 1 card. Total=13. But need void...
    // S: A K 7 3 = 7 HCP, 4 cards. H: Q J 5 = 3 HCP, 3 cards. D: K Q 7 5 2 = 5 HCP, 5 cards. C: (void) 0 cards. 4+3+5+0=12 cards -- need 13
    // S: A K 7 3 = 7 HCP, 4 cards. H: Q J 5 2 = 3 HCP, 4 cards. D: K 7 5 3 2 = 3 HCP, 5 cards. C: (void). 4+4+5=13 cards. 7+3+3=13 HCP ✓
    const responder = hand(
      "SA",
      "SK",
      "S7",
      "S3",
      "HQ",
      "HJ",
      "H5",
      "H2",
      "DK",
      "D7",
      "D5",
      "D3",
      "D2",
    );
    expect(calculateHcp(responder)).toBe(13);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    expect(getSuitLength(responder)[3]).toBe(0); // void clubs
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-splinter");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });

  test("[bridgebum/bergen] balanced 12 HCP without shortage bids limit raise, not splinter", () => {
    // 12 HCP, 4 hearts, balanced (no singleton/void)
    // S: K Q 5 = 5 HCP, 3 cards. H: K J 7 3 = 4 HCP, 4 cards. D: Q 5 3 = 2 HCP, 3 cards. C: J 5 3 = 1 HCP, 3 cards. Total=12
    const responder = hand(
      "SK",
      "SQ",
      "S5",
      "HK",
      "HJ",
      "H7",
      "H3",
      "DQ",
      "D5",
      "D3",
      "CJ",
      "C5",
      "C3",
    );
    expect(calculateHcp(responder)).toBe(12);
    expect(getSuitLength(responder)[1]).toBe(4); // 4 hearts
    // No suit with 0 or 1 cards
    const shape = getSuitLength(responder);
    expect(shape.every((s) => s >= 2)).toBe(true);
    const result = callFromRules(responder, Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-limit-raise");
  });

  test("[bridgebum/bergen] 15 HCP with shortage bids splinter over game raise", () => {
    // 15 HCP, 4 spades, singleton heart
    const responder = hand(
      "SA",
      "SK",
      "SQ",
      "S3",
      "H5",
      "DA",
      "DQ",
      "D7",
      "D5",
      "D2",
      "C5",
      "C3",
      "C2",
    );
    expect(calculateHcp(responder)).toBe(15);
    expect(getSuitLength(responder)[0]).toBe(4); // 4 spades
    expect(getSuitLength(responder)[1]).toBe(1); // singleton heart
    const result = callFromRules(responder, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
    expect(result!.rule).toBe("bergen-splinter");
    const call = result!.call as ContractBid;
    expect(call.level).toBe(3);
    expect(call.strain).toBe(BidSuit.Hearts);
  });
});
