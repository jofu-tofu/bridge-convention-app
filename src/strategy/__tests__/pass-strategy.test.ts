import { describe, test, expect } from "vitest";
import { Seat } from "../../engine/types";
import { hand, auctionFromBids } from "../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import type { BiddingContext } from "../../conventions/core/types";
import { passStrategy } from "../bidding/pass-strategy";

describe("passStrategy", () => {
  test("has correct id and name", () => {
    expect(passStrategy.id).toBe("pass");
    expect(passStrategy.name).toBe("Always Pass");
  });

  test("always returns BidResult with pass call", () => {
    const h = hand(
      "SA",
      "SK",
      "SQ",
      "SJ",
      "HA",
      "HK",
      "HQ",
      "DA",
      "DK",
      "CA",
      "CK",
      "CQ",
      "CJ",
    );
    const auction = auctionFromBids(Seat.North, ["1NT", "P"]);
    const context: BiddingContext = {
      hand: h,
      auction,
      seat: Seat.South,
      evaluation: evaluateHand(h),
    };

    const result = passStrategy.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
    expect(result!.ruleName).toBeNull();
    expect(result!.explanation).toBeTruthy();
  });

  test("never returns null", () => {
    const h = hand(
      "S2",
      "S3",
      "S4",
      "H2",
      "H3",
      "H4",
      "D2",
      "D3",
      "D4",
      "D5",
      "C2",
      "C3",
      "C4",
    );
    const context: BiddingContext = {
      hand: h,
      auction: { entries: [], isComplete: false },
      seat: Seat.North,
      evaluation: evaluateHand(h),
    };

    const result = passStrategy.suggest(context);
    expect(result).not.toBeNull();
  });
});
