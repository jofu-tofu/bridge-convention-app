import { describe, test, expect, beforeEach } from "vitest";
import { Seat, BidSuit } from "../../engine/types";
import type { ContractBid } from "../../engine/types";
import { clearRegistry, registerConvention } from "../../conventions/registry";
import { staymanConfig } from "../../conventions/stayman";
import { hand, auctionFromBids } from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/types";
import { conventionToStrategy } from "../convention-strategy";

beforeEach(() => {
  clearRegistry();
  registerConvention(staymanConfig);
});

describe("conventionToStrategy", () => {
  test("returns BiddingStrategy with convention-prefixed id and name", () => {
    const strategy = conventionToStrategy(staymanConfig);
    expect(strategy.id).toBe("convention:stayman");
    expect(strategy.name).toBe("Stayman");
  });

  test("suggest returns BidResult for Stayman ask context", () => {
    const strategy = conventionToStrategy(staymanConfig);
    // Responder with 4 hearts, 13 HCP after 1NT-P
    const h = hand(
      "SK", "S5", "S2",
      "HA", "HK", "HQ", "H3",
      "D5", "D3", "D2",
      "C5", "C3", "C2",
    );
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
    // Hand with no 4-card major — no Stayman rule matches
    const h = hand(
      "SA", "S5", "S2",
      "HK", "H8", "H3",
      "DA", "DQ", "D7", "D4",
      "C5", "C3", "C2",
    );
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
    // Opener with 4 hearts after 1NT-P-2C-P
    const opener = hand(
      "SA", "SK", "S3",
      "HK", "HQ", "HJ", "H2",
      "DK", "D5", "D3",
      "C7", "C5", "C2",
    );
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
