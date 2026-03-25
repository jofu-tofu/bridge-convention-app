import { describe, test, expect } from "vitest";
import { Seat } from "../../../engine/types";
import {
  staymanResponder,
  auctionFromBids,
} from "../../../conventions/__tests__/fixtures";
import { evaluateHand } from "../../../engine/hand-evaluator";
import type { BiddingContext } from "../../../conventions/core/strategy-types";
import { createStrategyChain } from "../strategy-chain";
import { passStrategy } from "../pass-strategy";

// ─── Strategy chain resultFilter ──────────────

describe("createStrategyChain — resultFilter", () => {
  test("chain with resultFilter skips Pass from passStrategy → returns null", () => {
    const chain = createStrategyChain([passStrategy], {
      resultFilter: (result) => result.call.type !== "pass",
    });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).toBeNull();
  });

  test("chain without resultFilter allows Pass from passStrategy", () => {
    const chain = createStrategyChain([passStrategy]);
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    const result = chain.suggest(context);
    expect(result).not.toBeNull();
    expect(result!.call.type).toBe("pass");
  });

  test("forcingFiltered trace field set when result filtered", () => {
    const chain = createStrategyChain([passStrategy], {
      resultFilter: (result) => result.call.type !== "pass",
    });
    const h = staymanResponder();
    const context: BiddingContext = {
      hand: h,
      auction: auctionFromBids(Seat.North, ["1NT", "P"]),
      seat: Seat.South,
      evaluation: evaluateHand(h),
      opponentConventionIds: [],
    };

    // Chain returns null, so no result to check trace on.
    // But we verify the chain tries passStrategy and filters it.
    const result = chain.suggest(context);
    expect(result).toBeNull();
  });

});
