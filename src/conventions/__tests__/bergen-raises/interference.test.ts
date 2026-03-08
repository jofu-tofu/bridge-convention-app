// Bergen Raises interference tests.
// Bergen is OFF when opponent doubles or overcalls partner's 1M opening.
// Sources: bridgebum.com/bergen_raises.php

import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../../engine/types";
import type { Hand } from "../../../engine/types";
import {
  registerConvention,
  clearRegistry,
} from "../../core/registry";
import { bergenConfig } from "../../definitions/bergen-raises";
import { evaluateHand } from "../../../engine/hand-evaluator";
import { conventionToStrategy } from "../../../strategy/bidding/convention-strategy";
import type { BiddingContext } from "../../core/types";
import { hand, auctionFromBids } from "../fixtures";
import { computeDialogueState } from "../../core/dialogue/dialogue-manager";
import { baselineTransitionRules } from "../../core/dialogue/baseline-transitions";

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

function suggestCall(
  h: Hand,
  seat: Seat,
  bids: string[],
  dealer: Seat = Seat.North,
) {
  const ctx = makeBiddingContext(h, seat, bids, dealer);
  const strategy = conventionToStrategy(bergenConfig);
  return strategy.suggest(ctx);
}

// ─── Test hands ─────────────────────────────────────────────

// 8 HCP: SQ(2) + HJ(1) + HT(0) + DK(3) + DQ(2) = 8, 4 hearts
const constructiveHand = () =>
  hand("SQ", "S5", "S2", "HJ", "HT", "H6", "H2", "DK", "DQ", "D3", "C5", "C3", "C2");

// 11 HCP: SA(4) + HK(3) + HJ(1) + DQ(2) + CJ(1) = 11, 4 hearts
const _limitHand = () =>
  hand("SA", "S5", "S2", "HK", "HJ", "H6", "H2", "DQ", "D7", "D3", "CJ", "C3", "C2");

// 5 HCP: HK(3) + HQ(2) = 5, 4 hearts
const preemptiveHand = () =>
  hand("S8", "S5", "S2", "HK", "HQ", "H6", "H2", "DT", "D7", "D3", "C5", "C3", "C2");

// ─── Overlay activation tests ───────────────────────────────

describe("Bergen Raises — overlays: doubled", () => {
  test("Bergen OFF when opponent doubles 1H — constructive hand returns null", () => {
    const result = suggestCall(constructiveHand(), Seat.South, ["1H", "X"]);
    // Bergen is OFF: overlays suppress all Bergen intents after a double
    expect(result).toBeNull();
  });

  test("Bergen OFF when opponent doubles 1S — limit hand returns null", () => {
    // Need limit hand with 4 spades instead
    const limitSpades = hand("SK", "SQ", "S6", "S2", "HA", "H5", "H2", "DK", "DQ", "D3", "C5", "C3", "C2");
    const result = suggestCall(limitSpades, Seat.South, ["1S", "X"]);
    expect(result).toBeNull();
  });

  test("Bergen OFF when opponent doubles 1H — preemptive hand returns null", () => {
    const result = suggestCall(preemptiveHand(), Seat.South, ["1H", "X"]);
    expect(result).toBeNull();
  });
});

describe("Bergen Raises — overlays: overcalled", () => {
  test("Bergen OFF when opponent overcalls 1H — constructive hand returns null", () => {
    const result = suggestCall(constructiveHand(), Seat.South, ["1H", "1S"]);
    expect(result).toBeNull();
  });

  test("Bergen OFF when opponent overcalls 1H with 2C — returns null", () => {
    const result = suggestCall(constructiveHand(), Seat.South, ["1H", "2C"]);
    expect(result).toBeNull();
  });

  test("Bergen OFF when opponent overcalls 1S with 2H — returns null", () => {
    const limitSpades = hand("SK", "SQ", "S6", "S2", "HA", "H5", "H2", "DK", "DQ", "D3", "C5", "C3", "C2");
    const result = suggestCall(limitSpades, Seat.South, ["1S", "2H"]);
    expect(result).toBeNull();
  });

  test("Bergen OFF when opponent overcalls 1H with 2D — preemptive returns null", () => {
    const result = suggestCall(preemptiveHand(), Seat.South, ["1H", "2D"]);
    expect(result).toBeNull();
  });
});

describe("Bergen Raises — overlay only activates under interference", () => {
  test("Bergen fires normally after 1H-P (uncontested)", () => {
    const result = suggestCall(constructiveHand(), Seat.South, ["1H", "P"]);
    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 3, strain: BidSuit.Clubs });
  });

  test("Bergen fires normally after 1S-P (uncontested)", () => {
    const limitSpades = hand("SK", "SQ", "S6", "S2", "HA", "H5", "H2", "DK", "DQ", "D3", "C5", "C3", "C2");
    const result = suggestCall(limitSpades, Seat.South, ["1S", "P"]);
    expect(result).not.toBeNull();
  });
});

describe("Bergen Raises — dialogue state under interference", () => {
  test("opponent double sets competitionMode to Doubled", () => {
    const auction = auctionFromBids(Seat.North, ["1H", "X"]);
    const state = computeDialogueState(
      auction,
      bergenConfig.transitionRules!,
      baselineTransitionRules,
    );
    expect(state.competitionMode).toBe("doubled");
  });

  test("opponent overcall sets competitionMode to Overcalled", () => {
    const auction = auctionFromBids(Seat.North, ["1H", "1S"]);
    const state = computeDialogueState(
      auction,
      bergenConfig.transitionRules!,
      baselineTransitionRules,
    );
    expect(state.competitionMode).toBe("overcalled");
  });
});
