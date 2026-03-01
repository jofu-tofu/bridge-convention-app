import { describe, it, expect } from "vitest";
import { BidSuit, Seat } from "../../engine/types";
import { hand } from "../../engine/__tests__/fixtures";
import { evaluateHand } from "../../engine/hand-evaluator";
import { buildAuction } from "../../engine/auction-helpers";
import { isLegalCall } from "../../engine/auction";
import type { BiddingContext } from "../../conventions/core/types";
import { naturalFallbackStrategy } from "../bidding/natural-fallback";

function makeContext(
  h: ReturnType<typeof hand>,
  bids: string[],
  dealer: Seat = Seat.North,
  seat: Seat = Seat.South,
): BiddingContext {
  return {
    hand: h,
    auction: buildAuction(dealer, bids),
    seat,
    evaluation: evaluateHand(h),
    opponentConventionIds: [],
  };
}

describe("naturalFallbackStrategy", () => {
  it("has correct id and name", () => {
    expect(naturalFallbackStrategy.id).toBe("natural-fallback");
    expect(naturalFallbackStrategy.name).toBe("Natural Fallback");
  });

  it("returns null for hand with less than 6 HCP", () => {
    // 5 HCP: QJ in spades + J in hearts + J in diamonds = 2+1+1+1 = 5
    const weakHand = hand(
      "SQ", "SJ", "S9", "S8", "S7",
      "HJ", "H5", "H3",
      "DJ", "D4", "D3",
      "C5", "C2",
    );
    const ctx = makeContext(weakHand, ["1C", "P", "P"]);

    expect(naturalFallbackStrategy.suggest(ctx)).toBeNull();
  });

  it("bids longest 5+ card suit at cheapest legal level", () => {
    // 10 HCP, 5 spades: AK in spades + Q in diamonds + J in clubs = 4+3+2+1 = 10
    const fiveSpades = hand(
      "SA", "SK", "S8", "S7", "S6",
      "H4", "H3",
      "DQ", "D5", "D3",
      "CJ", "C4", "C2",
    );
    const ctx = makeContext(fiveSpades, ["1C", "P", "P"]);
    const result = naturalFallbackStrategy.suggest(ctx);

    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Spades });
  });

  it("returns null for balanced hand without 5+ card suit", () => {
    // 12 HCP, 4-3-3-3 shape: AK in spades + QJ in hearts = 4+3+2+1 = 10... let me recalc
    // A=4, K=3, Q=2, J=1 = 10 HCP. Need 6+.
    // AK spades (7) + Q hearts (2) + J diamonds (1) = 10 HCP, 4-3-3-3
    const balanced = hand(
      "SA", "SK", "S8", "S7",
      "HQ", "H5", "H3",
      "DJ", "D5", "D3",
      "C7", "C4", "C2",
    );
    const ctx = makeContext(balanced, ["1C", "P", "P"]);

    expect(naturalFallbackStrategy.suggest(ctx)).toBeNull();
  });

  it("suggested bid is always auction-legal", () => {
    // 8 HCP, 6 hearts: K in hearts + Q in diamonds + J in hearts + ...
    // K=3, Q=2, J=1, J=1, J=1 = 8 HCP, 6 hearts
    const sixHearts = hand(
      "SJ", "S4", "S2",
      "HK", "HJ", "H9", "H8", "H7", "H6",
      "DQ", "D3",
      "CJ", "C2",
    );
    // After opponent bids 2H, we can't bid 1H or 2H — need higher
    const ctx = makeContext(sixHearts, ["2H", "P", "P"]);
    const result = naturalFallbackStrategy.suggest(ctx);

    if (result) {
      expect(isLegalCall(ctx.auction, result.call, ctx.seat)).toBe(true);
    }
  });

  it("picks highest-ranking suit when multiple 5+ card suits tied in length", () => {
    // 9 HCP, 5 spades + 5 hearts: K=3+Q=2+J=1+J=1+J=1+T=0 = 8...
    // K=3, K=3, J=1, J=1, J=1 = 9 HCP
    const twoFiveCardSuits = hand(
      "SK", "SJ", "S8", "S7", "S6",
      "HK", "HJ", "H9", "H8", "H7",
      "DJ", "D3",
      "C2",
    );
    const ctx = makeContext(twoFiveCardSuits, ["1C", "P", "P"]);
    const result = naturalFallbackStrategy.suggest(ctx);

    expect(result).not.toBeNull();
    // Spades outranks hearts
    expect(result!.call).toEqual({ type: "bid", level: 1, strain: BidSuit.Spades });
  });

  it("bids at higher level when cheapest level is below current auction", () => {
    // 10 HCP, 5 diamonds
    const fiveDiamonds = hand(
      "SA", "SK", "S4",
      "H7", "H3",
      "DQ", "DJ", "D9", "D8", "D7",
      "C5", "C3", "C2",
    );
    // After 1S bid, 1D is not legal — must bid 2D
    const ctx = makeContext(fiveDiamonds, ["1S", "P", "P"]);
    const result = naturalFallbackStrategy.suggest(ctx);

    expect(result).not.toBeNull();
    expect(result!.call).toEqual({ type: "bid", level: 2, strain: BidSuit.Diamonds });
  });
});
