import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { Hand } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import {
  registerConvention,
  clearRegistry,
  listConventions,
  getConventionRules,
} from "../registry";
import { staymanConfig } from "../stayman";
import { gerberConfig } from "../gerber";
import { bergenConfig } from "../bergen-raises";
import { dontConfig } from "../dont";
import { saycConfig } from "../sayc";
import { isConditionedRule } from "../condition-evaluator";
import {
  conditionedRule,
  auctionMatches,
  hcpMin,
  suitMin,
} from "../conditions";
import type { BiddingContext, ConditionedBiddingRule } from "../types";
import { isAuctionCondition } from "../tree-compat";
import { hand, auctionFromBids } from "./fixtures";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
  registerConvention(gerberConfig);
  registerConvention(bergenConfig);
  registerConvention(dontConfig);
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
        const conditioned = rule as ConditionedBiddingRule;
        for (const cond of conditioned.auctionConditions) {
          if (!isAuctionCondition(cond.name)) {
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
        const conditioned = rule as ConditionedBiddingRule;
        for (const cond of conditioned.handConditions) {
          if (isAuctionCondition(cond.name)) {
            violations.push(`${config.id}/${rule.name}: "${cond.name}" in handConditions`);
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
        const conditioned = rule as ConditionedBiddingRule;
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
