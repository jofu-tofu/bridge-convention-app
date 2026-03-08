import { describe, test, expect, beforeEach } from "vitest";
import { Seat, Vulnerability } from "../../../engine/types";
import { evaluateHand } from "../../../engine/hand-evaluator";
import {
  registerConvention,
  clearRegistry,
  listConventions,
  getConventionRules,
} from "../../core/registry";
import { staymanConfig } from "../../definitions/stayman";
import { bergenConfig } from "../../definitions/bergen-raises";
import { saycConfig } from "../../definitions/sayc";
import { isConditionedRule } from "../../core/condition-evaluator";
import {
  conditionedRule,
  auctionMatches,
  hcpMin,
  suitMin,
  isVulnerable,
  isNotVulnerable,
  favorableVulnerability,
  unfavorableVulnerability,
  partnerBidMade,
  opponentBidMade,
} from "../../core/conditions";
import type { BiddingContext } from "../../core/types";
import { isAuctionCondition } from "../../core/tree-compat";
import { hand, auctionFromBids, makeBiddingContext } from "../fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(bergenConfig);
  registerConvention(saycConfig);
});

// ─── conditionedRule factory tests ─────────────────────────

describe("conditionedRule factory", () => {
  test("output has auctionConditions, handConditions, and conditions", () => {
    const rule = conditionedRule({
      name: "test-rule",
      auctionConditions: [auctionMatches(["1NT", "P"])],
      handConditions: [hcpMin(8)],
      call: () => ({ type: "pass" }),
    });
    expect(rule.auctionConditions).toHaveLength(1);
    expect(rule.handConditions).toHaveLength(1);
    expect(rule.conditions).toHaveLength(2);
  });

  test(".conditions equals [...auctionConditions, ...handConditions]", () => {
    const auction = auctionMatches(["1NT", "P"]);
    const hcp = hcpMin(8);
    const suit = suitMin(0, "spades", 4);
    const rule = conditionedRule({
      name: "test-rule",
      auctionConditions: [auction],
      handConditions: [hcp, suit],
      call: () => ({ type: "pass" }),
    });
    expect(rule.conditions[0]).toBe(auction);
    expect(rule.conditions[1]).toBe(hcp);
    expect(rule.conditions[2]).toBe(suit);
  });

  test("matches() returns false if auction condition fails", () => {
    const rule = conditionedRule({
      name: "test-rule",
      auctionConditions: [auctionMatches(["1NT", "P"])],
      handConditions: [hcpMin(0)], // always passes
      call: () => ({ type: "pass" }),
    });
    // Wrong auction
    const h = hand(
      "SA", "SK", "SQ", "SJ", "ST",
      "HA", "HK", "HQ",
      "DA", "DK",
      "CA", "CK", "CQ",
    );
    const ctx: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1H", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    expect(rule.matches(ctx)).toBe(false);
  });

  test("matches() returns false if hand condition fails", () => {
    const rule = conditionedRule({
      name: "test-rule",
      auctionConditions: [auctionMatches(["1NT", "P"])],
      handConditions: [hcpMin(40)], // never passes
      call: () => ({ type: "pass" }),
    });
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    const ctx: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    expect(rule.matches(ctx)).toBe(false);
  });

  test("empty auctionConditions and handConditions produces always-matching rule", () => {
    const rule = conditionedRule({
      name: "catch-all",
      auctionConditions: [],
      handConditions: [],
      call: () => ({ type: "pass" }),
    });
    const h = hand(
      "S8", "S5", "S2",
      "HK", "HQ", "H6", "H2",
      "DT", "D7", "D3",
      "C5", "C3", "C2",
    );
    const ctx: BiddingContext = {
      hand: h,
      auction: { entries: [], isComplete: false },
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };
    expect(rule.matches(ctx)).toBe(true);
    expect(rule.conditions).toHaveLength(0);
  });
});

// ─── Classification audit tests ───────────────────────────

