import { Seat, BidSuit } from "../../engine/types";
import { evaluateHand } from "../../engine/hand-evaluator";
import { bid } from "../core/rule-tree";
import type { BidNode } from "../core/rule-tree";
import type { RuleCondition, BiddingContext } from "../core/types";
import { hand } from "../../engine/__tests__/fixtures";
import { createBiddingContext } from "../core/context-factory";

export function alwaysTrue(name: string, category: "auction" | "hand" = "hand"): RuleCondition {
  return {
    name,
    label: `Always true: ${name}`,
    category,
    test: () => true,
    describe: () => `${name} passed`,
  };
}

export function alwaysFalse(name: string, category: "auction" | "hand" = "hand"): RuleCondition {
  return {
    name,
    label: `Always false: ${name}`,
    category,
    test: () => false,
    describe: () => `${name} failed`,
  };
}

export function staticBid(name: string, level: 1 | 2 | 3 | 4 | 5 | 6 | 7, strain: BidSuit): BidNode {
  return bid(name, `Test: ${name}`, () => ({ type: "bid", level, strain }));
}

/** 4=3=3=3 shape, 28 HCP, empty auction, South seat. */
export function makeMinimalContext(): BiddingContext {
  const h = hand("SA", "SK", "SQ", "SJ", "HA", "HK", "HQ", "DA", "DK", "D5", "CA", "CK", "C2");
  return createBiddingContext({
    hand: h,
    auction: { entries: [], isComplete: false },
    seat: Seat.South,
    evaluation: evaluateHand(h),
  });
}
