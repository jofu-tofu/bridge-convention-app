import { describe, test, expect } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { staymanConfig } from "../../conventions/stayman";
import {
  staymanResponder,
  staymanOpener,
  noMajorHand,
  auctionFromBids,
} from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/types";
import { conventionToStrategy } from "../convention-strategy";

describe("conventionToStrategy", () => {
  test("returns BiddingStrategy with convention-prefixed id and name", () => {
    const strategy = conventionToStrategy(staymanConfig);
    expect(strategy.id).toBe("convention:stayman");
    expect(strategy.name).toBe("Stayman");
  });

  test("suggest returns BidResult for Stayman ask context", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = staymanResponder();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("bid");
    const bid = result!.call as ContractBid;
    expect(bid.level).toBe(2);
    expect(bid.strain).toBe(BidSuit.Clubs);
    expect(result!.ruleName).toBe("stayman-ask");
    expect(result!.explanation).toBeTruthy();
  });

  test("suggest returns null when no rule matches", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const h = noMajorHand();
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = strategy.suggest(context);
    expect(result).toBeNull();
  });

  test("suggest preserves rule metadata from evaluateBiddingRules", () => {
    const strategy = conventionToStrategy(staymanConfig);
    const opener = staymanOpener();
    const auction = auctionFromBids(Seat.North, ["1NT", "P", "2C", "P"]);
    const context: BiddingContext = {
      hand: opener,
      auction,
      seat: Seat.North,
      evaluation: evaluateHand(opener),
    };

    const result = strategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.ruleName).toBe("stayman-response-hearts");
    expect(result!.explanation).toContain("heart");
  });
});