describe("condition classification audit", () => {
  test("auctionConditions only contain known auction condition names", () => {
    const violations: string[] = [];
    const conventions = listConventions();

    for (const config of conventions) {
      for (const rule of getConventionRules(config.id)) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule;
        for (const cond of conditioned.auctionConditions) {
          if (!isAuctionCondition(cond)) {
            violations.push(`${config.id}/${rule.name}: "${cond.name}" in auctionConditions`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("no auction condition names appear in handConditions (except hybrid conditions)", () => {
    // Pure auction conditions (auctionMatches, isOpener, isResponder, etc.)
    // should never appear in handConditions — including negated (not-) and
    // prefix-matched (partner-opened-1H, partner-bid-3C) forms.
    // Hybrid conditions that embed auction checks are fine because they
    // ultimately gate on hand properties.
    const violations: string[] = [];
    const conventions = listConventions();

    for (const config of conventions) {
      for (const rule of getConventionRules(config.id)) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule;
        for (const cond of conditioned.handConditions) {
          if (isAuctionCondition(cond)) {
            violations.push(`${config.id}/${rule.name}: "${cond.name}" in handConditions`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("no handConditions have category 'auction'", () => {
    const violations: string[] = [];
    const conventions = listConventions();

    for (const config of conventions) {
      for (const rule of getConventionRules(config.id)) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule;
        for (const cond of conditioned.handConditions) {
          if (cond.category === "auction") {
            violations.push(`${config.id}/${rule.name}: "${cond.name}" has category:'auction' in handConditions`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test("no auctionCondition carries .inference metadata", () => {
    const violations: string[] = [];
    const conventions = listConventions();

    for (const config of conventions) {
      for (const rule of getConventionRules(config.id)) {
        if (!isConditionedRule(rule)) continue;
        const conditioned = rule;
        for (const cond of conditioned.auctionConditions) {
          if (cond.inference) {
            violations.push(`${config.id}/${rule.name}: "${cond.name}" has .inference in auctionConditions`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ─── Vulnerability condition factories ───────────────────

/** Helper to build a BiddingContext with specific vulnerability. */
function vulnContext(seat: Seat, vulnerability: Vulnerability | undefined): BiddingContext {
  const h = hand(
    "SA", "SK", "SQ", "SJ",
    "HA", "HK", "HQ",
    "DA", "DK",
    "CA", "CK", "CQ", "CJ",
  );
  return {
    hand: h,
    auction: { entries: [], isComplete: false },
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
    vulnerability,
  };
}

describe("isVulnerable", () => {
  test("South is vulnerable when NorthSouth", () => {
    expect(isVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.NorthSouth))).toBe(true);
  });

  test("South is NOT vulnerable when EastWest", () => {
    expect(isVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.EastWest))).toBe(false);
  });

  test("South is vulnerable when Both", () => {
    expect(isVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.Both))).toBe(true);
  });

  test("South is NOT vulnerable when None", () => {
    expect(isVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.None))).toBe(false);
  });

  test("South is NOT vulnerable when undefined (defaults to None)", () => {
    expect(isVulnerable(Seat.South).test(vulnContext(Seat.South, undefined))).toBe(false);
  });

  test("East is vulnerable when EastWest", () => {
    expect(isVulnerable(Seat.East).test(vulnContext(Seat.East, Vulnerability.EastWest))).toBe(true);
  });

  test("East is NOT vulnerable when NorthSouth", () => {
    expect(isVulnerable(Seat.East).test(vulnContext(Seat.East, Vulnerability.NorthSouth))).toBe(false);
  });

  test("has category hand", () => {
    expect(isVulnerable(Seat.South).category).toBe("hand");
  });
});

describe("isNotVulnerable", () => {
  test("South is NOT vulnerable when EastWest", () => {
    expect(isNotVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.EastWest))).toBe(true);
  });

  test("South IS vulnerable when NorthSouth — returns false", () => {
    expect(isNotVulnerable(Seat.South).test(vulnContext(Seat.South, Vulnerability.NorthSouth))).toBe(false);
  });

  test("South is NOT vulnerable when undefined (defaults to None)", () => {
    expect(isNotVulnerable(Seat.South).test(vulnContext(Seat.South, undefined))).toBe(true);
  });
});

describe("favorableVulnerability", () => {
  test("favorable when we are not vul, they are vul (South, EastWest)", () => {
    expect(favorableVulnerability().test(vulnContext(Seat.South, Vulnerability.EastWest))).toBe(true);
  });

  test("NOT favorable when we are vul (South, NorthSouth)", () => {
    expect(favorableVulnerability().test(vulnContext(Seat.South, Vulnerability.NorthSouth))).toBe(false);
  });

  test("NOT favorable when nobody is vul (None)", () => {
    expect(favorableVulnerability().test(vulnContext(Seat.South, Vulnerability.None))).toBe(false);
  });

  test("NOT favorable when both are vul", () => {
    expect(favorableVulnerability().test(vulnContext(Seat.South, Vulnerability.Both))).toBe(false);
  });

  test("favorable from East perspective (East, NorthSouth)", () => {
    expect(favorableVulnerability().test(vulnContext(Seat.East, Vulnerability.NorthSouth))).toBe(true);
  });
});

describe("unfavorableVulnerability", () => {
  test("unfavorable when we are vul, they are not (South, NorthSouth)", () => {
    expect(unfavorableVulnerability().test(vulnContext(Seat.South, Vulnerability.NorthSouth))).toBe(true);
  });

  test("NOT unfavorable when they are vul (South, EastWest)", () => {
    expect(unfavorableVulnerability().test(vulnContext(Seat.South, Vulnerability.EastWest))).toBe(false);
  });

  test("NOT unfavorable when nobody is vul (None)", () => {
    expect(unfavorableVulnerability().test(vulnContext(Seat.South, Vulnerability.None))).toBe(false);
  });

  test("NOT unfavorable when both are vul", () => {
    expect(unfavorableVulnerability().test(vulnContext(Seat.South, Vulnerability.Both))).toBe(false);
  });

  test("unfavorable from East perspective (East, EastWest)", () => {
    expect(unfavorableVulnerability().test(vulnContext(Seat.East, Vulnerability.EastWest))).toBe(true);
  });
});

// ─── Partnership-aware bid conditions ─────────────────────

import { BidSuit } from "../../../engine/types";

describe("partnerBidMade", () => {
  test("returns false when opponent (East) bid 1NT, evaluating as South", () => {
    // East opens 1NT — East is opponent of South
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1NT"],
      Seat.East,
    );
    expect(partnerBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  test("returns true when partner (North) bid 1NT, evaluating as South", () => {
    // North opens 1NT — North is partner of South
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1NT"],
      Seat.North,
    );
    expect(partnerBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(true);
  });

  test("works when evaluating as West (partner is East)", () => {
    // East opens 1NT — East is partner of West
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.West,
      ["1NT"],
      Seat.East,
    );
    expect(partnerBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(true);
  });

  test("returns false when nobody bid the specified level/strain", () => {
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1H"],
      Seat.North,
    );
    expect(partnerBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  test("has category auction", () => {
    expect(partnerBidMade(1, BidSuit.NoTrump).category).toBe("auction");
  });
});

describe("opponentBidMade", () => {
  test("returns true when opponent (East) bid 1NT, evaluating as South", () => {
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1NT"],
      Seat.East,
    );
    expect(opponentBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(true);
  });

  test("returns false when partner (North) bid 1NT, evaluating as South", () => {
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1NT"],
      Seat.North,
    );
    expect(opponentBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  test("works when evaluating as North (opponents are East/West)", () => {
    // East opens 1NT — East is opponent of North
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.North,
      ["1NT"],
      Seat.East,
    );
    expect(opponentBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(true);
  });

  test("returns false when nobody bid the specified level/strain", () => {
    const ctx = makeBiddingContext(
      hand("SA", "SK", "SQ", "SJ", "ST", "HA", "HK", "HQ", "DA", "DK", "CA", "CK", "CQ"),
      Seat.South,
      ["1H"],
      Seat.East,
    );
    expect(opponentBidMade(1, BidSuit.NoTrump).test(ctx)).toBe(false);
  });

  test("has category auction", () => {
    expect(opponentBidMade(1, BidSuit.NoTrump).category).toBe("auction");
  });
});
